
const formUser = document.querySelector('#formUser');
const tipoUser = document.querySelector('#tipoUser');
const userNome = document.querySelector('#UserNome');
const userSenha = document.querySelector('#UserSenha');
const mensagem = document.querySelector('#mensagem');
const botaoEntrar = formUser.querySelector('button[type="submit"]');

formUser.addEventListener('submit', async function (evento) {
  // Impede o recarregamento da página ao enviar o formulário.
  evento.preventDefault();

  // trava o botão durante a autenticação
  botaoEntrar.disabled = true;
  mensagem.textContent = 'Autenticando...';
  mensagem.className = '';

  const emailDigitado = userNome.value.trim();
  const senhaDigitada = userSenha.value;

  // FAZ O LOGIN SEGURO USANDO O SUPABASE AUTH
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: emailDigitado,
    password: senhaDigitada
  });

  if (authError) {
    mensagem.textContent = 'E-mail ou senha inválidos.';
    mensagem.className = 'erro';
    console.error(authError);
    botaoEntrar.disabled = false;
    return;
  }

  // BUSCA AS PERMISSÕES NA TABELA 'usuarios' USANDO O ID SEGURO
  const idSeguro = authData.user.id;

  const { data: usuarioEncontrado, error: dbError } = await supabaseClient
    .from('usuarios')
    .select('id_usuarios, usuario, tipo_usuario, pode_editar, pode_excluir')
    .eq('auth_id', idSeguro)
    .eq('tipo_usuario', tipoUser.value) // Confere se ele acertou o nível de acesso no select
    .maybeSingle();

  if (dbError) {
    mensagem.textContent = 'Erro ao buscar permissões do usuário.';
    mensagem.className = 'erro';
    console.error(dbError);
    await supabaseClient.auth.signOut();
    botaoEntrar.disabled = false;
    return;
  }

  if (!usuarioEncontrado) {
    // Se logou com sucesso, mas o tipo_usuario não bateu ou o auth_id não está na tabela
    await supabaseClient.auth.signOut(); // Desloga por segurança
    mensagem.textContent = 'Acesso não autorizado para este perfil.';
    mensagem.className = 'erro';
    botaoEntrar.disabled = false;
    return;
  }

  // Guarda os dados de perfil no navegador
  localStorage.setItem('usuarioLogado', JSON.stringify(usuarioEncontrado));

  mensagem.textContent = 'Login realizado com sucesso!';
  mensagem.className = 'sucesso';

  // Redireciona para o menu
  window.location.href = 'menu.html';
});
