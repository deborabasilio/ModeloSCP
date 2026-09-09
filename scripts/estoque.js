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

    const { data: linhasAtualizadas } = await supabaseClientAtual
      .from("produtos")
      .update({ qt_estoque_produto: novoEstoque })
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
