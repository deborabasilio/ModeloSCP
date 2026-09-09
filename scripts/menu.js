document.addEventListener("DOMContentLoaded", function () {
  // ==========================================
  // 0. VERIFICA SE O USUÁRIO ESTÁ LOGADO E QUAL É O TIPO DE ACESSO
  // ==========================================
  const usuarioLogadoTexto = localStorage.getItem("usuarioLogado");

  if (!usuarioLogadoTexto) {
    window.location.href = "login.html";
    return;
  }

  const usuarioLogado = JSON.parse(usuarioLogadoTexto);
  const tipoUsuarioLogado = String(usuarioLogado.tipo_usuario || "")
    .trim()
    .toUpperCase();
  const ehAdmin = tipoUsuarioLogado !== "PADRAO";
  const usuarioPodeEditar = ehAdmin || usuarioLogado.pode_editar === true;
  const usuarioPodeExcluir = ehAdmin || usuarioLogado.pode_excluir === true;

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

  document.addEventListener("click", function (event) {
    if (!event.target.matches(".dropbtn")) {
      document.querySelectorAll(".dropdown-content").forEach((menu) => {
        menu.classList.remove("mostrar-dropdown");
      });
    }

    if (!event.target.matches(".btn-menu-acoes")) {
      document.querySelectorAll(".menu-acoes-dropdown").forEach((menu) => {
        menu.classList.remove("mostrar-menu-acoes");
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

  let tabelaAtual = "";
  let queryAtual = "*";

  const CHAVE_DA_TABELA = {
    clientes: "clienteid",
    categoria_produto: "categoriaprodutoid",
    produtos: "produtoid",
    orcamentos: "orcamentoid",
    faturamentos: "faturamentoid",
  };

  const PAGINA_DA_TABELA = {
    clientes: "cadastrocliente.html",
    categoria_produto: "categoriaprodutos.html",
    produtos: "produtos.html",
    orcamentos: "orcamentos.html",
  };

  const areaPainelEl = document.getElementById("area-painel");
  const areaPesquisaEl = document.getElementById("area-pesquisa");

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
    tbody.innerHTML =
      '<tr><td colspan="10">Buscando dados no servidor...</td></tr>';

    let requisicao = window.supabaseClient.from(nomeTabela).select(query);

    if (filtro && filtro.valor) {
      let nomeColunaReal = filtro.coluna.split(":")[1] || filtro.coluna;

      if (nomeColunaReal.includes("(") && nomeColunaReal.includes(")")) {
        nomeColunaReal = nomeColunaReal.replace(/\(/g, ".").replace(/\)/g, "");
      }

      const nomeColunaSimples = nomeColunaReal.split(".").pop();

      const ehCodigo = /id$/i.test(nomeColunaSimples);
      const ehValorMonetario = nomeColunaSimples.startsWith("vl_");
      const ehData = nomeColunaSimples.startsWith("dt_");

      const valorDigitado = String(filtro.valor).trim();

      if (ehCodigo) {
        const numero = Number(valorDigitado.replace(/\D/g, ""));
        if (!isNaN(numero)) {
          requisicao = requisicao.eq(nomeColunaReal, numero);
        }
      } else if (ehValorMonetario) {
        const somenteNumero = valorDigitado.replace(/[^\d,.-]/g, "");
        const numero = Number(
          somenteNumero.includes(",")
            ? somenteNumero.replace(/\./g, "").replace(",", ".")
            : somenteNumero,
        );
        if (!isNaN(numero)) {
          requisicao = requisicao.eq(nomeColunaReal, numero);
        }
      } else if (ehData) {
        const partesBr = valorDigitado.match(
          /^(\d{2})\/(\d{2})\/(\d{4})$/,
        );
        const dataBusca = partesBr
          ? `${partesBr[3]}-${partesBr[2]}-${partesBr[1]}`
          : valorDigitado;

        requisicao = requisicao.ilike(`${nomeColunaReal}::text`, `${dataBusca}%`);
      } else {
        if (filtro.condicao === "contem") {
          requisicao = requisicao.ilike(nomeColunaReal, `%${valorDigitado}%`);
        } else {
          requisicao = requisicao.ilike(nomeColunaReal, valorDigitado);
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
      tbody.innerHTML =
        '<tr><td colspan="10">Nenhum registro encontrado com estes filtros.</td></tr>';
      return;
    }

    const colunas = Object.keys(data[0]);

    if (selectColuna && !filtro) {
      selectColuna.innerHTML =
        '<option value="">Selecione a coluna...</option>';
      colunas.forEach((coluna) => {
        const nomeFormatado = coluna.replace(/_/g, " ").toUpperCase();
        let queryArray = query.split(",").map((item) => item.trim());
        let colunaOriginal =
          queryArray.find((q) => q.startsWith(coluna + ":")) || coluna;
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
      const idRegistro = linha[colunas[0]];

      // Guardamos também o código do orçamento relacionado (só existe quando a
      // tabela é "faturamentos"), para poder usar na hora de abrir a nota fiscal.
      const idOrcamentoRelacionado =
        nomeTabela === "faturamentos" ? linha["Orçamento"] : "";

      bodyHTML += `<tr data-id="${idRegistro}" data-orc-id="${idOrcamentoRelacionado}">`;
      colunas.forEach((coluna) => {
        let valor = linha[coluna];

        while (typeof valor === "object" && valor !== null) {
          valor = Object.values(valor)[0];
        }

        if (coluna === "Tipo_de_Cliente") {
          if (valor === "F" || valor === "f") valor = "Físico";
          if (valor === "J" || valor === "j") valor = "Jurídico";
        }

        if (coluna === "Status") {
          const statusTexto = String(valor).toUpperCase();
          if (statusTexto === "ATIVO" || statusTexto === "APROVADO") {
            valor = `<span style="color: green; font-weight: bold;">${valor}</span>`;
          } else if (statusTexto === "INATIVO" || statusTexto === "REPROVADO") {
            valor = `<span style="color: red; font-weight: bold;">${valor}</span>`;
          } else if (statusTexto === "PENDENTE") {
            valor = `<span style="color: #b8860b; font-weight: bold;">${valor}</span>`;
          }
        }

        if (coluna.toLowerCase().includes("data") && valor) {
          const dataObj = new Date(valor);
          if (!isNaN(dataObj.getTime())) {
            valor =
              coluna === "Data_do_Orçamento"
                ? dataObj.toLocaleString("pt-BR")
                : dataObj.toLocaleDateString("pt-BR");
          }
        }

        if (
          coluna.toLowerCase().includes("valor") &&
          valor !== null &&
          valor !== undefined &&
          valor !== "" &&
          !isNaN(Number(valor))
        ) {
          valor =
            "R$ " +
            Number(valor).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        }

        bodyHTML += `<td>${valor || ""}</td>`;
      });

      let itensAcao = "";

      if (usuarioPodeEditar) {
        if (PAGINA_DA_TABELA[nomeTabela]) {
          itensAcao +=
            '<button type="button" class="btn-editar">Editar</button>';
        }

        if (nomeTabela === "faturamentos") {
          itensAcao += `<button type="button" class="btn-nota-fiscal">Simular Nota Fiscal</button>`;
        }

        if (nomeTabela === "orcamentos" && linha.Status === "PENDENTE") {
          itensAcao += `<button type="button" class="btn-aprovar">Aprovar</button>`;
          itensAcao += `<button type="button" class="btn-reprovar">Reprovar</button>`;
        }
        if (nomeTabela === "orcamentos" && linha.Status === "APROVADO") {
          itensAcao += `<button type="button" class="btn-faturar">Faturar</button>`;
        }
      }

      if (usuarioPodeExcluir) {
        itensAcao += `<button type="button" class="btn-excluir">Excluir</button>`;
      }

      const botoesAcao = itensAcao
        ? `<div class="menu-acoes">
             <button type="button" class="btn-menu-acoes" title="Ações" aria-label="Abrir ações">⋮</button>
             <div class="menu-acoes-dropdown">${itensAcao}</div>
           </div>`
        : "";

      bodyHTML += `<td style="white-space: nowrap;">${botoesAcao}</td></tr>`;
    });
    tbody.innerHTML = bodyHTML;
  }

  // ==========================================
  // 3b. AÇÕES NA LISTAGEM: EDITAR, VISUALIZAR, EXCLUIR, APROVAR, REPROVAR, IMPRIMIR
  // ==========================================
  document
    .getElementById("tabela-corpo")
    ?.addEventListener("click", async function (evento) {
      const botaoClicado = evento.target;

      if (botaoClicado.classList.contains("btn-menu-acoes")) {
        const dropdownAtual = botaoClicado.nextElementSibling;

        document.querySelectorAll(".menu-acoes-dropdown").forEach((menu) => {
          if (menu !== dropdownAtual) {
            menu.classList.remove("mostrar-menu-acoes");
          }
        });

        dropdownAtual?.classList.toggle("mostrar-menu-acoes");
        return;
      }

      const linhaClicada = botaoClicado.closest("tr");
      if (!linhaClicada) return;

      const idRegistro = linhaClicada.dataset.id;

      botaoClicado
        .closest(".menu-acoes-dropdown")
        ?.classList.remove("mostrar-menu-acoes");

      if (
        botaoClicado.classList.contains("btn-editar") ||
        botaoClicado.classList.contains("btn-visualizar")
      ) {
        const pagina = PAGINA_DA_TABELA[tabelaAtual];
        if (pagina) {
          const ehBotaoEditar = botaoClicado.classList.contains("btn-editar");
          const sufixoModo =
            tabelaAtual === "orcamentos" && ehBotaoEditar ? "&modo=editar" : "";
          window.open(`${pagina}?id=${idRegistro}${sufixoModo}`, "_blank");
        }
        return;
      }

      if (botaoClicado.classList.contains("btn-excluir")) {
        const confirmou = confirm(
          "Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.",
        );
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

        // Excluir um faturamento não pode deixar o orçamento "preso" no
        // status FATURADO sem nenhum faturamento de verdade vinculado a
        // ele. Por isso, ao excluir um faturamento, devolvemos o
        // orçamento relacionado para o status APROVADO, para que ele
        // possa ser faturado novamente depois.
        if (tabelaAtual === "faturamentos") {
          const idOrcamentoRelacionado = linhaClicada.dataset.orcId;

          if (idOrcamentoRelacionado) {
            const { error: erroReverterStatus } = await window.supabaseClient
              .from("orcamentos")
              .update({ status_orcamento: "APROVADO" })
              .eq("orcamentoid", idOrcamentoRelacionado);

            if (erroReverterStatus) {
              alert(
                "Faturamento excluído, mas houve um erro ao devolver o orçamento para o status APROVADO: " +
                  erroReverterStatus.message,
              );
              console.error(erroReverterStatus);
            }
          }
        }

        linhaClicada.remove();
        return;
      }
      if (botaoClicado.classList.contains("btn-faturar")) {
        window.open(`faturamento.html?id=${idRegistro}`, "_blank");
        return;
      }
      if (botaoClicado.classList.contains("btn-nota-fiscal")) {
        window.open(`imprimir_nota_fiscal.html?id=${idRegistro}`, "_blank");
        return;
      }
      if (
        botaoClicado.classList.contains("btn-aprovar") ||
        botaoClicado.classList.contains("btn-reprovar")
      ) {
        const novoStatus = botaoClicado.classList.contains("btn-aprovar")
          ? "APROVADO"
          : "REPROVADO";

        if (novoStatus === "APROVADO") {
          const { data: itens } = await window.supabaseClient
            .from("orcamento_item")
            .select("produtoid, qt_produto")
            .eq("orcamentoid", idRegistro);

          if (itens) {
            // ALTERAÇÃO (item 3): mesma checagem de estoque insuficiente
            // que foi feita em orcamentos.js, agora também aqui, já que
            // esse é o outro lugar do sistema onde dá para aprovar um
            // orçamento (a partir da listagem do menu).
            const produtosComEstoqueInsuficiente = [];

            for (let item of itens) {
              const { data: produto } = await window.supabaseClient
                .from("produtos")
                .select("ds_produto, qt_estoque_produto")
                .eq("produtoid", item.produtoid)
                .single();

              if (
                produto &&
                produto.qt_estoque_produto - item.qt_produto < 0
              ) {
                produtosComEstoqueInsuficiente.push(
                  `${produto.ds_produto} (estoque atual: ${produto.qt_estoque_produto}, necessário: ${item.qt_produto})`,
                );
              }
            }

            if (produtosComEstoqueInsuficiente.length > 0) {
              alert(
                "Não é possível aprovar: estoque insuficiente para: " +
                  produtosComEstoqueInsuficiente.join("; "),
              );
              return;
            }

            for (let item of itens) {
              const { data: produto } = await window.supabaseClient
                .from("produtos")
                .select("qt_estoque_produto")
                .eq("produtoid", item.produtoid)
                .single();

              if (produto) {
                let novoEstoque = produto.qt_estoque_produto - item.qt_produto;

                await window.supabaseClient
                  .from("produtos")
                  .update({ qt_estoque_produto: novoEstoque })
                  .eq("produtoid", item.produtoid);
              }
            }
          }
        }

        const { error } = await window.supabaseClient
          .from("orcamentos")
          .update({ status_orcamento: novoStatus })
          .eq("orcamentoid", idRegistro);

        if (error) {
          alert("Erro ao atualizar o status do orçamento: " + error.message);
          console.error(error);
          return;
        }

        buscarDados(
          tabelaAtual,
          document.getElementById("titulo-pesquisa").innerText,
          queryAtual,
        );
        return;
      }
    });

  // ==========================================
  // 4. EVENTOS DO BOTÃO DE FILTRAR (PESQUISA AVANÇADA)
  // ==========================================
  document.getElementById("btn-filtrar")?.addEventListener("click", (e) => {
    e.preventDefault();
    const colunaSelecionada = document.getElementById("filtro-coluna").value;
    const condicaoSelecionada =
      document.getElementById("filtro-condicao").value;
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
        valor: valorDigitado,
      },
    );
  });

  // ==========================================
  // 5. EVENTOS DE CLIQUE NOS MENUS
  // ==========================================
  document.getElementById("pesq-produtos")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query =
      "Código:produtoid, Produto:ds_produto, Valor_Unitário:vl_venda_produto, Estoque:qt_estoque_produto, Observação:obs_produto, Categoria:categoria_produto(ds_categoria_produto), Status:status_produto, Data_de_Cadastro:dt_cadastro_produto";
    buscarDados("produtos", "Lista de Produtos", query);
  });

  document.getElementById("pesq-orcamentos")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query =
      "Código:orcamentoid, Data_do_Orçamento:dt_orcamento, Cliente:clientes(nome_cliente), Valor_Total:vl_total_orcamento, Data_de_Validade:dt_validade_orcamento, Status:status_orcamento";
    buscarDados("orcamentos", "Lista de Orçamentos", query);
  });

  document.getElementById("pesq-faturamentos")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query =
      "Código:faturamentoid, Orçamento:orcamentoid, Cliente:orcamentos(clientes(nome_cliente)), Data_do_Faturamento:dt_faturamento, Nota_Fiscal:nr_nota_fiscal, Forma_de_Pagamento:forma_pagamento, Valor_Faturado:vl_faturado";
    buscarDados("faturamentos", "Lista de Faturamentos", query);
  });

  document.getElementById("pesq-clientes")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query =
      "Código:clienteid, Tipo_de_Cliente:tipo_cliente, CPF_CNPJ:cpf_cnpj_cliente, Nome:nome_cliente";
    buscarDados("clientes", "Lista de Clientes", query);
  });

  document.getElementById("pesq-categorias")?.addEventListener("click", (e) => {
    e.preventDefault();
    const query =
      "Código:categoriaprodutoid, Descrição_da_Categoria:ds_categoria_produto";
    buscarDados("categoria_produto", "Lista de Categorias", query);
  });

  // ==========================================
  // 6. PAINEL (DASHBOARD)
  // ==========================================
  function atualizarContadorOrcamentos(spanQtdId, lista) {
    const spanQtd = document.getElementById(spanQtdId);
    if (spanQtd) spanQtd.textContent = lista.length;
  }

  async function carregarPainel() {
    mostrarArea("painel");

    document
      .querySelectorAll(".dropdown-content")
      .forEach((m) => m.classList.remove("mostrar-dropdown"));

    const { data: orcamentos, error: erroOrcamentos } =
      await window.supabaseClient
        .from("orcamentos")
        .select("orcamentoid, status_orcamento");

    if (erroOrcamentos) {
      console.error(erroOrcamentos);
      return;
    }

    const aprovados = orcamentos.filter(
      (o) => o.status_orcamento === "APROVADO",
    );
    const pendentes = orcamentos.filter(
      (o) => o.status_orcamento === "PENDENTE",
    );
    const reprovados = orcamentos.filter(
      (o) => o.status_orcamento === "REPROVADO",
    );
    const faturados = orcamentos.filter(
      (o) => o.status_orcamento === "FATURADO",
    );
    atualizarContadorOrcamentos("qtd-faturados", faturados);
    atualizarContadorOrcamentos("qtd-aprovados", aprovados);
    atualizarContadorOrcamentos("qtd-pendentes", pendentes);
    atualizarContadorOrcamentos("qtd-reprovados", reprovados);
  }

  document.getElementById("btn-painel")?.addEventListener("click", (e) => {
    e.preventDefault();
    carregarPainel();
  });

  carregarPainel();

  // ==========================================
  // 7. FUNÇÃO DE LOGOUT (SAIR)
  // ==========================================
  document
    .getElementById("btn-sair")
    ?.addEventListener("click", function (event) {
      event.preventDefault();
      localStorage.removeItem("usuarioLogado");
      sessionStorage.removeItem("usuarioLogado");
      window.location.href = "login.html";
    });

  // ==========================================
  // 8. CLIQUE NOS CARDS DO PAINEL (FILTRO AUTOMÁTICO)
  // ==========================================
  const cardsPainel = {
    verde: "APROVADO",
    amarelo: "PENDENTE",
    vermelho: "REPROVADO",
  };

  Object.keys(cardsPainel).forEach((cor) => {
    const card = document.querySelector(`.painel-card.${cor}`);
    if (card) {
      card.addEventListener("click", () => {
        mostrarArea("pesquisa");
        const query =
          "Código:orcamentoid, Data_do_Orçamento:dt_orcamento, Cliente:clientes(nome_cliente), Valor_Total:vl_total_orcamento, Data_de_Validade:dt_validade_orcamento, Status:status_orcamento";

        buscarDados("orcamentos", "Orçamentos " + cardsPainel[cor], query, {
          coluna: "Status:status_orcamento",
          condicao: "igual",
          valor: cardsPainel[cor],
        });

        setTimeout(() => {
          const selectColuna = document.getElementById("filtro-coluna");
          if (selectColuna && selectColuna.options.length <= 1) {
            selectColuna.innerHTML += `<option value="Status:status_orcamento">STATUS</option>`;
          }
          if (selectColuna) selectColuna.value = "Status:status_orcamento";
          document.getElementById("filtro-condicao").value = "igual";
          document.getElementById("filtro-valor").value = cardsPainel[cor];
        }, 500);
      });
    }
  });
});

// =====================================================
// 9. FORÇAR LETRAS MAIÚSCULAS NOS CAMPOS DE TEXTO
// =====================================================
document.addEventListener("DOMContentLoaded", function () {
  const camposTexto = document.querySelectorAll('input[type="text"], textarea');
  camposTexto.forEach((campo) => {
    campo.addEventListener("input", function () {
      const inicioCursor = this.selectionStart;
      const fimCursor = this.selectionEnd;
      this.value = this.value.toUpperCase();
      this.setSelectionRange(inicioCursor, fimCursor);
    });
  });
});