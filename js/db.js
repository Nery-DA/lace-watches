/* ==========================================================
   LACE — acesso ao Firebase (compartilhado entre loja e painel)
   ========================================================== */
(() => {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  const cfg = window.LACE_FIREBASE;
  const ativo = !!(cfg && cfg.apiKey && cfg.projectId);

  const loadScript = src => new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => fail(new Error("Não foi possível carregar " + src));
    document.head.appendChild(s);
  });

  let base, comAuth;
  function iniciar(auth = false) {
    if (!ativo) return Promise.resolve(null);
    if (!base) base = (async () => {
      if (!window.firebase || !window.firebase.firestore) {
        await loadScript(SDK + "firebase-app-compat.js");
        await loadScript(SDK + "firebase-firestore-compat.js");
      }
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      return firebase;
    })();
    if (!auth) return base;
    if (!comAuth) comAuth = base.then(async fb => {
      if (!fb.auth) await loadScript(SDK + "firebase-auth-compat.js");
      return fb;
    });
    return comAuth;
  }

  const comPrazo = (p, ms) => Promise.race([p, new Promise((_, f) => setTimeout(() => f(new Error("tempo esgotado")), ms))]);

  /* ---------- estoque ---------- */
  function chave(p, idx) {
    const itens = (p.opcoes && p.opcoes.itens) || [];
    if (idx == null || !itens[idx]) return "unico";
    const o = itens[idx];
    return typeof o === "string" ? o : o.nome;
  }
  function estoque(p, idx) {
    const e = p && p.estoque;
    if (!e) return null;
    const v = e[chave(p, idx)];
    return (v == null || v === "") ? null : Number(v);
  }

  /* ---------- catálogo ---------- */
  async function carregarCatalogo() {
    const fb = await comPrazo(iniciar(), 8000);
    if (!fb) return null;
    const db = fb.firestore();
    const [cfgSnap, prodSnap] = await comPrazo(Promise.all([
      db.collection("config").doc("loja").get(),
      db.collection("produtos").get()
    ]), 8000);
    if (prodSnap.empty) return null;
    const produtos = prodSnap.docs.map(d => ({ ...d.data(), id: d.id }))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const c = cfgSnap.exists ? cfgSnap.data() : {};
    return { ...c, loja: c.loja || {}, categorias: c.categorias || [], produtos };
  }

  /* ---------- imagens enviadas pelo painel (guardadas no banco) ---------- */
  const cacheImg = {};
  /** Devolve a URL utilizável de uma imagem: caminho normal ou "db:ID" (do banco). */
  function imagem(ref) {
    if (!ref || !String(ref).startsWith("db:")) return Promise.resolve(ref || "");
    const id = String(ref).slice(3);
    if (!cacheImg[id]) cacheImg[id] = iniciar().then(fb => fb ? fb.firestore().collection("imagens").doc(id).get() : null)
      .then(s => (s && s.exists ? s.data().data : "")).catch(() => "");
    return cacheImg[id];
  }
  /** Preenche <img data-src="..."> resolvendo imagens do banco. */
  function aplicarImagens(raiz = document) {
    raiz.querySelectorAll("img[data-src]").forEach(img => {
      const ref = img.getAttribute("data-src");
      img.removeAttribute("data-src");
      if (!ref.startsWith("db:")) { img.src = ref; return; }
      imagem(ref).then(u => { if (u) img.src = u; });
    });
  }

  /* ---------- pedidos ---------- */
  async function registrarPedido(pedido) {
    const fb = await comPrazo(iniciar(), 6000);
    if (!fb) return null;
    const ref = fb.firestore().collection("pedidos").doc();
    await comPrazo(ref.set({ ...pedido, status: "pendente", criadoEm: fb.firestore.FieldValue.serverTimestamp() }), 8000);
    return ref.id;
  }
  async function obterPedido(id) {
    const fb = await comPrazo(iniciar(), 6000);
    if (!fb) return null;
    const s = await comPrazo(fb.firestore().collection("pedidos").doc(id).get(), 8000);
    return s.exists ? { ...s.data(), id: s.id } : null;
  }

  /* ---------- cupons ---------- */
  async function buscarCupom(codigo) {
    const fb = await comPrazo(iniciar(), 6000);
    if (!fb) return null;
    const s = await comPrazo(fb.firestore().collection("cupons").doc(codigo.toUpperCase()).get(), 8000);
    return s.exists ? { ...s.data(), codigo: s.id } : null;
  }

  const data = v => (v && v.toDate) ? v.toDate() : (v ? new Date(v) : null);

  window.LaceDB = { ativo, iniciar, carregarCatalogo, registrarPedido, obterPedido, buscarCupom,
                    chave, estoque, imagem, aplicarImagens, data };
})();
