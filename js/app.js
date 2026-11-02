/* ==========================================================
   LACE WATCHES & BAGS — catálogo + sacola + WhatsApp
   Produtos, preços e estoque vêm do Firebase (painel admin.html)
   quando ele está configurado; senão, de dados/produtos.js
   ========================================================== */
(() => {
  "use strict";

  const DATA_URL  = "dados/produtos.js";
  const CART_KEY  = "lace_sacola_v1";
  const NAME_KEY  = "lace_nome_v1";

  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = v => (v == null || Number.isNaN(Number(v))) ? "Valor a combinar" : BRL.format(Number(v));
  const EMB = "embalagens";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /* ---------- Animate.css helper (padrão da documentação animate.style) ---------- */
  function animateCSS(el, animation, { keep = false, delay = 0 } = {}) {
    return new Promise(resolve => {
      if (!el) return resolve();
      const names = ["animate__animated", `animate__${animation}`];
      el.classList.remove(...[...el.classList].filter(c => c.startsWith("animate__") && c !== "animate__animated"));
      el.style.animationDelay = delay ? `${delay}ms` : "";
      void el.offsetWidth; // reinicia a animação
      el.classList.add(...names);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        el.removeEventListener("animationend", done);
        if (!keep) el.classList.remove(`animate__${animation}`);
        resolve();
      };
      function done(e) { if (e.target === el) finish(); }
      el.addEventListener("animationend", done);
      setTimeout(finish, 1600 + delay); // segurança caso a animação não dispare
    });
  }

  /* ---------- Estado ---------- */
  let LOJA = {};
  let CATS = [];
  let PRODUTOS = [];
  const byId = {};
  const escolha = {};                // id -> índice da opção escolhida
  let filtro = "todos", busca = "", ordem = "padrao";
  let cart = loadCart();

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }

  /* ---------- Preço / opções ---------- */
  const opcoesDe = p => (p.opcoes && Array.isArray(p.opcoes.itens)) ? p.opcoes.itens.map(o => typeof o === "string" ? { nome: o } : o) : [];
  function precoDe(p, idx) {
    const ops = opcoesDe(p);
    if (idx != null && ops[idx] && ops[idx].preco != null) return Number(ops[idx].preco);
    return p.preco == null ? null : Number(p.preco);
  }
  function precoMinimo(p) {
    const vals = opcoesDe(p).filter(o => o.preco != null).map(o => Number(o.preco));
    return vals.length ? Math.min(...vals) : (p.preco == null ? null : Number(p.preco));
  }
  const temPrecoVariavel = p => opcoesDe(p).some(o => o.preco != null && Number(o.preco) !== Number(p.preco)) ||
                                new Set(opcoesDe(p).filter(o => o.preco != null).map(o => +o.preco)).size > 1;

  /* ---------- Estoque (controlado pelo painel do administrador) ---------- */
  const DB = window.LaceDB || null;
  const estq = (p, idx) => DB ? DB.estoque(p, idx) : null;           // null = sem controle
  const noCarrinho = (id, idx) => cart.filter(i => i.id === id && (i.opt ?? null) === (idx ?? null)).reduce((s, i) => s + i.qty, 0);
  function semEstoque(p) {
    if (p.disponivel === false) return true;
    const ops = opcoesDe(p);
    return ops.length ? ops.every((_, i) => estq(p, i) === 0) : estq(p, null) === 0;
  }
  function avisoEstoque(p) {
    const ops = opcoesDe(p);
    const idx = escolha[p.id];
    if (ops.length && idx == null) return "";
    const n = estq(p, ops.length ? idx : null);
    if (n == null) return "";
    if (n === 0) return "Esgotada nesta opção";
    return n <= 3 ? `Restam ${n} ${n === 1 ? "unidade" : "unidades"}` : "";
  }

  function precoHTML(p) {
    const idx = escolha[p.id];
    const variavel = temPrecoVariavel(p);
    let html = (variavel && idx == null)
      ? `<small>a partir de</small>${money(precoMinimo(p))}`
      : money(precoDe(p, idx));
    if (p.precoAntigo) html += `<span class="price-old">${money(p.precoAntigo)}</span>`;
    return html;
  }

  /* ---------- Carregar dados ---------- */
  async function init() {
    let data = null;
    if (DB && DB.ativo) {
      try { data = await DB.carregarCatalogo(); }
      catch (err) { console.warn("Firebase indisponível, usando dados/produtos.js", err); }
    }
    if (data) {
      LOJA = data.loja || {};
      CATS = data.categorias || [];
      PRODUTOS = (data.produtos || []).filter(p => p && p.id && p.nome);
      PRODUTOS.forEach((p, i) => { p._ordem = i; byId[p.id] = p; });
    } else try {
      // carrega dados/produtos.js com "?v=" + hora, para nunca mostrar preços antigos em cache.
      // Funciona tanto no GitHub Pages quanto abrindo o index.html com dois cliques.
      data = await new Promise((ok, fail) => {
        const sc = document.createElement("script");
        sc.src = `${DATA_URL}?v=${Date.now()}`;
        sc.onload = () => window.LACE_DADOS ? ok(window.LACE_DADOS) : fail(new Error("LACE_DADOS vazio"));
        sc.onerror = () => fail(new Error("não encontrei " + DATA_URL));
        document.head.appendChild(sc);
      });
      LOJA = data.loja || {};
      CATS = data.categorias || [];
      PRODUTOS = (data.produtos || []).filter(p => p && p.id && p.nome);
      PRODUTOS.forEach((p, i) => { p._ordem = i; byId[p.id] = p; });
    } catch (err) {
      console.error("Erro ao carregar dados/produtos.js", err);
      $("#gallery").innerHTML = `<div class="empty-state">Não foi possível carregar a coleção.<br><small>Verifique se o arquivo dados/produtos.js existe e se não há vírgula ou aspas faltando nele.</small></div>`;
      return;
    }
    if (LOJA.instagram) {
      const a = $("#instaLink");
      a.href = `https://www.instagram.com/${LOJA.instagram}/`;
      a.textContent = "@" + LOJA.instagram;
    }
    // remove da sacola itens que não existem mais
    cart = cart.filter(it => byId[it.id]);
    saveCart();

    buildFilters();
    render();
    updateCart(false);
    try { $("#custName").value = localStorage.getItem(NAME_KEY) || ""; } catch {}
  }

  /* ---------- Filtros ---------- */
  function buildFilters() {
    const count = id => PRODUTOS.filter(p => id === "todos" ? p.categoria !== EMB : p.categoria === id).length;
    const all = [{ id: "todos", nome: "Todos" }, ...CATS.filter(c => count(c.id) > 0)];
    $("#filters").innerHTML = all.map(c =>
      `<button class="filter-btn${c.id === filtro ? " active" : ""}" data-filter="${esc(c.id)}" role="tab">${esc(c.nome)}<small>${count(c.id)}</small></button>`
    ).join("");
  }

  function setFilter(id) {
    filtro = id;
    $$(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === id));
    render();
  }

  $("#filters").addEventListener("click", e => {
    const b = e.target.closest(".filter-btn");
    if (b) { setFilter(b.dataset.filter); animateCSS(b, "pulse"); }
  });
  $$("[data-goto]").forEach(a => a.addEventListener("click", () => setFilter(a.dataset.goto)));

  let tBusca;
  $("#search").addEventListener("input", e => {
    clearTimeout(tBusca);
    tBusca = setTimeout(() => { busca = norm(e.target.value.trim()); render(); }, 180);
  });
  $("#sort").addEventListener("change", e => { ordem = e.target.value; render(); });

  /* ---------- Grade ---------- */
  function lista() {
    let l = PRODUTOS.filter(p =>
      (filtro === "todos" ? p.categoria !== EMB : p.categoria === filtro) &&
      (!busca || norm(`${p.nome} ${p.descricao} ${p.categoria} ${opcoesDe(p).map(o => o.nome).join(" ")}`).includes(busca))
    );
    const pr = (p, vazio) => precoDe(p, escolha[p.id]) ?? vazio;
    if (ordem === "menor") l.sort((a, b) => pr(a, Infinity) - pr(b, Infinity));
    else if (ordem === "maior") l.sort((a, b) => pr(b, -1) - pr(a, -1));
    else if (ordem === "nome") l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    else l.sort((a, b) => (b.disponivel !== false) - (a.disponivel !== false) || a._ordem - b._ordem);
    return l;
  }

  const catNome = id => (CATS.find(c => c.id === id) || {}).nome || id;

  function cardHTML(p) {
    const ops = opcoesDe(p);
    const imgs = p.imagens || [];
    const esgotado = semEstoque(p);
    return `
    <article class="card pre${esgotado ? " soldout" : ""}" data-id="${esc(p.id)}">
      <button class="card-media" data-open="${esc(p.id)}" aria-label="Ver detalhes de ${esc(p.nome)}">
        <span class="tag">${esc(esgotado ? "Esgotado" : catNome(p.categoria))}</span>
        ${p.selo && !esgotado ? `<span class="tag selo">${esc(p.selo)}</span>` : ""}
        ${imgs[0] ? `<img src="${esc(imgs[0])}" alt="${esc(p.nome)}" loading="lazy">` : ""}
        ${imgs[1] ? `<img class="alt" src="${esc(imgs[1])}" alt="" loading="lazy">` : ""}
      </button>
      <div class="card-info">
        <h3>${esc(p.nome)}</h3>
        <span class="price" data-price>${precoHTML(p)}</span>
        <p>${esc(p.descricao || "")}</p>
        ${ops.length ? `
          <span class="opt-label">${esc(p.opcoes.titulo || "Opção")}</span>
          <div class="opts" data-opts>
            ${ops.map((o, i) => optHTML(p, o, i)).join("")}
          </div>` : ""}
        <span class="stock-note" data-stock>${esc(avisoEstoque(p))}</span>
        <div class="card-actions">
          <button class="btn-add" data-add="${esc(p.id)}" ${esgotado ? "disabled" : ""}>${esgotado ? "Esgotado" : "Adicionar à sacola"}</button>
        </div>
      </div>
    </article>`;
  }

  function optHTML(p, o, i, extra = "") {
    const off = estq(p, i) === 0;
    return `<button class="opt${escolha[p.id] === i ? " on" : ""}${off ? " off" : ""}" data-opt="${i}"${off ? ' disabled title="Esgotada"' : ""}>${esc(o.nome)}${extra}</button>`;
  }

  let io;
  function render() {
    const l = lista();
    const g = $("#gallery");
    $("#resultInfo").textContent = `${l.length} ${l.length === 1 ? "peça" : "peças"}${filtro !== "todos" ? " em " + catNome(filtro) : ""}${busca ? " para sua busca" : ""}`;
    if (!l.length) {
      g.innerHTML = `<div class="empty-state">Nenhuma peça encontrada.</div>`;
      return;
    }
    g.innerHTML = l.map(cardHTML).join("");

    // entrada animada ao aparecer na tela (Animate.css + IntersectionObserver)
    if (io) io.disconnect();
    let lote = 0, tLote;
    io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        en.target.classList.remove("pre");
        animateCSS(en.target, "fadeInUp", { delay: (lote++ % 8) * 70 });
        clearTimeout(tLote); tLote = setTimeout(() => (lote = 0), 120);
      });
    }, { threshold: .12, rootMargin: "0px 0px -40px 0px" });
    $$(".card", g).forEach(c => io.observe(c));
  }

  /* ---------- Cliques na grade ---------- */
  $("#gallery").addEventListener("click", e => {
    const card = e.target.closest(".card");
    if (!card) return;
    const p = byId[card.dataset.id];

    const opt = e.target.closest("[data-opt]");
    if (opt) { escolherOpcao(p, +opt.dataset.opt, card); return; }

    if (e.target.closest("[data-add]")) { adicionar(p, card); return; }
    if (e.target.closest("[data-open]")) abrirModal(p);
  });

  function escolherOpcao(p, idx, scope) {
    escolha[p.id] = idx;
    // atualiza card e modal (se aberto)
    $$(`.card[data-id="${CSS.escape(p.id)}"], #modal[data-id="${CSS.escape(p.id)}"]`).forEach(el => {
      $$("[data-opt]", el).forEach(b => b.classList.toggle("on", +b.dataset.opt === idx));
      const pr = $("[data-price]", el);
      if (pr) { pr.innerHTML = precoHTML(p); animateCSS(pr, "flipInX"); }
      const st = $("[data-stock]", el);
      if (st) st.textContent = avisoEstoque(p);
    });
    const b = scope && $(`[data-opt="${idx}"]`, scope);
    if (b) animateCSS(b, "rubberBand");
  }

  /* ---------- Sacola ---------- */
  function adicionar(p, scope) {
    if (!p || p.disponivel === false) return;
    const ops = opcoesDe(p);
    const idx = escolha[p.id];
    if (ops.length && idx == null) {
      const box = $("[data-opts]", scope);
      animateCSS(box, "headShake");
      toast(`Escolha uma opção de ${(p.opcoes.titulo || "modelo").toLowerCase()} para ${p.nome}`);
      return;
    }
    const disp = estq(p, ops.length ? idx : null);
    if (disp != null && noCarrinho(p.id, idx ?? null) + 1 > disp) {
      toast(disp === 0 ? `${p.nome} está esgotada nesta opção` : `Só temos ${disp} ${disp === 1 ? "unidade" : "unidades"} de ${p.nome}${idx != null ? " nesta opção" : ""}`);
      return;
    }
    const key = `${p.id}::${idx ?? ""}`;
    const it = cart.find(i => i.key === key);
    if (it) it.qty++;
    else cart.push({ key, id: p.id, opt: idx ?? null, qty: 1 });
    saveCart();
    updateCart(true);

    const btn = $("[data-add]", scope);
    if (btn) {
      const txt = btn.textContent;
      btn.classList.add("done"); btn.textContent = "Adicionado ✓";
      animateCSS(btn, "pulse");
      setTimeout(() => { btn.classList.remove("done"); btn.textContent = txt; }, 1400);
    }
    toast(`${p.nome} foi para a sacola`, drawer.hidden ? "Ver sacola" : null, openCart);
  }

  const linhaPreco = it => { const v = precoDe(byId[it.id], it.opt); return v == null ? null : v * it.qty; };
  const total = () => cart.reduce((s, it) => s + (linhaPreco(it) ?? 0), 0);
  const aCombinar = () => cart.some(it => linhaPreco(it) == null);
  const qtdTotal = () => cart.reduce((s, it) => s + it.qty, 0);

  function updateCart(bump) {
    const n = qtdTotal();
    const badge = $("#cartCount");
    badge.textContent = n;
    badge.classList.toggle("empty", n === 0);
    if (bump) { animateCSS($("#cartBtn"), "tada"); animateCSS(badge, "bounceIn"); }
    renderCart();
  }

  function renderCart(animIn = false) {
    const box = $("#cartItems");
    $("#cartFoot").hidden = cart.length === 0;
    if (!cart.length) {
      box.innerHTML = `<div class="cart-empty"><p>Sua sacola está vazia</p>Escolha suas peças favoritas na coleção.</div>`;
      return;
    }
    box.innerHTML = cart.map(it => {
      const p = byId[it.id];
      const op = it.opt != null ? opcoesDe(p)[it.opt] : null;
      return `
      <div class="ci" data-key="${esc(it.key)}">
        <img src="${esc((p.imagens || [])[0] || "")}" alt="">
        <div>
          <h4>${esc(p.nome)}</h4>
          ${op ? `<div class="ci-opt">${esc(p.opcoes.titulo || "Opção")}: ${esc(op.nome)}</div>` : ""}
          <div class="ci-price${linhaPreco(it) == null ? " tbd" : ""}">${money(linhaPreco(it))}${it.qty > 1 && linhaPreco(it) != null ? ` <small style="color:var(--ink-soft);font-weight:400">(${money(precoDe(p, it.opt))} cada)</small>` : ""}</div>
          <div class="qty">
            <button data-q="-1" aria-label="Diminuir">−</button><span>${it.qty}</span><button data-q="1" aria-label="Aumentar">+</button>
          </div>
        </div>
        <button class="ci-remove" data-rm>Remover</button>
      </div>`;
    }).join("") + embalagensHTML();
    $("#cartTotal").textContent = money(total());
    $("#cartTbd").hidden = !aCombinar();
    if (animIn) $$(".ci", box).forEach((el, i) => animateCSS(el, "fadeInRight", { delay: i * 60 }));
  }

  /* Embalagens oferecidas dentro da sacola */
  function embalagensHTML() {
    const embs = PRODUTOS.filter(p => p.categoria === EMB && !semEstoque(p));
    if (!embs.length || !cart.some(it => byId[it.id].categoria !== EMB)) return "";
    return `
    <section class="emb-box">
      <h5>Deixe pronto para presentear</h5>
      <p>Escolha uma embalagem e a cor. Pode adicionar uma para cada peça.</p>
      <div class="emb-list">
        ${embs.map(p => `
        <div class="emb-card" data-emb="${esc(p.id)}">
          <img src="${esc((p.imagens || [])[0] || "")}" alt="${esc(p.nome)}" loading="lazy">
          <div class="emb-info">
            <strong>${esc(p.nome)}</strong>
            <span class="emb-price${precoDe(p, escolha[p.id]) == null ? " tbd" : ""}">${money(precoDe(p, escolha[p.id]))}</span>
            <div class="opts" data-opts>
              ${opcoesDe(p).map((o, i) => optHTML(p, o, i)).join("")}
            </div>
            <button class="btn-emb" data-add>+ Adicionar</button>
          </div>
        </div>`).join("")}
      </div>
    </section>`;
  }

  $("#cartItems").addEventListener("click", e => {
    const card = e.target.closest(".emb-card");
    if (!card) return;
    const p = byId[card.dataset.emb];
    const opt = e.target.closest("[data-opt]");
    if (opt) {
      escolha[p.id] = +opt.dataset.opt;
      $$("[data-opt]", card).forEach(b => b.classList.toggle("on", b === opt));
      animateCSS(opt, "rubberBand");
      return;
    }
    if (e.target.closest("[data-add]")) adicionar(p, card);
  });

  $("#cartItems").addEventListener("click", async e => {
    const row = e.target.closest(".ci");
    if (!row) return;
    const it = cart.find(i => i.key === row.dataset.key);
    if (!it) return;
    const q = e.target.closest("[data-q]");
    if (q) {
      const disp = estq(byId[it.id], it.opt);
      if (+q.dataset.q > 0 && disp != null && it.qty + 1 > disp) {
        toast(`Só temos ${disp} ${disp === 1 ? "unidade" : "unidades"} disponível${disp === 1 ? "" : "is"}`);
        return;
      }
      it.qty += +q.dataset.q;
      if (it.qty <= 0) return remover(row, it);
      saveCart(); updateCart(false);
      animateCSS($(`.ci[data-key="${CSS.escape(it.key)}"] .qty span`), "bounceIn");
      animateCSS($("#cartTotal"), "pulse");
      return;
    }
    if (e.target.closest("[data-rm]")) remover(row, it);
  });

  async function remover(row, it) {
    await animateCSS(row, "fadeOutLeft", { keep: true });
    cart = cart.filter(i => i !== it);
    saveCart(); updateCart(false);
  }

  $("#clearCart").addEventListener("click", async () => {
    await Promise.all($$(".ci").map((r, i) => animateCSS(r, "fadeOutLeft", { keep: true, delay: i * 40 })));
    cart = []; saveCart(); updateCart(false);
  });

  /* ---------- Abrir / fechar sacola ---------- */
  const drawer = $("#drawer"), overlay = $("#overlay");
  function openCart() {
    closeModal(true);
    overlay.hidden = false; drawer.hidden = false;
    document.body.classList.add("locked");
    animateCSS(overlay, "fadeIn");
    animateCSS(drawer, "slideInRight");
    renderCart(true);
  }
  async function closeCart() {
    if (drawer.hidden) return;
    animateCSS(overlay, "fadeOut");
    await animateCSS(drawer, "slideOutRight");
    drawer.hidden = true; overlay.hidden = true;
    document.body.classList.remove("locked");
  }
  $("#cartBtn").addEventListener("click", openCart);
  $("#closeCart").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);

  /* ---------- Finalizar no WhatsApp ---------- */
  const novoCodigo = () => "L" + Date.now().toString(36).slice(-4).toUpperCase() +
    Math.random().toString(36).slice(2, 4).toUpperCase();

  $("#checkout").addEventListener("click", async () => {
    if (!cart.length) return;
    const nameEl = $("#custName");
    const nome = nameEl.value.trim();
    if (!nome) {
      nameEl.parentElement.classList.add("error");
      animateCSS(nameEl.parentElement, "headShake");
      nameEl.focus();
      return;
    }
    nameEl.parentElement.classList.remove("error");
    try { localStorage.setItem(NAME_KEY, nome); } catch {}
    const obs = $("#custNote").value.trim();

    const codigo = novoCodigo();
    const linhas = cart.map(it => {
      const p = byId[it.id];
      const op = it.opt != null ? opcoesDe(p)[it.opt] : null;
      return `• ${it.qty}x ${p.nome}${op ? ` (${p.opcoes.titulo || "Opção"}: ${op.nome})` : ""} — ${money(linhaPreco(it))}`;
    });

    const msg = [
      `Olá! Gostaria de fazer um pedido na *${LOJA.nome || "Lace"}*:`,
      DB && DB.ativo ? `Pedido nº *${codigo}*` : null,
      "",
      ...linhas,
      "",
      `*Total: ${money(total())}*${aCombinar() ? " + embalagem (valor a combinar)" : ""}`,
      "",
      `Nome: ${nome}`,
      obs ? `Observações: ${obs}` : null,
      LOJA.mensagemFinal ? `\n${LOJA.mensagemFinal}` : null
    ].filter(l => l !== null).join("\n");

    const fone = String(LOJA.whatsapp || "").replace(/\D/g, "");
    const valido = fone.length >= 10 && !/^0+$/.test(fone.slice(2));
    if (!valido) console.warn("Número de WhatsApp não configurado em dados/produtos.json (loja.whatsapp).");
    const url = `https://wa.me/${valido ? fone : ""}?text=${encodeURIComponent(msg)}`;

    // abre a aba já no clique (senão o navegador bloqueia) e registra o pedido pendente
    const w = DB && DB.ativo ? window.open("", "_blank") : window.open(url, "_blank");
    if (DB && DB.ativo) {
      const btn = $("#checkout");
      btn.disabled = true;
      try {
        await DB.registrarPedido({
          codigo, nome, obs,
          itens: cart.map(it => {
            const p = byId[it.id];
            const op = it.opt != null ? opcoesDe(p)[it.opt] : null;
            return { id: p.id, nome: p.nome, opcao: op ? op.nome : "", chave: DB.chave(p, it.opt),
                     qtd: it.qty, preco: precoDe(p, it.opt) };
          }),
          total: total(),
          aCombinar: aCombinar()
        });
      } catch (err) {
        console.warn("Pedido não registrado no painel (segue só pelo WhatsApp):", err);
      }
      btn.disabled = false;
      if (w) w.location.href = url;
    }
    if (w) w.opener = null; else location.href = url; // se o pop-up for bloqueado, abre na mesma aba
  });

  /* ---------- Modal de detalhe ---------- */
  const modal = $("#modal");
  function abrirModal(p) {
    const imgs = p.imagens || [];
    const ops = opcoesDe(p);
    const esgotado = semEstoque(p);
    modal.dataset.id = p.id;
    const mImg = $("#mImg");
    mImg.src = imgs[0] || ""; mImg.alt = p.nome;
    $("#mThumbs").innerHTML = imgs.length > 1
      ? imgs.map((src, i) => `<button class="${i ? "" : "on"}" data-src="${esc(src)}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")
      : "";
    $("#mInfo").innerHTML = `
      <span class="kicker">${esc(catNome(p.categoria))}${p.selo ? " · " + esc(p.selo) : ""}</span>
      <h3 id="mTitle">${esc(p.nome)}</h3>
      <span class="price" data-price>${precoHTML(p)}</span>
      <p>${esc(p.descricao || "")}</p>
      ${ops.length ? `
        <span class="opt-label">${esc(p.opcoes.titulo || "Opção")}</span>
        <div class="opts" data-opts>${ops.map((o, i) => optHTML(p, o, i, o.preco != null && temPrecoVariavel(p) ? " · " + money(o.preco) : "")).join("")}</div>` : ""}
      <span class="stock-note" data-stock>${esc(avisoEstoque(p))}</span>
      <button class="btn-add" data-add ${esgotado ? "disabled" : ""}>${esgotado ? "Esgotado" : "Adicionar à sacola"}</button>`;
    modal.hidden = false;
    document.body.classList.add("locked");
    animateCSS(modal, "fadeIn");
    animateCSS($(".modal-card", modal), "zoomIn");
  }
  async function closeModal(instant) {
    if (modal.hidden) return;
    if (!instant) {
      animateCSS(modal, "fadeOut", { keep: true });
      await animateCSS($(".modal-card", modal), "zoomOut", { keep: true });
    }
    modal.hidden = true;
    modal.classList.remove("animate__fadeOut");
    $(".modal-card", modal).classList.remove("animate__zoomOut");
    if (drawer.hidden) document.body.classList.remove("locked");
  }
  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.closest("#closeModal")) return closeModal();
    const p = byId[modal.dataset.id];
    const th = e.target.closest("[data-src]");
    if (th) {
      $$("#mThumbs button").forEach(b => b.classList.toggle("on", b === th));
      $("#mImg").src = th.dataset.src;
      animateCSS($("#mImg"), "fadeIn");
      return;
    }
    const opt = e.target.closest("[data-opt]");
    if (opt) return escolherOpcao(p, +opt.dataset.opt, modal);
    if (e.target.closest("[data-add]")) {
      adicionar(p, modal);
      if (!opcoesDe(p).length || escolha[p.id] != null) setTimeout(() => closeModal(), 500);
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!modal.hidden) closeModal(); else closeCart();
  });

  /* ---------- Toast ---------- */
  const toastEl = $("#toast");
  let tToast;
  function toast(text, actionLabel, action) {
    clearTimeout(tToast);
    toastEl.innerHTML = `<span>${esc(text)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ""}`;
    if (action && actionLabel) $("button", toastEl).onclick = () => { hideToast(); action(); };
    toastEl.hidden = false;
    animateCSS(toastEl, "fadeInUp");
    tToast = setTimeout(hideToast, 3200);
  }
  async function hideToast() {
    clearTimeout(tToast);
    if (toastEl.hidden) return;
    await animateCSS(toastEl, "fadeOutDown", { keep: true });
    toastEl.hidden = true;
    toastEl.classList.remove("animate__fadeOutDown");
  }

  /* ---------- Topbar + seções reveladas ao rolar ---------- */
  const topbar = $("#topbar");
  addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 10), { passive: true });

  const ioReveal = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    ioReveal.unobserve(en.target);
    animateCSS(en.target, en.target.dataset.anim || "fadeInUp", { keep: true });
  }), { threshold: .15 });
  $$(".reveal").forEach(el => ioReveal.observe(el));

  init();
})();
