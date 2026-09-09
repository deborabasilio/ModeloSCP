const formFaturamento = document.getElementById("formFaturamento");
const codigoOrcamentoFatInput = document.getElementById("codigoOrcamentoFat");
const clienteFatInput = document.getElementById("clienteFat");
const valorFatInput = document.getElementById("valorFat");
const dataFatInput = document.getElementById("dataFat");
const notaFiscalFatInput = document.getElementById("notaFiscalFat");
const formaPagamentoFatSelect = document.getElementById("formaPagamentoFat");
const obsFatInput = document.getElementById("obsFat");
const mensagem = document.getElementById("mensagem");
const botaoGerarNota = document.getElementById("botao");

const sessaoFaturamento = protegerRota();
const idOrcamento = new URLSearchParams(window.location.search).get("id");

let valorOrcamentoCarregado = 0;
let orcamentoProntoParaFaturar = false;

botaoGerarNota.disabled = true;

if (!idOrcamento) {
  alert("Nenhum orçamento informado para faturamento.");
  window.close();
} else if (sessaoFaturamento) {
  carregarOrcamento(idOrcamento);
}

function urlDaNotaFiscal(idFaturamento) {
  return `imprimir_nota_fiscal.html?id=${encodeURIComponent(idFaturamento)}`;
}

function abrirJanelaDeNota() {
  const janelaNota = window.open("", "_blank");

  if (janelaNota) {
    janelaNota.document.title = "Gerando nota fiscal";
    janelaNota.document.body.textContent = "Gerando nota fiscal...";
  }

  return janelaNota;
}

function mostrarAcessoNota(idFaturamento, numeroNota) {
  const urlNota = urlDaNotaFiscal(idFaturamento);
  mensagem.textContent = `Nota fiscal nº ${numeroNota} gerada com sucesso. `;
  mensagem.className = "sucesso";

  const linkNota = document.createElement("a");
  linkNota.href = urlNota;
  linkNota.target = "_blank";
  linkNota.rel = "noopener";
  linkNota.textContent = "Abrir documento para salvar em PDF";
  mensagem.appendChild(linkNota);
}

function fecharJanelaDeNota(janelaNota) {
  if (janelaNota && !janelaNota.closed) {
    janelaNota.close();
  }
}

function finalizarFormulario() {
  formFaturamento
    .querySelectorAll("select, textarea, button[type=submit]")
    .forEach((campo) => {
      campo.disabled = true;
    });
}

