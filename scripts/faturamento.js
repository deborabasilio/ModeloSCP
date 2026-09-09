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

// =====================================================
// PROTEÇÃO DE ROTA: só entra quem estiver logado
// =====================================================
const sessaoFaturamento = protegerRota();

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
} else if (sessaoFaturamento) {
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
  const botaoEnviar = formFaturamento.querySelector("button[type=submit]");

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

  // MELHORIA: trava o botão logo no início para evitar duplo clique
  // gerando dois faturamentos para o mesmo orçamento.
  botaoEnviar.disabled = true;

  // MELHORIA (integridade de estoque / retry seguro): o registro de
  // faturamento é criado ANTES da baixa de estoque, não depois. Ele
  // funciona como o "recibo" que garante o invariante "existe um
  // faturamento para este orçamento SE E SOMENTE SE o estoque dele já
  // foi descontado". Se a baixa (passo 2) falhar, desfazemos esse
  // insert (passo 2b) antes de liberar uma nova tentativa — assim uma
  // nova tentativa sempre parte do zero (nada criado, nada descontado)
  // e nunca desconta o mesmo estoque duas vezes.

  // Passo 1: insere o registro na tabela "faturamentos"
  const { data: faturamentoCriado, error: erroFaturamento } =
    await supabaseClient
      .from("faturamentos")
      .insert(dadosFaturamento)
      .select("faturamentoid")
      .single();

  if (erroFaturamento) {
    mensagem.textContent = "Erro ao gerar faturamento: " + erroFaturamento.message;
    mensagem.className = "erro";
    console.error(erroFaturamento);
    botaoEnviar.disabled = false; // nada foi criado, tentar de novo é seguro
    return;
  }

  // Passo 2: checa e desconta o estoque dos produtos do orçamento. A
  // checagem e a baixa vêm de uma função compartilhada, em
  // scripts/estoque.js, já protegida contra concorrência.
  const resultadoEstoque = await processarAprovacaoDeOrcamento(
    supabaseClient,
    idOrcamento,
  );

  if (!resultadoEstoque.sucesso) {
    // Passo 2b: a baixa falhou (ex.: estoque insuficiente ou conflito de
    // concorrência) -> desfaz o faturamento criado no passo 1, para não
    // deixar um registro de faturamento sem a baixa correspondente.
    const { error: erroDesfazer } = await supabaseClient
      .from("faturamentos")
      .delete()
      .eq("faturamentoid", faturamentoCriado.faturamentoid);

    if (erroDesfazer) {
      // Não conseguimos nem desfazer o insert: mais seguro travar o
      // botão e pedir revisão manual do que arriscar duplicar o
      // faturamento numa nova tentativa.
      mensagem.textContent =
        resultadoEstoque.mensagem +
        " Além disso, não foi possível cancelar automaticamente o registro de faturamento já criado (erro: " +
        erroDesfazer.message +
        "). Avise um administrador antes de tentar faturar este orçamento de novo.";
      mensagem.className = "erro";
      console.error(erroDesfazer);
      return; // botão continua travado de propósito
    }

    mensagem.textContent = resultadoEstoque.mensagem;
    mensagem.className = "erro";
    botaoEnviar.disabled = false; // desfeito com sucesso, tentar de novo é seguro
    return;
  }

  // Passo 3: atualiza o status do orçamento para "FATURADO",
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
    // Propositalmente NÃO reabilitamos o botão aqui: o faturamento já
    // foi gravado, então faturar de novo criaria um registro duplicado.
    return;
  }

  mensagem.textContent = "Faturamento gerado com sucesso!";
  mensagem.className = "sucesso";

  // Trava o formulário depois de faturar, já que não faz sentido
  // faturar o mesmo orçamento de novo na mesma tela.
});

/*
  =====================================================
  BOTÃO VOLTAR: FECHA A ABA (vem de scripts/common.js)
  =====================================================
*/