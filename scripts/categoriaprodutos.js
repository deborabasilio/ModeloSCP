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

// Assim que a página abre, já mostramos o próximo código.
mostrarProximoCodigo();

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
  const novaCategoria = {
    ds_categoria_produto: descricaoCategoria
  };

  const { error } = await supabaseClient
    .from(NOME_TABELA)
    .insert(novaCategoria);

  if (error) {
    mensagem.textContent = "Erro ao salvar categoria: " + error.message;
    mensagem.className = "erro";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  mensagem.textContent = "Categoria salva com sucesso!";
  mensagem.className = "sucesso";

  formCategoria.reset();

  // Depois de salvar, atualizamos o preview do próximo código.
  mostrarProximoCodigo();

  setTimeout(() => {
    mensagem.textContent = "";
    mensagem.className = "";
  }, 5000);
});