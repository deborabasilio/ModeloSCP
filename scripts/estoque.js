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
  // suficiente. Agora sim descontamos de verdade.
  for (let item of itens) {
    const { data: produto } = await supabaseClientAtual
      .from("produtos")
      .select("qt_estoque_produto")
      .eq("produtoid", item.produtoid)
      .single();

    if (produto && produto.qt_estoque_produto !== undefined) {
      const novoEstoque = produto.qt_estoque_produto - item.qt_produto;

      await supabaseClientAtual
        .from("produtos")
        .update({ qt_estoque_produto: novoEstoque })
        .eq("produtoid", item.produtoid);
    }
  }

  return { sucesso: true };
}