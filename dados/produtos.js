/* ==========================================================
   LACE — PRODUTOS E PREÇOS
   Este é o único arquivo que você precisa editar.
   • Preço: troque o número em "preco" (use PONTO: 109.90)
   • Esgotado: "disponivel": false
   • Não apague a primeira linha (window.LACE_DADOS = ) nem o ";" no final.
   ========================================================== */
window.LACE_DADOS = {
  "loja": {
    "nome": "Lace Watches & Bags",
    "whatsapp": "5588997653193",
    "instagram": "lace_watchesbags",
    "mensagemFinal": "Aguardo o retorno para combinar pagamento e entrega. Obrigada!"
  },

  "categorias": [
    { "id": "bolsas",   "nome": "Bolsas" },
    { "id": "relogios", "nome": "Relógios" },
    { "id": "masculino", "nome": "Masculinos" },
    { "id": "cintos",   "nome": "Cintos" },
    { "id": "embalagens", "nome": "Embalagens" }
  ],

  "produtos": [
    { "id": "bag-helena",   "nome": "Bag Helena",   "categoria": "bolsas", "preco": 109.90, "disponivel": true,
      "descricao": "Mini bolsa preta estruturada com zíper metálico e alça de corrente.",
      "imagens": ["img/produtos/helena-1.webp"] },

    { "id": "bag-carlene",  "nome": "Bag Carlene",  "categoria": "bolsas", "preco": 169.90, "disponivel": true,
      "descricao": "Bolsa café com alça circular escultural, design moderno e elegante.",
      "imagens": ["img/produtos/carlene-1.webp", "img/produtos/carlene-2.webp"] },

    { "id": "bag-camylla",  "nome": "Bag Camylla",  "categoria": "bolsas", "preco": 99.90, "disponivel": true,
      "descricao": "Bolsa em tecido texturizado verde-sálvia com alça de mão e alça transversal.",
      "imagens": ["img/produtos/camylla-1.webp", "img/produtos/camylla-2.webp", "img/produtos/camylla-3.webp"] },

    { "id": "bag-gisela",   "nome": "Bag Gisela",   "categoria": "bolsas", "preco": 149.90, "disponivel": true,
      "descricao": "Bolsa preta com textura croco, ferragens douradas e alça transversal.",
      "imagens": ["img/produtos/gisela-1.webp", "img/produtos/gisela-2.webp"] },

    { "id": "bag-vanessa",  "nome": "Bag Vanessa",  "categoria": "bolsas", "preco": 104.90, "disponivel": true,
      "descricao": "Bolsa de mão em tom chocolate, acabamento aveludado e alça removível.",
      "imagens": ["img/produtos/vanessa-1.webp", "img/produtos/vanessa-2.webp"] },

    { "id": "bag-clara",    "nome": "Bag Clara",    "categoria": "bolsas", "preco": 89.90, "disponivel": true,
      "descricao": "Pequena e elegante, para celular e gloss. Acompanha alça transversal.",
      "opcoes": { "titulo": "Cor", "itens": ["Preto", "Café"] },
      "imagens": ["img/produtos/clara-1.webp"] },

    { "id": "bag-cecilia",  "nome": "Bag Cecília",  "categoria": "bolsas", "preco": 124.90, "disponivel": true,
      "descricao": "Bolsa com estampa patchwork em tons pastel e lenço decorativo na alça.",
      "imagens": ["img/produtos/cecilia-1.webp"] },

    { "id": "bag-catarina", "nome": "Bag Catarina", "categoria": "bolsas", "preco": 124.90, "disponivel": true,
      "descricao": "Bolsa vermelha arredondada com laço off-white — um charme romântico.",
      "imagens": ["img/produtos/catarina-1.webp", "img/produtos/catarina-2.webp", "img/produtos/catarina-3.webp"] },

    { "id": "bag-julia",    "nome": "Bag Julia",    "categoria": "bolsas", "preco": 111.90, "disponivel": true,
      "descricao": "Com ferragem metálica e porta-moedas. Cor sólida em couro PU marsala.",
      "imagens": ["img/produtos/julia-1.webp", "img/produtos/julia-2.webp", "img/produtos/julia-3.webp"] },

    { "id": "bag-jayna",    "nome": "Bag Jayna",    "categoria": "bolsas", "preco": 84.90, "disponivel": true,
      "selo": "Favorita das seguidoras",
      "descricao": "Bolsa preta croco com aba caramelo e alça transversal. A melhor escolha das seguidoras!",
      "imagens": ["img/produtos/jayna-1.webp"] },

    { "id": "bag-zoe",      "nome": "Bag Zoe",      "categoria": "bolsas", "preco": 59.90, "disponivel": true,
      "descricao": "Estampa monograma em couro PU na cor areia. Disponível em três tamanhos.",
      "opcoes": { "titulo": "Tamanho", "itens": [
        { "nome": "Pequena — 16 x 6 x 12 cm", "preco": 59.90 },
        { "nome": "Média — 19 x 7 x 15 cm",   "preco": 69.90 },
        { "nome": "Grande — 21 x 9 x 17 cm",  "preco": 79.90 }
      ] },
      "imagens": ["img/produtos/zoe-1.webp", "img/produtos/zoe-2.webp", "img/produtos/zoe-3.webp"] },

    { "id": "bag-manuela",  "nome": "Bag Manuela",  "categoria": "bolsas", "preco": 121.90, "disponivel": true,
      "descricao": "Bolsa miniatura metálica prateada com alça transversal.",
      "imagens": ["img/produtos/manuela-1.webp"] },

    { "id": "bag-olivia",   "nome": "Bag Olivia",   "categoria": "bolsas", "preco": 111.90, "disponivel": true,
      "descricao": "Mini bolsa baú com estampa monograma e alça transversal.",
      "opcoes": { "titulo": "Cor", "itens": ["Azul petróleo", "Preto", "Terracota"] },
      "imagens": ["img/produtos/olivia-1.webp", "img/produtos/olivia-2.webp", "img/produtos/olivia-3.webp", "img/produtos/olivia-4.webp"] },

    { "id": "bag-maria",    "nome": "Bag Mariá",    "categoria": "bolsas", "preco": 139.90, "disponivel": true,
      "descricao": "Bolsa de ombro transversal feminina com tecido trançado e detalhes caramelo.",
      "imagens": ["img/produtos/maria-1.webp", "img/produtos/maria-2.webp"] },


    { "id": "rel-crystal",        "nome": "Crystal Branco",        "categoria": "relogios", "preco": 59.90, "disponivel": true,
      "descricao": "Pulseira de silicone branca com máquina transparente.",
      "imagens": ["img/produtos/w01-1.webp", "img/produtos/w01-2.webp"] },

    { "id": "rel-romano-marrom",  "nome": "Romano Marrom",         "categoria": "relogios", "preco": 89.90, "disponivel": true,
      "descricao": "Pulseira de couro PU marrom, mostrador pequeno dourado com números romanos.",
      "imagens": ["img/produtos/w02-1.webp", "img/produtos/w02-2.webp", "img/produtos/w02-3.webp"] },

    { "id": "rel-classico-noir",  "nome": "Clássico Noir",         "categoria": "relogios", "preco": 89.90, "disponivel": true,
      "descricao": "Pulseira de couro PU preta, mostrador pequeno com fundo branco e máquina prata.",
      "imagens": ["img/produtos/w03-1.webp"] },

    { "id": "rel-classico-marrom","nome": "Clássico Marrom",       "categoria": "relogios", "preco": 89.90, "disponivel": true,
      "descricao": "Pulseira de couro PU marrom, mostrador pequeno com fundo branco e máquina prata.",
      "imagens": ["img/produtos/w04-1.webp"] },

    { "id": "rel-quadrado-cafe",  "nome": "Quadrado Café",         "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU marrom, mostrador dourado pequeno minimalista com fundo preto.",
      "imagens": ["img/produtos/w05-1.webp"] },

    { "id": "rel-quadrado-noir",  "nome": "Quadrado Noir",         "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU preta, mostrador dourado pequeno minimalista com fundo preto.",
      "imagens": ["img/produtos/w06-1.webp"] },

    { "id": "rel-quadrado-rose",  "nome": "Quadrado Rosé",         "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU marrom, mostrador pequeno minimalista dourado com fundo branco.",
      "imagens": ["img/produtos/w07-1.webp", "img/produtos/w07-2.webp", "img/produtos/w07-3.webp"] },

    { "id": "rel-quadrado-prata", "nome": "Quadrado Prata",        "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU preta, mostrador pequeno minimalista com fundo preto.",
      "imagens": ["img/produtos/w08-1.webp", "img/produtos/w08-2.webp"] },

    { "id": "rel-delicado-branco","nome": "Delicado Branco",       "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU branca, mostrador pequeno minimalista com fundo branco.",
      "imagens": ["img/produtos/w09-1.webp"] },

    { "id": "rel-costura-preto",  "nome": "Costura Preto",         "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU preta com costura, mostrador pequeno minimalista fundo branco.",
      "imagens": ["img/produtos/w10-1.webp"] },

    { "id": "rel-costura-marrom", "nome": "Costura Marrom",        "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU marrom com costura, mostrador pequeno minimalista fundo branco.",
      "imagens": ["img/produtos/w11-1.webp", "img/produtos/w11-2.webp"] },

    { "id": "rel-costura-bege",   "nome": "Costura Bege",          "categoria": "relogios", "preco": 69.90, "disponivel": true,
      "descricao": "Pulseira de couro PU bege com costura, mostrador pequeno minimalista fundo branco.",
      "imagens": ["img/produtos/w12-1.webp", "img/produtos/w12-2.webp"] },

    { "id": "rel-costura-noir-gold","nome": "Costura Noir Gold",   "categoria": "relogios", "preco": 89.90, "disponivel": true,
      "descricao": "Pulseira de couro PU preta com costura, caixa dourada e mostrador minimalista fundo branco.",
      "imagens": ["img/produtos/w13-1.webp"] },

    { "id": "rel-costura-dourado","nome": "Costura Dourado",       "categoria": "relogios", "preco": 79.90, "disponivel": true,
      "descricao": "Pulseira de couro PU marrom com costura, mostrador pequeno minimalista fundo dourado.",
      "imagens": ["img/produtos/w14-1.webp", "img/produtos/w14-2.webp"] },

    { "id": "rel-unisex-black",   "nome": "Unisex All Black",      "categoria": "masculino", "preco": 79.90, "disponivel": true,
      "selo": "Unisex",
      "descricao": "Pulseira emborrachada, fundo preto e máquina preta.",
      "imagens": ["img/produtos/w15-1.webp"] },

    { "id": "rel-sport-preto",    "nome": "Sport Preto",           "categoria": "masculino", "preco": 79.90, "disponivel": true,
      "descricao": "Relógio masculino preto esportivo com pulseira em nylon.",
      "imagens": ["img/produtos/w16-1.webp"] },

    { "id": "rel-sport-branco",   "nome": "Sport Fundo Branco",    "categoria": "masculino", "preco": 79.90, "disponivel": true,
      "descricao": "Relógio masculino preto esportivo com pulseira em nylon e fundo branco.",
      "imagens": ["img/produtos/w17-1.webp"] },

    { "id": "rel-sport-verde",    "nome": "Sport Verde Militar",   "categoria": "masculino", "preco": 79.90, "disponivel": true,
      "descricao": "Relógio masculino verde exército esportivo com pulseira em nylon e fundo branco.",
      "imagens": ["img/produtos/w18-1.webp"] },

    { "id": "rel-sport-azul",     "nome": "Sport Azul",            "categoria": "masculino", "preco": 79.90, "disponivel": true,
      "descricao": "Relógio masculino esportivo com pulseira em nylon, fundo preto e números azuis.",
      "imagens": ["img/produtos/w19-1.webp"] },

    { "id": "rel-bolsa",          "nome": "Relógio de Bolsa",      "categoria": "relogios", "preco": 59.90, "disponivel": true,
      "descricao": "Relógio pingente para pendurar na bolsa — acessório charmoso e prático.",
      "imagens": ["img/produtos/w20-1.webp", "img/produtos/w20-2.webp"] },

    { "id": "rel-delicado-prata", "nome": "Delicado Prata",        "categoria": "relogios", "preco": 89.90, "disponivel": true,
      "descricao": "Relógio delicado com pulseira fina e máquina mini, todo prata.",
      "imagens": ["img/produtos/w21-1.webp", "img/produtos/w21-2.webp"] },

    { "id": "rel-delicado-cores", "nome": "Delicado Color",        "categoria": "relogios", "preco": 59.90, "disponivel": true,
      "descricao": "Relógio delicado com pulseira intermediária.",
      "opcoes": { "titulo": "Cor", "itens": ["Rosa", "Rosa seco", "Preto", "Branco"] },
      "imagens": ["img/produtos/w22-1.webp"] },

    { "id": "rel-delicado-borracha","nome": "Delicado Emborrachado","categoria": "relogios", "preco": 59.90, "disponivel": true,
      "descricao": "Relógio delicado com pulseira emborrachada.",
      "opcoes": { "titulo": "Cor", "itens": ["Preto", "Marrom", "Cinza"] },
      "imagens": ["img/produtos/w23-1.webp", "img/produtos/w23-2.webp"] },


    { "id": "cinto-classico",     "nome": "Cinto Clássico",        "categoria": "cintos", "preco": 39.90, "disponivel": true,
      "descricao": "Cinto em couro PU, casual, de cor sólida. Comprimento 100 cm.",
      "opcoes": { "titulo": "Cor", "itens": ["Preto", "Marrom"] },
      "imagens": ["img/produtos/cinto-classico-1.webp"] },

    { "id": "cinto-coreano",      "nome": "Cinto Coreano",         "categoria": "cintos", "preco": 49.90, "disponivel": true,
      "descricao": "Cinto versátil estilo coreano com fivela de agulha. Comprimento 110 cm.",
      "opcoes": { "titulo": "Cor", "itens": ["Preto", "Marrom", "Marsala"] },
      "imagens": ["img/produtos/cinto-coreano-1.webp"] },


    /* ---------- EMBALAGENS ----------
       Aparecem no filtro "Embalagens" e dentro da sacola, antes de finalizar.
       "preco": null  →  mostra "Valor a combinar". Troque por um número (ex.: 5.90) quando definir o valor. */

    { "id": "emb-sacola",     "nome": "Sacola Lace",          "categoria": "embalagens", "preco": null, "disponivel": true,
      "descricao": "Sacola com alças e a assinatura Lace, pronta para presentear.",
      "opcoes": { "titulo": "Cor", "itens": ["Branca", "Bege"] },
      "imagens": ["img/produtos/emb-sacola-1.webp", "img/produtos/emb-sacola-2.webp"] },

    { "id": "emb-caixa-lace", "nome": "Caixa Lace Watches",   "categoria": "embalagens", "preco": null, "disponivel": true,
      "descricao": "Caixa rígida texturizada com cinta Lace Watches, no tamanho certo para relógio.",
      "opcoes": { "titulo": "Cor", "itens": ["Vermelha", "Preta", "Rosa", "Off-white"] },
      "imagens": ["img/produtos/emb-caixa-lace-1.webp"] },

    { "id": "emb-caixa-laco", "nome": "Caixa com Laço",       "categoria": "embalagens", "preco": null, "disponivel": true,
      "descricao": "Caixa texturizada com laço de cetim, para relógios e pulseiras.",
      "opcoes": { "titulo": "Cor", "itens": ["Caramelo", "Cinza", "Branca"] },
      "imagens": ["img/produtos/emb-caixa-laco-1.webp"] }
  ]
};
