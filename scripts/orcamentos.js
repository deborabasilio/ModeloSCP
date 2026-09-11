const TABELA_ORCAMENTO = "orcamentos";
const TABELA_ITENS = "orcamento_item";
const TABELA_CLIENTES = "clientes";
const TABELA_PRODUTOS = "produtos";

const formOrcamento = document.getElementById("formOrcamento");
const codigoOrcamentoInput = document.getElementById("codigoOrcamento");
const clienteSelecSelect = document.getElementById("clienteSelec");
const clienteSelecIdInput = document.getElementById("clienteSelecId");
const dataOrcamentoInput = document.getElementById("dataOrcamento");
const statusOrcamentoSelect = document.getElementById("statusOrcamento");
const grupoStatusOrcamento = document.getElementById("grupoStatusOrcamento");
const validadeOrcamentoInput = document.getElementById("validadeOrcamento");

const produtoOrcSelect = document.getElementById("produtoOrc");
const produtoOrcIdInput = document.getElementById("produtoOrcId");
const descProdutoOrcInput = document.getElementById("descProdutoOrc");
const qtdeProdutoOrcInput = document.getElementById("qtdeProdutoOrc");
const valorUnitarioInput = document.getElementById("valorUnitario");
const valorTotalItemInput = document.getElementById("valorTotalItem");
const btnAdicionarItem = document.getElementById("btnAdicionarItem");
const corpoListaItens = document.getElementById("corpoListaItens");
const valorTotalOrcamentoInput = document.getElementById("valorTotalOrcamento");
const descontoOrcamentoInput = document.getElementById("descontoOrcamento");
const valorFinalOrcamentoInput = document.getElementById("valorFinalOrcamento");

const mensagem = document.getElementById("mensagem");

const areaVisualizacao = document.getElementById("areaVisualizacao");
const visCodigo = document.getElementById("visCodigo");
const visCliente = document.getElementById("visCliente");
const visTelefone = document.getElementById("visTelefone");
const visEndereco = document.getElementById("visEndereco");
const visData = document.getElementById("visData");
const visValidade = document.getElementById("visValidade");
const visStatus = document.getElementById("visStatus");
const visDesconto = document.getElementById("visDesconto");
const visCorpoItens = document.getElementById("visCorpoItens");
const visTotal = document.getElementById("visTotal");
const visAcoesAprovacao = document.getElementById("visAcoesAprovacao");
const btnAprovarOrcamento = document.getElementById("btnAprovarOrcamento");
const btnReprovarOrcamento = document.getElementById("btnReprovarOrcamento");
const btnImprimirVis = document.getElementById("btnImprimirVis"); // Botão de imprimir na visualização

let itensDoOrcamento = [];

// Guarda o ID do orçamento quando esta editando (null = cadastro novo)
let idOrcamentoEmEdicao = null;
const botaoSalvarOrcamento = document.getElementById("botaoSalvarOrcamento");

// =====================================================
// PROTEÇÃO DE ROTA E PERMISSÕES
// =====================================================
const sessaoOrcamento = protegerRota();
if (sessaoOrcamento) {
  bloquearEdicaoSemPermissao(sessaoOrcamento.podeEditar, true);
}

// Converte o que foi digitado no campo de desconto (aceita "10", "10,5"
// ou "10.5") em um número entre 0 e 100.
function converterPercentualParaNumero(valorDigitado) {
  if (!valorDigitado) return 0;

  const somenteNumero = String(valorDigitado).replace(/[^\d,.-]/g, "");
  const numero = Number(
    somenteNumero.includes(",")
      ? somenteNumero.replace(/\./g, "").replace(",", ".")
      : somenteNumero,
  );

  if (isNaN(numero)) return 0;

  // Não deixa o desconto passar de 0% a 100%
  return Math.min(Math.max(numero, 0), 100);
}

// Guarda o subtotal (soma dos itens, sem desconto) para recalcular o
// valor final sempre que o usuário mudar a % de desconto.
let subtotalAtualOrcamento = 0;

