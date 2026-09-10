/*
  ==============================
  PEGANDO OS ELEMENTOS DO HTML
  ===============================
*/

const formCategoria = document.getElementById("categoriaProdutos");
const codigoCategoriaInput = document.getElementById("codigoCategoria");
const descricaoCategoriaInput = document.getElementById("descricaoCategoria");
const mensagem = document.getElementById("mensagem");
const botaoSalvar = document.getElementById("botao");

// Guarda o ID da categoria quando esta editando (null = cadastro novo)
let idCategoriaEmEdicao = null;

// ================================
// PROTEÇÃO DE ROTA E PERMISSÕES
// ================================
const sessaoCategoria = protegerRota();
if (sessaoCategoria) {
  bloquearEdicaoSemPermissao(sessaoCategoria.podeEditar);
}

/*
  ===========================
  NOME DA TABELA NO BANCO
  ===========================
*/
const NOME_TABELA = "categoria_produto";

/*
  ==========================
  MOSTRAR O PRÓXIMO CÓDIGO
  ==========================
*/
async function mostrarProximoCodigo() {
  await mostrarProximoCodigoNoCampo(
    NOME_TABELA,
    "categoriaprodutoid",
    codigoCategoriaInput,
  );
}

/*
  =====================================================
  FUNÇÃO PARA CARREGAR UMA CATEGORIA PARA EDIÇÃO
  =====================================================
*/
async function carregarCategoriaNoFormulario(idCategoria) {
  mensagem.textContent = "Carregando dados da categoria...";
  mensagem.className = "";

  const { data: categoria, error } = await supabaseClient
    .from(NOME_TABELA)
    .select("*")
    .eq("categoriaprodutoid", idCategoria)
    .single();

  if (error || !categoria) {
    mensagem.textContent = "Não foi possível carregar esta categoria.";
    mensagem.className = "erro";
    console.error(error);
    document.documentElement.classList.remove("carregando-edicao");
    return;
  }

  codigoCategoriaInput.value = categoria.categoriaprodutoid;
  descricaoCategoriaInput.value = categoria.ds_categoria_produto;

  idCategoriaEmEdicao = categoria.categoriaprodutoid;
  botaoSalvar.textContent = "Atualizar Categoria";

  const tituloPagina = document.getElementById("tituloPagina");
  const descricaoPagina = document.getElementById("descricaoPagina");
  if (tituloPagina) tituloPagina.textContent = "Atualizar Categoria";
  if (descricaoPagina) {
    descricaoPagina.textContent = `Atualize os dados da categoria #${categoria.categoriaprodutoid}.`;
  }

  mensagem.textContent = "";
  mensagem.className = "";

  // Só mostra o formulário depois que ele já está preenchido com os
  // dados da categoria, evitando tela de cadastro vazia.
  document.documentElement.classList.remove("carregando-edicao");
}

/*
  ======================
  QUANDO A PÁGINA ABRE
  ======================
*/
const parametrosUrl = new URLSearchParams(window.location.search);
const idCategoriaParaEditar = parametrosUrl.get("id");

if (idCategoriaParaEditar) {
  carregarCategoriaNoFormulario(idCategoriaParaEditar);
} else {
  // Mostra o próximo código apenas quando é um cadastro novo
  mostrarProximoCodigo();
}

/*
  ===============================
  EVENTO DE ENVIO DO FORMULÁRIO
  ===============================
*/

formCategoria.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const descricaoCategoria = descricaoCategoriaInput.value.trim();

  // Confere se a descrição foi preenchida antes de tentar salvar.
  if (descricaoCategoria === "") {
    mensagem.textContent = "Digite a descrição da categoria.";
    mensagem.className = "erro";
    return;
  }

  
  // Objeto com os dados da categoria.
  
  const dadosCategoria = {
    ds_categoria_produto: descricaoCategoria
  };

  botaoSalvar.disabled = true;

  let erroSupabase = null;

  if (idCategoriaEmEdicao) {
    const { error } = await supabaseClient
      .from(NOME_TABELA)
      .update(dadosCategoria)
      .eq("categoriaprodutoid", idCategoriaEmEdicao);

    erroSupabase = error;
  } else {
    const { error } = await supabaseClient
      .from(NOME_TABELA)
      .insert(dadosCategoria);

    erroSupabase = error;
  }

  botaoSalvar.disabled = false;

  if (erroSupabase) {
    mensagem.textContent = "Erro ao salvar categoria: " + erroSupabase.message;
    mensagem.className = "erro";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  if (idCategoriaEmEdicao) {
    // Atualização de categoria existente: mantém os valores no formulário
    // e só mostra a mensagem de sucesso, sem voltar para o modo cadastro.
    mensagem.textContent = "Categoria atualizada com sucesso!";
    mensagem.className = "sucesso";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  // Cadastro de categoria nova: limpa o formulário para o próximo cadastro
  mensagem.textContent = "Categoria salva com sucesso!";
  mensagem.className = "sucesso";

  formCategoria.reset();

  // Depois de salvar, atualiza o preview do próximo código.
  mostrarProximoCodigo();

  setTimeout(() => {
    mensagem.textContent = "";
    mensagem.className = "";
  }, 5000);
});
  