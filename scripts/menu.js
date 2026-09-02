document.addEventListener("DOMContentLoaded", function () {
  // ==========================================
  // 1. ABRIR E FECHAR OS SUBMENUS (DROPDOWNS)
  // ==========================================
  const botoesMenu = document.querySelectorAll(".dropbtn");

  botoesMenu.forEach((botao) => {
    botao.addEventListener("click", function (event) {
      event.preventDefault();

      const submenu = this.parentElement.querySelector(".dropdown-content");

      document.querySelectorAll(".dropdown-content").forEach((menu) => {
        if (menu !== submenu) {
          menu.classList.remove("mostrar-dropdown");
        }
      });

      if (submenu) {
        submenu.classList.toggle("mostrar-dropdown");
      }
    });
  });

  // Fecha ao clicar fora
  document.addEventListener("click", function (event) {
    if (!event.target.matches(".dropbtn")) {
      document.querySelectorAll(".dropdown-content").forEach((menu) => {
        menu.classList.remove("mostrar-dropdown");
      });
    }
  });

  // ==========================================
  // 2. CONFIGURAÇÃO DO SUPABASE E VARIÁVEIS GLOBAIS
  // ==========================================
  const SUPABASE_URL = "https://whidvijhqmudgzyylbfo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_MHgrDJpm8wa4mGTJWPR0sg_08Bc9dut";

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );

  let tabelaAtual = '';
  let queryAtual = '*';

  // ==========================================
  // 3. FUNÇÃO PARA BUSCAR E EXIBIR DADOS
  // ==========================================
  async function buscarDados(nomeTabela, titulo, query = "*", filtro = null) {
    tabelaAtual = nomeTabela;
    queryAtual = query;

    const areaPesquisa = document.getElementById("area-pesquisa");
    const tituloPesquisa = document.getElementById("titulo-pesquisa");
    const thead = document.getElementById("tabela-cabecalho");
    const tbody = document.getElementById("tabela-corpo");
    const selectColuna = document.getElementById("filtro-coluna");

    if (!areaPesquisa || !thead || !tbody) return;

    areaPesquisa.style.display = "block";
    if (tituloPesquisa) tituloPesquisa.innerText = titulo;

    document
      .querySelectorAll(".dropdown-content")
      .forEach((m) => m.classList.remove("mostrar-dropdown"));

    thead.innerHTML = "";
    tbody.innerHTML = '<tr><td colspan="10">Buscando dados no servidor...</td></tr>';

    let requisicao = window.supabaseClient.from(nomeTabela).select(query);

    // SE HOUVER UM FILTRO APLICADO PELO USUÁRIO
    if (filtro && filtro.valor) {
      let nomeColunaReal = filtro.coluna.split(':')[1] || filtro.coluna; 
      
      // CONVERSÃO DE JOIN: Transforma "clientes(nome_cliente)" em "clientes.nome_cliente"
      if (nomeColunaReal.includes('(') && nomeColunaReal.includes(')')) {
        nomeColunaReal = nomeColunaReal.replace(/\(/g, '.').replace(/\)/g, '');
      }

      // Identifica o tipo de dado baseado no nome da coluna real ou de relacionamento
      const ehNumero = nomeColunaReal.includes('id') || nomeColunaReal.includes('vl_');
      const ehData = nomeColunaReal.includes('dt_');
      
      if (ehNumero) {
        // IDs e valores numéricos exigem busca exata para evitar conflito de tipos no Postgres
        requisicao = requisicao.eq(nomeColunaReal, filtro.valor);
      } else if (ehData) {
        // Para datas, permite busca por aproximação textual (ex: ano, mês ou dia específico)
        if (filtro.condicao === "contem") {
          requisicao = requisicao.ilike(nomeColunaReal, `%${filtro.valor}%`);
        } else {
          requisicao = requisicao.eq(nomeColunaReal, filtro.valor);
        }
      } else {
        // Textos normais e colunas de tabelas Relacionadas (joins)
        if (filtro.condicao === "contem") {
          requisicao = requisicao.ilike(nomeColunaReal, `%${filtro.valor}%`);
        } else if (filtro.condicao === "igual") {
          requisicao = requisicao.ilike(nomeColunaReal, filtro.valor);
        }
      }
    }

    const { data, error } = await requisicao;

    if (error) {
      tbody.innerHTML = `<tr><td colspan="10" style="color:red;">Erro ao buscar dados: ${error.message}</td></tr>`;
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10">Nenhum registro encontrado com estes filtros.</td></tr>';
      return;
    }

    const colunas = Object.keys(data[0]);

    // PREENCHE O DROPDOWN DE COLUNAS AUTOMATICAMENTE SE FOR A PRIMEIRA BUSCA (SEM FILTRO)
    if (selectColuna && !filtro) {
      selectColuna.innerHTML = '<option value="">Selecione a coluna...</option>';
      colunas.forEach(coluna => {
        const nomeFormatado = coluna.replace(/_/g, " ").toUpperCase();
        
        let queryArray = query.split(',').map(item => item.trim());
        let colunaOriginal = queryArray.find(q => q.startsWith(coluna + ':')) || coluna;

        selectColuna.innerHTML += `<option value="${colunaOriginal}">${nomeFormatado}</option>`;
      });
    }

    let headHTML = "<tr>";
    colunas.forEach((coluna) => {
      const nomeFormatado = coluna.replace(/_/g, " ").toUpperCase();
      headHTML += `<th>${nomeFormatado}</th>`;
    });
    headHTML += "<th>AÇÕES</th></tr>";
    thead.innerHTML = headHTML;

    let bodyHTML = "";
    data.forEach((linha) => {
      bodyHTML += "<tr>";
      colunas.forEach((coluna) => {
        let valor = linha[coluna];

        // REGRA DO JOIN (Extrai o valor de objetos aninhados)
        if (typeof valor === "object" && valor !== null) {
          valor = Object.values(valor)[0];
        }

        // REGRA DE CLIENTE
        if (coluna === "Tipo_de_Cliente") {
          if (valor === "F" || valor === "f") valor = "Físico";
          if (valor === "J" || valor === "j") valor = "Jurídico";
        }

        // REGRA DE STATUS
        if (coluna === "Status") {
          const statusTexto = String(valor).toUpperCase(); 
          if (statusTexto === "ATIVO") {
            valor = `<span style="color: green; font-weight: bold;">${valor}</span>`;
          } else if (statusTexto === "INATIVO") {
            valor = `<span style="color: red; font-weight: bold;">${valor}</span>`;
          }
        }

        bodyHTML += `<td>${valor || ""}</td>`;
      });
      
      bodyHTML += `<td style="white-space: nowrap;">
        <button class="btn-editar">Editar</button>
        <button class="btn-excluir">Excluir</button>
      </td></tr>`;
    });
    tbody.innerHTML = bodyHTML;
  }

  // ==========================================
  // 4. EVENTOS DO BOTÃO DE FILTRAR (PESQUISA AVANÇADA)
  // ==========================================
  document.getElementById("btn-filtrar")?.addEventListener("click", (e) => {
    e.preventDefault();
    
    const colunaSelecionada = document.getElementById("filtro-coluna").value;
    const condicaoSelecionada = document.getElementById("filtro-condicao").value;
    const valorDigitado = document.getElementById("filtro-valor").value;

    if (!colunaSelecionada) {
      alert("Por favor, selecione uma coluna para filtrar.");
      return;
    }

    buscarDados(
      tabelaAtual, 
      document.getElementById("titulo-pesquisa").innerText, 
      queryAtual, 
      {
        coluna: colunaSelecionada,
        condicao: condicaoSelecionada,
        valor: valorDigitado
      }
    );
  });

  // ==========================================
  // 5. EVENTOS DE CLIQUE NOS MENUS 
  // ==========================================
  document.getElementById("pesq-produtos")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query = "Código:produtoid, Produto:ds_produto, Valor_Unitário:vl_venda_produto, Observação:obs_produto, Categoria:categoria_produto(ds_categoria_produto), Status:status_produto, Data_de_Cadastro:dt_cadastro_produto";
    buscarDados("produtos", "Pesquisa de Produtos", query);
  });

  document.getElementById("pesq-orcamentos")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query = "Código:orcamentoid, Data_do_Orçamento:dt_orcamento, Cliente:clientes(nome_cliente), Valor_Total:vl_total_orcamento, Data_de_Validade:dt_validade_orcamento";
    buscarDados("orcamentos", "Pesquisa de Orçamentos", query);
  });
  
  document.getElementById("pesq-clientes")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query = "Código:clienteid, Tipo_de_Cliente:tipo_cliente, CPF_CNPJ:cpf_cnpj_cliente, Nome:nome_cliente";
    buscarDados("clientes", "Pesquisa de Clientes", query);
  });

  document.getElementById("pesq-categorias")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query = "Código:categoriaprodutoid, Descrição_da_Categoria:ds_categoria_produto";
    buscarDados("categoria_produto", "Pesquisa de Categorias", query);
  });
});