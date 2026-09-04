/*
  =====================================================
  CONFIGURAÇÃO DO SUPABASE
  =====================================================
*/

const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/*
  =====================================================
  NOMES DA TABELA E DAS COLUNAS
  =====================================================
*/
const TABELA_ORCAMENTO = "orcamentos";
const TABELA_ITENS = "orcamento_item";
const TABELA_CLIENTES = "clientes";
const TABELA_PRODUTOS = "produtos";

/*
  =====================================================
  PEGANDO OS ELEMENTOS DO HTML
  =====================================================
*/

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
// CORRIGIDO: antes existia só "visAcoes" (Aprovar + Reprovar + Voltar juntos).
// Agora "visAcoesAprovacao" controla só Aprovar/Reprovar, que dependem do status.
// O botão Voltar (no HTML) ficou fora dessa div e não depende de mais nada.
const visAcoesAprovacao = document.getElementById("visAcoesAprovacao");
const btnAprovarOrcamento = document.getElementById("btnAprovarOrcamento");
const btnReprovarOrcamento = document.getElementById("btnReprovarOrcamento");

/*
  Aqui guardamos, na memória, os itens que o usuário já
  adicionou no orçamento (antes de clicar em "Salvar
  Orçamento"). É um array comum de objetos JavaScript.
*/
let itensDoOrcamento = [];

// =====================================================
// PROTEÇÃO DE ROTA E PERMISSÕES
// =====================================================
const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");

if (!usuarioLogadoTexto) {
  window.location.href = "login.html"; // Expulsa se não estiver logado
} else {
  const usuarioLogado = JSON.parse(usuarioLogadoTexto);
  const ehAdmin = String(usuarioLogado.tipo_usuario).trim().toUpperCase() !== "PADRAO";
  const usuarioPodeEditar = ehAdmin || usuarioLogado.pode_editar === true;

  const parametrosUrl = new URLSearchParams(window.location.search);
  const idAcesso = parametrosUrl.get("id");

  // Se estiver tentando acessar um orçamento existente (Visualizar/Editar) sem permissão
  if (idAcesso && !usuarioPodeEditar) {
    alert("Você não tem permissão para visualizar ou editar registros.");
    window.location.href = "menu.html";
  }
}

/*
  =====================================================
  FUNÇÃO PARA MOSTRAR VALORES EM REAL (R$)
  =====================================================
*/
function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/*
  =====================================================
  DATA E CÓDIGO AUTOMÁTICOS
  =====================================================
*/
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

/*
  =====================================================
  BUSCAR CLIENTES E COLOCAR NA SELECT
  =====================================================
*/
async function carregarClientes() {
  // Ajustado para buscar 'clienteid'. O campo de nome assumimos como 'nome_cliente' ou similar.
  // Caso sua tabela de clientes use outro nome para a coluna de texto, ajuste o "nome_cliente" abaixo.
  const { data, error } = await supabaseClient
    .from(TABELA_CLIENTES)
    .select("clienteid, nome_cliente")
    .order("nome_cliente", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  data.forEach((cliente) => {
    const opcao = document.createElement("option");
    opcao.value = cliente.clienteid;
    opcao.textContent = cliente.nome_cliente;
    clienteSelecSelect.appendChild(opcao);
  });
}

/*
  =====================================================
  BUSCAR PRODUTOS E COLOCAR NA SELECT
  =====================================================
  CORRIGIDO: agora só busca produtos com status_produto = "ATIVO".
  Produtos inativos não devem poder ser selecionados em um orçamento novo.
*/
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

  data.forEach((produto) => {
    const opcao = document.createElement("option");
    opcao.value = produto.produtoid;
    opcao.textContent = produto.ds_produto;
    opcao.dataset.descricao = produto.ds_produto;
    opcao.dataset.valor = produto.vl_venda_produto;
    produtoOrcSelect.appendChild(opcao);
  });
}

/*
  =====================================================
  QUANDO O USUÁRIO ESCOLHE UM PRODUTO
  =====================================================
*/
produtoOrcSelect.addEventListener("change", function () {
  const opcaoEscolhida = produtoOrcSelect.selectedOptions[0];

  if (!opcaoEscolhida || opcaoEscolhida.value === "") {
    descProdutoOrcInput.value = "";
    valorUnitarioInput.value = "";
    valorTotalItemInput.value = "";
    return;
  }

  descProdutoOrcInput.value = opcaoEscolhida.dataset.descricao;
  valorUnitarioInput.value = formatarMoeda(opcaoEscolhida.dataset.valor);

  recalcularValorTotalItem();
});

