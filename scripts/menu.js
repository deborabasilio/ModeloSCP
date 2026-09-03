document.addEventListener("DOMContentLoaded", function () {
  // ==========================================
  // 0. VERIFICA SE O USUÁRIO ESTÁ LOGADO E QUAL É O TIPO DE ACESSO
  // ==========================================
  // O login.js guarda esses dados no navegador (sessionStorage) quando
  // o usuário entra com sucesso. Se não tiver nada aqui, mandamos a
  // pessoa de volta para a tela de login.
  const usuarioLogadoTexto = sessionStorage.getItem("usuarioLogado");

  if (!usuarioLogadoTexto) {
    window.location.href = "login.html";
    return;
  }

  const usuarioLogado = JSON.parse(usuarioLogadoTexto);
  const tipoUsuarioLogado = String(usuarioLogado.tipo_usuario || "").trim().toUpperCase();
  // Só escondemos Editar/Excluir quando o acesso for explicitamente PADRAO.
  // Qualquer outro valor (ADMIN, ou algo inesperado) mantém os botões visíveis.
  const ehAdmin = tipoUsuarioLogado !== "PADRAO";

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

  // Nome da coluna que é a chave (ID) de cada tabela, usada para
  // Editar e Excluir. E o nome da página de cadastro de cada uma,
  // usada para abrir a tela de edição.
  const CHAVE_DA_TABELA = {
    clientes: "clienteid",
    categoria_produto: "categoriaprodutoid",
    produtos: "produtoid",
    orcamentos: "orcamentoid"
  };

  const PAGINA_DA_TABELA = {
    clientes: "cadastrocliente.html",
    categoria_produto: "categoriaprodutos.html",
    produtos: "produtos.html",
    orcamentos: "orcamentos.html"
  };

  const areaPainelEl = document.getElementById("area-painel");
  const areaPesquisaEl = document.getElementById("area-pesquisa");

  // Troca qual das duas áreas (Painel ou Pesquisa) fica visível
  function mostrarArea(nomeArea) {
    areaPainelEl.style.display = nomeArea === "painel" ? "block" : "none";
    areaPesquisaEl.style.display = nomeArea === "pesquisa" ? "block" : "none";
  }

  // ==========================================
  // 3. FUNÇÃO PARA BUSCAR E EXIBIR DADOS (PESQUISA)
  // ==========================================
  async function buscarDados(nomeTabela, titulo, query = "*", filtro = null) {
    tabelaAtual = nomeTabela;
    queryAtual = query;

    mostrarArea("pesquisa");

    const tituloPesquisa = document.getElementById("titulo-pesquisa");
    const thead = document.getElementById("tabela-cabecalho");
    const tbody = document.getElementById("tabela-corpo");
    const selectColuna = document.getElementById("filtro-coluna");

    if (!thead || !tbody) return;

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
      // A primeira coluna de todas as nossas pesquisas é sempre o "Código"
      // (o ID de verdade da tabela), então usamos ela para Editar/Excluir.
      const idRegistro = linha[colunas[0]];

      bodyHTML += `<tr data-id="${idRegistro}">`;
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

        // REGRA DE STATUS (produtos: ATIVO/INATIVO; orçamentos: FINALIZADO/PENDENTE/REPROVADO)
        if (coluna === "Status") {
          const statusTexto = String(valor).toUpperCase();
          if (statusTexto === "ATIVO" || statusTexto === "FINALIZADO") {
            valor = `<span style="color: green; font-weight: bold;">${valor}</span>`;
          } else if (statusTexto === "INATIVO" || statusTexto === "REPROVADO") {
            valor = `<span style="color: red; font-weight: bold;">${valor}</span>`;
          } else if (statusTexto === "PENDENTE") {
            valor = `<span style="color: #b8860b; font-weight: bold;">${valor}</span>`;
          }
        }

        bodyHTML += `<td>${valor || ""}</td>`;
      });

      // Monta os botões de ação de acordo com o tipo de acesso do usuário.
      // Acesso PADRAO só pode ver e cadastrar, não pode editar nem excluir.
      let botoesAcao = "";

      if (ehAdmin) {
        if (PAGINA_DA_TABELA[nomeTabela]) {
          const textoBotao = nomeTabela === "orcamentos" ? "Visualizar" : "Editar";
          botoesAcao += `<button type="button" class="btn-editar">${textoBotao}</button>`;
        }
        botoesAcao += `<button type="button" class="btn-excluir">Excluir</button>`;

        // Para orçamentos pendentes, mostra atalhos para Aprovar/Reprovar
        if (nomeTabela === "orcamentos" && linha.Status === "PENDENTE") {
          botoesAcao += `<button type="button" class="btn-aprovar">Aprovar</button>`;
          botoesAcao += `<button type="button" class="btn-reprovar">Reprovar</button>`;
        }
      }

      bodyHTML += `<td style="white-space: nowrap;">${botoesAcao}</td></tr>`;
    });
    tbody.innerHTML = bodyHTML;
  }

  // ==========================================
  // 3b. AÇÕES NA LISTAGEM: EDITAR/VISUALIZAR, EXCLUIR, APROVAR, REPROVAR
  // ==========================================
  document.getElementById("tabela-corpo")?.addEventListener("click", async function (evento) {
    const botaoClicado = evento.target;
    const linhaClicada = botaoClicado.closest("tr");
    if (!linhaClicada) return;

    const idRegistro = linhaClicada.dataset.id;

    // EDITAR/VISUALIZAR: abre a página de cadastro correspondente já com o ID na URL
    if (botaoClicado.classList.contains("btn-editar")) {
      const pagina = PAGINA_DA_TABELA[tabelaAtual];
      if (pagina) {
        window.open(`${pagina}?id=${idRegistro}`, "_blank");
      }
      return;
    }

    // EXCLUIR: apaga o registro no Supabase depois de confirmar com o usuário
    if (botaoClicado.classList.contains("btn-excluir")) {
      const confirmou = confirm("Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.");
      if (!confirmou) return;

      const colunaChave = CHAVE_DA_TABELA[tabelaAtual];
      const { error } = await window.supabaseClient
        .from(tabelaAtual)
        .delete()
        .eq(colunaChave, idRegistro);

      if (error) {
        alert("Erro ao excluir: " + error.message);
        console.error(error);
        return;
      }

      linhaClicada.remove();
      return;
    }

    // APROVAR / REPROVAR: atualiza o status do orçamento
    if (botaoClicado.classList.contains("btn-aprovar") || botaoClicado.classList.contains("btn-reprovar")) {
      const novoStatus = botaoClicado.classList.contains("btn-aprovar") ? "FINALIZADO" : "REPROVADO";

      const { error } = await window.supabaseClient
        .from("orcamentos")
        .update({ status_orcamento: novoStatus })
        .eq("orcamentoid", idRegistro);

      if (error) {
        alert("Erro ao atualizar o status do orçamento: " + error.message);
        console.error(error);
        return;
      }

      // Atualiza a listagem para refletir o novo status
      buscarDados(tabelaAtual, document.getElementById("titulo-pesquisa").innerText, queryAtual);
      return;
    }
  });

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
    const query = "Código:produtoid, Produto:ds_produto, Valor_Unitário:vl_venda_produto, Estoque:qt_estoque_produto, Observação:obs_produto, Categoria:categoria_produto(ds_categoria_produto), Status:status_produto, Data_de_Cadastro:dt_cadastro_produto";
    buscarDados("produtos", "Pesquisa de Produtos", query);
  });

  document.getElementById("pesq-orcamentos")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query = "Código:orcamentoid, Data_do_Orçamento:dt_orcamento, Cliente:clientes(nome_cliente), Valor_Total:vl_total_orcamento, Data_de_Validade:dt_validade_orcamento, Status:status_orcamento";
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

  // ==========================================
  // 6. PAINEL (DASHBOARD)
  // ==========================================
  function preencherTabelaOrcamentos(corpoId, spanQtdId, lista) {
    const corpo = document.getElementById(corpoId);
    const spanQtd = document.getElementById(spanQtdId);

    spanQtd.textContent = lista.length;

    if (lista.length === 0) {
      corpo.innerHTML = '<tr><td colspan="3">Nenhum</td></tr>';
      return;
    }

    corpo.innerHTML = lista.map((orc) => `
      <tr>
        <td>${orc.orcamentoid}</td>
        <td>${orc.clientes?.nome_cliente ?? ""}</td>
        <td>R$ ${Number(orc.vl_total_orcamento).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");
  }

  async function carregarPainel() {
    mostrarArea("painel");

    document
      .querySelectorAll(".dropdown-content")
      .forEach((m) => m.classList.remove("mostrar-dropdown"));

    // Orçamentos, separados por status
    const { data: orcamentos, error: erroOrcamentos } = await window.supabaseClient
      .from("orcamentos")
      .select("orcamentoid, vl_total_orcamento, status_orcamento, clientes(nome_cliente)");

    if (erroOrcamentos) {
      console.error(erroOrcamentos);
    } else {
      const finalizados = orcamentos.filter((o) => o.status_orcamento === "FINALIZADO");
      const pendentes = orcamentos.filter((o) => o.status_orcamento === "PENDENTE");
      const reprovados = orcamentos.filter((o) => o.status_orcamento === "REPROVADO");

      preencherTabelaOrcamentos("tabela-finalizados", "qtd-finalizados", finalizados);
      preencherTabelaOrcamentos("tabela-pendentes", "qtd-pendentes", pendentes);
      preencherTabelaOrcamentos("tabela-reprovados", "qtd-reprovados", reprovados);
    }

    // Estoque: produtos ativos e sua quantidade
    const { data: produtos, error: erroProdutos } = await window.supabaseClient
      .from("produtos")
      .select("ds_produto, qt_estoque_produto, status_produto")
      .eq("status_produto", "ATIVO")
      .order("ds_produto", { ascending: true });

    const corpoEstoque = document.getElementById("tabela-estoque");

    if (erroProdutos) {
      console.error(erroProdutos);
      corpoEstoque.innerHTML = '<tr><td colspan="2">Erro ao buscar estoque.</td></tr>';
    } else if (!produtos || produtos.length === 0) {
      corpoEstoque.innerHTML = '<tr><td colspan="2">Nenhum produto ativo.</td></tr>';
    } else {
      corpoEstoque.innerHTML = produtos.map((p) => `
        <tr>
          <td>${p.ds_produto}</td>
          <td>${p.qt_estoque_produto ?? 0}</td>
        </tr>
      `).join("");
    }
  }

  document.getElementById("btn-painel")?.addEventListener("click", (e) => {
    e.preventDefault();
    carregarPainel();
  });

  // O Painel é a tela inicial ao abrir o menu
  carregarPainel();
});