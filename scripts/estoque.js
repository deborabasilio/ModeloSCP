/*
  =====================================================
  FUNÇÃO COMPARTILHADA: FATURAR ORÇAMENTO (BAIXA DE ESTOQUE)
  =====================================================
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
  // suficiente na conferência acima. cada UPDATE só é aplicado SE o estoque, no banco, ainda for
  // suficiente naquele instante.
  const produtosComConflito = [];

  for (let item of itens) {
    const { data: produto } = await supabaseClientAtual
      .from("produtos")
      .select("ds_produto, qt_estoque_produto")
      .eq("produtoid", item.produtoid)
      .single();

    if (!produto || produto.qt_estoque_produto === undefined) continue;

    const novoEstoque = produto.qt_estoque_produto - item.qt_produto;

    //se essa baixa zerar o estoque do produto, ele é marcado
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