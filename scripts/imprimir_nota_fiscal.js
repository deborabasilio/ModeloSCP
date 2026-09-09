// A conexão "supabaseClient" e as funções formatarMoeda/escapeHTML
// agora vêm de scripts/config.js e scripts/common.js.

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

  // Busca o faturamento e, através dele, o orçamento, o cliente e os itens
  const { data: fatura, error } = await supabaseClient
    .from("faturamentos")
    .select(`
      faturamentoid,
      dt_faturamento,
      nr_nota_fiscal,
      forma_pagamento,
      vl_faturado,
      orcamentos(
        orcamentoid,
        clientes(nome_cliente, cpf_cnpj_cliente),
        orcamento_item(qt_produto, vl_unitario, vl_total, produtos(ds_produto))
      )
    `)
    .eq("faturamentoid", idFaturamento)
    .single();

  if (error || !fatura) {
    alert("Erro ao carregar os dados da nota fiscal.");
    console.error(error);
    return;
  }

  const orcamento = fatura.orcamentos;

  // Preenche os textos na tela
  // A referência da nota é gerada a partir do ID do faturamento. Mantemos
  // também o ID separado para facilitar a rastreabilidade no sistema.
  document.getElementById("doc-numero").textContent =
    fatura.nr_nota_fiscal || fatura.faturamentoid;
  document.getElementById("doc-faturamento").textContent = fatura.faturamentoid;
  document.getElementById("doc-orcamento").textContent = orcamento?.orcamentoid ?? "";
  document.getElementById("doc-cliente").textContent = orcamento?.clientes?.nome_cliente || "Não informado";
  document.getElementById("doc-cpf").textContent = orcamento?.clientes?.cpf_cnpj_cliente || "Não informado";
  document.getElementById("doc-data").textContent = new Date(fatura.dt_faturamento).toLocaleString("pt-BR");
  document.getElementById("doc-pagamento").textContent = formatarFormaPagamento(fatura.forma_pagamento);
  document.getElementById("doc-total").textContent = "R$ " + formatarMoeda(fatura.vl_faturado);

  // Preenche a tabela de itens
  const tbody = document.getElementById("tabela-itens-corpo");
  const itens = orcamento?.orcamento_item || [];

  if (itens.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum item encontrado.</td></tr>';
  } else {
    let linhasHTML = "";
    itens.forEach(item => {
      // MELHORIA (XSS): descrição do produto escapada antes do innerHTML.
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

window.onload = carregarNotaFiscal;
