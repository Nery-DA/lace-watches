# Lace Watches & Bags — site

Catálogo online com sacola de compras que envia o pedido pronto para o WhatsApp.

```
site/
├── index.html            ← página
├── css/style.css         ← visual
├── admin.html            ← painel do administrador (login, pedidos, preços, estoque)
├── firestore.rules       ← regras de segurança do Firebase
├── js/app.js             ← catálogo, filtros, sacola, WhatsApp, animações
├── js/admin.js           ← painel
├── js/db.js              ← conexão com o Firebase
├── js/firebase-config.js ← cole aqui a configuração do Firebase
├── dados/produtos.js   ← ★ ÚNICO ARQUIVO QUE VOCÊ PRECISA EDITAR ★
└── img/
    ├── capa/             ← fotos da capa
    └── produtos/         ← fotos dos produtos
```

Animações: [Animate.css 4.1.1](https://animate.style), carregada pelo CDN no `index.html`.

---

## 1. Configurar o número do WhatsApp (uma vez)

No começo de `dados/produtos.js`:

```json
"whatsapp": "5585999998888",
```

Use só números: **55** (Brasil) + **DDD** + número. Sem espaços, traços ou +.

## 2. Alterar preços

Abra `dados/produtos.js`, encontre o produto e troque o valor de `"preco"`:

```json
{ "id": "bag-helena", "nome": "Bag Helena", "categoria": "bolsas", "preco": 109.90, ...
```

- Use **ponto** como separador decimal: `109.90` (não `109,90`).
- Para mostrar promoção, adicione `"precoAntigo": 129.90` — aparece riscado ao lado.
- Para marcar como esgotado: `"disponivel": false`.
- Selo de destaque (canto da foto): `"selo": "Novidade"`.

Depois de salvar no GitHub, o site mostra os novos preços em 1 a 5 minutos.
Quem já tinha itens na sacola também vê o preço novo, porque os valores sempre são lidos desse arquivo.

### Editando direto no GitHub (sem instalar nada)
1. Abra o repositório → pasta `dados` → `produtos.js`.
2. Clique no lápis (✏️ *Edit this file*).
3. Altere os preços → **Commit changes**.

## 3. Cores, tamanhos e preços por opção

```json
"opcoes": { "titulo": "Cor", "itens": ["Preto", "Café"] }
```

Se cada opção tiver preço diferente (ex.: tamanhos da Bag Zoe):

```json
"opcoes": { "titulo": "Tamanho", "itens": [
  { "nome": "Pequena — 16 x 6 x 12 cm", "preco": 59.90 },
  { "nome": "Grande — 21 x 9 x 17 cm",  "preco": 79.90 }
] }
```

## Embalagens (sacolas e caixas)

Ficam no fim de `dados/produtos.js`, com `"categoria": "embalagens"`. Elas aparecem no filtro **Embalagens** e dentro da sacola de compras, no bloco "Deixe pronto para presentear".

- `"preco": null` → aparece **"Valor a combinar"** e o pedido no WhatsApp avisa isso. Para cobrar, troque `null` por um número (ex.: `"preco": 5.90`).
- Cores: edite a lista em `"opcoes"`. Para tirar uma embalagem do site: `"disponivel": false`.

## 4. Adicionar um produto novo

1. Coloque a foto em `img/produtos/` (de preferência .webp ou .jpg, até ~1000 px).
2. Copie um bloco de produto existente no JSON, cole logo abaixo e altere:
   `id` (único, sem espaço), `nome`, `categoria` (`bolsas`, `relogios`, `masculino` ou `cintos`), `preco`, `descricao`, `imagens`.
3. Atenção às vírgulas: cada bloco `{ ... }` termina com vírgula, **menos o último** da lista.

Dica: se o site ficar em branco depois de uma edição, confira se não ficou faltando vírgula, aspas ou chave `}` perto do trecho que você mexeu.

## 5. Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `lace-watches`).
2. Envie **o conteúdo da pasta `site/`** para a raiz do repositório (arraste os arquivos em *Add file → Upload files*).
3. Em **Settings → Pages**: *Source* = `Deploy from a branch`, *Branch* = `main` / `(root)` → Save.
4. Em ~1 minuto o site fica em `https://SEU-USUARIO.github.io/lace-watches/`.

## 6. Testar no computador

É só abrir o `index.html` com dois cliques — os produtos carregam normalmente.

> Ao editar `dados/produtos.js`, não apague a linha `window.LACE_DADOS =` do início nem o `;` do final.


---

## Painel do administrador

Endereço: `https://nery-da.github.io/lace-watches/#admin` (ou `admin.html`). Só o e-mail definido em `firestore.rules` entra.

- **Início:** faturamento, vendas, ticket médio, pedidos a enviar, mais vendidos e estoque baixo.
- **Pedidos:** aguardando pagamento → **Marcar como pago** (o estoque baixa) → **Marcar como enviado** (com rastreio) → **Entregue**. Cancelar um pedido pago devolve as peças.
- **Produtos e estoque:** preços e estoque rápidos na lista; **Editar** abre fotos, descrição, selo, destaque, cores/tamanhos com preço e estoque próprios. **+ Novo produto** cria do zero.
- **Vitrine:** barra de aviso, banners do início e categorias.
- **Configurações:** WhatsApp, Pix (chave → QR Code com valor exato), desconto no Pix, parcelas, frete (retirada, local, outras cidades, grátis acima de) e cupons.

A loja tem: favoritos, busca, página de cada produto (#p-id), cálculo de frete por CEP, checkout com cupom, Pix com QR Code, cartão por link no WhatsApp e acompanhamento do pedido (#pedido-...) e "Meus pedidos".

Regras de segurança: publique o conteúdo de `firestore.rules` em Firebase → Firestore → Regras sempre que ele mudar.
