// Configuração Supabase (igual às outras páginas)
const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");
if (!usuarioLogadoTexto) {
  window.location.href = "login.html";
}

// Formatação de moeda
function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

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
  document.getElementById("doc-numero").textContent = fatura.faturamentoid;
  document.getElementById("doc-orcamento").textContent = orcamento?.orcamentoid ?? "";
  document.getElementById("doc-cliente").textContent = orcamento?.clientes?.nome_cliente || "Não informado";
  document.getElementById("doc-cpf").textContent = orcamento?.clientes?.cpf_cnpj_cliente || "Não informado";
  document.getElementById("doc-data").textContent = new Date(fatura.dt_faturamento).toLocaleString("pt-BR");
  document.getElementById("doc-pagamento").textContent = formatarFormaPagamento(fatura.forma_pagamento);
  document.getElementById("doc-notafiscal").textContent = fatura.nr_nota_fiscal || "Não informado";
  document.getElementById("doc-total").textContent = "R$ " + formatarMoeda(fatura.vl_faturado);

  // Preenche a tabela de itens
  const tbody = document.getElementById("tabela-itens-corpo");
  const itens = orcamento?.orcamento_item || [];

  if (itens.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum item encontrado.</td></tr>';
  } else {
    let linhasHTML = "";
    itens.forEach(item => {
      linhasHTML += `
        <tr>
          <td>${item.produtos?.ds_produto || "Produto Removido"}</td>
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