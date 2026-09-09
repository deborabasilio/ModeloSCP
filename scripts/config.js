// =====================================================
// CONFIGURAÇÃO CENTRAL DO SUPABASE
// =====================================================
// ANTES: a URL e a chave do Supabase estavam copiadas e coladas em
// quase todos os arquivos .js do projeto (login, menu, produtos,
// clientes, categorias, orçamentos, faturamento, impressões...).
// Isso é um problema de manutenção: se um dia a chave mudar, seria
// preciso lembrar de trocar em ~9 lugares diferentes, e esquecer um
// só já quebra aquela tela.
//
// AGORA: existe um único lugar para essa configuração. Todo o resto
// do sistema usa a variável global "supabaseClient" criada aqui.
//
// IMPORTANTE (segurança): a "anon/publishable key" do Supabase é uma
// chave PÚBLICA por definição — ela foi feita para rodar no navegador
// do usuário final e aparecer no código-fonte. Ela não concede acesso
// nenhum sozinha; quem decide o que cada usuário pode ler/gravar são
// as políticas de RLS configuradas nas tabelas do banco. Ou seja: não
// há problema de segurança em ela "aparecer" no JS — o que importa é
// ter RLS bem configurada (que você já tem) cobrindo SELECT, INSERT,
// UPDATE e DELETE de cada tabela.
//
// Este arquivo precisa ser incluído (via <script>) em toda página,
// DEPOIS da biblioteca do Supabase e ANTES de scripts/common.js e do
// script específico da página.

const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

// Guardamos em "window" para que fique acessível globalmente em
// qualquer outro script carregado depois deste, sem precisar recriar
// a conexão em cada arquivo.
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
