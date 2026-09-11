/*
  ==============================
  PEGANDO OS ELEMENTOS DO HTML
  ==============================
*/
const formCliente = document.getElementById("formCliente");
const codigoClienteInput = document.getElementById("codigoCliente");
const tipoClienteInput = document.getElementById("tipoCliente");
const cpfCnpjClienteInput = document.getElementById("cpfCnpjCliente");
const nomeClienteInput = document.getElementById("nomeCliente");
const telefoneClienteInput = document.getElementById("telefoneCliente");
const enderecoClienteInput = document.getElementById("enderecoCliente");
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
const sessaoCliente = protegerRota();
if (sessaoCliente) {
  bloquearEdicaoSemPermissao(sessaoCliente.podeEditar);
}

/*
  =====================================================
  FUNÇÃO PARA BUSCAR O PRÓXIMO CÓDIGO
  =====================================================
*/
async function buscarProximoCodigo() {
  await mostrarProximoCodigoNoCampo("clientes", "clienteid", codigoClienteInput);
}

/*
  =====================================================
  FUNÇÃO PARA CARREGAR UM CLIENTE PARA EDIÇÃO
  =====================================================
*/
async function carregarClienteNoFormulario(idCliente) {
  mensagem.textContent = "Carregando dados do cliente...";
  mensagem.className = "";

  const { data: cliente, error } = await supabaseClient
    .from("clientes")
    .select("*")
    .eq("clienteid", idCliente)
    .single();

  if (error || !cliente) {
    mensagem.textContent = "Não foi possível carregar este cliente.";
    mensagem.className = "erro";
    console.error(error);
    document.documentElement.classList.remove("carregando-edicao");
    return;
  }

  codigoClienteInput.value = cliente.clienteid;
  tipoClienteInput.value = cliente.tipo_cliente;

  cpfCnpjClienteInput.disabled = false;
  cpfCnpjClienteInput.placeholder =
    cliente.tipo_cliente === "F" ? "000.000.000-00" : "00.000.000/0000-00";
  cpfCnpjClienteInput.value = formatarCpfCnpj(
    cliente.cpf_cnpj_cliente,
    cliente.tipo_cliente,
  );

  nomeClienteInput.value = cliente.nome_cliente;
  telefoneClienteInput.value = cliente.telefone_cliente ?? "";
  enderecoClienteInput.value = cliente.endereco_cliente ?? "";

  idClienteEmEdicao = cliente.clienteid;
  botaoSalvar.textContent = "Atualizar Cliente";

  const tituloPagina = document.getElementById("tituloPagina");
  const descricaoPagina = document.getElementById("descricaoPagina");
  if (tituloPagina) tituloPagina.textContent = "Atualizar Cliente";
  if (descricaoPagina) {
    descricaoPagina.textContent = `Atualize os dados do cliente #${cliente.clienteid}.`;
  }

  mensagem.textContent = "";
  mensagem.className = "";

  // Só mostra o formulário depois que ele já está preenchido com os
  // dados do cliente, evitando o "flash" da tela de cadastro vazia.
  document.documentElement.classList.remove("carregando-edicao");
}

/*
  ==================
  QUANDO A PÁGINA ABRE
  ==================
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
  const telefoneCliente = telefoneClienteInput.value;
  const enderecoCliente = enderecoClienteInput.value;

  if (!tipoCliente) {
    mensagem.textContent = "Selecione o tipo de cliente.";
    mensagem.className = "erro";
    return;
  }

  if (!nomeCliente.trim()) {
    mensagem.textContent = "Digite o nome do cliente.";
    mensagem.className = "erro";
    return;
  }

  const quantidadeEsperadaDeDigitos = tipoCliente === "F" ? 11 : 14;
  const quantidadeDeDigitos = cpfCnpjCliente.replace(/\D/g, "").length;
  if (quantidadeDeDigitos !== quantidadeEsperadaDeDigitos) {
    mensagem.textContent =
      tipoCliente === "F"
        ? "Informe os 11 dígitos do CPF."
        : "Informe os 14 dígitos do CNPJ.";
    mensagem.className = "erro";
    return;
  }

  const dadosCliente = {
    tipo_cliente: tipoCliente,
    cpf_cnpj_cliente: cpfCnpjCliente,
    nome_cliente: nomeCliente,
    telefone_cliente: telefoneCliente,
    endereco_cliente: enderecoCliente,
  };

  botaoSalvar.disabled = true;

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

  botaoSalvar.disabled = false;

  if (erroSupabase) {
    mensagem.textContent = "Erro ao salvar cliente: " + erroSupabase.message;
    mensagem.className = "erro";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  if (idClienteEmEdicao) {
    // Atualização de cliente existente: mantém os valores no formulário
    // e só mostra a mensagem de sucesso, sem voltar para o modo cadastro.
    mensagem.textContent = `Cliente #${idGerado} atualizado com sucesso!`;
    mensagem.className = "sucesso";

    setTimeout(() => {
      mensagem.textContent = "";
      mensagem.className = "";
    }, 5000);

    return;
  }

  // Cadastro de cliente novo: limpa o formulário para o próximo cadastro
  mensagem.textContent = `Cliente #${idGerado} salvo com sucesso!`;
  mensagem.className = "sucesso";

  formCliente.reset();
  telefoneClienteInput.value = "";
  enderecoClienteInput.value = "";
  cpfCnpjClienteInput.disabled = true;
  cpfCnpjClienteInput.placeholder = "Selecione o tipo primeiro";

  // Busca o próximo código para o usuário já cadastrar o próximo cliente
  buscarProximoCodigo();

  setTimeout(() => {
    mensagem.textContent = "";
    mensagem.className = "";
  }, 5000);
});