/*
  =====================================================
  RECALCULAR O TOTAL DO ITEM ATUAL (antes de adicionar)
  =====================================================
*/
function recalcularValorTotalItem() {
  const opcaoEscolhida = produtoOrcSelect.selectedOptions[0];

  if (!opcaoEscolhida || opcaoEscolhida.value === "") {
    valorTotalItemInput.value = "";
    return;
  }

  const quantidade = Number(qtdeProdutoOrcInput.value) || 0;
  const valorUnitario = Number(opcaoEscolhida.dataset.valor) || 0;
  const total = quantidade * valorUnitario;

  valorTotalItemInput.value = formatarMoeda(total);
}

qtdeProdutoOrcInput.addEventListener("input", recalcularValorTotalItem);

/*
  =====================================================
  ADICIONAR ITEM NA LISTA DO ORÇAMENTO
  =====================================================
*/
btnAdicionarItem.addEventListener("click", function () {
  const opcaoEscolhida = produtoOrcSelect.selectedOptions[0];
  const quantidade = Number(qtdeProdutoOrcInput.value);

  if (!opcaoEscolhida || opcaoEscolhida.value === "") {
    mensagem.textContent = "Selecione um produto antes de adicionar o item.";
    mensagem.className = "erro";
    return;
  }

  if (!quantidade || quantidade <= 0) {
    mensagem.textContent = "Informe uma quantidade válida.";
    mensagem.className = "erro";
    return;
  }

  const valorUnitario = Number(opcaoEscolhida.dataset.valor);
  const valorTotalItem = quantidade * valorUnitario;

  itensDoOrcamento.push({
    produtoid: opcaoEscolhida.value, // Atualizado para produtoid
    descricao_produto: opcaoEscolhida.dataset.descricao,
    quantidade: quantidade,
    valor_unitario: valorUnitario,
    valor_total_item: valorTotalItem
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

/*
  =====================================================
  DESENHAR A TABELA DE ITENS E RECALCULAR O TOTAL GERAL
  =====================================================
*/
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
    0
  );

  valorTotalOrcamentoInput.value = formatarMoeda(valorTotalOrcamento);
}

desenharListaDeItens();

/*
  =====================================================
  REMOVER UM ITEM DA LISTA
  =====================================================
*/
corpoListaItens.addEventListener("click", function (evento) {
  const botaoClicado = evento.target;

  if (!botaoClicado.classList.contains("btn-excluir")) return;

  const indice = Number(botaoClicado.dataset.indice);
  itensDoOrcamento.splice(indice, 1);

  desenharListaDeItens();
});

/*
  =====================================================
  ENVIAR O FORMULÁRIO (SALVAR O ORÇAMENTO INTEIRO)
  =====================================================
*/
formOrcamento.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  if (clienteSelecSelect.value === "") {
    mensagem.textContent = "Selecione o cliente do orçamento.";
    mensagem.className = "erro";
    return;
  }

  if (validadeOrcamentoInput.value === "") {
    mensagem.textContent = "Informe a data de validade.";
    mensagem.className = "erro";
    return;
  }

  if (itensDoOrcamento.length === 0) {
    mensagem.textContent = "Adicione pelo menos um item ao orçamento.";
    mensagem.className = "erro";
    return;
  }

  const valorTotalOrcamento = itensDoOrcamento.reduce(
    (soma, item) => soma + item.valor_total_item,
    0
  );

  // 1) Primeiro salvamos o "cabeçalho" do orçamento...
  // Mapeado com as colunas corretas da tabela orcamentos
  const novoOrcamento = {
    clienteid: clienteSelecSelect.value, 
    dt_orcamento: new Date().toISOString(),
    dt_validade_orcamento: new Date(validadeOrcamentoInput.value).toISOString(), 
    vl_total_orcamento: valorTotalOrcamento,
    status_orcamento: "PENDENTE"
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

  // 2) ...depois salvamos cada item, ligado ao orçamento que acabou de ser criado.
  // Mapeado com as colunas corretas da tabela orcamento_item
  const itensParaSalvar = itensDoOrcamento.map((item) => ({
    orcamentoid: orcamentoSalvo.orcamentoid, 
    produtoid: item.produtoid, 
    qt_produto: item.quantidade, 
    vl_unitario: item.valor_unitario, 
    vl_total: item.valor_total_item 
  }));

  const { error: erroItens } = await supabaseClient
    .from(TABELA_ITENS)
    .insert(itensParaSalvar);

  if (erroItens) {
    mensagem.textContent = "Orçamento salvo, mas houve erro ao salvar os itens: " + erroItens.message;
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

/*
  =====================================================
  VISUALIZAR / APROVAR / REPROVAR UM ORÇAMENTO EXISTENTE
  =====================================================
  Usado quando a página é aberta como "orcamentos.html?id=5",
  o que acontece ao clicar em "Visualizar" na listagem do menu.
*/
async function carregarOrcamentoParaVisualizacao(idOrcamento) {
  const { data: orcamento, error } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .select(`
      orcamentoid,
      dt_orcamento,
      dt_validade_orcamento,
      vl_total_orcamento,
      status_orcamento,
      clientes(nome_cliente),
      orcamento_item(qt_produto, vl_unitario, vl_total, produtos(ds_produto))
    `)
    .eq("orcamentoid", idOrcamento)
    .single();

  if (error || !orcamento) {
    mensagem.textContent = "Não foi possível carregar este orçamento.";
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  // Esconde o formulário de criação e mostra a área de visualização
  formOrcamento.classList.add("oculto");
  areaVisualizacao.classList.remove("oculto");

  visCodigo.textContent = orcamento.orcamentoid;
  visCliente.textContent = orcamento.clientes?.nome_cliente ?? "";
  visData.textContent = new Date(orcamento.dt_orcamento).toLocaleString("pt-BR");
  visValidade.textContent = new Date(orcamento.dt_validade_orcamento).toLocaleDateString("pt-BR");
  visStatus.textContent = orcamento.status_orcamento;
  visTotal.textContent = formatarMoeda(orcamento.vl_total_orcamento);

  const itens = orcamento.orcamento_item || [];
  visCorpoItens.innerHTML = itens.length === 0
    ? '<tr><td colspan="4">Nenhum item encontrado.</td></tr>'
    : itens.map((item) => `
        <tr>
          <td>${item.produtos?.ds_produto ?? ""}</td>
          <td>${item.qt_produto}</td>
          <td>R$ ${formatarMoeda(item.vl_unitario)}</td>
          <td>R$ ${formatarMoeda(item.vl_total)}</td>
        </tr>
      `).join("");

  // CORRIGIDO: só o bloco de Aprovar/Reprovar depende do status ser PENDENTE.
  // O botão Voltar (fora dessa div, no HTML) fica sempre visível.
  if (orcamento.status_orcamento === "PENDENTE") {
    visAcoesAprovacao.classList.remove("oculto");
  } else {
    visAcoesAprovacao.classList.add("oculto");
  }
}

async function atualizarStatusOrcamento(idOrcamento, novoStatus) {
  const { error } = await supabaseClient
    .from(TABELA_ORCAMENTO)
    .update({ status_orcamento: novoStatus })
    .eq("orcamentoid", idOrcamento);

  if (error) {
    mensagem.textContent = "Erro ao atualizar o status do orçamento: " + error.message;
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  mensagem.textContent = novoStatus === "FINALIZADO"
    ? "Orçamento aprovado com sucesso!"
    : "Orçamento reprovado.";
  mensagem.className = "sucesso";

  visStatus.textContent = novoStatus;
  visAcoesAprovacao.classList.add("oculto");
}

btnAprovarOrcamento?.addEventListener("click", () => {
  atualizarStatusOrcamento(visCodigo.textContent, "FINALIZADO");
});

btnReprovarOrcamento?.addEventListener("click", () => {
  atualizarStatusOrcamento(visCodigo.textContent, "REPROVADO");
});

/*
  =====================================================
  QUANDO A PÁGINA ABRE
  =====================================================
*/
const parametrosUrl = new URLSearchParams(window.location.search);
const idOrcamentoParaVisualizar = parametrosUrl.get("id");
const descricaoHeader = document.getElementById("descricaoHeader");

if (idOrcamentoParaVisualizar) {
  // Tela de Visualização: Mantém o texto padrão do HTML ("Acompanhe propostas comerciais.")
  carregarOrcamentoParaVisualizacao(idOrcamentoParaVisualizar);
} else {
  // Tela de Criação: Altera o texto do cabeçalho
  if (descricaoHeader) {
    descricaoHeader.textContent = "Crie novos orçamentos e propostas comerciais.";
  }
  
  mostrarProximoCodigo();
  carregarClientes();
  carregarProdutos();
}