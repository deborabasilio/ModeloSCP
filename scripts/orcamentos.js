const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function extrairCodigoDoTexto(texto) {
  const match = String(texto || "").match(/\(Código:\s*(\d+)\)\s*$/);
  return match ? match[1] : null;
}

const TABELA_ORCAMENTO = "orcamentos";
const TABELA_ITENS = "orcamento_item";
const TABELA_CLIENTES = "clientes";
const TABELA_PRODUTOS = "produtos";

const formOrcamento = document.getElementById("formOrcamento");
const codigoOrcamentoInput = document.getElementById("codigoOrcamento");
const clienteSelecSelect = document.getElementById("clienteSelec");
const dataOrcamentoInput = document.getElementById("dataOrcamento");
const validadeOrcamentoInput = document.getElementById("validadeOrcamento");

const produtoOrcSelect = document.getElementById("produtoOrc");
const descProdutoOrcInput = document.getElementById("descProdutoOrc");
const qtdeProdutoOrcInput = document.getElementById("qtdeProdutoOrc");
const valorUnitarioInput = document.getElementById("valorUnitario");
const valorTotalItemInput = document.getElementById("valorTotalItem");
const btnAdicionarItem = document.getElementById("btnAdicionarItem");
const corpoListaItens = document.getElementById("corpoListaItens");
const valorTotalOrcamentoInput = document.getElementById("valorTotalOrcamento");

const mensagem = document.getElementById("mensagem");

const areaVisualizacao = document.getElementById("areaVisualizacao");
const visCodigo = document.getElementById("visCodigo");
const visCliente = document.getElementById("visCliente");
const visData = document.getElementById("visData");
const visValidade = document.getElementById("visValidade");
const visStatus = document.getElementById("visStatus");
const visCorpoItens = document.getElementById("visCorpoItens");
const visTotal = document.getElementById("visTotal");
const visAcoesAprovacao = document.getElementById("visAcoesAprovacao");
const btnAprovarOrcamento = document.getElementById("btnAprovarOrcamento");
const btnReprovarOrcamento = document.getElementById("btnReprovarOrcamento");
const btnImprimirVis = document.getElementById("btnImprimirVis"); // Botão de imprimir na visualização

let itensDoOrcamento = [];

const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");

if (!usuarioLogadoTexto) {
  window.location.href = "login.html";
} else {
  const usuarioLogado = JSON.parse(usuarioLogadoTexto);
  const ehAdmin =
    String(usuarioLogado.tipo_usuario).trim().toUpperCase() !== "PADRAO";
  const usuarioPodeEditar = ehAdmin || usuarioLogado.pode_editar === true;

  const parametrosUrl = new URLSearchParams(window.location.search);
  const idAcesso = parametrosUrl.get("id");

  if (idAcesso && !usuarioPodeEditar) {
    alert("Você não tem permissão para visualizar ou editar registros.");
    window.location.href = "menu.html";
  }
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

produtoOrcSelect.addEventListener("input", function () {
  const idProduto = extrairCodigoDoTexto(produtoOrcSelect.value);
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
  const idProduto = extrairCodigoDoTexto(produtoOrcSelect.value);
  const produto = idProduto ? mapaProdutosPorId[idProduto] : null;

  if (!produto) { valorTotalItemInput.value = ""; return; }

  const quantidade = Number(qtdeProdutoOrcInput.value) || 0;
  valorTotalItemInput.value = "R$ " + formatarMoeda(quantidade * produto.valor);
}


qtdeProdutoOrcInput.addEventListener("input", recalcularValorTotalItem);

btnAdicionarItem.addEventListener("click", function () {
  const idProduto = extrairCodigoDoTexto(produtoOrcSelect.value);
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
          <td>${item.descricao_produto}</td>
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

  const idCliente = extrairCodigoDoTexto(clienteSelecSelect.value);

  if (!idCliente) {
    mensagem.textContent = "Selecione o cliente da lista.";
    mensagem.className = "erro";
    return;
  }
  

  const valorTotalOrcamento = itensDoOrcamento.reduce(
    (soma, item) => soma + item.valor_total_item,
    0,
  );

  const novoOrcamento = {
    clienteid: idCliente,
    dt_orcamento: new Date().toISOString(),
    dt_validade_orcamento: new Date(validadeOrcamentoInput.value).toISOString(),
    vl_total_orcamento: valorTotalOrcamento,
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
      clientes(nome_cliente),
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
  visData.textContent = new Date(orcamento.dt_orcamento).toLocaleString(
    "pt-BR",
  );
  visValidade.textContent = new Date(
    orcamento.dt_validade_orcamento,
  ).toLocaleDateString("pt-BR");
  visStatus.textContent = orcamento.status_orcamento;
  visTotal.textContent = formatarMoeda(orcamento.vl_total_orcamento);

  const itens = orcamento.orcamento_item || [];
  visCorpoItens.innerHTML =
    itens.length === 0
      ? '<tr><td colspan="4">Nenhum item encontrado.</td></tr>'
      : itens
          .map(
            (item) => `
        <tr>
          <td>${item.produtos?.ds_produto ?? ""}</td>
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

async function atualizarStatusOrcamento(idOrcamento, novoStatus) {
  if (novoStatus === "FINALIZADO") {
    const { data: itens } = await supabaseClient
      .from("orcamento_item")
      .select("produtoid, qt_produto")
      .eq("orcamentoid", idOrcamento);

    if (itens) {
      for (let item of itens) {
        const { data: produto } = await supabaseClient
          .from(TABELA_PRODUTOS)
          .select("qt_estoque_produto")
          .eq("produtoid", item.produtoid)
          .single();

        if (produto && produto.qt_estoque_produto !== undefined) {
          let novoEstoque = produto.qt_estoque_produto - item.qt_produto;

          await supabaseClient
            .from(TABELA_PRODUTOS)
            .update({ qt_estoque_produto: novoEstoque })
            .eq("produtoid", item.produtoid);
        }
      }
    }
  }

  const { error } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .update({ status_orcamento: novoStatus })
    .eq("orcamentoid", idOrcamento);

  if (error) {
    mensagem.textContent =
      "Erro ao atualizar o status do orçamento: " + error.message;
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  mensagem.textContent =
    novoStatus === "FINALIZADO"
      ? "Orçamento aprovado e estoque atualizado com sucesso!"
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
  atualizarStatusOrcamento(visCodigo.textContent, "FINALIZADO");
});

btnReprovarOrcamento?.addEventListener("click", () => {
  atualizarStatusOrcamento(visCodigo.textContent, "REPROVADO");
});

// Ação do botão de impressão na tela de visualização
btnImprimirVis?.addEventListener("click", () => {
  window.open(`imprimir_orcamento.html?id=${visCodigo.textContent}`, "_blank");
});

const parametrosUrl = new URLSearchParams(window.location.search);
const idOrcamentoParaVisualizar = parametrosUrl.get("id");
const descricaoHeader = document.getElementById("descricaoHeader");

if (idOrcamentoParaVisualizar) {
  carregarOrcamentoParaVisualizacao(idOrcamentoParaVisualizar);
} else {
  if (descricaoHeader) {
    descricaoHeader.textContent =
      "Crie novos orçamentos e propostas comerciais.";
  }

  mostrarProximoCodigo();
  carregarClientes();
  carregarProdutos();
}

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
