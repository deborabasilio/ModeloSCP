/*
  =====================================================
  CONFIGURAÇÃO DO SUPABASE
  =====================================================
*/

const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*
  =====================================================
  NOMES DA TABELA E DAS COLUNAS
  =====================================================
*/
const TABELA_PRODUTOS = "produtos";
const TABELA_CATEGORIAS = "categoria_produto";

/*
  =====================================================
  PEGANDO OS ELEMENTOS DO HTML
  =====================================================
*/

const formProdutos = document.getElementById("formProdutos");
const idProdInput = document.getElementById("idProd");
const catProdSelect = document.getElementById("catProd");
const catProdIdInput = document.getElementById("catProdId");
const descProdInput = document.getElementById("descProd");
const obsProdInput = document.getElementById("obsProd");
const valorVendaInput = document.getElementById("valorVenda");
const qtdEstoqueProdInput = document.getElementById("qtdEstoqueProd");
const dataCadastroProdInput = document.getElementById("dataCadastroProd");
const statusProdSelect = document.getElementById("statusProd");
const mensagem = document.getElementById("mensagem");
const botaoSalvar = document.getElementById("botao");

// Extrai o código escondido no formato "Nome (Código: 5)" que o datalist usa internamente
function extrairCodigoDoTexto(texto) {
  const match = String(texto || "").match(/\(Código:\s*(\d+)\)\s*$/);
  return match ? match[1] : null;
}

let idProdutoEmEdicao = null;

// =====================================================
// PROTEÇÃO DE ROTA E PERMISSÕES
// =====================================================
const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");

