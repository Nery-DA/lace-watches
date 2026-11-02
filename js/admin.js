/* ==========================================================
   LACE — painel do administrador
   Login, pedidos (confirmar = baixa no estoque), preços e estoque.
   ========================================================== */
(() => {
  "use strict";
  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = v => v == null ? "a combinar" : BRL.format(v);
  const fData = d => d ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const DB = window.LaceDB;

  let fb, db, auth;
  let PEDIDOS = [], PRODUTOS = [], CONFIG = {};
  let filtroSt = "pendente";
  const sujos = new Map();          // id do produto -> alterações pendentes

  /* ---------- utilitários ---------- */
  let tToast;
  function toast(msg, erro = false) {
    const t = $("#toast");
    t.textContent = msg; t.classList.toggle("erro", erro); t.hidden = false;
    t.classList.remove("animate__fadeOutDown");
    t.classList.add("animate__animated", "animate__fadeInUp");
    clearTimeout(tToast);
    tToast = setTimeout(() => { t.hidden = true; }, erro ? 6000 : 3000);
  }
  const mostrar = id => ["semConfig", "telaLogin", "painel"].forEach(x => { $("#" + x).hidden = x !== id; });
  const msgErro = e => {
    const c = e && e.code || "";
    if (c.includes("permission-denied")) return "Este login não tem permissão de administrador.";
    if (c.includes("wrong-password") || c.includes("invalid-credential") || c.includes("user-not-found") || c.includes("invalid-login")) return "E-mail ou senha incorretos.";
    if (c.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    if (c.includes("network")) return "Sem conexão com a internet.";
    return (e && e.message) || "Algo deu errado.";
  };

  /* ---------- início / login ---------- */
  async function init() {
    if (!DB || !DB.ativo) { mostrar("semConfig"); return; }
    try {
      fb = await DB.iniciar(true);
      db = fb.firestore(); auth = fb.auth();
    } catch (e) { mostrar("semConfig"); $("#semConfig p").textContent = "Não foi possível conectar ao Firebase. Verifique a internet e a configuração."; return; }

    auth.onAuthStateChanged(user => {
      if (!user) { $("#admUser").hidden = true; mostrar("telaLogin"); return; }
      $("#admEmail").textContent = user.email;
      $("#admUser").hidden = false;
      mostrar("painel");
      carregarTudo();
    });
  }

  async function entrar() {
    const email = $("#loginEmail").value.trim(), senha = $("#loginSenha").value;
    const erro = $("#loginErro");
    erro.hidden = true;
    if (!email || !senha) { erro.textContent = "Preencha e-mail e senha."; erro.hidden = false; return; }
    $("#btnEntrar").disabled = true;
    try { await auth.signInWithEmailAndPassword(email, senha); }
    catch (e) {
      erro.textContent = msgErro(e); erro.hidden = false;
      $("#formLogin").classList.add("animate__animated", "animate__headShake");
      setTimeout(() => $("#formLogin").classList.remove("animate__headShake"), 900);
    }
    $("#btnEntrar").disabled = false;
  }
  $("#btnEntrar").addEventListener("click", entrar);
  $("#loginSenha").addEventListener("keydown", e => { if (e.key === "Enter") entrar(); });
  $("#btnSair").addEventListener("click", () => auth.signOut());

  async function carregarTudo() {
    await Promise.all([carregarProdutos(), carregarPedidos()]);
  }

  /* ---------- abas ---------- */
  $$(".adm-tabs button").forEach(b => b.addEventListener("click", () => {
    $$(".adm-tabs button").forEach(x => x.classList.toggle("on", x === b));
    $$(".adm-tab").forEach(t => { t.hidden = t.id !== "tab-" + b.dataset.tab; });
  }));

  /* ================= PEDIDOS ================= */
  async function carregarPedidos() {
    try {
      const snap = await db.collection("pedidos").orderBy("criadoEm", "desc").limit(300).get();
      PEDIDOS = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      renderPedidos();
    } catch (e) {
      $("#listaPedidos").innerHTML = `<p class="adm-erro">${esc(msgErro(e))}</p>`;
    }
  }

  function renderPedidos() {
    const pend = PEDIDOS.filter(p => p.status === "pendente").length;
    const b = $("#badgePend"); b.textContent = pend; b.hidden = pend === 0;
    const lista = PEDIDOS.filter(p => filtroSt === "todos" || p.status === filtroSt);
    const box = $("#listaPedidos");
    if (!lista.length) { box.innerHTML = `<p class="vazio">Nenhum pedido ${filtroSt === "todos" ? "" : filtroSt + " "}por aqui.</p>`; return; }
    box.innerHTML = lista.map(p => `
      <article class="pedido st-${esc(p.status)}" data-id="${esc(p.id)}">
        <header>
          <div><strong>Pedido ${esc(p.codigo || p.id.slice(0, 6))}</strong> <span class="pill">${esc(p.status)}</span></div>
          <span class="muted small">${fData(DB.data(p.criadoEm))}</span>
        </header>
        <p class="cli">${esc(p.nome)}${p.obs ? ` · <span class="muted">${esc(p.obs)}</span>` : ""}</p>
        <ul>${(p.itens || []).map(i => {
          const prod = PRODUTOS.find(x => x.id === i.id);
          const k = prod && prod.estoque ? prod.estoque[i.chave] : null;
          const estTxt = p.status === "pendente" && k != null && k !== "" ? ` <span class="est ${Number(k) < i.qtd ? "falta" : ""}">estoque: ${k}</span>` : "";
          return `<li>${i.qtd}× ${esc(i.nome)}${i.opcao ? ` <span class="muted">(${esc(i.opcao)})</span>` : ""} — ${money(i.preco == null ? null : i.preco * i.qtd)}${estTxt}</li>`;
        }).join("")}</ul>
        <footer>
          <span>Total: <b>${money(p.total)}</b>${p.aCombinar ? " + itens a combinar" : ""}</span>
          <div class="acoes">
            ${p.status === "pendente" ? `
              <button class="btn-ok" data-acao="confirmar">Confirmar venda</button>
              <button class="btn-ghost" data-acao="cancelar">Cancelar</button>` : ""}
            ${p.status === "confirmado" ? `<button class="btn-ghost" data-acao="estornar">Cancelar e devolver ao estoque</button>` : ""}
            ${p.status === "cancelado" ? `<button class="btn-ghost danger" data-acao="excluir">Excluir</button>` : ""}
          </div>
        </footer>
        <div class="confirma" hidden></div>
      </article>`).join("");
  }

  $("#filtroPedidos").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    filtroSt = c.dataset.st;
    $$("#filtroPedidos .chip").forEach(x => x.classList.toggle("on", x === c));
    renderPedidos();
  });
  $("#btnAtualizar").addEventListener("click", async () => { await carregarTudo(); toast("Lista atualizada"); });
  setInterval(() => { if (!$("#painel").hidden && !$("#tab-pedidos").hidden) carregarPedidos(); }, 45000);

  const TEXTOS = {
    confirmar: "Confirmar a venda? As quantidades saem do estoque.",
    cancelar: "Cancelar este pedido? O estoque não muda.",
    estornar: "Cancelar esta venda e devolver as peças ao estoque?",
    excluir: "Excluir este pedido da lista definitivamente?"
  };

  // confirmação dentro do próprio cartão (sem janelas do navegador)
  $("#listaPedidos").addEventListener("click", async e => {
    const card = e.target.closest(".pedido"); if (!card) return;
    const box = $(".confirma", card);
    const acao = e.target.closest("[data-acao]");
    if (acao) {
      box.innerHTML = `<span>${TEXTOS[acao.dataset.acao]}</span>
        <button class="btn-dark" data-sim="${acao.dataset.acao}">Sim</button><button class="btn-ghost" data-nao>Não</button>`;
      box.hidden = false; return;
    }
    if (e.target.closest("[data-nao]")) { box.hidden = true; return; }
    const sim = e.target.closest("[data-sim]");
    if (!sim) return;
    sim.disabled = true;
    const ped = PEDIDOS.find(p => p.id === card.dataset.id);
    try {
      if (sim.dataset.sim === "confirmar") await confirmar(ped);
      if (sim.dataset.sim === "cancelar") await db.collection("pedidos").doc(ped.id).update({ status: "cancelado", canceladoEm: fb.firestore.FieldValue.serverTimestamp() });
      if (sim.dataset.sim === "estornar") await estornar(ped);
      if (sim.dataset.sim === "excluir") await db.collection("pedidos").doc(ped.id).delete();
      toast({ confirmar: "Venda confirmada e estoque atualizado", cancelar: "Pedido cancelado", estornar: "Venda cancelada e estoque devolvido", excluir: "Pedido excluído" }[sim.dataset.sim]);
      await carregarTudo();
    } catch (err) {
      box.hidden = true;
      toast(msgErro(err), true);
    }
  });

  /** Confirma o pedido e baixa o estoque, tudo de uma vez (transação). */
  function confirmar(ped) {
    return movimentar(ped, -1, "pendente", { status: "confirmado", confirmadoEm: fb.firestore.FieldValue.serverTimestamp() });
  }
  /** Cancela uma venda confirmada e devolve as peças. */
  function estornar(ped) {
    return movimentar(ped, +1, "confirmado", { status: "cancelado", estornado: true, canceladoEm: fb.firestore.FieldValue.serverTimestamp() });
  }

  function movimentar(ped, sinal, statusEsperado, novoStatus) {
    return db.runTransaction(async t => {
      const pref = db.collection("pedidos").doc(ped.id);
      const ps = await t.get(pref);
      if (!ps.exists) throw new Error("Pedido não encontrado.");
      const atual = ps.data();
      if (atual.status !== statusEsperado) throw new Error(`Este pedido já está ${atual.status}.`);
      const porProd = {};
      (atual.itens || []).forEach(i => { (porProd[i.id] = porProd[i.id] || []).push(i); });
      const ids = Object.keys(porProd);
      const snaps = [];
      for (const id of ids) snaps.push(await t.get(db.collection("produtos").doc(id)));
      const mudancas = [];
      snaps.forEach(s => {
        if (!s.exists) return;
        const d = s.data();
        const est = { ...(d.estoque || {}) };
        let mudou = false;
        porProd[s.id].forEach(i => {
          const k = i.chave || "unico";
          if (est[k] == null || est[k] === "") return;            // sem controle de estoque
          const novo = Number(est[k]) + sinal * Number(i.qtd);
          if (novo < 0) throw new Error(`Estoque insuficiente: ${d.nome}${i.opcao ? " (" + i.opcao + ")" : ""}. Restam ${est[k]}, pedido de ${i.qtd}.`);
          est[k] = novo; mudou = true;
        });
        if (mudou) mudancas.push([s.ref, est]);
      });
      mudancas.forEach(([ref, est]) => t.update(ref, { estoque: est }));
      t.update(pref, novoStatus);
    });
  }

  /* ================= PRODUTOS ================= */
  async function carregarProdutos() {
    try {
      const [ps, cs] = await Promise.all([db.collection("produtos").get(), db.collection("config").doc("loja").get()]);
      PRODUTOS = ps.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      CONFIG = cs.exists ? cs.data() : {};
      $("#boxImportar").hidden = PRODUTOS.length > 0;
      sujos.clear(); atualizarBotaoSalvar();
      montarCategorias(); renderProdutos(); preencherLoja();
    } catch (e) {
      $("#listaProdutos").innerHTML = `<p class="adm-erro">${esc(msgErro(e))}</p>`;
    }
  }

  function montarCategorias() {
    const cats = CONFIG.categorias || [];
    const sel = $("#catProd"), atual = sel.value;
    sel.innerHTML = `<option value="">Todas as categorias</option>` + cats.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
    sel.value = atual;
  }

  const opcoes = p => ((p.opcoes && p.opcoes.itens) || []).map(o => typeof o === "string" ? { nome: o } : o);
  const valorCampo = v => (v == null || v === "") ? "" : String(v);

  function renderProdutos() {
    const q = $("#buscaProd").value.trim().toLowerCase();
    const cat = $("#catProd").value;
    const lista = PRODUTOS.filter(p => (!cat || p.categoria === cat) && (!q || p.nome.toLowerCase().includes(q)));
    $("#listaProdutos").innerHTML = lista.map(p => {
      const ops = opcoes(p);
      const chaves = ops.length ? ops.map(o => o.nome) : ["unico"];
      const est = p.estoque || {};
      const total = chaves.reduce((s, k) => est[k] == null || est[k] === "" ? s : s + Number(est[k]), 0);
      const controla = chaves.some(k => est[k] != null && est[k] !== "");
      return `
      <article class="prod${p.disponivel === false ? " oculto" : ""}" data-id="${esc(p.id)}">
        <img src="${esc((p.imagens || [])[0] || "")}" alt="" loading="lazy">
        <div class="prod-main">
          <div class="prod-head">
            <strong>${esc(p.nome)}</strong>
            <span class="muted small">${esc(p.categoria)}${controla ? ` · ${total} em estoque` : " · estoque sem controle"}</span>
          </div>
          <div class="campos">
            <label>Preço (R$)<input type="number" step="0.01" min="0" data-f="preco" value="${valorCampo(p.preco)}" placeholder="a combinar"></label>
            <label>Preço antigo<input type="number" step="0.01" min="0" data-f="precoAntigo" value="${valorCampo(p.precoAntigo)}" placeholder="—"></label>
            <label class="chk"><input type="checkbox" data-f="disponivel" ${p.disponivel === false ? "" : "checked"}> À venda</label>
          </div>
          ${ops.some(o => o.preco != null) ? `<p class="muted small">Este produto tem preço por opção (${ops.map(o => `${esc(o.nome)}: ${money(o.preco)}`).join(" · ")}). Para mudar esses valores, peça a quem mantém o site.</p>` : ""}
          <div class="estoques">
            ${chaves.map(k => `
              <label class="est-campo">${k === "unico" ? "Estoque" : esc(k)}
                <span class="stepper">
                  <button type="button" data-step="-1" data-k="${esc(k)}" aria-label="Diminuir">−</button>
                  <input type="number" min="0" step="1" data-est="${esc(k)}" value="${valorCampo(est[k])}" placeholder="∞">
                  <button type="button" data-step="1" data-k="${esc(k)}" aria-label="Aumentar">+</button>
                </span>
              </label>`).join("")}
          </div>
        </div>
      </article>`;
    }).join("") || `<p class="vazio">Nenhum produto encontrado.</p>`;
    // reaplica alterações ainda não salvas
    sujos.forEach((_, id) => { const el = $(`.prod[data-id="${CSS.escape(id)}"]`); if (el) el.classList.add("sujo"); });
  }

  $("#buscaProd").addEventListener("input", renderProdutos);
  $("#catProd").addEventListener("change", renderProdutos);

  function lerCartao(card) {
    const p = PRODUTOS.find(x => x.id === card.dataset.id);
    const num = v => v === "" ? null : Math.round(Number(v) * 100) / 100;
    const est = { ...(p.estoque || {}) };
    $$("[data-est]", card).forEach(i => { est[i.dataset.est] = i.value === "" ? null : Math.max(0, Math.floor(Number(i.value))); });
    return {
      preco: num($('[data-f="preco"]', card).value),
      precoAntigo: num($('[data-f="precoAntigo"]', card).value),
      disponivel: $('[data-f="disponivel"]', card).checked,
      estoque: est
    };
  }

  function marcar(card) {
    sujos.set(card.dataset.id, lerCartao(card));
    card.classList.add("sujo");
    atualizarBotaoSalvar();
  }
  function atualizarBotaoSalvar() {
    const b = $("#btnSalvar");
    b.disabled = sujos.size === 0;
    b.textContent = sujos.size ? `Salvar alterações (${sujos.size})` : "Salvar alterações";
  }

  $("#listaProdutos").addEventListener("input", e => { const c = e.target.closest(".prod"); if (c) marcar(c); });
  $("#listaProdutos").addEventListener("change", e => { const c = e.target.closest(".prod"); if (c) marcar(c); });
  $("#listaProdutos").addEventListener("click", e => {
    const b = e.target.closest("[data-step]"); if (!b) return;
    const card = b.closest(".prod");
    const inp = $(`[data-est="${CSS.escape(b.dataset.k)}"]`, card);
    const v = inp.value === "" ? 0 : Number(inp.value);
    inp.value = Math.max(0, v + Number(b.dataset.step));
    marcar(card);
  });

  $("#btnSalvar").addEventListener("click", async () => {
    const b = $("#btnSalvar"); b.disabled = true;
    try {
      const lote = db.batch();
      sujos.forEach((dados, id) => lote.update(db.collection("produtos").doc(id), dados));
      await lote.commit();
      toast(`${sujos.size} ${sujos.size === 1 ? "produto atualizado" : "produtos atualizados"}`);
      await carregarProdutos();
    } catch (e) { toast(msgErro(e), true); atualizarBotaoSalvar(); }
  });

  /* ---------- importar catálogo (primeiro acesso) ---------- */
  $("#btnImportar").addEventListener("click", async () => {
    const b = $("#btnImportar"); b.disabled = true; b.textContent = "Importando…";
    try {
      const dados = await new Promise((ok, fail) => {
        const s = document.createElement("script");
        s.src = "dados/produtos.js?v=" + Date.now();
        s.onload = () => window.LACE_DADOS ? ok(window.LACE_DADOS) : fail(new Error("Arquivo dados/produtos.js vazio."));
        s.onerror = () => fail(new Error("Não encontrei dados/produtos.js."));
        document.head.appendChild(s);
      });
      const lote = db.batch();
      (dados.produtos || []).forEach((p, i) => {
        const { id, ...resto } = p;
        lote.set(db.collection("produtos").doc(id), { ...resto, ordem: i, estoque: resto.estoque || {} });
      });
      lote.set(db.collection("config").doc("loja"), { loja: dados.loja || {}, categorias: dados.categorias || [] });
      await lote.commit();
      toast("Catálogo importado. Agora é só definir os estoques.");
      await carregarProdutos();
    } catch (e) { toast(msgErro(e), true); }
    b.disabled = false; b.textContent = "Importar catálogo";
  });

  /* ================= LOJA ================= */
  function preencherLoja() {
    const l = CONFIG.loja || {};
    $("#cfgWhats").value = l.whatsapp || "";
    $("#cfgInsta").value = l.instagram || "";
    $("#cfgMsg").value = l.mensagemFinal || "";
  }
  $("#btnSalvarLoja").addEventListener("click", async () => {
    const whats = $("#cfgWhats").value.replace(/\D/g, "");
    if (whats.length < 12) { toast("Confira o WhatsApp: 55 + DDD + número, só números.", true); return; }
    const loja = { ...(CONFIG.loja || {}), whatsapp: whats, instagram: $("#cfgInsta").value.trim().replace(/^@/, ""), mensagemFinal: $("#cfgMsg").value.trim() };
    try {
      await db.collection("config").doc("loja").set({ loja }, { merge: true });
      CONFIG.loja = loja; toast("Dados da loja salvos");
    } catch (e) { toast(msgErro(e), true); }
  });

  window.addEventListener("beforeunload", e => { if (sujos.size) { e.preventDefault(); e.returnValue = ""; } });

  init();
})();
