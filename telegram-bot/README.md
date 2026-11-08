# Bot do Telegram para o Aletheia

Cria e edita ensaios do blog pelo celular, sem precisar do PC. Roda num Cloudflare
Worker (grátis) e fala com o GitHub pela API — quando você confirma, ele faz um
commit, e a Vercel já builda e publica sozinha.

Este bot é específico para este repositório: ele conhece a pasta
`src/content/articles`, os campos obrigatórios do frontmatter (`title`,
`date`, `description`) e a numeração dos arquivos (`N.nome.md`), do mesmo
jeito que o `scripts/criar-ensaio.sh` local.

Veja os dois guias do blog antes de usar: [guia de comandos](../docs/guia-comandos.md)
e [guia de Markdown](../docs/guia-markdown.md) — o bot só automatiza o envio,
o conteúdo dos ensaios segue as mesmas regras.

## O que ele faz (v1)

- **Ensaio novo:** mande um arquivo `.md`.
  - Se já tem frontmatter completo (`title`, `date`, `description`), ele publica como está — só escolhe o número certo do arquivo.
  - Se não tem frontmatter, ele usa o primeiro `# Título` do texto e a data de hoje, e te pergunta a descrição (não inventa uma).
- **Editar ensaio:** `/editar` lista os ensaios (ou `/editar palavra` para filtrar). Você escolhe, o bot manda o arquivo, você edita num editor de texto do celular e manda de volta. Ele mostra o que mudou e você confirma.
- **Nada vai ao ar sem seu toque em "Publicar".** E nada que quebraria o build (`astro check`) é aceito — o bot confere `title`/`date`/`description` antes de qualquer commit.

Fora do escopo por enquanto (dá pra adicionar depois): marcar `pinned`, editar `tags` pelo bot, apagar um ensaio, subpastas, imagens.

## Segurança

- O Telegram manda um segredo (`TELEGRAM_SECRET`) em todo webhook; o Worker recusa qualquer chamada sem ele.
- Só o seu `ALLOWED_USER_ID` é atendido — qualquer outra pessoa é ignorada em silêncio.
- O token do GitHub é *fine-grained*, só para este repositório, só com permissão `Contents: Read and write`. Mesmo vazando, não dá acesso a mais nada.
- Toda edição carrega o `sha` da versão baixada; se o arquivo mudou no GitHub nesse meio tempo (ex.: você editou pelo PC), o commit é recusado em vez de sobrescrever silenciosamente.
- Segredos ficam só no Cloudflare (`wrangler secret`), nunca no código.

## Instalação

### 1. Chaves

- **Bot do Telegram:** fale com o [@BotFather](https://t.me/BotFather), use `/newbot` e guarde o token.
- **Seu ID do Telegram:** mande qualquer mensagem para o [@userinfobot](https://t.me/userinfobot).
- **Token do GitHub:** em GitHub → Settings → Developer settings → Fine-grained tokens, crie um token com acesso só ao repositório `aletheia-blog` e permissão **Contents: Read and write**.

### 2. Configurar o Worker

Precisa de uma conta gratuita na Cloudflare e do Node instalado.

```sh
cd telegram-bot
npm install
npx wrangler login
npx wrangler kv namespace create KV
```

Cole o `id` que aparecer no campo `id` de `[[kv_namespaces]]` em `wrangler.toml`. No mesmo arquivo, troque `ALLOWED_USER_ID` pelo seu ID do Telegram (os campos `GITHUB_REPO`, `GITHUB_BRANCH` e `CONTENT_PATH` já estão certos para este projeto).

### 3. Segredos

```sh
npx wrangler secret put TELEGRAM_TOKEN
npx wrangler secret put TELEGRAM_SECRET     # invente uma senha longa (letras, números, _ e -)
npx wrangler secret put GITHUB_TOKEN
```

### 4. Publicar e ligar o webhook

```sh
npm run deploy
```

Anote a URL que aparecer (algo como `https://aletheia-telegram-bot.SEU-USUARIO.workers.dev`). Depois:

```sh
curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=<URL_DO_WORKER>&secret_token=<TELEGRAM_SECRET>"
```

Se responder `"ok":true`, está ligado. Mande `/start` para o bot.

### Depurar

```sh
npm run tail
```

Mostra os erros do Worker em tempo real enquanto você usa o bot.

## Limitações atuais

- Só lista arquivos direto em `src/content/articles` (sem subpastas) — igual à estrutura atual do blog.
- Não abre arquivos acima de 1 MB (nenhum ensaio chega perto disso).
- O "diff" mostrado antes de publicar uma edição é simples (conta linhas que mudaram, não percebe reordenação) — serve para conferir o essencial, não é um diff completo.
- `pinned` e `tags` não têm atalho no bot ainda; se o arquivo já os tiver no frontmatter, eles são preservados, mas não há como ligá-los por aqui.
