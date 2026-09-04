/*
  =====================================================
  CONFIGURAÇÃO DO SUPABASE
  =====================================================
  Mesmos dados de conexão usados nas outras páginas
  do sistema.
*/

const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/*
  =====================================================
  PEGANDO OS ELEMENTOS DO HTML
  =====================================================
*/

const formCategoria = document.getElementById("categoriaProdutos");
const codigoCategoriaInput = document.getElementById("codigoCategoria");
const descricaoCategoriaInput = document.getElementById("descricaoCategoria");
const mensagem = document.getElementById("mensagem");
const botaoSalvar = document.getElementById("botao");

// Guarda o ID da categoria quando estamos editando (null = cadastro novo)
let idCategoriaEmEdicao = null;

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
  NOME DA TABELA NO BANCO
  =====================================================
  IMPORTANTE: o nome abaixo precisa ser IGUAL ao nome
  da tabela criada no Supabase. Aqui usamos o mesmo nome
  que já aparece no menu.js ("categoria_produto").
  Se a sua tabela tiver outro nome, troque aqui.
*/
const NOME_TABELA = "categoria_produto";

/*
  =====================================================
  MOSTRAR O PRÓXIMO CÓDIGO (só um preview)
  =====================================================
  O código de verdade (a chave da tabela) quem gera é o
  próprio banco de dados sozinho. Aqui a gente só faz uma
  ESTIMATIVA de qual vai ser o próximo número, contando
  quantas categorias já existem e somando 1, só para o
  usuário ter uma ideia antes de salvar.
*/
async function mostrarProximoCodigo() {
  const { count, error } = await supabaseClient
    .from(NOME_TABELA)
    .select("*", { count: "exact", head: true });

  if (error) {
    // Se não conseguir contar, não trava a tela, só deixa em branco.
    codigoCategoriaInput.value = "";
    console.error(error);
    return;
  }

  codigoCategoriaInput.value = (count ?? 0) + 1;
}

/*
  =====================================================
  FUNÇÃO PARA CARREGAR UMA CATEGORIA PARA EDIÇÃO
  =====================================================
  Usada quando a página é aberta com "?id=5" na URL,
  o que acontece ao clicar em "Editar" na listagem do menu.
*/
async function carregarCategoriaNoFormulario(idCategoria) {
  const { data: categoria, error } = await supabaseClient
    .from(NOME_TABELA)
    .select("*")
    .eq("categoriaprodutoid", idCategoria)
    .single();

  if (error || !categoria) {
    mensagem.textContent = "Não foi possível carregar esta categoria.";
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  codigoCategoriaInput.value = categoria.categoriaprodutoid;
  descricaoCategoriaInput.value = categoria.ds_categoria_produto;

  idCategoriaEmEdicao = categoria.categoriaprodutoid;
  botaoSalvar.textContent = "Atualizar Categoria";
}

/*
  =====================================================
  QUANDO A PÁGINA ABRE
  =====================================================
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
  =====================================================
  EVENTO DE ENVIO DO FORMULÁRIO
  =====================================================
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

  /*
    Montamos o objeto com os dados da categoria.
    IMPORTANTE: o nome da propriedade "descricao_categoria"
    precisa ser igual ao nome da coluna no Supabase.
  */
  const dadosCategoria = {
    ds_categoria_produto: descricaoCategoria
  };

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

  if (erroSupabase) {
    mensagem.textContent = "Erro ao salvar categoria: " + erroSupabase.message;
    mensagem.className = "erro";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  mensagem.textContent = idCategoriaEmEdicao
    ? "Categoria atualizada com sucesso!"
    : "Categoria salva com sucesso!";
  mensagem.className = "sucesso";

  formCategoria.reset();
  idCategoriaEmEdicao = null;
  botaoSalvar.textContent = "Salvar Categoria";

  // Depois de salvar, atualizamos o preview do próximo código.
  mostrarProximoCodigo();

  setTimeout(() => {
    mensagem.textContent = "";
    mensagem.className = "";
  }, 5000);
});
/*
  =====================================================
  FORÇAR LETRAS MAIÚSCULAS NOS CAMPOS DE TEXTO
  =====================================================
*/
document.addEventListener("DOMContentLoaded", function () {
  // Seleciona todos os inputs de texto e textareas da página atual
  const camposTexto = document.querySelectorAll('input[type="text"], textarea');

  camposTexto.forEach(campo => {
    campo.addEventListener('input', function () {
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