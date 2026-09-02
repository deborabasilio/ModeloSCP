/*
  =====================================================
  CONFIGURAÇÃO DO SUPABASE
  =====================================================
*/
const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/*
  =====================================================
  PEGANDO OS ELEMENTOS DO HTML
  =====================================================
*/
const formCliente = document.getElementById("formCliente");
const codigoOrcamentoInput = document.getElementById("codigoCliente");
const tipoClienteInput = document.getElementById("tipoCliente");
const cpfCnpjClienteInput = document.getElementById("cpfCnpjCliente");
const nomeClienteInput = document.getElementById("nomeCliente");
const mensagem = document.getElementById("mensagem");

/*
  =====================================================
  FUNÇÃO PARA BUSCAR O PRÓXIMO CÓDIGO
  =====================================================
*/
async function buscarProximoCodigo() {
  codigoOrcamentoInput.value = "Buscando...";

  // Busca apenas o maior clienteid cadastrado
  const { data, error } = await supabaseClient
    .from("clientes")
    .select("clienteid")
    .order("clienteid", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar próximo código:", error);
    codigoOrcamentoInput.value = "Erro";
    return;
  }

  // Se houver dados, soma 1. Se a tabela estiver vazia, começa do 1.
  let proximoId = 1;
  if (data && data.length > 0) {
    proximoId = data[0].clienteid + 1;
  }

  codigoOrcamentoInput.value = proximoId;
}

// Executa a busca assim que o arquivo é carregado
buscarProximoCodigo();


/*
  =====================================================
  EVENTO DE ENVIO DO FORMULÁRIO
  =====================================================
*/
formCliente.addEventListener("submit", async function(evento) {
  evento.preventDefault();

  const tipoCliente = tipoClienteInput.value;
  const cpfCnpjCliente = cpfCnpjClienteInput.value;
  const nomeCliente = nomeClienteInput.value;

  const novoCliente = {
    tipo_cliente: tipoCliente,
    cpf_cnpj_cliente: cpfCnpjCliente,
    nome_cliente: nomeCliente
  };

  // Adicionado o .select() no final para garantir que o banco retorne o dado gravado
  const { data, error } = await supabaseClient
    .from("clientes")
    .insert(novoCliente)
    .select();

  if (error) {
    mensagem.textContent = "Erro ao salvar cliente: " + error.message;
    mensagem.className = "erro"; 
    
    setTimeout(() => {
        mensagem.textContent = "";
        mensagem.className = "";
    }, 5000);
    
    return;
  }

  // Mostra a confirmação com o ID real que o banco gerou
  const idGerado = data[0].clienteid;
  mensagem.textContent = `Cliente #${idGerado} salvo com sucesso!`;
  mensagem.className = "sucesso";

  // Limpa o formulário
  formCliente.reset();

  // Busca o próximo código para o usuário já cadastrar o próximo cliente
  buscarProximoCodigo();

  setTimeout(() => {
      mensagem.textContent = ""; 
      mensagem.className = "";  
  }, 5000);
});