if (!usuarioLogadoTexto) {
  window.location.href = "login.html"; // Expulsa se não estiver logado
} else {
  const usuarioLogado = JSON.parse(usuarioLogadoTexto);
  const ehAdmin =
    String(usuarioLogado.tipo_usuario).trim().toUpperCase() !== "PADRAO";
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
  FORMATA A DATA/HORA ATUAL PARA MOSTRAR NA TELA
  =====================================================
*/
function formatarDataHoraAtual() {
  const agora = new Date();
  return agora.toLocaleString("pt-BR");
}

dataCadastroProdInput.value = formatarDataHoraAtual();

/*
  =====================================================
  FUNÇÕES PARA FORMATAR O VALOR DE VENDA EM REAL
  =====================================================
  formatarValorDigitado: usada enquanto o usuário digita.
  Trata os números digitados como se os 2 últimos fossem
  sempre os centavos (do jeito que funciona em caixa de
  loja / maquininha de cartão).

  converterValorParaNumero: usada na hora de salvar, para
  transformar o texto "1.234,56" de volta em um número
  (1234.56) que o Supabase entende.
*/
function formatarValorDigitado(valorDigitado) {
  // Remove tudo que não for número
  let numeros = valorDigitado.replace(/\D/g, "");

  if (numeros === "") {
    return "";
  }

  // Transforma em número e divide por 100 para separar os centavos
  const valorEmReais = Number(numeros) / 100;

  // Formata no padrão brasileiro: 1.234,56
  return valorEmReais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function converterValorParaNumero(valorFormatado) {
  if (!valorFormatado) return 0;

  // Remove os pontos de milhar e troca a vírgula decimal por ponto
  const valorLimpo = valorFormatado.replace(/\./g, "").replace(",", ".");
  return Number(valorLimpo) || 0;
}

// Toda vez que o usuário digitar algo no campo, a máscara é reaplicada
valorVendaInput.addEventListener("input", function () {
  valorVendaInput.value = formatarValorDigitado(valorVendaInput.value);
});

/*
  =====================================================
  MOSTRAR O PRÓXIMO CÓDIGO (só um preview)
  =====================================================
*/
async function mostrarProximoCodigo() {
  const { count, error } = await supabaseClient
    .from(TABELA_PRODUTOS)
    .select("*", { count: "exact", head: true });

  if (error) {
    idProdInput.value = "";
    console.error(error);
    return;
  }

  idProdInput.value = (count ?? 0) + 1;
}

let mapaCategorias = {}; // id -> nome (usado ao carregar um produto para edição)

/*
  =====================
  BUSCAR AS CATEGORIAS
  =====================
*/
async function carregarCategorias() {
  const { data, error } = await supabaseClient
    .from(TABELA_CATEGORIAS)
    .select("categoriaprodutoid, ds_categoria_produto")
    .order("ds_categoria_produto", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const listaCategoriasEl = document.getElementById("listaCategorias");
  listaCategoriasEl.innerHTML = "";
  mapaCategorias = {};

  data.forEach((categoria) => {
    mapaCategorias[categoria.categoriaprodutoid] =
      categoria.ds_categoria_produto;

    const opcao = document.createElement("option");
    opcao.value = `${categoria.ds_categoria_produto} (Código: ${categoria.categoriaprodutoid})`;
    listaCategoriasEl.appendChild(opcao);
  });
}

/*
  =====================================================
  QUANDO O USUÁRIO ESCOLHE UMA CATEGORIA NO DATALIST
  =====================================================
  Assim que o texto digitado bate com uma categoria da lista,
  guardamos o código dela no campo escondido e limpamos o
  "(Código: X)" do campo visível, para o usuário ver só o nome.
*/
catProdSelect.addEventListener("input", function () {
  const codigo = extrairCodigoDoTexto(catProdSelect.value);

  if (codigo) {
    catProdSelect.value = catProdSelect.value.replace(
      /\s*\(Código:\s*\d+\)\s*$/,
      "",
    );
  }

  catProdIdInput.value = codigo || "";
});

/*
  =====================================================
  EDITAR: CARREGA OS DADOS DO PRODUTO NO FORMULÁRIO
  =====================================================
*/
async function carregarProdutoNoFormulario(idProduto) {
  mensagem.textContent = "Carregando dados do produto...";
  mensagem.className = "";

  const { data: produto, error } = await supabaseClient
    .from(TABELA_PRODUTOS)
    .select("*")
    .eq("produtoid", idProduto)
    .single();

  if (error || !produto) {
    mensagem.textContent = "Não foi possível carregar este produto.";
    mensagem.className = "erro";
    console.error(error);
    document.documentElement.classList.remove("carregando-edicao");
    return;
  }

  idProdInput.value = produto.produtoid;
  const nomeCategoria = mapaCategorias[produto.categoriaprodutoid];
  catProdSelect.value = nomeCategoria || "";
  catProdIdInput.value = produto.categoriaprodutoid ?? "";
  descProdInput.value = produto.ds_produto;
  obsProdInput.value = produto.obs_produto ?? "";
  valorVendaInput.value = Number(produto.vl_venda_produto).toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
  qtdEstoqueProdInput.value = produto.qt_estoque_produto ?? 0;

  // Se a data vier no formato ISO do banco (timestamp), convertemos para visualização
  let dataVisual = produto.dt_cadastro_produto;
  if (dataVisual && dataVisual.includes("T")) {
    dataVisual = new Date(dataVisual).toLocaleString("pt-BR");
  }
  dataCadastroProdInput.value = dataVisual ?? formatarDataHoraAtual();
  statusProdSelect.value = produto.status_produto;

  idProdutoEmEdicao = produto.produtoid;
  botaoSalvar.textContent = "Atualizar Produto";

  const tituloPagina = document.getElementById("tituloPagina");
  const descricaoPagina = document.getElementById("descricaoPagina");
  if (tituloPagina) tituloPagina.textContent = "Atualizar Produto";
  if (descricaoPagina) {
    descricaoPagina.textContent = `Atualize os dados do produto #${produto.produtoid}.`;
  }

  mensagem.textContent = "";
  mensagem.className = "";

  // Só mostra o formulário depois que ele já está preenchido com os
  // dados do produto, evitando o "flash" da tela de cadastro vazia.
  document.documentElement.classList.remove("carregando-edicao");

  formProdutos.scrollIntoView({ behavior: "smooth" });
}

/*
  =====================================================
  VOLTAR O FORMULÁRIO PARA O MODO "NOVO PRODUTO"
  =====================================================
*/
function voltarParaModoCadastro() {
  idProdutoEmEdicao = null;
  botaoSalvar.textContent = "Salvar Produto";
  formProdutos.reset();
  dataCadastroProdInput.value = formatarDataHoraAtual();
  mostrarProximoCodigo();
}

/*
  =====================================================
  EVENTO DE ENVIO DO FORMULÁRIO (SALVAR OU ATUALIZAR)
  =====================================================
*/
formProdutos.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const categoria = catProdIdInput.value;

  if (!categoria) {
    mensagem.textContent =
      "Selecione uma categoria válida na lista antes de salvar.";
    mensagem.className = "erro";
    return;
  }
  const descricao = descProdInput.value.trim();
  const observacao = obsProdInput.value.trim();
  const valorVenda = valorVendaInput.value;
  const qtdEstoque = qtdEstoqueProdInput.value;
  const status = statusProdSelect.value;

  if (categoria === "") {
    mensagem.textContent = "Selecione uma categoria antes de salvar.";
    mensagem.className = "erro";
    return;
  }

  if (descricao === "") {
    mensagem.textContent = "Digite a descrição do produto.";
    mensagem.className = "erro";
    return;
  }

  if (valorVenda === "") {
    mensagem.textContent = "Informe o valor de venda.";
    mensagem.className = "erro";
    return;
  }

  if (status === "") {
    mensagem.textContent = "Selecione o status do produto.";
    mensagem.className = "erro";
    return;
  }

  const dadosProduto = {
    categoriaprodutoid: categoria,
    ds_produto: descricao,
    obs_produto: observacao,
    vl_venda_produto: converterValorParaNumero(valorVenda),
    qt_estoque_produto: qtdEstoque,
    status_produto: status,
  };

  let erroSupabase = null;

  if (idProdutoEmEdicao) {
    const { error } = await supabaseClient
      .from(TABELA_PRODUTOS)
      .update(dadosProduto)
      .eq("produtoid", idProdutoEmEdicao);

    erroSupabase = error;
  } else {
    // Passando no formato ISO para compatibilidade direta com timestamp
    dadosProduto.dt_cadastro_produto = new Date().toISOString();

    const { error } = await supabaseClient
      .from(TABELA_PRODUTOS)
      .insert(dadosProduto);

    erroSupabase = error;
  }

  if (erroSupabase) {
    mensagem.textContent = "Erro ao salvar produto: " + erroSupabase.message;
    mensagem.className = "erro";
    console.error(erroSupabase);

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  if (idProdutoEmEdicao) {
    // Atualização de produto existente: mantém os valores no formulário
    // e só mostra a mensagem de sucesso, sem voltar para o modo cadastro.
    mensagem.textContent = "Produto atualizado com sucesso!";
    mensagem.className = "sucesso";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  // Cadastro de produto novo: limpa o formulário e volta para o modo cadastro
  mensagem.textContent = "Produto salvo com sucesso!";
  mensagem.className = "sucesso";

  voltarParaModoCadastro();

  setTimeout(() => {
    mensagem.textContent = "";
    mensagem.className = "";
  }, 5000);
});

/*
  =====================================================
  QUANDO A PÁGINA ABRE
  =====================================================
  Se a página foi aberta com "?id=5" na URL (o que acontece
  quando clicamos em "Editar" na listagem do menu), já
  carregamos os dados desse produto no formulário.
*/
async function iniciarPagina() {
  await carregarCategorias();

  const parametros = new URLSearchParams(window.location.search);
  const idParaEditar = parametros.get("id");

  if (idParaEditar) {
    await carregarProdutoNoFormulario(idParaEditar);
  } else {
    mostrarProximoCodigo();
  }
}

iniciarPagina();
/*
  =====================================================
  FORÇAR LETRAS MAIÚSCULAS NOS CAMPOS DE TEXTO
  =====================================================
*/
document.addEventListener("DOMContentLoaded", function () {
  // Seleciona todos os inputs de texto e textareas da página atual
  const camposTexto = document.querySelectorAll('input[type="text"], textarea');

  camposTexto.forEach((campo) => {
    campo.addEventListener("input", function () {
      // Guarda a posição atual do cursor para não pular pro final ao digitar no meio do texto
      const inicioCursor = this.selectionStart;
      const fimCursor = this.selectionEnd;

      // Converte o valor para maiúsculas
      this.value = this.value.toUpperCase();

      // Restaura a posição do cursor
      this.setSelectionRange(inicioCursor, fimCursor);
    });
  });
});
/*
  =====================================================
  BOTÃO VOLTAR: FECHA A ABA EM VEZ DE NAVEGAR
  =====================================================
  Como esta página é sempre aberta em uma nova aba (a partir do menu),
  "Voltar" deve fechar a aba atual e devolver o usuário para a aba do
  menu que já estava aberta, em vez de carregar menu.html aqui e ir
  acumulando abas.
*/
document.getElementById("botaoVoltarForm")?.addEventListener("click", function () {
  window.close();

  // Se o navegador não deixar fechar (ex.: a página foi aberta digitando
  // a URL direto, e não por um link/script), caímos de volta para o menu.
  setTimeout(() => {
    window.location.href = "menu.html";
  }, 300);
});