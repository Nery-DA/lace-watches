/* ==========================================================
   LACE — Pix "copia e cola" (BR Code estático, padrão do Banco Central)
   Gera o código com chave, valor e identificador do pedido.
   ========================================================== */
(() => {
  "use strict";
  const limpa = (s, max) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "").toUpperCase().trim().slice(0, max);
  const campo = (id, valor) => id + String(valor.length).padStart(2, "0") + valor;

  function crc16(txt) {
    let crc = 0xFFFF;
    for (let i = 0; i < txt.length; i++) {
      crc ^= txt.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  /** tipo: "cpf" | "cnpj" | "celular" | "email" | "aleatoria" */
  function normalizaChave(chave, tipo) {
    const c = String(chave || "").trim();
    const d = c.replace(/\D/g, "");
    if (tipo === "email") return c.toLowerCase();
    if (tipo === "aleatoria") return c.toLowerCase();
    if (tipo === "celular") return "+" + (d.startsWith("55") && d.length > 11 ? d : "55" + d);
    return d;
  }

  function gerar({ chave, tipo, nome, cidade, valor, txid }) {
    const conta = campo("00", "br.gov.bcb.pix") + campo("01", normalizaChave(chave, tipo));
    let p = campo("00", "01")
      + campo("26", conta)
      + campo("52", "0000")
      + campo("53", "986")
      + (valor > 0 ? campo("54", Number(valor).toFixed(2)) : "")
      + campo("58", "BR")
      + campo("59", limpa(nome, 25) || "LACE")
      + campo("60", limpa(cidade, 15) || "BRASIL")
      + campo("62", campo("05", (String(txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25)) || "***"))
      + "6304";
    return p + crc16(p);
  }

  window.LacePix = { gerar, crc16, normalizaChave };
})();