// Recalcula e exibe o "Valor Total com Desconto" a partir do subtotal
// atual dos itens e da % digitada no campo de desconto.
function recalcularValorFinalOrcamento() {
  const percentualDesconto = converterPercentualParaNumero(
    descontoOrcamentoInput.value,
  );
  const valorComDesconto =
    subtotalAtualOrcamento -
    (subtotalAtualOrcamento * percentualDesconto) / 100;

  valorFinalOrcamentoInput.value = "R$ " + formatarMoeda(valorComDesconto);

  return valorComDesconto;
}

descontoOrcamentoInput.addEventListener("input", recalcularValorFinalOrcamento);

dataOrcamentoInput.value = new Date().toLocaleString("pt-BR");

async function mostrarProximoCodigo() {
  const { count, error } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .select("*", { count: "exact", head: true });

  if (error) {
    codigoOrcamentoInput.value = "";
    console.error(error);
    return;
  }

  codigoOrcamentoInput.value = (count ?? 0) + 1;
}

async function carregarClientes() {
  const { data, error } = await supabaseClient
    .from(TABELA_CLIENTES)
    .select("clienteid, nome_cliente")
    .order("nome_cliente", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const listaClientesEl = document.getElementById("listaClientes");
  listaClientesEl.innerHTML = "";

  data.forEach((cliente) => {
    const opcao = document.createElement("option");
    opcao.value = `${cliente.nome_cliente} (Código: ${cliente.clienteid})`;
    listaClientesEl.appendChild(opcao);
  });
}

// Assim que o texto digitado bate com um cliente da lista
clienteSelecSelect.addEventListener("input", function () {
  const codigo = extrairCodigoDoTexto(clienteSelecSelect.value);

  if (codigo) {
    clienteSelecSelect.value = clienteSelecSelect.value.replace(
      /\s*\(Código:\s*\d+\)\s*$/,
      "",
    );
  }

  clienteSelecIdInput.value = codigo || "";
});

let mapaProdutosPorId = {};

async function carregarProdutos() {
  const { data, error } = await supabaseClient
    .from(TABELA_PRODUTOS)
    .select("produtoid, ds_produto, vl_venda_produto")
    .eq("status_produto", "ATIVO")
    .order("ds_produto", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const listaProdutosEl = document.getElementById("listaProdutosOrc");
  listaProdutosEl.innerHTML = "";
  mapaProdutosPorId = {};

  data.forEach((produto) => {
    mapaProdutosPorId[produto.produtoid] = {
      descricao: produto.ds_produto,
      valor: produto.vl_venda_produto,
    };

    const opcao = document.createElement("option");
    opcao.value = `${produto.ds_produto} (Código: ${produto.produtoid})`;
    listaProdutosEl.appendChild(opcao);
  });
}

// Assim que o texto digitado bate com um produto da lista
produtoOrcSelect.addEventListener("input", function () {
  const idProduto = extrairCodigoDoTexto(produtoOrcSelect.value);

  if (idProduto) {
    produtoOrcSelect.value = produtoOrcSelect.value.replace(
      /\s*\(Código:\s*\d+\)\s*$/,
      "",
    );
  }

  produtoOrcIdInput.value = idProduto || "";

  const produto = idProduto ? mapaProdutosPorId[idProduto] : null;

  if (!produto) {
    descProdutoOrcInput.value = "";
    valorUnitarioInput.value = "";
    valorTotalItemInput.value = "";
    return;
  }

  descProdutoOrcInput.value = produto.descricao;
  valorUnitarioInput.value = "R$ " + formatarMoeda(produto.valor);
  recalcularValorTotalItem();
});

function recalcularValorTotalItem() {
  const idProduto = produtoOrcIdInput.value;
  const produto = idProduto ? mapaProdutosPorId[idProduto] : null;

  if (!produto) { valorTotalItemInput.value = ""; return; }

  const quantidade = Number(qtdeProdutoOrcInput.value) || 0;
  valorTotalItemInput.value = "R$ " + formatarMoeda(quantidade * produto.valor);
}

qtdeProdutoOrcInput.addEventListener("input", recalcularValorTotalItem);

btnAdicionarItem.addEventListener("click", function () {
  const idProduto = produtoOrcIdInput.value;
  const produto = idProduto ? mapaProdutosPorId[idProduto] : null;
  const quantidade = Number(qtdeProdutoOrcInput.value);

  if (!produto) {
    mensagem.textContent = "Selecione um produto válido na lista antes de adicionar.";
    mensagem.className = "erro";
    return;
  }

  if (!quantidade || quantidade <= 0) {
    mensagem.textContent = "Informe uma quantidade válida.";
    mensagem.className = "erro";
    return;
  }

  itensDoOrcamento.push({
    produtoid: idProduto,
    descricao_produto: produto.descricao,
    quantidade: quantidade,
    valor_unitario: produto.valor,
    valor_total_item: quantidade * produto.valor
  });

  mensagem.textContent = "";
  mensagem.className = "";
  produtoOrcSelect.value = "";
  produtoOrcIdInput.value = "";
  descProdutoOrcInput.value = "";
  qtdeProdutoOrcInput.value = 1;
  valorUnitarioInput.value = "";
  valorTotalItemInput.value = "";

  desenharListaDeItens();
});
function desenharListaDeItens() {
  if (itensDoOrcamento.length === 0) {
    corpoListaItens.innerHTML =
      '<tr><td colspan="5">Nenhum item adicionado ainda.</td></tr>';
  } else {
    let linhasHTML = "";

    itensDoOrcamento.forEach((item, indice) => {
      
      linhasHTML += `
        <tr>
          <td>${escapeHTML(item.descricao_produto)}</td>
          <td>${item.quantidade}</td>
          <td>R$ ${formatarMoeda(item.valor_unitario)}</td>
          <td>R$ ${formatarMoeda(item.valor_total_item)}</td>
          <td><button type="button" class="btn-excluir" data-indice="${indice}">Remover</button></td>
        </tr>
      `;
    });

    corpoListaItens.innerHTML = linhasHTML;
  }

  const valorTotalOrcamento = itensDoOrcamento.reduce(
    (soma, item) => soma + item.valor_total_item,
    0,
  );

  valorTotalOrcamentoInput.value = "R$ " + formatarMoeda(valorTotalOrcamento);

  subtotalAtualOrcamento = valorTotalOrcamento;
  recalcularValorFinalOrcamento();
}

desenharListaDeItens();

corpoListaItens.addEventListener("click", function (evento) {
  const botaoClicado = evento.target;

  if (!botaoClicado.classList.contains("btn-excluir")) return;

  const indice = Number(botaoClicado.dataset.indice);
  itensDoOrcamento.splice(indice, 1);

  desenharListaDeItens();
});

formOrcamento.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const idCliente = clienteSelecIdInput.value;

  if (!idCliente) {
    mensagem.textContent = "Selecione o cliente da lista.";
    mensagem.className = "erro";
    return;
  }

  // Não deixa salvar um orçamento sem nenhum item
  if (itensDoOrcamento.length === 0) {
    mensagem.textContent =
      "Adicione pelo menos um item ao orçamento antes de salvar.";
    mensagem.className = "erro";
    return;
  }

  const valorTotalOrcamento = itensDoOrcamento.reduce(
    (soma, item) => soma + item.valor_total_item,
    0,
  );

  // Garante que subtotalAtualOrcamento está sincronizado antes de calcular
  // o valor final (evita depender só do "input" do campo de desconto).
  subtotalAtualOrcamento = valorTotalOrcamento;
  const valorFinalComDesconto = recalcularValorFinalOrcamento();
  const percentualDescontoAtual = converterPercentualParaNumero(
    descontoOrcamentoInput.value,
  );

  // trava o botão de salvar durante o envio.
  botaoSalvarOrcamento.disabled = true;

  // =====================================================
  // FLUXO DE ATUALIZAÇÃO (quando o orçamento já existe)
  // =====================================================
  if (idOrcamentoEmEdicao) {
    const dadosOrcamentoAtualizado = {
      clienteid: idCliente,
      dt_validade_orcamento: new Date(
        validadeOrcamentoInput.value,
      ).toISOString(),
      vl_total_orcamento: valorFinalComDesconto,
      vl_desconto_orcamento: percentualDescontoAtual,
      status_orcamento: statusOrcamentoSelect.value,
    };

    const { error: erroOrcamento } = await supabaseClient
      .from(TABELA_ORCAMENTO)
      .update(dadosOrcamentoAtualizado)
      .eq("orcamentoid", idOrcamentoEmEdicao);

    if (erroOrcamento) {
      mensagem.textContent =
        "Erro ao atualizar orçamento: " + erroOrcamento.message;
      mensagem.className = "erro";
      console.error(erroOrcamento);
      botaoSalvarOrcamento.disabled = false;
      return;
    }

    // Substitui todos os itens antigos pelos itens atuais da tela
    const { error: erroExclusaoItens } = await supabaseClient
      .from(TABELA_ITENS)
      .delete()
      .eq("orcamentoid", idOrcamentoEmEdicao);

    if (erroExclusaoItens) {
      mensagem.textContent =
        "Orçamento atualizado, mas houve erro ao atualizar os itens: " +
        erroExclusaoItens.message;
      mensagem.className = "erro";
      console.error(erroExclusaoItens);
      botaoSalvarOrcamento.disabled = false;
      return;
    }

    const itensParaAtualizar = itensDoOrcamento.map((item) => ({
      orcamentoid: idOrcamentoEmEdicao,
      produtoid: item.produtoid,
      qt_produto: item.quantidade,
      vl_unitario: item.valor_unitario,
      vl_total: item.valor_total_item,
    }));

    if (itensParaAtualizar.length > 0) {
      const { error: erroItens } = await supabaseClient
        .from(TABELA_ITENS)
        .insert(itensParaAtualizar);

      if (erroItens) {
        mensagem.textContent =
          "Orçamento atualizado, mas houve erro ao salvar os itens: " +
          erroItens.message;
        mensagem.className = "erro";
        console.error(erroItens);
        botaoSalvarOrcamento.disabled = false;
        return;
      }
    }

    botaoSalvarOrcamento.disabled = false;
    mensagem.textContent = "Orçamento atualizado com sucesso!";
    mensagem.className = "sucesso";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  // =====================================================
  // FLUXO DE CADASTRO (orçamento novo)
  // =====================================================
  const novoOrcamento = {
    clienteid: idCliente,
    dt_orcamento: new Date().toISOString(),
    dt_validade_orcamento: new Date(validadeOrcamentoInput.value).toISOString(),
    vl_total_orcamento: valorFinalComDesconto,
    vl_desconto_orcamento: percentualDescontoAtual,
    status_orcamento: "PENDENTE",
  };

  const { data: orcamentoSalvo, error: erroOrcamento } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .insert(novoOrcamento)
    .select()
    .single();

  if (erroOrcamento) {
    mensagem.textContent = "Erro ao salvar orçamento: " + erroOrcamento.message;
    mensagem.className = "erro";
    console.error(erroOrcamento);
    botaoSalvarOrcamento.disabled = false;
    return;
  }

  const itensParaSalvar = itensDoOrcamento.map((item) => ({
    orcamentoid: orcamentoSalvo.orcamentoid,
    produtoid: item.produtoid,
    qt_produto: item.quantidade,
    vl_unitario: item.valor_unitario,
    vl_total: item.valor_total_item,
  }));

  const { error: erroItens } = await supabaseClient
    .from(TABELA_ITENS)
    .insert(itensParaSalvar);

  botaoSalvarOrcamento.disabled = false;

  if (erroItens) {
    mensagem.textContent =
      "Orçamento salvo, mas houve erro ao salvar os itens: " +
      erroItens.message;
    mensagem.className = "erro";
    console.error(erroItens);
    return;
  }

  mensagem.textContent = "Orçamento salvo com sucesso!";
  mensagem.className = "sucesso";

  formOrcamento.reset();
  itensDoOrcamento = [];
  desenharListaDeItens();
  dataOrcamentoInput.value = new Date().toLocaleString("pt-BR");
  mostrarProximoCodigo();

  setTimeout(() => {
    mensagem.textContent = "";
    mensagem.className = "";
  }, 5000);
});

async function carregarOrcamentoParaVisualizacao(idOrcamento) {
  const { data: orcamento, error } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .select(
      `
      orcamentoid,
      dt_orcamento,
      dt_validade_orcamento,
      vl_total_orcamento,
      status_orcamento,
      vl_desconto_orcamento,
      clientes(nome_cliente, telefone_cliente, endereco_cliente),
      orcamento_item(qt_produto, vl_unitario, vl_total, produtos(ds_produto))
    `,
    )
    .eq("orcamentoid", idOrcamento)
    .single();

  if (error || !orcamento) {
    mensagem.textContent = "Não foi possível carregar este orçamento.";
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  formOrcamento.classList.add("oculto");
  areaVisualizacao.classList.remove("oculto");

  visCodigo.textContent = orcamento.orcamentoid;
  visCliente.textContent = orcamento.clientes?.nome_cliente ?? "";
  visTelefone.textContent = orcamento.clientes?.telefone_cliente || "Não informado";
  visEndereco.textContent = orcamento.clientes?.endereco_cliente || "Não informado";
  visData.textContent = new Date(orcamento.dt_orcamento).toLocaleString(
    "pt-BR",
  );
  visValidade.textContent = new Date(
    orcamento.dt_validade_orcamento,
  ).toLocaleDateString("pt-BR");
  visStatus.textContent = orcamento.status_orcamento;
  visDesconto.textContent = orcamento.vl_desconto_orcamento
    ? `${orcamento.vl_desconto_orcamento}%`
    : "Nenhum";
  visTotal.textContent = formatarMoeda(orcamento.vl_total_orcamento);

  const itens = orcamento.orcamento_item || [];
  visCorpoItens.innerHTML =
    itens.length === 0
      ? '<tr><td colspan="4">Nenhum item encontrado.</td></tr>'
      : itens
        .map(
          (item) => `
        <tr>
          <td>${escapeHTML(item.produtos?.ds_produto ?? "")}</td>
          <td>${item.qt_produto}</td>
          <td>R$ ${formatarMoeda(item.vl_unitario)}</td>
          <td>R$ ${formatarMoeda(item.vl_total)}</td>
        </tr>
      `,
        )
        .join("");

  if (orcamento.status_orcamento === "PENDENTE") {
    visAcoesAprovacao.classList.remove("oculto");
  } else {
    visAcoesAprovacao.classList.add("oculto");
  }
}

async function carregarOrcamentoParaEdicao(idOrcamento) {
  mensagem.textContent = "Carregando dados do orçamento...";
  mensagem.className = "";

  const { data: orcamento, error } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .select(
      `
      orcamentoid,
      clienteid,
      dt_orcamento,
      dt_validade_orcamento,
      status_orcamento,
      vl_desconto_orcamento,
      clientes(nome_cliente),
      orcamento_item(produtoid, qt_produto, vl_unitario, vl_total, produtos(ds_produto))
    `,
    )
    .eq("orcamentoid", idOrcamento)
    .single();

  if (error || !orcamento) {
    mensagem.textContent = "Não foi possível carregar este orçamento para edição.";
    mensagem.className = "erro";
    console.error(error);
    document.documentElement.classList.remove("carregando-edicao");
    return;
  }

  if (orcamento.status_orcamento === "FATURADO") {
    alert(
      "Orçamentos já FATURADOS não podem mais ser editados. Abrindo em modo de visualização.",
    );
    document.documentElement.classList.remove("carregando-edicao");
    carregarOrcamentoParaVisualizacao(idOrcamento);
    return;
  }

  idOrcamentoEmEdicao = orcamento.orcamentoid;


  await carregarClientes();
  await carregarProdutos();

  codigoOrcamentoInput.value = orcamento.orcamentoid;
  clienteSelecSelect.value = orcamento.clientes?.nome_cliente ?? "";
  clienteSelecIdInput.value = orcamento.clienteid ?? "";
  dataOrcamentoInput.value = new Date(orcamento.dt_orcamento).toLocaleString(
    "pt-BR",
  );

  validadeOrcamentoInput.value = orcamento.dt_validade_orcamento
    ? new Date(orcamento.dt_validade_orcamento).toISOString().slice(0, 10)
    : "";

  itensDoOrcamento = (orcamento.orcamento_item || []).map((item) => ({
    produtoid: item.produtoid,
    descricao_produto: item.produtos?.ds_produto ?? "Produto removido",
    quantidade: item.qt_produto,
    valor_unitario: item.vl_unitario,
    valor_total_item: item.vl_total,
  }));

  // Preenche o desconto salvo
  descontoOrcamentoInput.value = orcamento.vl_desconto_orcamento ?? 0;

  statusOrcamentoSelect.value = orcamento.status_orcamento;
  grupoStatusOrcamento.classList.remove("oculto");

  desenharListaDeItens();

  if (descricaoHeader) {
    descricaoHeader.textContent = `Atualizando o orçamento nº ${orcamento.orcamentoid}.`;
  }

  const tituloPagina = document.getElementById("tituloPagina");
  if (tituloPagina) tituloPagina.textContent = "Atualizar Orçamento";

  if (botaoSalvarOrcamento) {
    botaoSalvarOrcamento.textContent = "Atualizar Orçamento";
  }

  mensagem.textContent = "";
  mensagem.className = "";

  // Só mostra o formulário depois que ele já está preenchido com os
  // dados do orçamento, evitando o "flash" da tela de cadastro vazia.
  document.documentElement.classList.remove("carregando-edicao");
}

async function atualizarStatusOrcamento(idOrcamento, novoStatus) {
  btnAprovarOrcamento.disabled = true;
  btnReprovarOrcamento.disabled = true;


  const { error } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .update({ status_orcamento: novoStatus })
    .eq("orcamentoid", idOrcamento);

  if (error) {
    mensagem.textContent =
      "Erro ao atualizar o status do orçamento: " + error.message;
    mensagem.className = "erro";
    console.error(error);
    btnAprovarOrcamento.disabled = false;
    btnReprovarOrcamento.disabled = false;
    return;
  }

  mensagem.textContent =
    novoStatus === "APROVADO"
      ? "Orçamento aprovado com sucesso!"
      : "Orçamento reprovado.";
  mensagem.className = "sucesso";

  visStatus.textContent = novoStatus;
  visAcoesAprovacao.classList.add("oculto");

  setTimeout(() => {
    mensagem.textContent = "";
    mensagem.className = "";
  }, 5000);
}

btnAprovarOrcamento?.addEventListener("click", () => {
  atualizarStatusOrcamento(visCodigo.textContent, "APROVADO");
});

btnReprovarOrcamento?.addEventListener("click", () => {
  atualizarStatusOrcamento(visCodigo.textContent, "REPROVADO");
});

// Ação do botão de impressão na tela de visualização
btnImprimirVis?.addEventListener("click", () => {
  window.open(`imprimir_orcamento.html?id=${visCodigo.textContent}`, "_blank");
});

const parametrosUrl = new URLSearchParams(window.location.search);
const idOrcamentoParaAcessar = parametrosUrl.get("id");
const modoAcesso = parametrosUrl.get("modo");
const descricaoHeader = document.getElementById("descricaoHeader");

if (idOrcamentoParaAcessar && modoAcesso === "editar") {
  carregarOrcamentoParaEdicao(idOrcamentoParaAcessar);
} else if (idOrcamentoParaAcessar) {
  carregarOrcamentoParaVisualizacao(idOrcamentoParaAcessar);
} else {
  if (descricaoHeader) {
    descricaoHeader.textContent =
      "Crie novos orçamentos e propostas comerciais.";
  }

  mostrarProximoCodigo();
  carregarClientes();
  carregarProdutos();
}