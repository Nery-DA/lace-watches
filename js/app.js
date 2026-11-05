/* ==========================================================
   LACE WATCHES & BAGS — loja
   Página única com rotas pelo endereço (#):
     #               início          #colecao / #c-bolsas   lista
     #p-bag-clara    produto         #busca                 resultado da busca
     #favoritos      favoritos       #checkout              finalizar compra
     #pedidos        meus pedidos    #pedido-ID             acompanhar pedido
     #admin          painel da loja (abre admin.html; protegido por login)
   Dados: Firebase (painel) — ou dados/produtos.js como reserva.
   ========================================================== */
(() => {
  "use strict";

  const CART_KEY = "lace_sacola_v1", FAV_KEY = "lace_favs_v1", ORD_KEY = "lace_pedidos_v1", CLI_KEY = "lace_cliente_v1";
  const EMB = "embalagens";
  const DB = window.LaceDB || null;
  const ONLINE = !!(DB && DB.ativo);

  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = v => (v == null || Number.isNaN(Number(v))) ? "Valor a combinar" : BRL.format(Number(v));
  const r2 = v => Math.round(v * 100) / 100;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const digits = s => String(s || "").replace(/\D/g, "");
  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- Animate.css ---------- */
  function animateCSS(el, animation, { keep = false, delay = 0 } = {}) {
    return new Promise(resolve => {
      if (!el) return resolve();
      el.classList.remove(...[...el.classList].filter(c => c.startsWith("animate__") && c !== "animate__animated"));
      el.style.animationDelay = delay ? `${delay}ms` : "";
      void el.offsetWidth;
      el.classList.add("animate__animated", `animate__${animation}`);
      let fim = false;
      const finish = () => { if (fim) return; fim = true; el.removeEventListener("animationend", done); if (!keep) el.classList.remove(`animate__${animation}`); resolve(); };
      function done(e) { if (e.target === el) finish(); }
      el.addEventListener("animationend", done);
      setTimeout(finish, 1600 + delay);
    });
  }

  /* ================= ESTADO ================= */
  let LOJA = {}, PAG = {}, FRETE = {}, VIT = {}, CATS = [], PRODUTOS = [];
  const byId = {};
  const escolha = {};
  let cart = ls.get(CART_KEY, []);
  let favs = ls.get(FAV_KEY, []);
  const ui = { cat: "todos", q: "", ordem: "padrao" };

  const PAG_PADRAO = { pixDesconto: 0.05, parcelasMax: 3, parcelaMin: 30, cartaoAtivo: true, pixChave: "", pixTipo: "cpf", pixNome: "", pixCidade: "" };
  const FRETE_PADRAO = { retirada: true, retiradaTexto: "Retirar com a loja (combinamos pelo WhatsApp)", localCidade: "", localValor: null, nacionalValor: null, gratisAcima: null, prazoTexto: "Enviamos com código de rastreio." };
  const VIT_PADRAO = { aviso: "", banners: [], destaquesTitulo: "As queridinhas" };

  const saveCart = () => ls.set(CART_KEY, cart);
  const saveFavs = () => ls.set(FAV_KEY, favs);

  /* ================= PREÇOS / OPÇÕES / ESTOQUE ================= */
  const opcoesDe = p => (p.opcoes && Array.isArray(p.opcoes.itens)) ? p.opcoes.itens.map(o => typeof o === "string" ? { nome: o } : o) : [];
  function precoDe(p, idx) {
    const ops = opcoesDe(p);
    if (idx != null && ops[idx] && ops[idx].preco != null) return Number(ops[idx].preco);
    return p.preco == null || p.preco === "" ? null : Number(p.preco);
  }
  function precoMinimo(p) {
    const v = opcoesDe(p).filter(o => o.preco != null).map(o => Number(o.preco));
    return v.length ? Math.min(...v) : precoDe(p, null);
  }
  const variavel = p => new Set(opcoesDe(p).filter(o => o.preco != null).map(o => +o.preco)).size > 1;
  const precoPix = v => v == null ? null : r2(v * (1 - (Number(PAG.pixDesconto) || 0)));
  function parcelas(v) {
    if (v == null || !PAG.cartaoAtivo) return "";
    const n = Math.max(1, Math.min(Number(PAG.parcelasMax) || 1, Math.floor(v / (Number(PAG.parcelaMin) || 1))));
    return n >= 2 ? `ou ${n}x de ${money(r2(v / n))} sem juros` : "à vista no cartão";
  }
  const estq = (p, idx) => DB ? DB.estoque(p, idx) : null;
  const noCarrinho = (id, idx) => cart.filter(i => i.id === id && (i.opt ?? null) === (idx ?? null)).reduce((s, i) => s + i.qty, 0);
  function semEstoque(p) {
    if (p.disponivel === false) return true;
    const ops = opcoesDe(p);
    return ops.length ? ops.every((_, i) => estq(p, i) === 0) : estq(p, null) === 0;
  }
  function avisoEstoque(p) {
    const ops = opcoesDe(p), idx = escolha[p.id];
    if (ops.length && idx == null) return "";
    const n = estq(p, ops.length ? idx : null);
    if (n == null) return "";
    if (n === 0) return "Esgotada nesta opção";
    return n <= 3 ? `Restam ${n} ${n === 1 ? "unidade" : "unidades"}` : "";
  }
  const visiveis = () => PRODUTOS.filter(p => p.disponivel !== false || semEstoque(p) === false);
  const catNome = id => (CATS.find(c => c.id === id) || {}).nome || id;
  const img = (ref, alt = "", cls = "", extra = "") => ref ? `<img ${cls ? `class="${cls}" ` : ""}data-src="${esc(ref)}" alt="${esc(alt)}" loading="lazy" ${extra}>` : "";

  /* ================= CARREGAR DADOS ================= */
  async function carregar() {
    let data = null;
    if (ONLINE) {
      try { data = await DB.carregarCatalogo(); }
      catch (e) { console.warn("Firebase indisponível, usando dados/produtos.js", e); }
    }
    if (!data) {
      data = await new Promise((ok, fail) => {
        const s = document.createElement("script");
        s.src = "dados/produtos.js?v=" + Date.now();
        s.onload = () => window.LACE_DADOS ? ok(window.LACE_DADOS) : fail(new Error("vazio"));
        s.onerror = () => fail(new Error("não encontrei dados/produtos.js"));
        document.head.appendChild(s);
      });
    }
    LOJA = data.loja || {};
    PAG = { ...PAG_PADRAO, ...(data.pagamento || {}) };
    FRETE = { ...FRETE_PADRAO, ...(data.frete || {}) };
    VIT = { ...VIT_PADRAO, ...(data.vitrine || {}) };
    CATS = (data.categorias || []).slice();
    PRODUTOS = (data.produtos || []).filter(p => p && p.id && p.nome);
    PRODUTOS.forEach((p, i) => { p._ordem = i; byId[p.id] = p; });
    cart = cart.filter(it => byId[it.id]);
    saveCart();
  }

  /* ================= CABEÇALHO / MENU ================= */
  function montarCabecalho() {
    const aviso = $("#aviso");
    aviso.textContent = VIT.aviso || "";
    aviso.hidden = !VIT.aviso;
    const cats = CATS.filter(c => PRODUTOS.some(p => p.categoria === c.id));
    const links = [`<a href="#colecao" data-nav="colecao">Coleção</a>`, ...cats.map(c => `<a href="#c-${esc(c.id)}" data-nav="c-${esc(c.id)}">${esc(c.nome)}</a>`)].join("");
    $("#nav").innerHTML = links;
    $("#sideNav").innerHTML = links + `<hr><a href="#favoritos">Favoritos</a><a href="#pedidos">Meus pedidos</a>`;
    if (LOJA.instagram) { const a = $("#instaLink"); a.href = `https://www.instagram.com/${LOJA.instagram}/`; a.textContent = "@" + LOJA.instagram; }
    const fone = digits(LOJA.whatsapp);
    if (fone.length >= 12) { const w = $("#wppFloat"); w.href = `https://wa.me/${fone}?text=${encodeURIComponent("Olá! Vim pelo site da Lace.")}`; w.hidden = false; }
  }
  function marcarNav(h) { $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === h)); }

  const side = $("#sideMenu");
  $("#menuBtn").addEventListener("click", () => { side.hidden = false; $("#overlay").hidden = false; animateCSS(side, "slideInLeft"); });
  const fecharMenu = () => { if (side.hidden) return; side.hidden = true; if ($("#drawer").hidden) $("#overlay").hidden = true; };
  $("#closeMenu").addEventListener("click", fecharMenu);
  side.addEventListener("click", e => { if (e.target.closest("a")) fecharMenu(); });

  $("#searchForm").addEventListener("submit", e => {
    e.preventDefault();
    ui.q = $("#searchInput").value.trim();
    if (!ui.q) return;
    if (location.hash === "#busca") route(); else location.hash = "busca";
  });

  /* ================= CARTÃO DE PRODUTO ================= */
  function precoBloco(p, idx) {
    const v = idx != null ? precoDe(p, idx) : (variavel(p) ? precoMinimo(p) : precoDe(p, null));
    const desde = idx == null && variavel(p);
    if (v == null) return `<span class="price tbd">Valor a combinar</span>`;
    return `<span class="price">${desde ? "<small>a partir de</small>" : ""}${money(v)}${p.precoAntigo ? `<s>${money(p.precoAntigo)}</s>` : ""}</span>
      <span class="parc">${esc(parcelas(v))}</span>
      ${PAG.pixDesconto > 0 ? `<span class="pix">${money(precoPix(v))} no Pix</span>` : ""}`;
  }

  function cardHTML(p) {
    const esg = semEstoque(p);
    const ops = opcoesDe(p);
    const imgs = p.imagens || [];
    return `
    <article class="card pre${esg ? " soldout" : ""}" data-id="${esc(p.id)}">
      <a class="card-media" href="#p-${esc(p.id)}" aria-label="${esc(p.nome)}">
        ${p.selo && !esg ? `<span class="tag selo">${esc(p.selo)}</span>` : ""}
        ${esg ? `<span class="tag">Esgotado</span>` : ""}
        ${img(imgs[0], p.nome)}
        ${imgs[1] ? img(imgs[1], "", "alt") : ""}
      </a>
      <button class="fav${favs.includes(p.id) ? " on" : ""}" data-fav="${esc(p.id)}" aria-label="Favoritar ${esc(p.nome)}" aria-pressed="${favs.includes(p.id)}">
        <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>
      </button>
      <div class="card-info">
        <span class="kicker">${esc(catNome(p.categoria))}</span>
        <a href="#p-${esc(p.id)}" class="card-name">${esc(p.nome)}</a>
        <div class="card-price">${precoBloco(p, null)}</div>
        <button class="btn-add" data-quick="${esc(p.id)}" ${esg ? "disabled" : ""}>
          ${esg ? "Esgotado" : ops.length ? `Escolher ${esc((p.opcoes.titulo || "opção").toLowerCase())}` : "Adicionar à sacola"}
        </button>
      </div>
    </article>`;
  }

  let io;
  function animarCards(raiz) {
    if (io) io.disconnect();
    let lote = 0, t;
    io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      en.target.classList.remove("pre");
      animateCSS(en.target, "fadeInUp", { delay: (lote++ % 6) * 60 });
      clearTimeout(t); t = setTimeout(() => (lote = 0), 120);
    }), { threshold: .1, rootMargin: "0px 0px -30px 0px" });
    $$(".card.pre", raiz).forEach(c => io.observe(c));
  }

  document.addEventListener("click", e => {
    const f = e.target.closest("[data-fav]");
    if (f) { e.preventDefault(); alternarFav(f.dataset.fav); return; }
    const q = e.target.closest("[data-quick]");
    if (q) {
      const p = byId[q.dataset.quick];
      if (opcoesDe(p).length) { location.hash = "p-" + p.id; return; }
      adicionar(p, null, 1, q);
    }
  });

  function alternarFav(id) {
    favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    saveFavs(); contarFavs();
    $$(`[data-fav="${CSS.escape(id)}"]`).forEach(b => { b.classList.toggle("on", favs.includes(id)); b.setAttribute("aria-pressed", favs.includes(id)); animateCSS(b, "heartBeat"); });
    toast(favs.includes(id) ? "Adicionado aos favoritos" : "Removido dos favoritos");
    if (location.hash === "#favoritos") route();
  }
  function contarFavs() { const c = $("#favCount"); c.textContent = favs.length; c.hidden = !favs.length; }

  /* ================= ROTAS ================= */
  const app = $("#app");
  function render(html, titulo) {
    app.innerHTML = html;
    document.title = titulo ? `${titulo} · Lace Watches & Bags` : "Lace Watches & Bags";
    if (DB) DB.aplicarImagens(app);
    animateCSS(app, "fadeIn");
    animarCards(app);
  }
  const topo = () => window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    fecharMenu(); fecharSacola(true);
    clearInterval(timerPedido);
    if (h === "admin" || h === "adm") { location.replace("admin.html"); return; }
    marcarNav(h);
    if (!h || h === "inicio") { renderInicio(); topo(); return; }
    if (h === "colecao") { ui.cat = "todos"; renderLista(); topo(); return; }
    if (h.startsWith("c-")) { ui.cat = h.slice(2); renderLista(); topo(); return; }
    if (h === "busca") { renderLista(true); topo(); return; }
    if (h.startsWith("p-")) { renderProduto(h.slice(2)); topo(); return; }
    if (h === "favoritos") { renderFavoritos(); topo(); return; }
    if (h === "checkout") { renderCheckout(); topo(); return; }
    if (h === "pedidos") { renderMeusPedidos(); topo(); return; }
    if (h.startsWith("pedido-")) { renderPedido(h.slice(7)); topo(); return; }
    renderInicio(); topo();
  }
  window.addEventListener("hashchange", route);

  /* ================= INÍCIO ================= */
  function renderInicio() {
    const banners = (VIT.banners || []).filter(b => b && (b.img || b.titulo));
    const vitrine = PRODUTOS.filter(p => p.categoria !== EMB && p.disponivel !== false);
    const destaques = vitrine.filter(p => p.destaque);
    const lista1 = (destaques.length ? destaques : vitrine.filter(p => p.selo).concat(vitrine)).filter((p, i, a) => a.indexOf(p) === i).slice(0, 8);
    const cats = CATS.filter(c => c.id !== EMB && vitrine.some(p => p.categoria === c.id));
    const embs = PRODUTOS.filter(p => p.categoria === EMB && p.disponivel !== false);
    const capaCat = id => (vitrine.find(p => p.categoria === id && (p.imagens || [])[0]) || {}).imagens?.[0];
    const v = Number(PAG.pixDesconto) || 0;

    render(`
      <section class="hero">
        ${banners.length ? `
          <div class="slides" id="slides">
            ${banners.map((b, i) => `
              <div class="slide${i ? "" : " on"}">
                ${img(b.img, b.titulo || "", "slide-img")}
                <div class="slide-txt wrap">
                  ${b.titulo ? `<h1>${esc(b.titulo)}</h1>` : ""}
                  ${b.subtitulo ? `<p>${esc(b.subtitulo)}</p>` : ""}
                  ${b.botao ? `<a class="btn-light" href="${esc(b.link || "#colecao")}">${esc(b.botao)}</a>` : ""}
                </div>
              </div>`).join("")}
            ${banners.length > 1 ? `<div class="dots">${banners.map((_, i) => `<button data-slide="${i}" class="${i ? "" : "on"}" aria-label="Banner ${i + 1}"></button>`).join("")}</div>` : ""}
          </div>` : `
          <div class="hero-default wrap">
            <div class="hero-text">
              <span class="eyebrow">Nova coleção</span>
              <h1>Elegância, precisão<br><em>e personalidade</em></h1>
              <p>Relógios, bolsas e cintos escolhidos peça por peça.</p>
              <a href="#colecao" class="btn-dark">Comprar agora</a>
            </div>
            <div class="hero-media">
              <img src="img/capa/capa-bolsas.webp" alt="Modelo com bolsa Lace" class="hm-a">
              <img src="img/capa/capa-relogios.webp" alt="Relógio Lace no pulso" class="hm-b">
            </div>
          </div>`}
      </section>

      <section class="perks wrap">
        ${v > 0 ? `<div><b>${Math.round(v * 100)}% off no Pix</b><span>Desconto na finalização</span></div>` : ""}
        ${PAG.cartaoAtivo && PAG.parcelasMax > 1 ? `<div><b>${PAG.parcelasMax}x sem juros</b><span>No cartão de crédito</span></div>` : ""}
        <div><b>Envio nacional</b><span>Com código de rastreio</span></div>
        ${embs.length ? `<div><b>Embalagem presente</b><span>Escolha na sacola</span></div>` : ""}
      </section>

      ${cats.length ? `
      <section class="wrap sec">
        <div class="sec-head"><span class="eyebrow">Navegue por</span><h2>Categorias</h2></div>
        <div class="cats">
          ${cats.map(c => `<a class="cat" href="#c-${esc(c.id)}">${img(capaCat(c.id), c.nome)}<span>${esc(c.nome)}</span></a>`).join("")}
        </div>
      </section>` : ""}

      <section class="wrap sec">
        <div class="sec-head row"><h2>${esc(VIT.destaquesTitulo || "As queridinhas")}</h2><a href="#colecao" class="more">Ver tudo</a></div>
        <div class="grid">${lista1.map(cardHTML).join("")}</div>
      </section>

      ${cats.slice(0, 3).map(c => {
        const ps = vitrine.filter(p => p.categoria === c.id).slice(0, 4);
        return ps.length ? `
        <section class="wrap sec">
          <div class="sec-head row"><h2>${esc(c.nome)}</h2><a href="#c-${esc(c.id)}" class="more">Ver todos</a></div>
          <div class="grid">${ps.map(cardHTML).join("")}</div>
        </section>` : "";
      }).join("")}

      ${embs.length ? `
      <section class="emb-sec">
        <div class="wrap">
          <div class="sec-head"><span class="eyebrow">Para presentear</span><h2>Embalagens Lace</h2><p>Escolha a embalagem e a cor na sacola. Dá para adicionar uma para cada peça.</p></div>
          <div class="emb-row">
            ${embs.map(p => `<a class="emb-tile" href="#p-${esc(p.id)}">${img((p.imagens || [])[0], p.nome)}<b>${esc(p.nome)}</b><span>${money(precoDe(p, null))}</span></a>`).join("")}
          </div>
        </div>
      </section>` : ""}

      <section class="wrap insta">
        <span class="eyebrow">Siga a gente</span>
        <a href="https://www.instagram.com/${esc(LOJA.instagram || "lace_watchesbags")}/" target="_blank" rel="noopener">@${esc(LOJA.instagram || "lace_watchesbags")}</a>
      </section>`);
    iniciarSlides();
  }

  let timerSlide;
  function iniciarSlides() {
    clearInterval(timerSlide);
    const box = $("#slides");
    if (!box) return;
    const slides = $$(".slide", box), dots = $$("[data-slide]", box);
    if (slides.length < 2) return;
    let i = 0;
    const ir = n => { i = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle("on", k === i)); dots.forEach((d, k) => d.classList.toggle("on", k === i)); };
    dots.forEach(d => d.addEventListener("click", () => { ir(+d.dataset.slide); clearInterval(timerSlide); }));
    timerSlide = setInterval(() => { if (!document.body.contains(box)) return clearInterval(timerSlide); ir(i + 1); }, 6000);
  }

  /* ================= LISTA / BUSCA ================= */
  function renderLista(busca = false) {
    const base = PRODUTOS.filter(p => busca ? true : ui.cat === "todos" ? p.categoria !== EMB : p.categoria === ui.cat);
    const q = norm(busca ? ui.q : "");
    let l = base.filter(p => !q || norm(`${p.nome} ${p.descricao} ${catNome(p.categoria)} ${opcoesDe(p).map(o => o.nome).join(" ")}`).includes(q));
    const pr = (p, z) => precoDe(p, null) ?? z;
    if (ui.ordem === "menor") l.sort((a, b) => pr(a, 1e9) - pr(b, 1e9));
    else if (ui.ordem === "maior") l.sort((a, b) => pr(b, -1) - pr(a, -1));
    else if (ui.ordem === "nome") l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    else l.sort((a, b) => semEstoque(a) - semEstoque(b) || a._ordem - b._ordem);
    const titulo = busca ? `Busca: “${ui.q}”` : ui.cat === "todos" ? "Coleção" : catNome(ui.cat);
    const chips = [{ id: "todos", nome: "Tudo" }, ...CATS.filter(c => PRODUTOS.some(p => p.categoria === c.id))];
    render(`
      <section class="wrap sec">
        <div class="sec-head"><span class="eyebrow">${busca ? "Resultado" : "Catálogo"}</span><h1 class="h1">${esc(titulo)}</h1></div>
        <div class="toolbar">
          ${busca ? "" : `<div class="chips">${chips.map(c => `<a class="chip${ui.cat === c.id ? " on" : ""}" href="${c.id === "todos" ? "#colecao" : "#c-" + esc(c.id)}">${esc(c.nome)}</a>`).join("")}</div>`}
          <select id="ordem" aria-label="Ordenar">
            <option value="padrao">Destaques</option><option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option><option value="nome">Nome A–Z</option>
          </select>
        </div>
        <p class="result-info">${l.length} ${l.length === 1 ? "peça" : "peças"}</p>
        <div class="grid">${l.map(cardHTML).join("") || `<p class="empty">Nenhuma peça encontrada. <a href="#colecao">Ver a coleção</a></p>`}</div>
      </section>`, titulo);
    const o = $("#ordem"); o.value = ui.ordem;
    o.addEventListener("change", () => { ui.ordem = o.value; renderLista(busca); });
  }

  /* ================= PRODUTO ================= */
  function renderProduto(id) {
    const p = byId[id];
    if (!p) { render(`<section class="wrap sec"><p class="empty">Produto não encontrado. <a href="#colecao">Ver a coleção</a></p></section>`); return; }
    const ops = opcoesDe(p), imgs = p.imagens || [];
    const esg = semEstoque(p);
    const rel = PRODUTOS.filter(x => x.id !== p.id && x.categoria === p.categoria && !semEstoque(x)).slice(0, 4);
    render(`
      <nav class="wrap crumbs"><a href="#">Início</a> / <a href="#c-${esc(p.categoria)}">${esc(catNome(p.categoria))}</a> / <span>${esc(p.nome)}</span></nav>
      <section class="wrap prod">
        <div class="gal">
          <div class="gal-main">${img(imgs[0], p.nome, "", 'id="galImg"')}
            <button class="fav big${favs.includes(p.id) ? " on" : ""}" data-fav="${esc(p.id)}" aria-label="Favoritar"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg></button>
          </div>
          ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((s, i) => `<button class="${i ? "" : "on"}" data-thumb="${esc(s)}">${img(s)}</button>`).join("")}</div>` : ""}
        </div>
        <div class="pinfo">
          <span class="kicker">${esc(catNome(p.categoria))}${p.selo ? " · " + esc(p.selo) : ""}</span>
          <h1>${esc(p.nome)}</h1>
          <div class="pprice" id="pPrice">${precoBloco(p, escolha[p.id] ?? null)}</div>
          ${p.descricao ? `<p class="pdesc">${esc(p.descricao)}</p>` : ""}
          ${ops.length ? `
            <span class="opt-label">${esc(p.opcoes.titulo || "Opção")}</span>
            <div class="opts" id="pOpts">${ops.map((o, i) => {
              const off = estq(p, i) === 0;
              return `<button class="opt${escolha[p.id] === i ? " on" : ""}${off ? " off" : ""}" data-opt="${i}" ${off ? "disabled" : ""}>${esc(o.nome)}${o.preco != null && variavel(p) ? " · " + money(o.preco) : ""}</button>`;
            }).join("")}</div>` : ""}
          <span class="stock-note" id="pStock">${esc(avisoEstoque(p))}</span>
          <div class="buy">
            <div class="qty"><button data-pq="-1" aria-label="Diminuir">−</button><span id="pQty">1</span><button data-pq="1" aria-label="Aumentar">+</button></div>
            <button class="btn-dark" id="pAdd" ${esg ? "disabled" : ""}>${esg ? "Esgotado" : "Adicionar à sacola"}</button>
          </div>
          ${esg ? "" : `<button class="btn-line full" id="pBuy">Comprar agora</button>`}
          <form class="ship" id="pShip">
            <label for="pCep">Calcular frete</label>
            <div><input id="pCep" inputmode="numeric" placeholder="00000-000" maxlength="9" autocomplete="postal-code"><button class="btn-line">OK</button></div>
            <p id="pShipRes" class="ship-res"></p>
          </form>
          <ul class="pnotes">
            ${PAG.pixDesconto > 0 ? `<li>${Math.round(PAG.pixDesconto * 100)}% de desconto pagando no Pix</li>` : ""}
            <li>${esc(FRETE.prazoTexto || "Enviamos com código de rastreio.")}</li>
            ${PRODUTOS.some(x => x.categoria === EMB) && p.categoria !== EMB ? `<li>Embalagem para presente: escolha na sacola</li>` : ""}
          </ul>
        </div>
      </section>
      ${rel.length ? `<section class="wrap sec"><div class="sec-head row"><h2>Você também pode gostar</h2></div><div class="grid">${rel.map(cardHTML).join("")}</div></section>` : ""}`, p.nome);

    let qty = 1;
    const att = () => {
      $("#pPrice").innerHTML = precoBloco(p, escolha[p.id] ?? null);
      $("#pStock").textContent = avisoEstoque(p);
    };
    $$("[data-thumb]").forEach(b => b.addEventListener("click", () => {
      $$("[data-thumb]").forEach(x => x.classList.toggle("on", x === b));
      const g = $("#galImg"); g.setAttribute("data-src", b.dataset.thumb); DB ? DB.aplicarImagens(g.parentElement) : (g.src = b.dataset.thumb);
      animateCSS(g, "fadeIn");
    }));
    $$("#pOpts [data-opt]").forEach(b => b.addEventListener("click", () => {
      escolha[p.id] = +b.dataset.opt;
      $$("#pOpts [data-opt]").forEach(x => x.classList.toggle("on", x === b));
      animateCSS(b, "rubberBand"); att();
    }));
    $$("[data-pq]").forEach(b => b.addEventListener("click", () => { qty = Math.max(1, qty + +b.dataset.pq); $("#pQty").textContent = qty; }));
    const add = () => {
      if (ops.length && escolha[p.id] == null) { animateCSS($("#pOpts"), "headShake"); toast(`Escolha ${(p.opcoes.titulo || "uma opção").toLowerCase()}`); return false; }
      return adicionar(p, ops.length ? escolha[p.id] : null, qty, $("#pAdd"));
    };
    $("#pAdd").addEventListener("click", () => { if (add()) abrirSacola(); });
    const buy = $("#pBuy"); if (buy) buy.addEventListener("click", () => { if (add()) location.hash = "checkout"; });
    const cep = $("#pCep"); cep.addEventListener("input", () => { cep.value = mascaraCEP(cep.value); });
    $("#pShip").addEventListener("submit", async e => {
      e.preventDefault();
      const res = $("#pShipRes");
      res.textContent = "Consultando…";
      const end = await consultarCEP(cep.value);
      if (!end) { res.textContent = "CEP não encontrado."; return; }
      const f = calcularFrete({ tipo: "envio", cidade: end.cidade, uf: end.uf }, (precoDe(p, escolha[p.id] ?? null) || 0) * qty);
      res.innerHTML = `${esc(end.cidade)}/${esc(end.uf)}: <b>${esc(f.texto)}</b>`;
    });
  }

  /* ================= FAVORITOS ================= */
  function renderFavoritos() {
    const l = favs.map(id => byId[id]).filter(Boolean);
    render(`<section class="wrap sec"><div class="sec-head"><span class="eyebrow">Sua seleção</span><h1 class="h1">Favoritos</h1></div>
      <div class="grid">${l.map(cardHTML).join("") || `<p class="empty">Você ainda não favoritou nenhuma peça. Toque no coração das que você amar. <a href="#colecao">Ver a coleção</a></p>`}</div></section>`, "Favoritos");
  }

  /* ================= SACOLA ================= */
  function adicionar(p, idx, qtd = 1, botao) {
    if (!p || semEstoque(p)) return false;
    const disp = estq(p, idx);
    if (disp != null && noCarrinho(p.id, idx) + qtd > disp) {
      toast(disp === 0 ? `${p.nome} está esgotada nesta opção` : `Só temos ${disp} ${disp === 1 ? "unidade" : "unidades"} de ${p.nome}${idx != null ? " nesta opção" : ""}`);
      return false;
    }
    const key = `${p.id}::${idx ?? ""}`;
    const it = cart.find(i => i.key === key);
    if (it) it.qty += qtd; else cart.push({ key, id: p.id, opt: idx ?? null, qty: qtd });
    saveCart(); atualizarSacola(true);
    if (botao) { const t = botao.textContent; botao.classList.add("done"); botao.textContent = "Adicionado ✓"; animateCSS(botao, "pulse"); setTimeout(() => { botao.classList.remove("done"); botao.textContent = t; }, 1300); }
    if ($("#drawer").hidden) toast(`${p.nome} foi para a sacola`, "Ver sacola", abrirSacola);
    return true;
  }
  const linhaPreco = it => { const v = precoDe(byId[it.id], it.opt); return v == null ? null : r2(v * it.qty); };
  const subtotal = () => r2(cart.reduce((s, it) => s + (linhaPreco(it) ?? 0), 0));
  const aCombinarItens = () => cart.some(it => linhaPreco(it) == null);
  const qtdTotal = () => cart.reduce((s, it) => s + it.qty, 0);
  const nomeOpcao = it => { const p = byId[it.id]; const o = it.opt != null ? opcoesDe(p)[it.opt] : null; return o ? `${p.opcoes.titulo || "Opção"}: ${o.nome}` : ""; };

  function atualizarSacola(bump) {
    const n = qtdTotal(), b = $("#cartCount");
    b.textContent = n; b.classList.toggle("empty", n === 0);
    if (bump) { animateCSS($("#cartBtn"), "tada"); animateCSS(b, "bounceIn"); }
    desenharSacola();
  }

  function embalagensHTML() {
    const embs = PRODUTOS.filter(p => p.categoria === EMB && !semEstoque(p));
    if (!embs.length || !cart.some(it => byId[it.id].categoria !== EMB)) return "";
    return `<section class="emb-box"><h5>Deixe pronto para presentear</h5><p>Escolha a embalagem e a cor. Pode adicionar uma para cada peça.</p>
      <div class="emb-list">${embs.map(p => `
        <div class="emb-card" data-emb="${esc(p.id)}">
          ${img((p.imagens || [])[0], p.nome)}
          <div class="emb-info"><strong>${esc(p.nome)}</strong><span class="emb-price">${money(precoDe(p, escolha[p.id] ?? null))}</span>
            <div class="opts">${opcoesDe(p).map((o, i) => `<button class="opt${escolha[p.id] === i ? " on" : ""}${estq(p, i) === 0 ? " off" : ""}" data-eopt="${i}" ${estq(p, i) === 0 ? "disabled" : ""}>${esc(o.nome)}</button>`).join("")}</div>
            <button class="btn-emb" data-eadd>+ Adicionar</button></div>
        </div>`).join("")}</div></section>`;
  }

  function desenharSacola(animIn = false) {
    const box = $("#cartItems");
    $("#cartFoot").hidden = !cart.length;
    if (!cart.length) { box.innerHTML = `<div class="cart-empty"><p>Sua sacola está vazia</p><a href="#colecao" class="btn-line">Ver a coleção</a></div>`; return; }
    box.innerHTML = cart.map(it => {
      const p = byId[it.id], v = linhaPreco(it);
      return `<div class="ci" data-key="${esc(it.key)}">
        ${img((p.imagens || [])[0])}
        <div><h4>${esc(p.nome)}</h4>${nomeOpcao(it) ? `<div class="ci-opt">${esc(nomeOpcao(it))}</div>` : ""}
          <div class="ci-price${v == null ? " tbd" : ""}">${money(v)}</div>
          <div class="qty small"><button data-q="-1" aria-label="Diminuir">−</button><span>${it.qty}</span><button data-q="1" aria-label="Aumentar">+</button></div></div>
        <button class="ci-remove" data-rm>Remover</button></div>`;
    }).join("") + embalagensHTML();
    const st = subtotal();
    $("#cartTotal").textContent = money(st) + (aCombinarItens() ? " +" : "");
    $("#cartPix").textContent = PAG.pixDesconto > 0 ? `${money(precoPix(st))} no Pix` + (aCombinarItens() ? " (sem as embalagens a combinar)" : "") : "";
    if (DB) DB.aplicarImagens(box);
    if (animIn) $$(".ci", box).forEach((el, i) => animateCSS(el, "fadeInRight", { delay: i * 50 }));
  }

  $("#cartItems").addEventListener("click", async e => {
    const emb = e.target.closest(".emb-card");
    if (emb) {
      const p = byId[emb.dataset.emb];
      const o = e.target.closest("[data-eopt]");
      if (o) { escolha[p.id] = +o.dataset.eopt; $$("[data-eopt]", emb).forEach(x => x.classList.toggle("on", x === o)); $(".emb-price", emb).textContent = money(precoDe(p, escolha[p.id])); return; }
      if (e.target.closest("[data-eadd]")) {
        if (opcoesDe(p).length && escolha[p.id] == null) { animateCSS($(".opts", emb), "headShake"); toast("Escolha a cor da embalagem"); return; }
        adicionar(p, opcoesDe(p).length ? escolha[p.id] : null, 1);
      }
      return;
    }
    const row = e.target.closest(".ci"); if (!row) return;
    const it = cart.find(i => i.key === row.dataset.key); if (!it) return;
    const q = e.target.closest("[data-q]");
    if (q) {
      const disp = estq(byId[it.id], it.opt);
      if (+q.dataset.q > 0 && disp != null && it.qty + 1 > disp) { toast(`Só temos ${disp} ${disp === 1 ? "unidade" : "unidades"}`); return; }
      it.qty += +q.dataset.q;
      if (it.qty <= 0) { await animateCSS(row, "fadeOutLeft", { keep: true }); cart = cart.filter(i => i !== it); }
      saveCart(); atualizarSacola(false); return;
    }
    if (e.target.closest("[data-rm]")) { await animateCSS(row, "fadeOutLeft", { keep: true }); cart = cart.filter(i => i !== it); saveCart(); atualizarSacola(false); }
  });
  $("#clearCart").addEventListener("click", () => { cart = []; saveCart(); atualizarSacola(false); });

  const drawer = $("#drawer"), overlay = $("#overlay");
  function abrirSacola() {
    overlay.hidden = false; drawer.hidden = false; document.body.classList.add("locked");
    animateCSS(overlay, "fadeIn"); animateCSS(drawer, "slideInRight"); desenharSacola(true);
  }
  async function fecharSacola(instant) {
    if (drawer.hidden) return;
    if (!instant) { animateCSS(overlay, "fadeOut"); await animateCSS(drawer, "slideOutRight"); }
    drawer.hidden = true; overlay.hidden = true; document.body.classList.remove("locked");
  }
  $("#cartBtn").addEventListener("click", abrirSacola);
  $("#closeCart").addEventListener("click", () => fecharSacola());
  overlay.addEventListener("click", () => { fecharSacola(); fecharMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { fecharSacola(); fecharMenu(); } });

  /* ================= CEP / FRETE ================= */
  const mascaraCEP = v => { const d = digits(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; };
  const mascaraFone = v => { const d = digits(v).slice(0, 11); if (d.length <= 2) return d; if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`; };
  async function consultarCEP(cep) {
    const d = digits(cep);
    if (d.length !== 8) return null;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j.erro) return null;
      return { cep: mascaraCEP(d), rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" };
    } catch { return null; }
  }
  /** Regras de frete definidas no painel. valor null = a combinar. */
  function calcularFrete(ent, base) {
    if (ent.tipo === "retirada") return { valor: 0, texto: "Grátis — " + (FRETE.retiradaTexto || "retirada") };
    if (FRETE.gratisAcima != null && FRETE.gratisAcima !== "" && base >= Number(FRETE.gratisAcima)) return { valor: 0, texto: "Frete grátis" };
    if (!ent.cidade) return { valor: null, texto: "Informe o CEP" };
    const local = FRETE.localCidade && norm(ent.cidade) === norm(FRETE.localCidade);
    const v = local ? FRETE.localValor : FRETE.nacionalValor;
    if (v == null || v === "") return { valor: null, texto: "Frete a combinar pelo WhatsApp" };
    return Number(v) === 0 ? { valor: 0, texto: "Frete grátis" } : { valor: Number(v), texto: money(v) + (local ? " (entrega local)" : "") };
  }

  /* ================= CHECKOUT ================= */
  let cupomAtivo = null;
  function renderCheckout() {
    if (!cart.length) { render(`<section class="wrap sec narrow"><h1 class="h1">Finalizar compra</h1><p class="empty">Sua sacola está vazia. <a href="#colecao">Ver a coleção</a></p></section>`, "Finalizar compra"); return; }
    const cli = ls.get(CLI_KEY, {});
    const pixOk = Number(PAG.pixDesconto) > 0;
    render(`
      <section class="wrap sec">
        <div class="sec-head"><span class="eyebrow">Quase lá</span><h1 class="h1">Finalizar compra</h1></div>
        <div class="co">
          <div class="co-main">
            <fieldset class="co-box"><legend>1. Seus dados</legend>
              <label>Nome completo<input id="cNome" autocomplete="name" value="${esc(cli.nome || "")}"></label>
              <div class="two"><label>WhatsApp<input id="cFone" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" value="${esc(cli.fone || "")}"></label>
              <label>E-mail <em>(opcional)</em><input id="cEmail" type="email" autocomplete="email" value="${esc(cli.email || "")}"></label></div>
            </fieldset>

            <fieldset class="co-box"><legend>2. Entrega</legend>
              <div class="radios">
                <label class="radio"><input type="radio" name="ent" value="envio" ${cli.tipo !== "retirada" ? "checked" : ""}><span><b>Receber em casa</b><small>${esc(FRETE.prazoTexto || "")}</small></span></label>
                ${FRETE.retirada ? `<label class="radio"><input type="radio" name="ent" value="retirada" ${cli.tipo === "retirada" ? "checked" : ""}><span><b>Retirar</b><small>${esc(FRETE.retiradaTexto || "")}</small></span></label>` : ""}
              </div>
              <div id="endBox">
                <div class="two"><label>CEP<input id="cCep" inputmode="numeric" maxlength="9" autocomplete="postal-code" value="${esc(cli.cep || "")}"></label><span class="cep-msg" id="cepMsg"></span></div>
                <label>Rua<input id="cRua" autocomplete="address-line1" value="${esc(cli.rua || "")}"></label>
                <div class="two"><label>Número<input id="cNum" value="${esc(cli.numero || "")}"></label><label>Complemento<input id="cComp" value="${esc(cli.complemento || "")}"></label></div>
                <div class="three"><label>Bairro<input id="cBairro" value="${esc(cli.bairro || "")}"></label><label>Cidade<input id="cCidade" value="${esc(cli.cidade || "")}"></label><label>UF<input id="cUf" maxlength="2" value="${esc(cli.uf || "")}"></label></div>
              </div>
            </fieldset>

            <fieldset class="co-box"><legend>3. Pagamento</legend>
              <div class="radios">
                <label class="radio"><input type="radio" name="pag" value="pix" checked><span><b>Pix${pixOk ? ` · ${Math.round(PAG.pixDesconto * 100)}% off` : ""}</b><small>QR Code e código copia e cola na próxima tela</small></span></label>
                ${PAG.cartaoAtivo ? `<label class="radio"><input type="radio" name="pag" value="cartao"><span><b>Cartão de crédito${PAG.parcelasMax > 1 ? ` · até ${PAG.parcelasMax}x sem juros` : ""}</b><small>Enviamos o link de pagamento seguro pelo WhatsApp</small></span></label>` : ""}
              </div>
              <label>Observações <em>(opcional)</em><textarea id="cObs" rows="2" placeholder="Ex.: é para presente, horário para entrega…"></textarea></label>
            </fieldset>
          </div>

          <aside class="co-sum">
            <h3>Resumo</h3>
            <div id="sumItens"></div>
            <form class="cupom" id="cupomForm"><input id="cCupom" placeholder="Cupom de desconto" autocomplete="off"><button class="btn-line">Aplicar</button></form>
            <p class="cupom-msg" id="cupomMsg"></p>
            <div id="sumTot"></div>
            <button class="btn-dark full" id="cFinal">Confirmar pedido</button>
            <p class="small muted">Ao confirmar, seu pedido é registrado e você vê como pagar. As peças ficam reservadas quando o pagamento é confirmado.</p>
          </aside>
        </div>
      </section>`, "Finalizar compra");

    const getEnt = () => ({
      tipo: ($('input[name="ent"]:checked') || {}).value || "envio",
      cep: $("#cCep").value.trim(), rua: $("#cRua").value.trim(), numero: $("#cNum").value.trim(), complemento: $("#cComp").value.trim(),
      bairro: $("#cBairro").value.trim(), cidade: $("#cCidade").value.trim(), uf: $("#cUf").value.trim().toUpperCase()
    });
    const getPag = () => ($('input[name="pag"]:checked') || {}).value || "pix";

    function totais() {
      const ent = getEnt(), pag = getPag();
      const st = subtotal();
      let dCupom = 0;
      if (cupomAtivo) dCupom = cupomAtivo.tipo === "valor" ? Math.min(st, Number(cupomAtivo.valor) || 0) : r2(st * (Number(cupomAtivo.valor) || 0) / 100);
      const base = r2(st - dCupom);
      const dPix = pag === "pix" ? r2(base * (Number(PAG.pixDesconto) || 0)) : 0;
      const fr = calcularFrete(ent, base);
      const total = r2(base - dPix + (fr.valor || 0));
      return { ent, pag, st, dCupom, dPix, fr, total };
    }
    function desenharResumo() {
      const t = totais();
      $("#sumItens").innerHTML = cart.map(it => { const p = byId[it.id]; return `<div class="si">${img((p.imagens || [])[0])}<div><b>${it.qty}× ${esc(p.nome)}</b>${nomeOpcao(it) ? `<small>${esc(nomeOpcao(it))}</small>` : ""}</div><span>${money(linhaPreco(it))}</span></div>`; }).join("");
      if (DB) DB.aplicarImagens($("#sumItens"));
      $("#sumTot").innerHTML = `
        <div class="tl"><span>Subtotal</span><span>${money(t.st)}</span></div>
        ${t.dCupom ? `<div class="tl ok"><span>Cupom ${esc(cupomAtivo.codigo)}</span><span>− ${money(t.dCupom)}</span></div>` : ""}
        ${t.dPix ? `<div class="tl ok"><span>Desconto Pix</span><span>− ${money(t.dPix)}</span></div>` : ""}
        <div class="tl"><span>Frete</span><span>${esc(t.fr.valor == null ? t.fr.texto : t.fr.valor === 0 ? "Grátis" : money(t.fr.valor))}</span></div>
        <div class="tl big"><span>Total</span><span>${money(t.total)}${t.fr.valor == null || aCombinarItens() ? " +" : ""}</span></div>
        ${aCombinarItens() ? `<p class="small muted">+ itens com valor a combinar pelo WhatsApp.</p>` : ""}
        ${t.pag === "cartao" && PAG.parcelasMax > 1 ? `<p class="small muted">${esc(parcelas(t.total))}</p>` : ""}`;
    }
    const endBox = $("#endBox");
    const syncEnt = () => { endBox.hidden = getEnt().tipo === "retirada"; desenharResumo(); };
    $$('input[name="ent"], input[name="pag"]').forEach(r => r.addEventListener("change", syncEnt));
    ["cRua", "cNum", "cBairro", "cCidade", "cUf"].forEach(id => $("#" + id).addEventListener("change", desenharResumo));
    $("#cFone").addEventListener("input", e => { e.target.value = mascaraFone(e.target.value); });
    const cep = $("#cCep");
    cep.addEventListener("input", async () => {
      cep.value = mascaraCEP(cep.value);
      if (digits(cep.value).length !== 8) return;
      $("#cepMsg").textContent = "Buscando endereço…";
      const e = await consultarCEP(cep.value);
      if (!e) { $("#cepMsg").textContent = "CEP não encontrado. Preencha o endereço."; return; }
      $("#cepMsg").textContent = `${e.cidade}/${e.uf}`;
      if (e.rua) $("#cRua").value = e.rua;
      if (e.bairro) $("#cBairro").value = e.bairro;
      $("#cCidade").value = e.cidade; $("#cUf").value = e.uf;
      $("#cNum").focus();
      desenharResumo();
    });
    $("#cupomForm").addEventListener("submit", async e => {
      e.preventDefault();
      const cod = $("#cCupom").value.trim().toUpperCase();
      const msg = $("#cupomMsg");
      if (!cod) { cupomAtivo = null; msg.textContent = ""; desenharResumo(); return; }
      if (!ONLINE) { msg.textContent = "Cupons indisponíveis no momento."; return; }
      msg.textContent = "Verificando…";
      let c = null;
      try { c = await DB.buscarCupom(cod); } catch {}
      const hoje = new Date().toISOString().slice(0, 10);
      const st = subtotal();
      if (!c || c.ativo === false) { cupomAtivo = null; msg.textContent = "Cupom inválido."; msg.className = "cupom-msg err"; }
      else if (c.validade && c.validade < hoje) { cupomAtivo = null; msg.textContent = "Este cupom expirou."; msg.className = "cupom-msg err"; }
      else if (c.minimo && st < Number(c.minimo)) { cupomAtivo = null; msg.textContent = `Válido para compras a partir de ${money(c.minimo)}.`; msg.className = "cupom-msg err"; }
      else { cupomAtivo = c; msg.textContent = `Cupom aplicado: ${c.tipo === "valor" ? money(c.valor) : c.valor + "%"} de desconto.`; msg.className = "cupom-msg ok"; }
      desenharResumo();
    });
    if (cupomAtivo) { $("#cCupom").value = cupomAtivo.codigo; $("#cupomMsg").textContent = "Cupom aplicado."; }
    syncEnt();

    $("#cFinal").addEventListener("click", async () => {
      const nome = $("#cNome").value.trim(), fone = digits($("#cFone").value), email = $("#cEmail").value.trim();
      const t = totais();
      const erro = (id, m) => { const el = $("#" + id); el.closest("label").classList.add("err"); animateCSS(el.closest("label"), "headShake"); el.focus(); toast(m); return true; };
      $$(".co label.err").forEach(l => l.classList.remove("err"));
      if (nome.length < 3 && erro("cNome", "Informe seu nome")) return;
      if (fone.length < 10 && erro("cFone", "Informe seu WhatsApp com DDD")) return;
      if (t.ent.tipo === "envio") {
        if (digits(t.ent.cep).length !== 8 && erro("cCep", "Informe o CEP")) return;
        if (!t.ent.rua && erro("cRua", "Informe a rua")) return;
        if (!t.ent.numero && erro("cNum", "Informe o número")) return;
        if (!t.ent.cidade && erro("cCidade", "Informe a cidade")) return;
      }
      // confere estoque de novo
      for (const it of cart) {
        const disp = estq(byId[it.id], it.opt);
        if (disp != null && it.qty > disp) { toast(`${byId[it.id].nome}: só restam ${disp}`); return; }
      }
      ls.set(CLI_KEY, { nome, fone, email, tipo: t.ent.tipo, ...t.ent });
      const codigo = "L" + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
      const pedido = {
        codigo, nome, telefone: fone, email, obs: $("#cObs").value.trim(),
        entrega: t.ent, pagamento: t.pag,
        itens: cart.map(it => { const p = byId[it.id]; const o = it.opt != null ? opcoesDe(p)[it.opt] : null; return { id: p.id, nome: p.nome, opcao: o ? o.nome : "", chave: DB ? DB.chave(p, it.opt) : "unico", qtd: it.qty, preco: precoDe(p, it.opt) }; }),
        subtotal: t.st, cupom: cupomAtivo ? cupomAtivo.codigo : "", descontoCupom: t.dCupom, descontoPix: t.dPix,
        frete: t.fr.valor, total: t.total, aCombinar: aCombinarItens() || t.fr.valor == null
      };
      const btn = $("#cFinal"); btn.disabled = true; btn.textContent = "Registrando…";
      let id = null;
      if (ONLINE) { try { id = await DB.registrarPedido(pedido); } catch (e) { console.warn("Pedido não registrado", e); } }
      btn.disabled = false; btn.textContent = "Confirmar pedido";
      if (!id) {   // sem banco: segue pelo WhatsApp, como antes
        const w = window.open(linkWhats(mensagemPedido({ ...pedido, id: null })), "_blank");
        if (!w) location.href = linkWhats(mensagemPedido({ ...pedido, id: null }));
        return;
      }
      const meus = ls.get(ORD_KEY, []); meus.unshift({ id, codigo, em: Date.now() }); ls.set(ORD_KEY, meus.slice(0, 30));
      cart = []; saveCart(); atualizarSacola(false); cupomAtivo = null;
      try { sessionStorage.setItem("lace_novo", id); } catch {}
      location.hash = "pedido-" + id;
    });
  }

  /* ================= PEDIDO (acompanhar) ================= */
  const STATUS = {
    pendente:   { n: "Aguardando pagamento", d: "Recebemos seu pedido." },
    confirmado: { n: "Pagamento confirmado", d: "Estamos separando suas peças." },
    pago:       { n: "Pagamento confirmado", d: "Estamos separando suas peças." },
    enviado:    { n: "Enviado", d: "Seu pedido está a caminho." },
    entregue:   { n: "Entregue", d: "Esperamos que você ame!" },
    cancelado:  { n: "Cancelado", d: "Este pedido foi cancelado." }
  };
  const ETAPAS = ["pendente", "pago", "enviado", "entregue"];
  const linkWhats = msg => `https://wa.me/${digits(LOJA.whatsapp)}?text=${encodeURIComponent(msg)}`;
  function mensagemPedido(p) {
    const linhas = (p.itens || []).map(i => `• ${i.qtd}x ${i.nome}${i.opcao ? ` (${i.opcao})` : ""} — ${money(i.preco == null ? null : i.preco * i.qtd)}`);
    return [
      `Olá! Fiz um pedido no site da *${LOJA.nome || "Lace"}*.`,
      `Pedido nº *${p.codigo}*`, "", ...linhas, "",
      `*Total: ${money(p.total)}*${p.aCombinar ? " + itens/frete a combinar" : ""}`,
      `Pagamento: ${p.pagamento === "cartao" ? "cartão de crédito (por favor, me envie o link)" : "Pix"}`,
      `Entrega: ${p.entrega && p.entrega.tipo === "retirada" ? "retirada" : `${p.entrega.rua}, ${p.entrega.numero} — ${p.entrega.cidade}/${p.entrega.uf}`}`,
      `Nome: ${p.nome}`,
      p.id ? `\nAcompanhar: ${location.origin}${location.pathname}#pedido-${p.id}` : null
    ].filter(x => x !== null).join("\n");
  }

  let timerPedido;
  async function renderPedido(id) {
    render(`<section class="wrap sec narrow"><p class="loading">Carregando pedido…</p></section>`, "Pedido");
    let p = null;
    try { p = await DB.obterPedido(id); } catch {}
    if (!p) { render(`<section class="wrap sec narrow"><h1 class="h1">Pedido não encontrado</h1><p class="empty">Confira o link ou fale com a gente pelo WhatsApp.</p></section>`, "Pedido"); return; }
    let novo = false; try { novo = sessionStorage.getItem("lace_novo") === id; } catch {}
    const st = p.status === "confirmado" ? "pago" : p.status;
    const etapa = ETAPAS.indexOf(st);
    const pixPend = p.pagamento === "pix" && st === "pendente";
    const chaveOk = PAG.pixChave && String(PAG.pixChave).trim();
    const codigoPix = pixPend && chaveOk && window.LacePix ? LacePix.gerar({ chave: PAG.pixChave, tipo: PAG.pixTipo, nome: PAG.pixNome || LOJA.nome, cidade: PAG.pixCidade, valor: p.total, txid: p.codigo }) : "";
    render(`
      <section class="wrap sec narrow">
        ${novo ? `<div class="ok-banner animate__animated animate__fadeInDown"><b>Pedido registrado!</b> Guarde o número: <b>${esc(p.codigo)}</b></div>` : ""}
        <div class="sec-head"><span class="eyebrow">Pedido nº ${esc(p.codigo)}</span><h1 class="h1">${esc(STATUS[st] ? STATUS[st].n : st)}</h1><p>${esc(STATUS[st] ? STATUS[st].d : "")}</p></div>
        ${st !== "cancelado" ? `<ol class="steps">${ETAPAS.map((e, i) => `<li class="${i <= etapa ? "on" : ""}">${esc(STATUS[e].n)}</li>`).join("")}</ol>` : ""}

        ${pixPend ? `
          <div class="pay-box">
            <h3>Pague com Pix: ${money(p.total)}</h3>
            ${codigoPix ? `
              <div class="qr" id="qr"></div>
              <label class="copy"><span>Pix copia e cola</span><textarea id="pixCode" readonly rows="3">${esc(codigoPix)}</textarea></label>
              <button class="btn-dark" id="copyPix">Copiar código Pix</button>
              <p class="small muted">Depois de pagar, envie o comprovante pelo WhatsApp. Assim que confirmarmos, o status muda aqui.</p>`
            : `<p>Vamos te enviar a chave Pix pelo WhatsApp.</p>`}
            <a class="btn-wpp" href="${esc(linkWhats(mensagemPedido(p) + (codigoPix ? "\n\nVou pagar pelo Pix e envio o comprovante aqui." : "")))}" target="_blank" rel="noopener">Enviar pedido e comprovante no WhatsApp</a>
          </div>` : ""}
        ${p.pagamento === "cartao" && st === "pendente" ? `
          <div class="pay-box">
            <h3>Pagamento no cartão</h3>
            <p>Envie seu pedido pelo WhatsApp e mandamos o link de pagamento seguro${PAG.parcelasMax > 1 ? `, em até ${PAG.parcelasMax}x sem juros` : ""}.</p>
            <a class="btn-wpp" href="${esc(linkWhats(mensagemPedido(p)))}" target="_blank" rel="noopener">Enviar pedido no WhatsApp</a>
          </div>` : ""}
        ${p.rastreio ? `<div class="pay-box"><h3>Código de rastreio</h3><p class="mono">${esc(p.rastreio)}</p><a class="btn-line" href="https://rastreamento.correios.com.br/app/index.php" target="_blank" rel="noopener">Rastrear nos Correios</a></div>` : ""}

        <div class="ped-box">
          <h3>Itens</h3>
          ${(p.itens || []).map(i => `<div class="tl"><span>${i.qtd}× ${esc(i.nome)}${i.opcao ? ` <small>(${esc(i.opcao)})</small>` : ""}</span><span>${money(i.preco == null ? null : i.preco * i.qtd)}</span></div>`).join("")}
          <hr>
          <div class="tl"><span>Subtotal</span><span>${money(p.subtotal)}</span></div>
          ${p.descontoCupom ? `<div class="tl ok"><span>Cupom ${esc(p.cupom)}</span><span>− ${money(p.descontoCupom)}</span></div>` : ""}
          ${p.descontoPix ? `<div class="tl ok"><span>Desconto Pix</span><span>− ${money(p.descontoPix)}</span></div>` : ""}
          <div class="tl"><span>Frete</span><span>${p.frete == null ? "A combinar" : p.frete === 0 ? "Grátis" : money(p.frete)}</span></div>
          <div class="tl big"><span>Total</span><span>${money(p.total)}</span></div>
          <h3>Entrega</h3>
          <p>${p.entrega && p.entrega.tipo === "retirada" ? esc(FRETE.retiradaTexto || "Retirada") : esc(`${p.entrega.rua}, ${p.entrega.numero}${p.entrega.complemento ? " — " + p.entrega.complemento : ""}, ${p.entrega.bairro} — ${p.entrega.cidade}/${p.entrega.uf} — CEP ${p.entrega.cep}`)}</p>
        </div>
        <p class="small muted">Esta página se atualiza sozinha. Guarde o link para acompanhar seu pedido.</p>
      </section>`, "Pedido " + p.codigo);

    if (codigoPix && window.qrcode) {
      const q = qrcode(0, "M"); q.addData(codigoPix); q.make();
      $("#qr").innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    }
    const cp = $("#copyPix");
    if (cp) cp.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(codigoPix); toast("Código Pix copiado"); }
      catch { const t = $("#pixCode"); t.select(); toast("Selecione e copie o código"); }
    });
    try { sessionStorage.removeItem("lace_novo"); } catch {}
    // atualiza o status sozinho
    timerPedido = setInterval(async () => {
      if (location.hash !== "#pedido-" + id) return clearInterval(timerPedido);
      try { const n = await DB.obterPedido(id); if (n && (n.status !== p.status || n.rastreio !== p.rastreio)) { clearInterval(timerPedido); renderPedido(id); } } catch {}
    }, 20000);
  }

  async function renderMeusPedidos() {
    const meus = ls.get(ORD_KEY, []);
    render(`<section class="wrap sec narrow"><div class="sec-head"><span class="eyebrow">Neste aparelho</span><h1 class="h1">Meus pedidos</h1></div>
      <div id="lista">${meus.length ? `<p class="loading">Carregando…</p>` : `<p class="empty">Você ainda não fez pedidos por este aparelho. <a href="#colecao">Ver a coleção</a></p>`}</div></section>`, "Meus pedidos");
    if (!meus.length || !ONLINE) return;
    const lista = await Promise.all(meus.map(m => DB.obterPedido(m.id).catch(() => null)));
    $("#lista").innerHTML = lista.filter(Boolean).map(p => {
      const st = p.status === "confirmado" ? "pago" : p.status;
      return `<a class="ped-row" href="#pedido-${esc(p.id)}"><div><b>Pedido ${esc(p.codigo)}</b><small>${DB.data(p.criadoEm) ? DB.data(p.criadoEm).toLocaleDateString("pt-BR") : ""} · ${(p.itens || []).reduce((s, i) => s + i.qtd, 0)} itens</small></div><span class="pill st-${esc(st)}">${esc(STATUS[st] ? STATUS[st].n : st)}</span><b>${money(p.total)}</b></a>`;
    }).join("") || `<p class="empty">Não encontramos seus pedidos.</p>`;
  }

  /* ================= TOAST ================= */
  const toastEl = $("#toast"); let tToast;
  function toast(text, label, action) {
    clearTimeout(tToast);
    toastEl.innerHTML = `<span>${esc(text)}</span>${label ? `<button>${esc(label)}</button>` : ""}`;
    if (label && action) $("button", toastEl).onclick = () => { toastEl.hidden = true; action(); };
    toastEl.hidden = false; animateCSS(toastEl, "fadeInUp");
    tToast = setTimeout(async () => { await animateCSS(toastEl, "fadeOutDown", { keep: true }); toastEl.hidden = true; toastEl.classList.remove("animate__fadeOutDown"); }, 3000);
  }

  const topbar = $("#topbar");
  addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 10), { passive: true });

  /* ================= INÍCIO ================= */
  (async () => {
    if (/^#(admin|adm)$/.test(location.hash)) { location.replace("admin.html"); return; }
    try { await carregar(); }
    catch (e) { app.innerHTML = `<section class="wrap sec"><p class="empty">Não foi possível carregar a loja. Tente recarregar a página.</p></section>`; return; }
    montarCabecalho(); contarFavs(); atualizarSacola(false);
    route();
  })();
})();
