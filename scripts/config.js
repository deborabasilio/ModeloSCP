// =====================================================
// CONFIGURAÇÃO CENTRAL DO SUPABASE
// =====================================================
// o sistema usa a variável global "supabaseClient" criada aqui.

const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

//para que fique acessível globalmente
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
