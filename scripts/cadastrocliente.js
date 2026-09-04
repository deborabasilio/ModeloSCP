/*
  =====================================================
  CONFIGURAÇÃO DO SUPABASE
  =====================================================
*/
const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
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
const botaoSalvar = document.getElementById("botao");

// Guarda o ID do cliente quando estamos editando (null = cadastro novo)
let idClienteEmEdicao = null;

/*
  =====================================================
  FUNÇÃO PARA FORMATAR CPF OU CNPJ CONFORME O TIPO SELECIONADO
  =====================================================
*/
function formatarCpfCnpj(valorDigitado, tipo) {
  let numeros = valorDigitado.replace(/\D/g, "");

  if (tipo === "F") {
    // CPF: 000.000.000-00
    numeros = numeros.slice(0, 11);
    numeros = numeros.replace(/(\d{3})(\d)/, "$1.$2");
    numeros = numeros.replace(/(\d{3})(\d)/, "$1.$2");
    numeros = numeros.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else if (tipo === "J") {
    // CNPJ: 00.000.000/0000-00
    numeros = numeros.slice(0, 14);
    numeros = numeros.replace(/(\d{2})(\d)/, "$1.$2");
    numeros = numeros.replace(/(\d{3})(\d)/, "$1.$2");
    numeros = numeros.replace(/(\d{3})(\d)/, "$1/$2");
    numeros = numeros.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }

  return numeros;
}

// Enquanto o usuário digita o CPF/CNPJ, aplica a máscara do tipo já selecionado
cpfCnpjClienteInput.addEventListener("input", function () {
  cpfCnpjClienteInput.value = formatarCpfCnpj(
    cpfCnpjClienteInput.value,
    tipoClienteInput.value,
  );
});

// Quando o usuário troca o Tipo de Cliente, reaplica a máscara certa
// e libera/limpa o campo de documento
tipoClienteInput.addEventListener("change", function () {
  const tipo = tipoClienteInput.value;

  if (tipo === "") {
    cpfCnpjClienteInput.value = "";
    cpfCnpjClienteInput.disabled = true;
    cpfCnpjClienteInput.placeholder = "Selecione o tipo primeiro";
    return;
  }

  cpfCnpjClienteInput.disabled = false;
  cpfCnpjClienteInput.placeholder =
    tipo === "F" ? "000.000.000-00" : "00.000.000/0000-00";

  // Reformata o que já estiver digitado, caso o usuário troque o tipo depois
  cpfCnpjClienteInput.value = formatarCpfCnpj(cpfCnpjClienteInput.value, tipo);
});

// Estado inicial: campo bloqueado até escolher o tipo
cpfCnpjClienteInput.disabled = true;
cpfCnpjClienteInput.placeholder = "Selecione o tipo primeiro";

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

/*
  =====================================================
  FUNÇÃO PARA CARREGAR UM CLIENTE PARA EDIÇÃO
  =====================================================
  Usada quando a página é aberta com "?id=5" na URL,
  o que acontece ao clicar em "Editar" na listagem do menu.
*/
async function carregarClienteNoFormulario(idCliente) {
  const { data: cliente, error } = await supabaseClient
    .from("clientes")
    .select("*")
    .eq("clienteid", idCliente)
    .single();

  if (error || !cliente) {
    mensagem.textContent = "Não foi possível carregar este cliente.";
    mensagem.className = "erro";
    console.error(error);
    return;
  }

  codigoOrcamentoInput.value = cliente.clienteid;
  tipoClienteInput.value = cliente.tipo_cliente;
  cpfCnpjClienteInput.value = cliente.cpf_cnpj_cliente;
  nomeClienteInput.value = cliente.nome_cliente;

  idClienteEmEdicao = cliente.clienteid;
  botaoSalvar.textContent = "Atualizar Cliente";
}

/*
  =====================================================
  QUANDO A PÁGINA ABRE
  =====================================================
*/
const parametrosUrl = new URLSearchParams(window.location.search);
const idClienteParaEditar = parametrosUrl.get("id");

if (idClienteParaEditar) {
  carregarClienteNoFormulario(idClienteParaEditar);
} else {
  // Executa a busca do próximo código apenas quando é um cadastro novo
  buscarProximoCodigo();
}

/*
  =====================================================
  EVENTO DE ENVIO DO FORMULÁRIO
  =====================================================
*/
formCliente.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const tipoCliente = tipoClienteInput.value;
  const cpfCnpjCliente = cpfCnpjClienteInput.value;
  const nomeCliente = nomeClienteInput.value;

  const dadosCliente = {
    tipo_cliente: tipoCliente,
    cpf_cnpj_cliente: cpfCnpjCliente,
    nome_cliente: nomeCliente,
  };

  let erroSupabase = null;
  let idGerado = idClienteEmEdicao;

  if (idClienteEmEdicao) {
    // Já existe um cliente sendo editado: atualiza em vez de inserir
    const { error } = await supabaseClient
      .from("clientes")
      .update(dadosCliente)
      .eq("clienteid", idClienteEmEdicao);

    erroSupabase = error;
  } else {
    // Adicionado o .select() no final para garantir que o banco retorne o dado gravado
    const { data, error } = await supabaseClient
      .from("clientes")
      .insert(dadosCliente)
      .select();

    erroSupabase = error;
    if (!error) idGerado = data[0].clienteid;
  }

  if (erroSupabase) {
    mensagem.textContent = "Erro ao salvar cliente: " + erroSupabase.message;
    mensagem.className = "erro";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  mensagem.textContent = idClienteEmEdicao
    ? `Cliente #${idGerado} atualizado com sucesso!`
    : `Cliente #${idGerado} salvo com sucesso!`;
  mensagem.className = "sucesso";

  // Limpa o formulário e volta para o modo de cadastro novo
  formCliente.reset();
  idClienteEmEdicao = null;
  botaoSalvar.textContent = "Salvar";

  // Busca o próximo código para o usuário já cadastrar o próximo cliente
  buscarProximoCodigo();

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
