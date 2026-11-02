/* ==========================================================
   CONFIGURAÇÃO DO FIREBASE (login do administrador, estoque e pedidos)

   Enquanto estiver "null", o site funciona como antes, lendo os
   produtos de dados/produtos.js, sem estoque e sem painel.

   Para ativar: no Firebase, em Configurações do projeto → Seus apps →
   app da Web, copie o objeto "firebaseConfig" e cole no lugar do null,
   assim:

   window.LACE_FIREBASE = {
     apiKey: "AIza...",
     authDomain: "lace-watches.firebaseapp.com",
     projectId: "lace-watches",
     storageBucket: "lace-watches.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };

   Esses dados podem ficar públicos: quem protege o painel são as
   regras de segurança (arquivo firestore.rules) e o login.
   ========================================================== */
window.LACE_FIREBASE = null;
