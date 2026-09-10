// FUNÇÕES COMPARTILHADAS ENTRE TODAS AS TELAS


/*
  =====================================================
  1. PROTEÇÃO DE ROTA + PERMISSÕES
  =====================================================
  Confere se existe um usuário logado no localStorage. Se não
  existir, redireciona para o login. Se existir, devolve um objeto
  com o usuário e as permissões já calculadas (ehAdmin, podeEditar,
  podeExcluir), para a página usar como quiser.
*/
function protegerRota() {
  const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");

  if (!usuarioLogadoTexto) {
    window.location.href = "login.html";
    return null;
  }

  let usuarioLogado;
  try {
    usuarioLogado = JSON.parse(usuarioLogadoTexto);
  } catch (erro) {
    // localStorage corrompido/adulterado: melhor mandar para o login de novo.
    localStorage.removeItem("usuarioLogado");
    window.location.href = "login.html";
    return null;
  }

  const tipoUsuarioLogado = String(usuarioLogado.tipo_usuario || "")
    .trim()
    .toUpperCase();
  const ehAdmin = tipoUsuarioLogado !== "PADRAO";
  const podeEditar = ehAdmin || usuarioLogado.pode_editar === true;
  const podeExcluir = ehAdmin || usuarioLogado.pode_excluir === true;

  return { usuarioLogado, ehAdmin, podeEditar, podeExcluir };
}

// Usada nas telas de cadastro (produtos, clientes, categorias, orçamentos):
// se a página foi aberta em modo edição ("?id=...") e o usuário não pode editar, barra o acesso e manda de volta para o menu.
function bloquearEdicaoSemPermissao(podeEditar, exigirModoEdicao = false) {
  const parametros = new URLSearchParams(window.location.search);
  const idAcesso = parametros.get("id");
  const estaEmModoEdicao = !exigirModoEdicao || parametros.get("modo") === "editar";

  if (idAcesso && estaEmModoEdicao && !podeEditar) {
    alert("Você não tem permissão para visualizar ou editar registros.");
    window.location.href = "menu.html";
  }
}

/*
  =====================================================
  2. FORMATAÇÃO DE MOEDA (padrão brasileiro)
  =====================================================
*/
function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/*
  Mostra uma estimativa do próximo ID para fins de interface. O banco continua
  sendo a fonte e gera a chave definitiva ao salvar o registro.
*/
async function mostrarProximoCodigoNoCampo(tabela, colunaId, campo) {
  campo.value = "Buscando...";

  const { data, error } = await supabaseClient
    .from(tabela)
    .select(colunaId)
    .order(colunaId, { ascending: false })
    .limit(1);

  if (error) {
    campo.value = "";
    console.error("Erro ao buscar o próximo código:", error);
    return null;
  }

  const maiorId = Number(data?.[0]?.[colunaId]) || 0;
  const proximoId = maiorId + 1;
  campo.value = proximoId;
  return proximoId;
}

/*
  =====================================================
  3. EXTRAIR O CÓDIGO ESCONDIDO NOS CAMPOS DE DATALIST
  =====================================================
*/
function extrairCodigoDoTexto(texto) {
  const match = String(texto || "").match(/\(Código:\s*(\d+)\)\s*$/);
  return match ? match[1] : null;
}

/*
  =====================================================
  4. ESCAPE DE HTML (proteção contra XSS armazenado)
  =====================================================
*/
function escapeHTML(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/*
  =====================================================
  5. FORÇAR LETRAS MAIÚSCULAS NOS CAMPOS DE TEXTO
  =====================================================
  Antes esse bloco de código (idêntico) estava colado em todo arquivo
  de script. Agora basta chamar ativarMaiusculasAutomaticas() uma vez.
*/
function ativarMaiusculasAutomaticas() {
  const camposTexto = document.querySelectorAll('input[type="text"], textarea');

  camposTexto.forEach((campo) => {
    campo.addEventListener("input", function () {
      const inicioCursor = this.selectionStart;
      const fimCursor = this.selectionEnd;
      this.value = this.value.toUpperCase();
      this.setSelectionRange(inicioCursor, fimCursor);
    });
  });
}

document.addEventListener("DOMContentLoaded", ativarMaiusculasAutomaticas);

/*
  =====================================================
  6. BOTÃO VOLTAR: FECHA A ABA EM VEZ DE NAVEGAR
  =====================================================
  Como as telas de cadastro são sempre abertas em uma nova aba (a
  partir do menu), "Voltar" deve fechar a aba atual e devolver o
  usuário para a aba do menu que já estava aberta.
*/
function voltarFechandoAba() {
  window.close();

  // Se o navegador não deixar fechar (ex.: a página foi aberta
  // digitando a URL direto, e não por um link/script), caímos de
  // volta para o menu.
  setTimeout(() => {
    window.location.href = "menu.html";
  }, 300);
}

function ativarBotoesVoltar() {
  document
    .getElementById("botaoVoltarForm")
    ?.addEventListener("click", voltarFechandoAba);

  document
    .getElementById("botaoVoltarVis")
    ?.addEventListener("click", voltarFechandoAba);
}

document.addEventListener("DOMContentLoaded", ativarBotoesVoltar);
