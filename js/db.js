/* ==========================================================
   LACE — acesso ao Firebase (compartilhado entre site e painel)
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
  /** Carrega o SDK do Firebase (só quando configurado). */
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

  const comPrazo = (promessa, ms) => Promise.race([
    promessa,
    new Promise((_, fail) => setTimeout(() => fail(new Error("tempo esgotado")), ms))
  ]);

  /** Nome da "gaveta" de estoque: a opção escolhida (cor/tamanho) ou "unico". */
  function chave(p, idx) {
    const itens = (p.opcoes && p.opcoes.itens) || [];
    if (idx == null || !itens[idx]) return "unico";
    const o = itens[idx];
    return typeof o === "string" ? o : o.nome;
  }

  /** Quantidade em estoque, ou null quando o estoque não é controlado. */
  function estoque(p, idx) {
    const e = p && p.estoque;
    if (!e) return null;
    const v = e[chave(p, idx)];
    return (v == null || v === "") ? null : Number(v);
  }

  /** Catálogo salvo no Firebase. Devolve null se não houver (usa-se produtos.js). */
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
    return { loja: c.loja || {}, categorias: c.categorias || [], produtos };
  }

  /** Registra o pedido como "pendente". O estoque só baixa quando o admin confirma. */
  async function registrarPedido(pedido) {
    const fb = await comPrazo(iniciar(), 6000);
    if (!fb) return false;
    const ref = fb.firestore().collection("pedidos").doc();
    await comPrazo(ref.set({
      ...pedido,
      status: "pendente",
      criadoEm: fb.firestore.FieldValue.serverTimestamp()
    }), 6000);
    return true;
  }

  const data = v => (v && v.toDate) ? v.toDate() : (v ? new Date(v) : null);

  window.LaceDB = { ativo, iniciar, carregarCatalogo, registrarPedido, chave, estoque, data };
})();
