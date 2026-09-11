const sessaoNotaFiscal = protegerRota();

// Tradução da forma de pagamento salva no banco (código) para um texto
// mais bonito de mostrar no documento.
function formatarFormaPagamento(codigo) {
  const nomes = {
    DINHEIRO: "Dinheiro",
    PIX: "PIX",
    CARTAO_CREDITO: "Cartão de Crédito",
    CARTAO_DEBITO: "Cartão de Débito",
    BOLETO: "Boleto",
  };
  return nomes[codigo] || codigo || "Não informado";
}

async function carregarNotaFiscal() {
  if (!sessaoNotaFiscal) return; // já redirecionou para login.html

  const parametrosUrl = new URLSearchParams(window.location.search);
  const idFaturamento = parametrosUrl.get("id");

  if (!idFaturamento) {
    alert("Nenhum faturamento selecionado.");
    window.close();
    return;
  }

  // 1. Busca APENAS o faturamento primeiro
  const { data: fatura, error: erroFatura } = await supabaseClient
    .from("faturamentos")
    .select("*")
    .eq("faturamentoid", idFaturamento)
    .single();

  if (erroFatura || !fatura) {
    alert("Erro ao carregar os dados da nota fiscal.");
    console.error(erroFatura);
    return;
  }

  // 2. Usa o ID do orçamento contido no faturamento para buscar a lista de itens
  const { data: orcamento, error: erroOrcamento } = await supabaseClient
    .from("orcamentos")
    .select(`
      orcamentoid,
      clientes(nome_cliente, cpf_cnpj_cliente),
      orcamento_item(qt_produto, vl_unitario, vl_total, produtos(ds_produto))
    `)
    .eq("orcamentoid", fatura.orcamentoid)
    .single();

  if (erroOrcamento || !orcamento) {
    alert("Erro ao carregar os dados do orçamento vinculado.");
    console.error(erroOrcamento);
    return;
  }

  // 3. Preenche os textos no cabeçalho da nota
  document.getElementById("doc-numero").textContent = fatura.nr_nota_fiscal || fatura.faturamentoid;
  document.getElementById("doc-faturamento").textContent = fatura.faturamentoid;
  document.getElementById("doc-orcamento").textContent = orcamento.orcamentoid;
  document.getElementById("doc-cliente").textContent = orcamento.clientes?.nome_cliente || "Não informado";
  document.getElementById("doc-cpf").textContent = orcamento.clientes?.cpf_cnpj_cliente || "Não informado";
  
  // Verifica se a data existe antes de formatar para evitar erros
  if (fatura.dt_faturamento) {
    document.getElementById("doc-data").textContent = new Date(fatura.dt_faturamento).toLocaleString("pt-BR");
  } else {
    document.getElementById("doc-data").textContent = "Não registrada";
  }
  
  document.getElementById("doc-pagamento").textContent = formatarFormaPagamento(fatura.forma_pagamento);
  document.getElementById("doc-total").textContent = "R$ " + formatarMoeda(fatura.vl_faturado);

  // 4. Preenche a tabela de itens
  const tbody = document.getElementById("tabela-itens-corpo");
  const itens = orcamento.orcamento_item || [];

  if (itens.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum item encontrado.</td></tr>';
  } else {
    let linhasHTML = "";
    itens.forEach(item => {
      // Usando o escapeHTML do common.js por segurança
      linhasHTML += `
        <tr>
          <td>${escapeHTML(item.produtos?.ds_produto || "Produto Removido")}</td>
          <td>${item.qt_produto}</td>
          <td class="num">R$ ${formatarMoeda(item.vl_unitario)}</td>
          <td class="num">R$ ${formatarMoeda(item.vl_total)}</td>
        </tr>
      `;
    });
    tbody.innerHTML = linhasHTML;
  }

  // Dispara a impressão automaticamente, 1 segundo depois de carregar
  setTimeout(() => {
    window.print();
  }, 1000);
}

// Inicializa a página
window.onload = carregarNotaFiscal;