async function carregarOrcamento(id) {
  mensagem.textContent = "Carregando dados do orçamento...";
  mensagem.className = "";

  const { data: orcamento, error } = await supabaseClient
    .from("orcamentos")
    .select("orcamentoid, status_orcamento, vl_total_orcamento, clientes(nome_cliente)")
    .eq("orcamentoid", id)
    .single();

  if (error || !orcamento) {
    mensagem.textContent = "Não foi possível carregar este orçamento.";
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  if (orcamento.status_orcamento !== "APROVADO") {
    mensagem.textContent = "Somente orçamentos aprovados podem ser faturados.";
    mensagem.className = "erro";
    return;
  }

  codigoOrcamentoFatInput.value = orcamento.orcamentoid;
  clienteFatInput.value = orcamento.clientes?.nome_cliente || "";
  valorFatInput.value = "R$ " + formatarMoeda(orcamento.vl_total_orcamento);
  dataFatInput.value = new Date().toLocaleString("pt-BR");
  valorOrcamentoCarregado = Number(orcamento.vl_total_orcamento) || 0;
  orcamentoProntoParaFaturar = true;
  botaoGerarNota.disabled = false;
  mensagem.textContent = "";
}

formFaturamento.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  if (!orcamentoProntoParaFaturar) {
    mensagem.textContent = "Aguarde o carregamento do orçamento.";
    mensagem.className = "erro";
    return;
  }

  const formaPagamento = formaPagamentoFatSelect.value;
  if (!formaPagamento) {
    mensagem.textContent = "Selecione a forma de pagamento.";
    mensagem.className = "erro";
    return;
  }

  // A janela é aberta durante o clique do usuário para não ser bloqueada
  // como pop-up após as operações assíncronas.
  const janelaNota = abrirJanelaDeNota();
  botaoGerarNota.disabled = true;
  mensagem.textContent = "Gerando faturamento e nota fiscal...";
  mensagem.className = "";

  // Revalida o status e evita uma segunda geração em uma aba já concluída.
  const { data: orcamentoAtual, error: erroConsultaOrcamento } = await supabaseClient
    .from("orcamentos")
    .select("status_orcamento")
    .eq("orcamentoid", idOrcamento)
    .single();

  if (erroConsultaOrcamento || !orcamentoAtual || orcamentoAtual.status_orcamento !== "APROVADO") {
    mensagem.textContent = "Este orçamento não está mais disponível para faturamento.";
    mensagem.className = "erro";
    console.error(erroConsultaOrcamento);
    fecharJanelaDeNota(janelaNota);
    botaoGerarNota.disabled = false;
    return;
  }

  const { data: faturamentoExistente, error: erroBuscaFaturamento } = await supabaseClient
    .from("faturamentos")
    .select("faturamentoid, nr_nota_fiscal")
    .eq("orcamentoid", idOrcamento)
    .maybeSingle();

  if (erroBuscaFaturamento) {
    mensagem.textContent = "Não foi possível verificar os faturamentos existentes.";
    mensagem.className = "erro";
    console.error(erroBuscaFaturamento);
    fecharJanelaDeNota(janelaNota);
    botaoGerarNota.disabled = false;
    return;
  }

  if (faturamentoExistente) {
    const numeroExistente = faturamentoExistente.nr_nota_fiscal || faturamentoExistente.faturamentoid;

    if (!faturamentoExistente.nr_nota_fiscal) {
      const { error: erroNumeroExistente } = await supabaseClient
        .from("faturamentos")
        .update({ nr_nota_fiscal: numeroExistente })
        .eq("faturamentoid", faturamentoExistente.faturamentoid);

      if (erroNumeroExistente) {
        mensagem.textContent = "Já existe um faturamento, mas não foi possível gerar o número da nota.";
        mensagem.className = "erro";
        console.error(erroNumeroExistente);
        fecharJanelaDeNota(janelaNota);
        return;
      }
    }

    // Corrige uma eventual inconsistência antiga: se já existe faturamento,
    // o orçamento correspondente precisa permanecer marcado como faturado.
    const { data: orcamentoAtualizado, error: erroAtualizacaoExistente } = await supabaseClient
      .from("orcamentos")
      .update({ status_orcamento: "FATURADO" })
      .eq("orcamentoid", idOrcamento)
      .eq("status_orcamento", "APROVADO")
      .select("orcamentoid");

    if (erroAtualizacaoExistente || !orcamentoAtualizado?.length) {
      mensagem.textContent = "Já existe um faturamento, mas não foi possível atualizar o status do orçamento.";
      mensagem.className = "erro";
      console.error(erroAtualizacaoExistente);
      fecharJanelaDeNota(janelaNota);
      return;
    }

    notaFiscalFatInput.value = numeroExistente;
    mostrarAcessoNota(faturamentoExistente.faturamentoid, numeroExistente);
    if (janelaNota) janelaNota.location.href = urlDaNotaFiscal(faturamentoExistente.faturamentoid);
    finalizarFormulario();
    return;
  }

  const dadosFaturamento = {
    orcamentoid: idOrcamento,
    nr_nota_fiscal: null,
    forma_pagamento: formaPagamento,
    vl_faturado: valorOrcamentoCarregado,
    observacao_faturamento: obsFatInput.value.trim() || null,
  };

  const { data: faturamentoGerado, error: erroFaturamento } = await supabaseClient
    .from("faturamentos")
    .insert(dadosFaturamento)
    .select("faturamentoid")
    .single();

  if (erroFaturamento || !faturamentoGerado) {
    mensagem.textContent = "Erro ao gerar faturamento: " + (erroFaturamento?.message || "registro não retornado.");
    mensagem.className = "erro";
    console.error(erroFaturamento);
    fecharJanelaDeNota(janelaNota);
    botaoGerarNota.disabled = false;
    return;
  }

  // O ID do faturamento vira uma referência rastreável para a nota simulada.
  const numeroNota = faturamentoGerado.faturamentoid;
  const { error: erroNumeroNota } = await supabaseClient
    .from("faturamentos")
    .update({ nr_nota_fiscal: numeroNota })
    .eq("faturamentoid", faturamentoGerado.faturamentoid);

  if (erroNumeroNota) {
    mensagem.textContent = "Faturamento salvo, mas não foi possível gerar o número da nota: " + erroNumeroNota.message;
    mensagem.className = "erro";
    console.error(erroNumeroNota);
    fecharJanelaDeNota(janelaNota);
    return;
  }

  const { data: orcamentosAtualizados, error: erroOrcamento } = await supabaseClient
    .from("orcamentos")
    .update({ status_orcamento: "FATURADO" })
    .eq("orcamentoid", idOrcamento)
    .eq("status_orcamento", "APROVADO")
    .select("orcamentoid");

  if (erroOrcamento || !orcamentosAtualizados?.length) {
    const detalheErro =
      erroOrcamento?.message || "o orçamento foi alterado por outra operação.";
    mensagem.textContent = "Faturamento e nota salvos, mas houve erro ao atualizar o orçamento: " + detalheErro;
    mensagem.className = "erro";
    console.error(erroOrcamento);
    fecharJanelaDeNota(janelaNota);
    return;
  }

  notaFiscalFatInput.value = numeroNota;
  dataFatInput.value = new Date().toLocaleString("pt-BR");
  mostrarAcessoNota(faturamentoGerado.faturamentoid, numeroNota);
  finalizarFormulario();

  if (janelaNota) {
    janelaNota.location.href = urlDaNotaFiscal(faturamentoGerado.faturamentoid);
  }
});
