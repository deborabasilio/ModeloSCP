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
const descProdInput = document.getElementById("descProd");
const obsProdInput = document.getElementById("obsProd");
const valorVendaInput = document.getElementById("valorVenda");
const qtdEstoqueProdInput = document.getElementById("qtdEstoqueProd");
const dataCadastroProdInput = document.getElementById("dataCadastroProd");
const statusProdSelect = document.getElementById("statusProd");
const mensagem = document.getElementById("mensagem");
const botaoSalvar = document.getElementById("botao");

let idProdutoEmEdicao = null;

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

let mapaCategorias = {};

/*
  =====================================================
  BUSCAR AS CATEGORIAS E COLOCAR NA SELECT
  =====================================================
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

  catProdSelect.length = 1;
  mapaCategorias = {};

  data.forEach((categoria) => {
    const opcao = document.createElement("option");
    opcao.value = categoria.categoriaprodutoid;
    opcao.textContent = categoria.ds_categoria_produto;
    catProdSelect.appendChild(opcao);

    mapaCategorias[categoria.categoriaprodutoid] = categoria.ds_categoria_produto;
  });
}


/*
  =====================================================
  EDITAR: CARREGA OS DADOS DO PRODUTO NO FORMULÁRIO
  =====================================================
*/
async function carregarProdutoNoFormulario(idProduto) {
  const { data: produto, error } = await supabaseClient
    .from(TABELA_PRODUTOS)
    .select("*")
    .eq("produtoid", idProduto)
    .single();

  if (error || !produto) {
    mensagem.textContent = "Não foi possível carregar este produto.";
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  idProdInput.value = produto.produtoid;
  catProdSelect.value = produto.categoriaprodutoid;
  descProdInput.value = produto.ds_produto;
  obsProdInput.value = produto.obs_produto ?? "";
  valorVendaInput.value = produto.vl_venda_produto;
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

  const categoria = catProdSelect.value;
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
    vl_venda_produto: valorVenda,
    qt_estoque_produto: qtdEstoque,
    status_produto: status
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

  mensagem.textContent = idProdutoEmEdicao
    ? "Produto atualizado com sucesso!"
    : "Produto salvo com sucesso!";
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