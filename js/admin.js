/* ==========================================================
   LACE — painel da loja (admin.html, também por index.html#admin)
   Início (vendas e faturamento) · Pedidos · Produtos e estoque ·
   Vitrine (aviso, banners, categorias) · Configurações (WhatsApp,
   Pix, cartão, frete, cupons). Tudo protegido pelo login do Firebase.
   ========================================================== */
(() => {
  "use strict";
  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = v => v == null ? "a combinar" : BRL.format(v);
  const fData = d => d ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const digits = s => String(s || "").replace(/\D/g, "");
  const num = v => (v === "" || v == null) ? null : Math.round(Number(v) * 100) / 100;
  const slug = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  const DB = window.LaceDB;

  let fb, db, auth;
  let PEDIDOS = [], PRODUTOS = [], CONFIG = {}, CUPONS = [];
  let filtroSt = "pendente", periodo = 30;
  const sujos = new Map();

  /* ---------- utilitários ---------- */
  let tToast;
  function toast(msg, erro = false) {
    const t = $("#toast");
    t.textContent = msg; t.classList.toggle("erro", erro); t.hidden = false;
    t.classList.remove("animate__fadeInUp"); void t.offsetWidth;
    t.classList.add("animate__animated", "animate__fadeInUp");
    clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, erro ? 6000 : 3000);
  }
  const mostrar = id => ["semConfig", "telaLogin", "painel"].forEach(x => { $("#" + x).hidden = x !== id; });
  const msgErro = e => {
    const c = (e && e.code) || "";
    if (c.includes("permission-denied")) return "Este login não tem permissão de administrador.";
    if (/wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)) return "E-mail ou senha incorretos.";
    if (c.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos.";
    if (c.includes("network")) return "Sem conexão com a internet.";
    return (e && e.message) || "Algo deu errado.";
  };
  const TS = () => fb.firestore.FieldValue.serverTimestamp();
  const opcoes = p => ((p.opcoes && p.opcoes.itens) || []).map(o => typeof o === "string" ? { nome: o } : o);
  const catsDe = () => CONFIG.categorias || [];
  const catNome = id => (catsDe().find(c => c.id === id) || {}).nome || id;
  function aplicarImgs(raiz) { if (DB) DB.aplicarImagens(raiz); }

  /* ---------- login ---------- */
  async function init() {
    if (!DB || !DB.ativo) { mostrar("semConfig"); return; }
    try { fb = await DB.iniciar(true); db = fb.firestore(); auth = fb.auth(); }
    catch { mostrar("semConfig"); return; }
    auth.onAuthStateChanged(user => {
      if (!user) { $("#admUser").hidden = true; mostrar("telaLogin"); return; }
      $("#admEmail").textContent = user.email; $("#admUser").hidden = false;
      mostrar("painel"); carregarTudo();
    });
  }
  async function entrar() {
    const email = $("#loginEmail").value.trim(), senha = $("#loginSenha").value, erro = $("#loginErro");
    erro.hidden = true;
    if (!email || !senha) { erro.textContent = "Preencha e-mail e senha."; erro.hidden = false; return; }
    $("#btnEntrar").disabled = true;
    try { await auth.signInWithEmailAndPassword(email, senha); }
    catch (e) { erro.textContent = msgErro(e); erro.hidden = false; $("#formLogin").classList.add("animate__animated", "animate__headShake"); setTimeout(() => $("#formLogin").classList.remove("animate__headShake"), 900); }
    $("#btnEntrar").disabled = false;
  }
  $("#btnEntrar").addEventListener("click", entrar);
  $("#loginSenha").addEventListener("keydown", e => { if (e.key === "Enter") entrar(); });
  $("#btnSair").addEventListener("click", () => auth.signOut());
  $("#btnEsqueci").addEventListener("click", async () => {
    const email = $("#loginEmail").value.trim(), erro = $("#loginErro");
    if (!email) { erro.textContent = "Digite seu e-mail acima e clique de novo em Esqueci a senha."; erro.hidden = false; return; }
    try { await auth.sendPasswordResetEmail(email); erro.textContent = "Enviamos um link para redefinir a senha no seu e-mail."; erro.hidden = false; }
    catch (e) { erro.textContent = msgErro(e); erro.hidden = false; }
  });

  async function carregarTudo() {
    await Promise.all([carregarProdutos(), carregarPedidos(), carregarCupons()]);
    renderInicio();
  }

  /* ---------- abas ---------- */
  function abrirAba(tab) {
    $$(".adm-tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === tab));
    $$(".adm-tab").forEach(t => { t.hidden = t.id !== "tab-" + tab; });
    if (tab === "inicio") renderInicio();
  }
  $$(".adm-tabs button").forEach(b => b.addEventListener("click", () => abrirAba(b.dataset.tab)));

  /* ================= INÍCIO ================= */
  const PAGOS = ["pago", "confirmado", "enviado", "entregue"];
  $("#periodo").addEventListener("click", e => {
    const c = e.target.closest("[data-dias]"); if (!c) return;
    periodo = +c.dataset.dias; $$("#periodo .chip").forEach(x => x.classList.toggle("on", x === c)); renderInicio();
  });
  function renderInicio() {
    const agora = Date.now(), ini = periodo ? agora - periodo * 864e5 : 0;
    const dt = p => { const d = DB.data(p.criadoEm); return d ? d.getTime() : 0; };
    const noPer = PEDIDOS.filter(p => dt(p) >= ini);
    const vendas = noPer.filter(p => PAGOS.includes(p.status));
    const fat = vendas.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const pend = PEDIDOS.filter(p => p.status === "pendente");
    const aEnviar = PEDIDOS.filter(p => p.status === "pago" || p.status === "confirmado");
    $("#kpis").innerHTML = [
      ["Faturamento", money(fat), "pedidos pagos no período"],
      ["Vendas", vendas.length, "pedidos pagos"],
      ["Ticket médio", money(vendas.length ? fat / vendas.length : 0), "por venda"],
      ["Aguardando pagamento", pend.length, "pedidos pendentes"],
      ["A enviar", aEnviar.length, "pagos e não enviados"]
    ].map(([t, v, s]) => `<div class="kpi"><span>${t}</span><b>${esc(v)}</b><small>${s}</small></div>`).join("");

    // gráfico de barras por dia
    const dias = Math.min(periodo || 30, 30);
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const serie = [...Array(dias)].map((_, i) => { const d = new Date(base); d.setDate(d.getDate() - (dias - 1 - i)); return { d, v: 0 }; });
    vendas.forEach(p => { const d = DB.data(p.criadoEm); if (!d) return; const k = new Date(d); k.setHours(0, 0, 0, 0); const s = serie.find(x => x.d.getTime() === k.getTime()); if (s) s.v += Number(p.total) || 0; });
    const max = Math.max(1, ...serie.map(s => s.v));
    const W = 600, H = 160, bw = W / serie.length;
    $("#grafico").innerHTML = `<svg viewBox="0 0 ${W} ${H + 22}" width="100%" role="img" aria-label="Faturamento por dia">
      ${serie.map((s, i) => { const h = s.v ? Math.max(3, (s.v / max) * H) : 0; return `<rect x="${i * bw + 2}" y="${H - h}" width="${Math.max(2, bw - 4)}" height="${h}" rx="3" fill="#C9773F"><title>${s.d.toLocaleDateString("pt-BR")}: ${money(s.v)}</title></rect>`; }).join("")}
      <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#DEDACF"/>
      <text x="0" y="${H + 16}" font-size="11" fill="#6B6259">${serie[0].d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</text>
      <text x="${W}" y="${H + 16}" font-size="11" fill="#6B6259" text-anchor="end">hoje</text>
    </svg>${vendas.length ? "" : `<p class="muted small">Nenhuma venda paga no período.</p>`}`;

    const cont = {};
    vendas.forEach(p => (p.itens || []).forEach(i => { cont[i.nome] = (cont[i.nome] || 0) + i.qtd; }));
    const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 6);
    $("#topProd").innerHTML = top.length ? `<ol class="rank">${top.map(([n, q]) => `<li><span>${esc(n)}</span><b>${q}</b></li>`).join("")}</ol>` : `<p class="muted small">Sem vendas no período.</p>`;

    const velhos = pend.filter(p => agora - dt(p) > 864e5);
    $("#atencao").innerHTML = (velhos.length || aEnviar.length) ? `<ul class="att">
      ${aEnviar.length ? `<li><b>${aEnviar.length}</b> pedido(s) pago(s) esperando envio <button class="link-btn" data-ir="pago">ver</button></li>` : ""}
      ${velhos.length ? `<li><b>${velhos.length}</b> pedido(s) aguardando pagamento há mais de 1 dia <button class="link-btn" data-ir="pendente">ver</button></li>` : ""}
    </ul>` : `<p class="muted small">Tudo em dia.</p>`;

    const baixos = [];
    PRODUTOS.forEach(p => { const ops = opcoes(p); const ks = ops.length ? ops.map(o => o.nome) : ["unico"]; ks.forEach(k => { const v = (p.estoque || {})[k]; if (v != null && v !== "" && Number(v) <= 2) baixos.push([p, k, Number(v)]); }); });
    $("#estBaixo").innerHTML = baixos.length ? `<ul class="att">${baixos.slice(0, 12).map(([p, k, v]) => `<li><span>${esc(p.nome)}${k !== "unico" ? ` <small>(${esc(k)})</small>` : ""}</span><b class="${v === 0 ? "zero" : ""}">${v === 0 ? "esgotado" : v}</b></li>`).join("")}</ul>` : `<p class="muted small">Nenhum item com 2 unidades ou menos.</p>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-ir]"); if (!b) return;
    filtroSt = b.dataset.ir; $$("#filtroPedidos .chip").forEach(x => x.classList.toggle("on", x.dataset.st === filtroSt));
    abrirAba("pedidos"); renderPedidos();
  });

  /* ================= PEDIDOS ================= */
  async function carregarPedidos() {
    try {
      const snap = await db.collection("pedidos").orderBy("criadoEm", "desc").limit(500).get();
      PEDIDOS = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      renderPedidos();
    } catch (e) { $("#listaPedidos").innerHTML = `<p class="adm-erro">${esc(msgErro(e))}</p>`; }
  }
  const NOMES = { pendente: "aguardando pagamento", pago: "pago", confirmado: "pago", enviado: "enviado", entregue: "entregue", cancelado: "cancelado" };
  const stDe = p => p.status === "confirmado" ? "pago" : p.status;

  function renderPedidos() {
    const pend = PEDIDOS.filter(p => p.status === "pendente").length;
    const b = $("#badgePend"); b.textContent = pend; b.hidden = pend === 0;
    const q = $("#buscaPed").value.trim().toLowerCase();
    const lista = PEDIDOS.filter(p => (filtroSt === "todos" || stDe(p) === filtroSt) && (!q || `${p.nome} ${p.codigo}`.toLowerCase().includes(q)));
    const box = $("#listaPedidos");
    if (!lista.length) { box.innerHTML = `<p class="vazio">Nenhum pedido aqui.</p>`; return; }
    const linkLoja = location.href.replace(/admin\.html.*$/, "index.html");
    box.innerHTML = lista.map(p => {
      const st = stDe(p), e = p.entrega || {};
      return `<article class="pedido st-${esc(st)}" data-id="${esc(p.id)}">
        <header><div><strong>Pedido ${esc(p.codigo || p.id.slice(0, 6))}</strong> <span class="pill">${esc(NOMES[st] || st)}</span></div>
          <span class="muted small">${fData(DB.data(p.criadoEm))}</span></header>
        <div class="ped-cols">
          <div>
            <p class="cli"><b>${esc(p.nome)}</b>${p.telefone ? ` · <a href="https://wa.me/55${esc(digits(p.telefone).replace(/^55(?=\d{10,11}$)/, ""))}" target="_blank" rel="noopener">WhatsApp ${esc(p.telefone)}</a>` : ""}${p.email ? ` · ${esc(p.email)}` : ""}</p>
            <p class="muted small">${e.tipo === "retirada" ? "Retirada" : e.rua ? esc(`${e.rua}, ${e.numero}${e.complemento ? " — " + e.complemento : ""}, ${e.bairro} — ${e.cidade}/${e.uf} — CEP ${e.cep}`) : ""}</p>
            <p class="muted small">Pagamento: <b>${p.pagamento === "cartao" ? "cartão (enviar link)" : "Pix"}</b>${p.cupom ? ` · cupom ${esc(p.cupom)}` : ""}${p.rastreio ? ` · rastreio <b>${esc(p.rastreio)}</b>` : ""}</p>
            ${p.obs ? `<p class="small">“${esc(p.obs)}”</p>` : ""}
          </div>
          <ul>${(p.itens || []).map(i => {
            const prod = PRODUTOS.find(x => x.id === i.id);
            const k = prod && prod.estoque ? prod.estoque[i.chave] : null;
            const est = st === "pendente" && k != null && k !== "" ? ` <span class="est ${Number(k) < i.qtd ? "falta" : ""}">estoque: ${k}</span>` : "";
            return `<li>${i.qtd}× ${esc(i.nome)}${i.opcao ? ` <span class="muted">(${esc(i.opcao)})</span>` : ""} — ${money(i.preco == null ? null : i.preco * i.qtd)}${est}</li>`;
          }).join("")}</ul>
        </div>
        <footer>
          <span>Total: <b>${money(p.total)}</b>${p.aCombinar ? " + a combinar" : ""}${p.frete ? ` <small class="muted">(frete ${money(p.frete)})</small>` : ""}</span>
          <div class="acoes">
            <a class="btn-ghost" href="${esc(linkLoja)}#pedido-${esc(p.id)}" target="_blank">Página do pedido</a>
            ${st === "pendente" ? `<button class="btn-ok" data-acao="pago">Marcar como pago</button><button class="btn-ghost" data-acao="cancelar">Cancelar</button>` : ""}
            ${st === "pago" ? `<button class="btn-ok" data-acao="enviar">Marcar como enviado</button><button class="btn-ghost" data-acao="estornar">Cancelar e devolver ao estoque</button>` : ""}
            ${st === "enviado" ? `<button class="btn-ok" data-acao="entregue">Marcar como entregue</button><button class="btn-ghost" data-acao="estornar">Cancelar e devolver ao estoque</button>` : ""}
            ${st === "cancelado" ? `<button class="btn-ghost danger" data-acao="excluir">Excluir</button>` : ""}
          </div>
        </footer>
        <div class="confirma" hidden></div>
      </article>`;
    }).join("");
  }
  $("#filtroPedidos").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    filtroSt = c.dataset.st; $$("#filtroPedidos .chip").forEach(x => x.classList.toggle("on", x === c)); renderPedidos();
  });
  $("#buscaPed").addEventListener("input", renderPedidos);
  $("#btnAtualizar").addEventListener("click", async () => { await carregarTudo(); toast("Lista atualizada"); });
  setInterval(() => { if (!$("#painel").hidden) carregarPedidos(); }, 45000);

  const TEXTOS = {
    pago: "Confirmar o pagamento? As peças saem do estoque.",
    cancelar: "Cancelar este pedido? O estoque não muda.",
    estornar: "Cancelar e devolver as peças ao estoque?",
    entregue: "Marcar como entregue?",
    excluir: "Excluir este pedido definitivamente?"
  };
  $("#listaPedidos").addEventListener("click", async e => {
    const card = e.target.closest(".pedido"); if (!card) return;
    const box = $(".confirma", card);
    const acao = e.target.closest("[data-acao]");
    if (acao) {
      box.innerHTML = acao.dataset.acao === "enviar"
        ? `<span>Código de rastreio <small>(opcional)</small></span><input class="rastreio" placeholder="Ex.: AA123456789BR"><button class="btn-dark" data-sim="enviar">Confirmar envio</button><button class="btn-ghost" data-nao>Voltar</button>`
        : `<span>${TEXTOS[acao.dataset.acao]}</span><button class="btn-dark" data-sim="${acao.dataset.acao}">Sim</button><button class="btn-ghost" data-nao>Não</button>`;
      box.hidden = false; const r = $(".rastreio", box); if (r) r.focus(); return;
    }
    if (e.target.closest("[data-nao]")) { box.hidden = true; return; }
    const sim = e.target.closest("[data-sim]"); if (!sim) return;
    sim.disabled = true;
    const ped = PEDIDOS.find(p => p.id === card.dataset.id);
    const ref = db.collection("pedidos").doc(ped.id);
    try {
      const a = sim.dataset.sim;
      if (a === "pago") await movimentar(ped, -1, ["pendente"], { status: "pago", pagoEm: TS() });
      if (a === "cancelar") await ref.update({ status: "cancelado", canceladoEm: TS() });
      if (a === "estornar") await movimentar(ped, +1, ["pago", "confirmado", "enviado"], { status: "cancelado", estornado: true, canceladoEm: TS() });
      if (a === "enviar") await ref.update({ status: "enviado", enviadoEm: TS(), rastreio: ($(".rastreio", box).value || "").trim().toUpperCase() });
      if (a === "entregue") await ref.update({ status: "entregue", entregueEm: TS() });
      if (a === "excluir") await ref.delete();
      toast({ pago: "Pagamento confirmado e estoque atualizado", cancelar: "Pedido cancelado", estornar: "Cancelado e estoque devolvido", enviar: "Marcado como enviado", entregue: "Marcado como entregue", excluir: "Pedido excluído" }[a]);
      await carregarTudo();
    } catch (err) { box.hidden = true; toast(msgErro(err), true); }
  });

  /** Muda o status e o estoque juntos (transação). sinal -1 baixa, +1 devolve. */
  function movimentar(ped, sinal, statusValidos, novo) {
    return db.runTransaction(async t => {
      const pref = db.collection("pedidos").doc(ped.id);
      const ps = await t.get(pref);
      if (!ps.exists) throw new Error("Pedido não encontrado.");
      const atual = ps.data();
      if (!statusValidos.includes(atual.status)) throw new Error(`Este pedido já está ${NOMES[atual.status] || atual.status}.`);
      const porProd = {};
      (atual.itens || []).forEach(i => { (porProd[i.id] = porProd[i.id] || []).push(i); });
      const snaps = [];
      for (const id of Object.keys(porProd)) snaps.push(await t.get(db.collection("produtos").doc(id)));
      const mud = [];
      snaps.forEach(s => {
        if (!s.exists) return;
        const d = s.data(), est = { ...(d.estoque || {}) }; let mudou = false;
        porProd[s.id].forEach(i => {
          const k = i.chave || "unico";
          if (est[k] == null || est[k] === "") return;
          const n = Number(est[k]) + sinal * Number(i.qtd);
          if (n < 0) throw new Error(`Estoque insuficiente: ${d.nome}${i.opcao ? " (" + i.opcao + ")" : ""}. Restam ${est[k]}, pedido de ${i.qtd}.`);
          est[k] = n; mudou = true;
        });
        if (mudou) mud.push([s.ref, est]);
      });
      mud.forEach(([r, est]) => t.update(r, { estoque: est }));
      t.update(pref, novo);
    });
  }

  /* ================= PRODUTOS ================= */
  async function carregarProdutos() {
    try {
      const [ps, cs] = await Promise.all([db.collection("produtos").get(), db.collection("config").doc("loja").get()]);
      PRODUTOS = ps.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      CONFIG = cs.exists ? cs.data() : {};
      $("#boxImportar").hidden = PRODUTOS.length > 0;
      sujos.clear(); botaoSalvar();
      montarCategorias(); renderProdutos(); preencherVitrine(); preencherConfig();
    } catch (e) { $("#listaProdutos").innerHTML = `<p class="adm-erro">${esc(msgErro(e))}</p>`; }
  }
  function montarCategorias() {
    const sel = $("#catProd"), atual = sel.value;
    sel.innerHTML = `<option value="">Todas as categorias</option>` + catsDe().map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
    sel.value = atual;
    $("#mpCat").innerHTML = catsDe().map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
  }
  const vCampo = v => (v == null || v === "") ? "" : String(v);

  function renderProdutos() {
    const q = $("#buscaProd").value.trim().toLowerCase(), cat = $("#catProd").value;
    const lista = PRODUTOS.filter(p => (!cat || p.categoria === cat) && (!q || p.nome.toLowerCase().includes(q)));
    $("#listaProdutos").innerHTML = lista.map(p => {
      const ops = opcoes(p), chaves = ops.length ? ops.map(o => o.nome) : ["unico"], est = p.estoque || {};
      const total = chaves.reduce((s, k) => est[k] == null || est[k] === "" ? s : s + Number(est[k]), 0);
      const controla = chaves.some(k => est[k] != null && est[k] !== "");
      return `<article class="prod${p.disponivel === false ? " oculto" : ""}" data-id="${esc(p.id)}">
        <img data-src="${esc((p.imagens || [])[0] || "")}" alt="" loading="lazy">
        <div class="prod-main">
          <div class="prod-head"><strong>${esc(p.nome)}</strong>
            <span class="muted small">${esc(catNome(p.categoria))}${p.destaque ? " · ★ destaque" : ""}${controla ? ` · ${total} em estoque` : " · estoque sem controle"}</span>
            <button class="btn-ghost sm" data-editar>Editar</button></div>
          <div class="campos">
            <label>Preço (R$)<input type="number" step="0.01" min="0" data-f="preco" value="${vCampo(p.preco)}" placeholder="a combinar"></label>
            <label>Preço antigo<input type="number" step="0.01" min="0" data-f="precoAntigo" value="${vCampo(p.precoAntigo)}" placeholder="—"></label>
            <label class="chk"><input type="checkbox" data-f="disponivel" ${p.disponivel === false ? "" : "checked"}> À venda</label>
          </div>
          <div class="estoques">${chaves.map(k => `
            <label class="est-campo">${k === "unico" ? "Estoque" : esc(k)}
              <span class="stepper"><button type="button" data-step="-1" data-k="${esc(k)}" aria-label="Diminuir">−</button>
              <input type="number" min="0" step="1" data-est="${esc(k)}" value="${vCampo(est[k])}" placeholder="∞">
              <button type="button" data-step="1" data-k="${esc(k)}" aria-label="Aumentar">+</button></span></label>`).join("")}</div>
        </div></article>`;
    }).join("") || `<p class="vazio">Nenhum produto encontrado.</p>`;
    sujos.forEach((_, id) => { const el = $(`.prod[data-id="${CSS.escape(id)}"]`); if (el) el.classList.add("sujo"); });
    aplicarImgs($("#listaProdutos"));
  }
  $("#buscaProd").addEventListener("input", renderProdutos);
  $("#catProd").addEventListener("change", renderProdutos);

  function lerCartao(card) {
    const p = PRODUTOS.find(x => x.id === card.dataset.id);
    const est = { ...(p.estoque || {}) };
    $$("[data-est]", card).forEach(i => { est[i.dataset.est] = i.value === "" ? null : Math.max(0, Math.floor(Number(i.value))); });
    return { preco: num($('[data-f="preco"]', card).value), precoAntigo: num($('[data-f="precoAntigo"]', card).value), disponivel: $('[data-f="disponivel"]', card).checked, estoque: est };
  }
  function marcar(card) { sujos.set(card.dataset.id, lerCartao(card)); card.classList.add("sujo"); botaoSalvar(); }
  function botaoSalvar() { const b = $("#btnSalvar"); b.disabled = !sujos.size; b.textContent = sujos.size ? `Salvar alterações (${sujos.size})` : "Salvar alterações"; }
  $("#listaProdutos").addEventListener("input", e => { const c = e.target.closest(".prod"); if (c && e.target.matches("input")) marcar(c); });
  $("#listaProdutos").addEventListener("change", e => { const c = e.target.closest(".prod"); if (c && e.target.matches("input")) marcar(c); });
  $("#listaProdutos").addEventListener("click", e => {
    const card = e.target.closest(".prod"); if (!card) return;
    if (e.target.closest("[data-editar]")) { abrirModal(PRODUTOS.find(p => p.id === card.dataset.id)); return; }
    const b = e.target.closest("[data-step]"); if (!b) return;
    const inp = $(`[data-est="${CSS.escape(b.dataset.k)}"]`, card);
    inp.value = Math.max(0, (inp.value === "" ? 0 : Number(inp.value)) + Number(b.dataset.step)); marcar(card);
  });
  $("#btnSalvar").addEventListener("click", async () => {
    $("#btnSalvar").disabled = true;
    try {
      const lote = db.batch();
      sujos.forEach((d, id) => lote.update(db.collection("produtos").doc(id), d));
      await lote.commit();
      toast(`${sujos.size} ${sujos.size === 1 ? "produto atualizado" : "produtos atualizados"}`);
      await carregarProdutos();
    } catch (e) { toast(msgErro(e), true); botaoSalvar(); }
  });

  /* ---------- fotos: reduz no navegador e guarda no banco ---------- */
  function reduzir(file, max = 1000) {
    return new Promise((ok, fail) => {
      const r = new FileReader();
      r.onerror = () => fail(new Error("Não consegui ler a imagem."));
      r.onload = () => {
        const im = new Image();
        im.onerror = () => fail(new Error("Formato de imagem não suportado."));
        im.onload = () => {
          const k = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          let q = .82, url = c.toDataURL("image/webp", q);
          if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", q);
          while (url.length > 700000 && q > .4) { q -= .12; url = c.toDataURL(url.startsWith("data:image/webp") ? "image/webp" : "image/jpeg", q); }
          ok(url);
        };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  async function enviarImagem(file, max) {
    const data = await reduzir(file, max);
    const ref = db.collection("imagens").doc();
    await ref.set({ data, criadoEm: TS() });
    return "db:" + ref.id;
  }

  /* ---------- modal de produto ---------- */
  let edit = null;   // { id|null, imagens:[], ops:[{nome,preco,est}], est }
  function abrirModal(p) {
    const novo = !p;
    p = p || { nome: "", categoria: (catsDe()[0] || {}).id || "", preco: null, disponivel: true, imagens: [], estoque: {} };
    const ops = opcoes(p);
    edit = { id: novo ? null : p.id, imagens: [...(p.imagens || [])], ops: ops.map(o => ({ nome: o.nome, preco: o.preco ?? "", est: vCampo((p.estoque || {})[o.nome]) })), estUnico: vCampo((p.estoque || {}).unico) };
    $("#mpTit").textContent = novo ? "Novo produto" : "Editar produto";
    $("#mpNome").value = p.nome || ""; $("#mpCat").value = p.categoria || "";
    $("#mpPreco").value = vCampo(p.preco); $("#mpAntigo").value = vCampo(p.precoAntigo);
    $("#mpSelo").value = p.selo || ""; $("#mpDesc").value = p.descricao || "";
    $("#mpAtivo").checked = p.disponivel !== false; $("#mpDest").checked = !!p.destaque;
    $("#mpOpTit").value = (p.opcoes && p.opcoes.titulo) || "";
    $("#mpExcluir").hidden = novo; $("#mpConfExc").hidden = true;
    desenharFotos(); desenharOps();
    $("#modalProd").hidden = false; document.body.classList.add("locked");
    $(".modal-card").classList.add("animate__animated", "animate__zoomIn");
  }
  function fecharModal() { $("#modalProd").hidden = true; document.body.classList.remove("locked"); edit = null; }
  $("#mpFechar").addEventListener("click", fecharModal);
  $("#modalProd").addEventListener("click", e => { if (e.target.id === "modalProd") fecharModal(); });

  function desenharFotos() {
    $("#mpFotos").innerHTML = edit.imagens.map((s, i) => `<div class="foto" draggable="true" data-i="${i}">
      <img data-src="${esc(s)}" alt="">${i === 0 ? `<span class="capa">capa</span>` : ""}
      <div class="foto-acoes"><button data-fmov="-1" aria-label="Para a esquerda">‹</button><button data-frm aria-label="Remover">✕</button><button data-fmov="1" aria-label="Para a direita">›</button></div></div>`).join("") || `<p class="muted small">Nenhuma foto ainda.</p>`;
    aplicarImgs($("#mpFotos"));
  }
  $("#mpFotos").addEventListener("click", e => {
    const f = e.target.closest(".foto"); if (!f) return;
    const i = +f.dataset.i;
    if (e.target.closest("[data-frm]")) edit.imagens.splice(i, 1);
    const m = e.target.closest("[data-fmov]");
    if (m) { const j = i + Number(m.dataset.fmov); if (j >= 0 && j < edit.imagens.length) [edit.imagens[i], edit.imagens[j]] = [edit.imagens[j], edit.imagens[i]]; }
    desenharFotos();
  });
  let arrastando = null;
  $("#mpFotos").addEventListener("dragstart", e => { const f = e.target.closest(".foto"); if (f) arrastando = +f.dataset.i; });
  $("#mpFotos").addEventListener("dragover", e => e.preventDefault());
  $("#mpFotos").addEventListener("drop", e => {
    e.preventDefault(); const f = e.target.closest(".foto"); if (!f || arrastando == null) return;
    const [x] = edit.imagens.splice(arrastando, 1); edit.imagens.splice(+f.dataset.i, 0, x); arrastando = null; desenharFotos();
  });
  $("#mpUp").addEventListener("change", async e => {
    const files = [...e.target.files]; e.target.value = "";
    for (const f of files) {
      toast(`Enviando ${f.name}…`);
      try { edit.imagens.push(await enviarImagem(f)); desenharFotos(); }
      catch (err) { toast(msgErro(err), true); }
    }
    if (files.length) toast("Fotos enviadas. Clique em Salvar produto.");
  });

  function desenharOps() {
    const tem = $("#mpOpTit").value.trim();
    $("#mpOps").innerHTML = tem ? `<div class="op-row op-head"><span>Nome</span><span>Preço próprio</span><span>Estoque</span><span></span></div>` + edit.ops.map((o, i) => `<div class="op-row" data-i="${i}">
      <input data-o="nome" value="${esc(o.nome)}" placeholder="Nome (ex.: Preto)">
      <input data-o="preco" type="number" step="0.01" min="0" value="${esc(o.preco)}" placeholder="Preço (opcional)">
      <input data-o="est" type="number" step="1" min="0" value="${esc(o.est)}" placeholder="Estoque ∞">
      <button class="btn-ghost sm" data-orm aria-label="Remover opção">✕</button></div>`).join("")
      : `<label>Estoque <small>(vazio = sem controle)</small><input id="mpEstU" type="number" min="0" step="1" value="${esc(edit.estUnico)}" placeholder="∞"></label>`;
    $("#mpAddOp").hidden = !tem;
  }
  $("#mpOpTit").addEventListener("input", () => { lerOps(); desenharOps(); });
  $("#mpAddOp").addEventListener("click", () => { lerOps(); edit.ops.push({ nome: "", preco: "", est: "" }); desenharOps(); $("#mpOps .op-row:last-child input").focus(); });
  $("#mpOps").addEventListener("click", e => { const r = e.target.closest("[data-orm]"); if (!r) return; lerOps(); edit.ops.splice(+r.closest(".op-row").dataset.i, 1); desenharOps(); });
  function lerOps() {
    $$("#mpOps .op-row").forEach(r => { const o = edit.ops[+r.dataset.i]; if (!o) return; o.nome = $('[data-o="nome"]', r).value.trim(); o.preco = $('[data-o="preco"]', r).value; o.est = $('[data-o="est"]', r).value; });
    const u = $("#mpEstU"); if (u) edit.estUnico = u.value;
  }

  $("#mpSalvar").addEventListener("click", async () => {
    lerOps();
    const nome = $("#mpNome").value.trim();
    if (!nome) { toast("Dê um nome ao produto", true); $("#mpNome").focus(); return; }
    const titulo = $("#mpOpTit").value.trim();
    const ops = titulo ? edit.ops.filter(o => o.nome) : [];
    if (titulo && !ops.length) { toast("Adicione pelo menos uma opção, ou apague o título das opções", true); return; }
    const estoque = {};
    if (ops.length) ops.forEach(o => { estoque[o.nome] = o.est === "" ? null : Math.max(0, Math.floor(+o.est)); });
    else estoque.unico = edit.estUnico === "" || edit.estUnico == null ? null : Math.max(0, Math.floor(+edit.estUnico));
    const dados = {
      nome, categoria: $("#mpCat").value, preco: num($("#mpPreco").value), precoAntigo: num($("#mpAntigo").value),
      selo: $("#mpSelo").value.trim(), descricao: $("#mpDesc").value.trim(),
      disponivel: $("#mpAtivo").checked, destaque: $("#mpDest").checked,
      imagens: edit.imagens, estoque,
      opcoes: ops.length ? { titulo, itens: ops.map(o => o.preco === "" ? o.nome : { nome: o.nome, preco: num(o.preco) }) } : null
    };
    $("#mpSalvar").disabled = true;
    try {
      if (edit.id) await db.collection("produtos").doc(edit.id).set(dados, { merge: true });
      else {
        let id = slug(nome), n = 2;
        while (PRODUTOS.some(p => p.id === id)) id = slug(nome) + "-" + n++;
        await db.collection("produtos").doc(id).set({ ...dados, ordem: PRODUTOS.length });
      }
      toast("Produto salvo"); fecharModal(); await carregarProdutos();
    } catch (e) { toast(msgErro(e), true); }
    $("#mpSalvar").disabled = false;
  });
  $("#btnNovo").addEventListener("click", () => abrirModal(null));
  $("#mpExcluir").addEventListener("click", () => { $("#mpConfExc").hidden = false; });
  $("#mpExcNao").addEventListener("click", () => { $("#mpConfExc").hidden = true; });
  $("#mpExcSim").addEventListener("click", async () => {
    try { await db.collection("produtos").doc(edit.id).delete(); toast("Produto excluído"); fecharModal(); await carregarProdutos(); }
    catch (e) { toast(msgErro(e), true); }
  });

  /* ---------- importar (primeiro acesso) ---------- */
  $("#btnImportar").addEventListener("click", async () => {
    const b = $("#btnImportar"); b.disabled = true; b.textContent = "Importando…";
    try {
      const d = await new Promise((ok, fail) => { const s = document.createElement("script"); s.src = "dados/produtos.js?v=" + Date.now(); s.onload = () => window.LACE_DADOS ? ok(window.LACE_DADOS) : fail(new Error("Arquivo vazio.")); s.onerror = () => fail(new Error("Não encontrei dados/produtos.js.")); document.head.appendChild(s); });
      const lote = db.batch();
      (d.produtos || []).forEach((p, i) => { const { id, ...r } = p; lote.set(db.collection("produtos").doc(id), { ...r, ordem: i, estoque: r.estoque || {} }); });
      lote.set(db.collection("config").doc("loja"), { loja: d.loja || {}, categorias: d.categorias || [] }, { merge: true });
      await lote.commit(); toast("Catálogo importado."); await carregarProdutos();
    } catch (e) { toast(msgErro(e), true); }
    b.disabled = false; b.textContent = "Importar catálogo";
  });

  /* ================= VITRINE ================= */
  let VB = [], VC = [];
  function preencherVitrine() {
    const v = CONFIG.vitrine || {};
    $("#vAviso").value = v.aviso || ""; $("#vDestTit").value = v.destaquesTitulo || "";
    VB = (v.banners || []).map(b => ({ ...b }));
    VC = catsDe().map(c => ({ ...c }));
    desenharBanners(); desenharCats();
  }
  function linkOpts(atual) {
    const ops = [["#colecao", "Coleção (tudo)"], ...VC.map(c => ["#c-" + c.id, c.nome])];
    return ops.map(([v, n]) => `<option value="${esc(v)}" ${v === atual ? "selected" : ""}>${esc(n)}</option>`).join("");
  }
  function desenharBanners() {
    $("#banners").innerHTML = VB.map((b, i) => `<div class="banner-row" data-i="${i}">
      <div class="banner-img">${b.img ? `<img data-src="${esc(b.img)}" alt="">` : `<span class="muted small">sem foto</span>`}
        <label class="btn-ghost sm up">Foto<input type="file" accept="image/*" data-bimg hidden></label></div>
      <div class="banner-txt">
        <input data-b="titulo" value="${esc(b.titulo || "")}" placeholder="Título (ex.: Nova coleção)">
        <input data-b="subtitulo" value="${esc(b.subtitulo || "")}" placeholder="Subtítulo">
        <div class="two"><input data-b="botao" value="${esc(b.botao || "")}" placeholder="Texto do botão (ex.: Comprar agora)">
        <select data-b="link">${linkOpts(b.link || "#colecao")}</select></div>
      </div>
      <div class="banner-acoes"><button class="btn-ghost sm" data-bmov="-1">↑</button><button class="btn-ghost sm" data-bmov="1">↓</button><button class="btn-ghost sm danger" data-brm>✕</button></div></div>`).join("") || `<p class="muted small">Nenhum banner.</p>`;
    aplicarImgs($("#banners"));
  }
  function lerBanners() { $$(".banner-row").forEach(r => { const b = VB[+r.dataset.i]; $$("[data-b]", r).forEach(i => { b[i.dataset.b] = i.value.trim(); }); }); }
  $("#addBanner").addEventListener("click", () => { lerBanners(); VB.push({ titulo: "", subtitulo: "", botao: "Comprar agora", link: "#colecao", img: "" }); desenharBanners(); });
  $("#banners").addEventListener("click", e => {
    const r = e.target.closest(".banner-row"); if (!r) return; lerBanners(); const i = +r.dataset.i;
    if (e.target.closest("[data-brm]")) VB.splice(i, 1);
    const m = e.target.closest("[data-bmov]"); if (m) { const j = i + +m.dataset.bmov; if (j >= 0 && j < VB.length) [VB[i], VB[j]] = [VB[j], VB[i]]; }
    if (e.target.closest("[data-brm],[data-bmov]")) desenharBanners();
  });
  $("#banners").addEventListener("change", async e => {
    if (!e.target.matches("[data-bimg]")) return;
    const r = e.target.closest(".banner-row"); lerBanners();
    const f = e.target.files[0]; if (!f) return;
    toast("Enviando foto…");
    try { VB[+r.dataset.i].img = await enviarImagem(f, 1800); desenharBanners(); toast("Foto enviada. Clique em Salvar vitrine."); }
    catch (err) { toast(msgErro(err), true); }
  });
  function desenharCats() {
    $("#cats").innerHTML = VC.map((c, i) => {
      const n = PRODUTOS.filter(p => p.categoria === c.id).length;
      return `<div class="cat-row" data-i="${i}"><input data-c="nome" value="${esc(c.nome)}"><span class="muted small">${n} produto(s)</span>
        <button class="btn-ghost sm" data-cmov="-1">↑</button><button class="btn-ghost sm" data-cmov="1">↓</button>
        <button class="btn-ghost sm danger" data-crm ${n ? `disabled title="Mova os produtos antes de excluir"` : ""}>✕</button></div>`;
    }).join("");
  }
  function lerCats() { $$(".cat-row").forEach(r => { VC[+r.dataset.i].nome = $('[data-c="nome"]', r).value.trim() || VC[+r.dataset.i].nome; }); }
  $("#addCat").addEventListener("click", () => { lerCats(); let id = "nova", n = 2; while (VC.some(c => c.id === id)) id = "nova-" + n++; VC.push({ id, nome: "Nova categoria", _novo: true }); desenharCats(); });
  $("#cats").addEventListener("click", e => {
    const r = e.target.closest(".cat-row"); if (!r) return; lerCats(); const i = +r.dataset.i;
    if (e.target.closest("[data-crm]")) VC.splice(i, 1);
    const m = e.target.closest("[data-cmov]"); if (m) { const j = i + +m.dataset.cmov; if (j >= 0 && j < VC.length) [VC[i], VC[j]] = [VC[j], VC[i]]; }
    if (e.target.closest("[data-crm],[data-cmov]")) desenharCats();
  });
  $("#salvarVitrine").addEventListener("click", async () => {
    lerBanners(); lerCats();
    const categorias = VC.map(c => { if (c._novo) { let id = slug(c.nome), n = 2; while (VC.some(x => x !== c && x.id === id)) id = slug(c.nome) + "-" + n++; return { id, nome: c.nome }; } return { id: c.id, nome: c.nome }; });
    const vitrine = { aviso: $("#vAviso").value.trim(), destaquesTitulo: $("#vDestTit").value.trim(), banners: VB.filter(b => b.img || b.titulo) };
    try { await db.collection("config").doc("loja").set({ vitrine, categorias }, { merge: true }); toast("Vitrine salva"); await carregarProdutos(); }
    catch (e) { toast(msgErro(e), true); }
  });

  /* ================= CONFIGURAÇÕES ================= */
  function preencherConfig() {
    const l = CONFIG.loja || {}, pg = CONFIG.pagamento || {}, fr = CONFIG.frete || {};
    $("#cfgWhats").value = l.whatsapp || ""; $("#cfgInsta").value = l.instagram || ""; $("#cfgMsg").value = l.mensagemFinal || "";
    $("#pixTipo").value = pg.pixTipo || "cpf"; $("#pixChave").value = pg.pixChave || ""; $("#pixNome").value = pg.pixNome || "";
    $("#pixCidade").value = pg.pixCidade || ""; $("#pixDesc").value = pg.pixDesconto != null ? Math.round(pg.pixDesconto * 100) : 5;
    $("#cartAtivo").checked = pg.cartaoAtivo !== false; $("#parcMax").value = pg.parcelasMax || 3; $("#parcMin").value = pg.parcelaMin || 30;
    $("#frRetirada").checked = fr.retirada !== false; $("#frRetTxt").value = fr.retiradaTexto || "Retirar com a loja (combinamos pelo WhatsApp)";
    $("#frCidade").value = fr.localCidade || ""; $("#frLocal").value = vCampo(fr.localValor); $("#frNac").value = vCampo(fr.nacionalValor);
    $("#frGratis").value = vCampo(fr.gratisAcima); $("#frPrazo").value = fr.prazoTexto || "Enviamos com código de rastreio.";
  }
  $("#salvarConfig").addEventListener("click", async () => {
    const whats = digits($("#cfgWhats").value);
    if (whats.length < 12) { toast("Confira o WhatsApp: 55 + DDD + número.", true); return; }
    const loja = { ...(CONFIG.loja || {}), whatsapp: whats, instagram: $("#cfgInsta").value.trim().replace(/^@/, ""), mensagemFinal: $("#cfgMsg").value.trim() };
    const pagamento = { pixTipo: $("#pixTipo").value, pixChave: $("#pixChave").value.trim(), pixNome: $("#pixNome").value.trim(), pixCidade: $("#pixCidade").value.trim(),
      pixDesconto: Math.max(0, Math.min(50, Number($("#pixDesc").value) || 0)) / 100,
      cartaoAtivo: $("#cartAtivo").checked, parcelasMax: Math.max(1, Math.min(12, parseInt($("#parcMax").value) || 1)), parcelaMin: Math.max(1, Number($("#parcMin").value) || 1) };
    const frete = { retirada: $("#frRetirada").checked, retiradaTexto: $("#frRetTxt").value.trim(), localCidade: $("#frCidade").value.trim(),
      localValor: num($("#frLocal").value), nacionalValor: num($("#frNac").value), gratisAcima: num($("#frGratis").value), prazoTexto: $("#frPrazo").value.trim() };
    if (pagamento.pixChave && (!pagamento.pixNome || !pagamento.pixCidade)) { toast("Preencha também o nome e a cidade do recebedor do Pix.", true); return; }
    try { await db.collection("config").doc("loja").set({ loja, pagamento, frete }, { merge: true }); CONFIG = { ...CONFIG, loja, pagamento, frete }; toast("Configurações salvas"); }
    catch (e) { toast(msgErro(e), true); }
  });

  /* ---------- cupons ---------- */
  async function carregarCupons() {
    try { const s = await db.collection("cupons").get(); CUPONS = s.docs.map(d => ({ ...d.data(), codigo: d.id })); renderCupons(); }
    catch (e) { $("#listaCupons").innerHTML = `<p class="adm-erro">${esc(msgErro(e))}</p>`; }
  }
  function renderCupons() {
    const hoje = new Date().toISOString().slice(0, 10);
    $("#listaCupons").innerHTML = CUPONS.length ? `<table class="tab"><thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Validade</th><th>Situação</th><th></th></tr></thead><tbody>
      ${CUPONS.map(c => `<tr data-c="${esc(c.codigo)}"><td><b>${esc(c.codigo)}</b></td><td>${c.tipo === "valor" ? money(c.valor) : c.valor + "%"}</td><td>${c.minimo ? money(c.minimo) : "—"}</td>
        <td>${c.validade ? new Date(c.validade + "T12:00").toLocaleDateString("pt-BR") : "sem prazo"}</td>
        <td>${c.ativo === false ? "pausado" : c.validade && c.validade < hoje ? "expirado" : "ativo"}</td>
        <td><button class="btn-ghost sm" data-ctog>${c.ativo === false ? "Ativar" : "Pausar"}</button> <button class="btn-ghost sm danger" data-cdel>Excluir</button></td></tr>`).join("")}
      </tbody></table>` : `<p class="muted small">Nenhum cupom criado.</p>`;
  }
  $("#cpAdd").addEventListener("click", async () => {
    const cod = $("#cpCod").value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const valor = Number($("#cpVal").value), tipo = $("#cpTipo").value;
    if (!cod || !(valor > 0) || (tipo === "pct" && valor > 90)) { toast("Preencha o código e um valor válido (até 90%).", true); return; }
    try {
      await db.collection("cupons").doc(cod).set({ tipo, valor, minimo: num($("#cpMin").value), validade: $("#cpVal2").value || null, ativo: true, criadoEm: TS() });
      ["cpCod", "cpVal", "cpMin", "cpVal2"].forEach(id => { $("#" + id).value = ""; });
      toast(`Cupom ${cod} criado`); await carregarCupons();
    } catch (e) { toast(msgErro(e), true); }
  });
  $("#listaCupons").addEventListener("click", async e => {
    const tr = e.target.closest("tr[data-c]"); if (!tr) return;
    const c = CUPONS.find(x => x.codigo === tr.dataset.c), ref = db.collection("cupons").doc(c.codigo);
    try {
      if (e.target.closest("[data-ctog]")) await ref.update({ ativo: c.ativo === false });
      if (e.target.closest("[data-cdel]")) await ref.delete();
      await carregarCupons();
    } catch (err) { toast(msgErro(err), true); }
  });

  window.addEventListener("beforeunload", e => { if (sujos.size) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modalProd").hidden) fecharModal(); });

  init();
})();
