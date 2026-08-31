// Dados do projeto Supabase usados para acessar o banco de dados.
const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

// Cria a conexão que será usada para consultar a tabela usuarios.
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Pegamos os elementos da página para ler os valores e mostrar mensagens.
const formUser = document.querySelector('#formUser');
const tipoUser = document.querySelector('#tipoUser');
const userNome = document.querySelector('#UserNome');
const userSenha = document.querySelector('#UserSenha');
const mensagem = document.querySelector('#mensagem');

formUser.addEventListener('submit', async function (evento) {
  // Impede o recarregamento da página ao enviar o formulário.
  evento.preventDefault();

  mensagem.textContent = 'Verificando login...';
  mensagem.className = '';

  // Procura na tabela usuarios um registro com os dados informados no login.
  const { data: usuarioEncontrado, error } = await supabaseClient
    .from('usuarios')
    .select('id_usuarios, usuario, tipo_usuario')
    .eq('usuario', userNome.value.trim())
    .eq('senha', userSenha.value)
    .eq('tipo_usuario', tipoUser.value)
    .maybeSingle();

  // Trata erros de conexão, permissões ou acesso ao Supabase.
  if (error) {
    mensagem.textContent = 'Não foi possível verificar o login. Tente novamente.';
    mensagem.className = 'erro';
    console.error(error);
    return;
  }

  // Se não houver registro igual no banco, o acesso não é permitido.
  if (!usuarioEncontrado) {
    mensagem.textContent = 'Usuário, senha ou tipo de acesso inválido.';
    mensagem.className = 'erro';
    return;
  }

  // Guarda os dados do usuário, mas nunca guarda a senha.
  sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioEncontrado));

  mensagem.textContent = 'Login realizado com sucesso!';
  mensagem.className = 'sucesso';

  // Abre o menu principal somente depois de validar o usuário.
  window.location.href = 'menu.html';
});
