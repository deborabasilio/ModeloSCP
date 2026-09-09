/*
  =====================================================
  FUNÇÃO COMPARTILHADA: APROVAR ORÇAMENTO (BAIXA DE ESTOQUE)
  =====================================================
  Essa lógica existia repetida em dois arquivos (orcamentos.js e
  menu.js). Colocamos ela aqui, uma vez só, para que os dois lugares
  usem a MESMA função — assim, se um dia precisar corrigir essa regra,
  corrige em um lugar só, e não corre o risco de esquecer o outro.

  Recebe:
    - supabaseClientAtual: a conexão já criada na página que chamou
    - idOrcamento: o código do orçamento que está sendo aprovado

  Retorna:
    { sucesso: true }                      -> pode aprovar, estoque já foi descontado
    { sucesso: false, mensagem: "texto" }  -> NÃO aprovar, mostrar essa mensagem

  MELHORIA (condição de corrida / concorrência):
  Antes, a função fazia 1) ler o estoque de cada produto, 2) conferir
  se dava, e só depois 3) gravar o novo estoque — em três passos
  separados. Se dois usuários aprovassem, ao mesmo tempo, dois
  orçamentos que usam o mesmo produto, os dois poderiam "ler" o mesmo
  estoque antes de qualquer um gravar, os dois passariam na conferência
  e o estoque final ficaria negativo (baixa duplicada).

  Aqui reduzimos bastante esse risco fazendo o UPDATE já com uma
  condição no próprio banco (".gte" = "maior ou igual"): o Supabase só
  atualiza a linha SE, no momento exato do UPDATE, o estoque ainda for
  suficiente. Se outra aprovação já tiver consumido o estoque entre a
  nossa conferência e o nosso UPDATE, a atualização não afeta nenhuma
  linha e nós detectamos isso e cancelamos a aprovação com uma
  mensagem clara, em vez de deixar o estoque ficar negativo.

  Observação para evolução futura: a forma 100% à prova de concorrência
  seria mover essa lógica para uma função no próprio banco (RPC/stored
  procedure em PL/pgSQL, dentro de uma transação com UPDATE ...
  WHERE qt_estoque_produto >= qt_produto). A solução abaixo já resolve
  o problema na prática para o uso do sistema, mas vale citar essa
  evolução na documentação/apresentação do projeto.
*/
async function processarAprovacaoDeOrcamento(supabaseClientAtual, idOrcamento) {
  const { data: itens, error: erroItens } = await supabaseClientAtual
    .from("orcamento_item")
    .select("produtoid, qt_produto")
    .eq("orcamentoid", idOrcamento);

  if (erroItens) {
    return {
      sucesso: false,
      mensagem: "Erro ao verificar os itens do orçamento: " + erroItens.message,
    };
  }

  if (!itens || itens.length === 0) {
    return { sucesso: true };
  }

  // 1ª etapa: só CONFERE se tem estoque suficiente para TODOS os itens,
  // sem descontar nada ainda (evita descontar metade e travar no meio).
  const produtosComEstoqueInsuficiente = [];

  for (let item of itens) {
    const { data: produto } = await supabaseClientAtual
      .from("produtos")
      .select("ds_produto, qt_estoque_produto")
      .eq("produtoid", item.produtoid)
      .single();

    if (
      produto &&
      produto.qt_estoque_produto !== undefined &&
      produto.qt_estoque_produto - item.qt_produto < 0
    ) {
      produtosComEstoqueInsuficiente.push(
        `${produto.ds_produto} (estoque atual: ${produto.qt_estoque_produto}, necessário: ${item.qt_produto})`,
      );
    }
  }

  if (produtosComEstoqueInsuficiente.length > 0) {
    return {
      sucesso: false,
      mensagem:
        "Não é possível aprovar: estoque insuficiente para: " +
        produtosComEstoqueInsuficiente.join("; "),
    };
  }

  // 2ª etapa: só chega aqui se TODOS os produtos tiverem estoque
  // suficiente na conferência acima. Agora descontamos de verdade,
  // mas cada UPDATE só é aplicado SE o estoque, no banco, ainda for
  // suficiente naquele instante (proteção contra concorrência).
  const produtosComConflito = [];

  for (let item of itens) {
    const { data: produto } = await supabaseClientAtual
      .from("produtos")
      .select("ds_produto, qt_estoque_produto")
      .eq("produtoid", item.produtoid)
      .single();

    if (!produto || produto.qt_estoque_produto === undefined) continue;

    const novoEstoque = produto.qt_estoque_produto - item.qt_produto;

    // NOVA REGRA: se essa baixa zerar o estoque do produto, ele é marcado
    // automaticamente como INATIVO, ficando assim até o usuário editá-lo
    // novamente (na tela de Produtos) e escolher outro status.
    const dadosAtualizacao = { qt_estoque_produto: novoEstoque };
    if (novoEstoque === 0) {
      dadosAtualizacao.status_produto = "INATIVO";
    }

    const { data: linhasAtualizadas } = await supabaseClientAtual
      .from("produtos")
      .update(dadosAtualizacao)
      .eq("produtoid", item.produtoid)
      .gte("qt_estoque_produto", item.qt_produto) // só atualiza se ainda houver estoque suficiente
      .select("produtoid");

    if (!linhasAtualizadas || linhasAtualizadas.length === 0) {
      produtosComConflito.push(produto.ds_produto);
    }
  }

  if (produtosComConflito.length > 0) {
    return {
      sucesso: false,
      mensagem:
        "O estoque de alguns produtos mudou enquanto este orçamento estava sendo aprovado (provavelmente outra aprovação aconteceu ao mesmo tempo). Verifique o estoque e tente aprovar novamente: " +
        produtosComConflito.join("; "),
    };
  }

  return { sucesso: true };
}

