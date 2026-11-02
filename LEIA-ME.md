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

## Painel do administrador (login, estoque e pedidos)

Com o painel ativado:
- **Só quem tem o login de administrador** altera preços, estoque e dados da loja (em `admin.html`).
- Quando o cliente finaliza, o pedido entra no painel como **pendente**, com um código (ex.: `LO2WJCQ`) que também vai na mensagem do WhatsApp.
- O estoque **só diminui quando você clica em "Confirmar venda"**. Se o cliente desistir, clique em "Cancelar" e nada muda no estoque.
- Se cancelar uma venda já confirmada, use "Cancelar e devolver ao estoque".
- O site mostra "Restam 2 unidades" quando há 3 ou menos, risca a cor esgotada e impede o cliente de colocar na sacola mais do que tem.
- Estoque vazio (∞) = sem controle, a peça fica sempre disponível.

### Como ativar (uma vez, ~15 minutos, gratuito)

1. Entre em **https://console.firebase.google.com** com uma conta Google e clique em **Criar projeto** (ex.: `lace-watches`). Pode desativar o Google Analytics.
2. **Login:** menu *Criação → Authentication* → *Vamos começar* → ative **E-mail/senha**. Na aba *Usuários*, clique em **Adicionar usuário** e crie o e-mail e a senha da administradora.
3. **Banco:** menu *Criação → Firestore Database* → *Criar banco de dados* → local `southamerica-east1 (São Paulo)` → *Modo de produção*.
4. **Regras:** no Firestore, aba **Regras**: apague o que estiver lá, cole o conteúdo de `firestore.rules`, **troque `ADMIN@EXEMPLO.COM` pelo e-mail criado no passo 2** e clique em **Publicar**.
5. **Configuração:** ⚙️ *Configurações do projeto* → em *Seus apps*, clique no ícone **</>** (Web), dê um nome e registre. Copie o objeto `firebaseConfig` e cole em `js/firebase-config.js`, no lugar do `null` (há um exemplo no arquivo).
6. **Domínio do site:** em *Authentication → Configurações → Domínios autorizados*, adicione `SEU-USUARIO.github.io`.
7. Envie os arquivos para o GitHub, abra `https://SEU-USUARIO.github.io/lace-watches/admin.html`, entre com o login e clique em **Importar catálogo** (só no primeiro acesso). Depois defina os estoques e clique em **Salvar alterações**.

Depois de importar, **preços e estoque passam a ser alterados só pelo painel** — o arquivo `dados/produtos.js` fica apenas como reserva (o site volta a usá-lo se o Firebase estiver fora do ar). Produtos novos e fotos novas ainda são incluídos pelo arquivo; me peça que eu adiciono no painel também.

Guarde a senha do administrador em local seguro. Para trocar, use *Authentication → Usuários* no Firebase.
