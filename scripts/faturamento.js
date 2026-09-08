/*
  =====================================================
  CONFIGURAÇÃO DO SUPABASE (igual às outras páginas)
  =====================================================
*/
const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*
  =====================================================
  PEGANDO OS ELEMENTOS DO HTML
  =====================================================
*/
const formFaturamento = document.getElementById("formFaturamento");
const codigoOrcamentoFatInput = document.getElementById("codigoOrcamentoFat");
const clienteFatInput = document.getElementById("clienteFat");
const valorFatInput = document.getElementById("valorFat");
const dataFatInput = document.getElementById("dataFat");
const notaFiscalFatInput = document.getElementById("notaFiscalFat");
const formaPagamentoFatSelect = document.getElementById("formaPagamentoFat");
const obsFatInput = document.getElementById("obsFat");
const mensagem = document.getElementById("mensagem");

// Formata número para o padrão de dinheiro brasileiro (R$ 1.234,56)
function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// =====================================================
// PROTEÇÃO DE ROTA: só entra quem estiver logado
// =====================================================
const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");

if (!usuarioLogadoTexto) {
  window.location.href = "login.html";
}

// =====================================================
// LÊ O "?id=" DA URL (o botão "Faturar" da listagem manda
// o código do orçamento nessa URL)
// =====================================================
const parametrosUrl = new URLSearchParams(window.location.search);
const idOrcamento = parametrosUrl.get("id");

// Vamos guardar aqui o valor total do orçamento, assim que carregarmos
// os dados dele, para usar depois no momento de salvar.
let valorOrcamentoCarregado = 0;

if (!idOrcamento) {
  alert("Nenhum orçamento informado para faturamento.");
  window.close();
} else {
  carregarOrcamento(idOrcamento);
}

/*
  =====================================================
  BUSCA OS DADOS DO ORÇAMENTO NO BANCO E PREENCHE A TELA
  =====================================================
*/
async function carregarOrcamento(id) {
  mensagem.textContent = "Carregando dados do orçamento...";
  mensagem.className = "";

  const { data: orcamento, error } = await supabaseClient
    .from("orcamentos")
    .select("orcamentoid, status_orcamento, vl_total_orcamento, clientes(nome_cliente)")
    .eq("orcamentoid", id)
    .single();

  if (error || !orcamento) {
    alert("Não foi possível carregar este orçamento.");
    window.close();
    return;
  }

  // Só deixa faturar orçamento que está APROVADO. Isso evita, por
  // exemplo, faturar um orçamento que ainda está pendente ou que já
  // foi reprovado.
  if (orcamento.status_orcamento !== "APROVADO") {
    alert("Somente orçamentos com status APROVADO podem ser faturados.");
    window.close();
    return;
  }

  codigoOrcamentoFatInput.value = orcamento.orcamentoid;
  clienteFatInput.value = orcamento.clientes?.nome_cliente || "";
  valorFatInput.value = "R$ " + formatarMoeda(orcamento.vl_total_orcamento);
  dataFatInput.value = new Date().toLocaleString("pt-BR");

  valorOrcamentoCarregado = orcamento.vl_total_orcamento;

  mensagem.textContent = "";
  mensagem.className = "";
}

/*
  =====================================================
  EVENTO DE ENVIO DO FORMULÁRIO
  =====================================================
*/
formFaturamento.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const formaPagamento = formaPagamentoFatSelect.value;

  if (!formaPagamento) {
    mensagem.textContent = "Selecione a forma de pagamento.";
    mensagem.className = "erro";
    return;
  }

  const dadosFaturamento = {
    orcamentoid: idOrcamento,
    nr_nota_fiscal: notaFiscalFatInput.value.trim() || null,
    forma_pagamento: formaPagamento,
    vl_faturado: valorOrcamentoCarregado,
    observacao_faturamento: obsFatInput.value.trim() || null,
  };

  // Passo 1: insere o registro na tabela "faturamentos"
  const { error: erroFaturamento } = await supabaseClient
    .from("faturamentos")
    .insert(dadosFaturamento);

  if (erroFaturamento) {
    mensagem.textContent = "Erro ao gerar faturamento: " + erroFaturamento.message;
    mensagem.className = "erro";
    console.error(erroFaturamento);
    return;
  }

  // Passo 2: atualiza o status do orçamento para "FATURADO",
  // pra ele sair da lista de "aprovados aguardando faturamento"
  const { error: erroOrcamento } = await supabaseClient
    .from("orcamentos")
    .update({ status_orcamento: "FATURADO" })
    .eq("orcamentoid", idOrcamento);

  if (erroOrcamento) {
    mensagem.textContent =
      "Faturamento salvo, mas houve erro ao atualizar o status do orçamento: " +
      erroOrcamento.message;
    mensagem.className = "erro";
    console.error(erroOrcamento);
    return;
  }

  mensagem.textContent = "Faturamento gerado com sucesso!";
  mensagem.className = "sucesso";

  // Trava o formulário depois de faturar, já que não faz sentido
  // faturar o mesmo orçamento de novo na mesma tela.
  formFaturamento.querySelector("button[type=submit]").disabled = true;
});

/*
  =====================================================
  FORÇAR LETRAS MAIÚSCULAS NOS CAMPOS DE TEXTO
  (igual às outras páginas do sistema)
  =====================================================
*/
document.addEventListener("DOMContentLoaded", function () {
  const camposTexto = document.querySelectorAll('input[type="text"], textarea');
  camposTexto.forEach((campo) => {
    campo.addEventListener("input", function () {
      const inicioCursor = this.selectionStart;
      const fimCursor = this.selectionEnd;
      this.value = this.value.toUpperCase();
      this.setSelectionRange(inicioCursor, fimCursor);
    });
  });
});

/*
  =====================================================
  BOTÃO VOLTAR: FECHA A ABA (igual às outras páginas)
  =====================================================
*/
document.getElementById("botaoVoltarForm")?.addEventListener("click", function () {
  window.close();
  setTimeout(() => {
    window.location.href = "menu.html";
  }, 300);
});