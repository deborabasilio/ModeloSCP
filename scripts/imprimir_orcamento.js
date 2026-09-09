// Configuração Supabase
const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");
if (!usuarioLogadoTexto) {
  window.location.href = "login.html";
}

// Formatação de Moeda
function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Busca e carrega os dados
async function carregarImpressao() {
  const parametrosUrl = new URLSearchParams(window.location.search);
  const idOrcamento = parametrosUrl.get("id");

  if (!idOrcamento) {
    alert("Nenhum orçamento selecionado para impressão.");
    window.close();
    return;
  }

  // Busca o orçamento completo
  const { data: orcamento, error } = await supabaseClient
    .from("orcamentos")
    .select(`
          orcamentoid,
          dt_orcamento,
          dt_validade_orcamento,
          vl_total_orcamento,
          status_orcamento,
          clientes(nome_cliente, cpf_cnpj_cliente),
          orcamento_item(qt_produto, vl_unitario, vl_total, produtos(ds_produto))
        `)
    .eq("orcamentoid", idOrcamento)
    .single();

  if (error || !orcamento) {
    alert("Erro ao carregar os dados do orçamento.");
    return;
  }

  // Preenche os textos na tela
  document.getElementById("doc-numero").textContent = orcamento.orcamentoid;
  document.getElementById("doc-cliente").textContent = orcamento.clientes?.nome_cliente || "Não informado";
  document.getElementById("doc-cpf").textContent = orcamento.clientes?.cpf_cnpj_cliente || "Não informado";

  document.getElementById("doc-data").textContent = new Date(orcamento.dt_orcamento).toLocaleDateString("pt-BR");
  document.getElementById("doc-validade").textContent = new Date(orcamento.dt_validade_orcamento).toLocaleDateString("pt-BR");
  document.getElementById("doc-status").textContent = orcamento.status_orcamento;

  document.getElementById("doc-total").textContent = "R$ " + formatarMoeda(orcamento.vl_total_orcamento);

  // Preenche a tabela de itens
  const tbody = document.getElementById("tabela-itens-corpo");
  const itens = orcamento.orcamento_item || [];

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

  // Dispara a janela de impressão automaticamente 1 segundo após carregar os dados
  setTimeout(() => {
    window.print();
  }, 1000);
}

// Inicia a busca assim que a página é carregada
window.onload = carregarImpressao;