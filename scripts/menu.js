document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. ABRIR E FECHAR OS SUBMENUS (DROPDOWNS)
    // ==========================================
    const botoesMenu = document.querySelectorAll('.dropbtn');

    botoesMenu.forEach(botao => {
        botao.addEventListener('click', function(event) {
            event.preventDefault(); 
            
            const submenu = this.parentElement.querySelector('.dropdown-content');
            
            document.querySelectorAll('.dropdown-content').forEach(menu => {
                if (menu !== submenu) {
                    menu.classList.remove('mostrar-dropdown');
                }
            });

            if (submenu) {
                submenu.classList.toggle('mostrar-dropdown');
            }
        });
    });

    // Fecha ao clicar fora
    document.addEventListener('click', function(event) {
        if (!event.target.matches('.dropbtn')) {
            document.querySelectorAll('.dropdown-content').forEach(menu => {
                menu.classList.remove('mostrar-dropdown');
            });
        }
    });

    // ==========================================
    // 2. CONFIGURAÇÃO DO SUPABASE
    // ==========================================
    const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

    // Usamos 'var' ou verificamos se window.supabaseClient já existe para evitar erro de duplicação
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ==========================================
    // 3. FUNÇÃO PARA BUSCAR E EXIBIR DADOS 
    // ==========================================
    async function buscarDados(nomeTabela, titulo) {
        const areaPesquisa = document.getElementById('area-pesquisa');
        const tituloPesquisa = document.getElementById('titulo-pesquisa');
        const thead = document.getElementById('tabela-cabecalho');
        const tbody = document.getElementById('tabela-corpo');

        if (!areaPesquisa || !thead || !tbody) return;

        areaPesquisa.style.display = 'block';
        if(tituloPesquisa) tituloPesquisa.innerText = titulo;
        
        document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('mostrar-dropdown'));

        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="10">Buscando dados no servidor...</td></tr>';

        const { data, error } = await window.supabaseClient.from(nomeTabela).select('*');

        if (error) {
            tbody.innerHTML = `<tr><td colspan="10" style="color:red;">Erro ao buscar dados: ${error.message}</td></tr>`;
            console.error(error);
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10">Nenhum registro encontrado nesta tabela.</td></tr>';
            return;
        }

        const colunas = Object.keys(data[0]); 
        let headHTML = '<tr>';
        colunas.forEach(coluna => {
            headHTML += `<th>${coluna.toUpperCase()}</th>`;
        });
        headHTML += '<th>AÇÕES</th></tr>';
        thead.innerHTML = headHTML;

        let bodyHTML = '';
        data.forEach(linha => {
            bodyHTML += '<tr>';
            colunas.forEach(coluna => {
                bodyHTML += `<td>${linha[coluna]}</td>`;
            });
            bodyHTML += `<td><button class="btn-editar">Editar</button></td></tr>`;
        });
        tbody.innerHTML = bodyHTML;
    }

    // ==========================================
    // 4. EVENTOS DE CLIQUE NOS BOTÕES "PESQUISAR"
    // ==========================================
    document.getElementById('pesq-clientes')?.addEventListener('click', (e) => {
        e.preventDefault();
        buscarDados('clientes', 'Pesquisa de Clientes'); 
    });

    document.getElementById('pesq-categorias')?.addEventListener('click', (e) => {
        e.preventDefault();
        buscarDados('categorias', 'Pesquisa de Categorias'); 
    });

    document.getElementById('pesq-produtos')?.addEventListener('click', (e) => {
        e.preventDefault();
        buscarDados('produtos', 'Pesquisa de Produtos'); 
    });

    document.getElementById('pesq-orcamentos')?.addEventListener('click', (e) => {
        e.preventDefault();
        buscarDados('orcamentos', 'Pesquisa de Orçamentos'); 
    });
});