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

// valor total do orçamento, assim que carrega os dados dele, para usar depois no momento de salvar.
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

  botaoEnviar.disabled = true;


  // insere o registro na tabela "faturamentos"
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

  //checa e desconta o estoque dos produtos do orçamento.
  const resultadoEstoque = await processarAprovacaoDeOrcamento(
    supabaseClient,
    idOrcamento,
  );

  if (!resultadoEstoque.sucesso) {
    // a baixa falhou, desfaz o faturamento criado, para não
    // deixar um registro de faturamento sem a baixa correspondente.
    const { error: erroDesfazer } = await supabaseClient
      .from("faturamentos")
      .delete()
      .eq("faturamentoid", faturamentoCriado.faturamentoid);

    if (erroDesfazer) {
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

  //atualiza o status do orçamento para "FATURADO",
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

});
