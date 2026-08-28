/*
  =====================================================
  CONFIGURAÇÃO DO SUPABASE
  =====================================================

  Aqui colocamos os dados do projeto Supabase.

  SUPABASE_URL:
  É a URL do projeto no Supabase.

  SUPABASE_ANON_KEY:
  É a chave pública usada no front-end.

  Importante:
  Nunca use a service_role key no front-end.
*/

const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

/*
  Criamos o cliente do Supabase.

  A variável "supabase" existe porque carregamos a biblioteca
  no arquivo index.html com esta linha:

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
*/

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/*
  =====================================================
  PEGANDO OS ELEMENTOS DO HTML
  =====================================================

  Aqui pegamos os elementos da tela usando o ID deles.
  Assim conseguimos acessar os valores digitados pelo usuário.
*/

const formCliente = document.getElementById("formCliente");
const tipoClienteInput = document.getElementById("tipoCliente");
const cpfCnpjClienteInput = document.getElementById("cpfCnpjCliente");
const nomeClienteInput = document.getElementById("nomeCliente");
const mensagem = document.getElementById("mensagem");

/*
  =====================================================
  EVENTO DE ENVIO DO FORMULÁRIO
  =====================================================

  Este evento será executado quando o usuário clicar no botão Salvar.
*/

formCliente.addEventListener("submit", async function(evento) {
  /*
    Por padrão, quando um formulário é enviado,
    o navegador recarrega a página.

    O preventDefault impede esse comportamento.
  */
  evento.preventDefault();

  /*
    Pegamos os valores digitados nos campos do formulário.
  */
  const tipoCliente = tipoClienteInput.value;
  const cpfCnpjCliente = cpfCnpjClienteInput.value;
  const nomeCliente = nomeClienteInput.value;

  /*
    Montamos um objeto JavaScript com os dados do cliente.

    Atenção:
    Os nomes das propriedades precisam ser iguais aos nomes
    das colunas no banco de dados.

    Como a tabela foi criada no PostgreSQL sem aspas,
    normalmente os nomes ficam em minúsculo:

    CLIENTE              vira cliente
    TIPO_CLIENTE         vira tipo_cliente
    CPF_CNPJ_CLIENTE     vira cpf_cnpj_cliente
    NOME_CLIENTE         vira nome_cliente
  */
  const novoCliente = {
    tipo_cliente: tipoCliente,
    cpf_cnpj_cliente: cpfCnpjCliente,
    nome_cliente: nomeCliente
  };

  /*
    Enviamos o objeto novoCliente para o Supabase.

    .from("cliente")
    indica a tabela onde vamos gravar.

    .insert(novoCliente)
    insere o registro na tabela.
  */
  const { error } = await supabaseClient
    .from("cliente")
    .insert(novoCliente);

  /*
    Se acontecer algum erro, mostramos a mensagem de erro
    e paramos a execução.
  */
  if (error) {
    mensagem.textContent = "Erro ao salvar cliente: " + error.message;
    return;
  }

  /*
    Se chegou até aqui, significa que o registro foi salvo com sucesso.
  */
  mensagem.textContent = "Cliente salvo com sucesso!";

  /*
    Limpamos o formulário depois de salvar.
  */
  formCliente.reset();
});