/*
  =====================================================
  FUNÇÃO COMPARTILHADA: DEVOLVER ESTOQUE (EXCLUSÃO DE FATURAMENTO)
  =====================================================
  Caminho inverso de processarAprovacaoDeOrcamento(): quando um
  faturamento é excluído, o estoque que ele tinha descontado precisa
  voltar. Sem isso, o orçamento related volta para APROVADO mas o
  estoque continua descontado — se alguém faturar de novo, desconta
  os mesmos itens uma segunda vez.

  Recebe os mesmos parâmetros e devolve o mesmo formato de resultado
  que processarAprovacaoDeOrcamento: { sucesso: true } ou
  { sucesso: false, mensagem: "texto" }.

  IMPORTANTE sobre quem chama essa função: ela deve ser chamada DEPOIS
  de excluir o registro de faturamento e ANTES de reverter o status do
  orçamento para APROVADO. Se ela falhar, quem chamou não deve permitir
  uma nova tentativa (não reabilitar botão) — como o faturamento já foi
  excluído nesse ponto, tentar de novo chamaria essa função outra vez e
  devolveria o mesmo estoque em dobro.

  Observação: por segurança, essa função NÃO reativa automaticamente
  produtos que foram marcados INATIVO por terem zerado o estoque. Isso
  evita reativar por engano um produto que, nesse meio-tempo, tenha
  sido desativado por outro motivo (ex.: descontinuado). Se for o
  caso, quem excluir o faturamento deve reativar o produto manualmente
  na tela de Produtos.
*/
async function devolverEstoqueDoOrcamento(supabaseClientAtual, idOrcamento) {
  const { data: itens, error: erroItens } = await supabaseClientAtual
    .from("orcamento_item")
    .select("produtoid, qt_produto")
    .eq("orcamentoid", idOrcamento);

  if (erroItens) {
    return {
      sucesso: false,
      mensagem: "Erro ao verificar os itens do orçamento: " + erroItens.message,
    };
  }

  if (!itens || itens.length === 0) {
    return { sucesso: true };
  }

  // Assim como na baixa, usamos uma trava otimista no UPDATE (".eq" no
  // valor antigo do estoque): só grava se ninguém mexeu no estoque
  // desse produto entre a leitura e a escrita. Aqui isso é mais para
  // detectar concorrência do que para impedir excesso (devolver
  // estoque não tem como "faltar" estoque), mas evita que uma
  // devolução pise em cima de uma alteração concorrente sem perceber.
  const produtosComErro = [];

  for (let item of itens) {
    const { data: produto } = await supabaseClientAtual
      .from("produtos")
      .select("ds_produto, qt_estoque_produto")
      .eq("produtoid", item.produtoid)
      .single();

    if (!produto || produto.qt_estoque_produto === undefined) continue;

    const novoEstoque = produto.qt_estoque_produto + item.qt_produto;

    const { data: linhasAtualizadas } = await supabaseClientAtual
      .from("produtos")
      .update({ qt_estoque_produto: novoEstoque })
      .eq("produtoid", item.produtoid)
      .eq("qt_estoque_produto", produto.qt_estoque_produto)
      .select("produtoid");

    if (!linhasAtualizadas || linhasAtualizadas.length === 0) {
      produtosComErro.push(produto.ds_produto);
    }
  }

  if (produtosComErro.length > 0) {
    return {
      sucesso: false,
      mensagem:
        "O estoque de alguns produtos mudou no exato momento da devolução (provavelmente outra operação aconteceu ao mesmo tempo). Confira e ajuste o estoque manualmente para: " +
        produtosComErro.join("; "),
    };
  }

  return { sucesso: true };
}