# Bot do Telegram para o Aletheia

Cria e edita ensaios do blog pelo celular, sem precisar do PC. Roda num Cloudflare
Worker (grátis) e fala com o GitHub pela API — quando você confirma, ele faz um
commit, e a Vercel já builda e publica sozinha.

Este bot é específico para este repositório: ele conhece a pasta
`src/content/articles`, os campos obrigatórios do frontmatter (`title`,
`date`, `description`) e a numeração dos arquivos (`NNNN.nome.md`), do mesmo
jeito que o `scripts/criar-ensaio.sh` local.

Veja os dois guias do blog antes de usar: [guia de comandos](../docs/guia-comandos.md)
e [guia de Markdown](../docs/guia-markdown.md) — o bot só automatiza o envio,
o conteúdo dos ensaios segue as mesmas regras.

## Comandos

```
/criar      — novo ensaio
/editar     — busca um ensaio e altera
/listar     — busca um ensaio só para ler
/analise    — busca um ensaio para análise crítica com IA (IA A e IA B)
/deletar    — busca um ensaio e agenda a exclusão (20 minutos)
/rascunhos  — retoma um ensaio salvo com /rascunho (durante o /escrever)
/link       — manda o link do site
/cancelar   — desiste do que estiver em andamento (inclusive uma exclusão agendada)
```

O bot é direto: não existe uma etapa genérica de "confirmar antes de publicar".
O próprio comando que você manda (`/end`, `/reescrever`, `/colar`, ou mandar o
`.md` já completo em `/criar`) já publica na hora. A única trava automática é
recusar publicar um ensaio sem `title`/`date`/`description`, porque isso
quebraria o build (`astro check`) do blog.

Depois de publicar ou atualizar um ensaio, o bot manda a mensagem de
confirmação na hora e depois confirma de verdade que o deploy terminou: espera
um tempo inicial e tenta abrir a página do ensaio algumas vezes, com timeout em
cada tentativa, até ela responder. Se confirmar, manda o link; se não
confirmar depois de uns minutos, avisa que não conseguiu confirmar (pode ser
só demora, ou algo deu errado) em vez de mandar um link que talvez ainda não
funcione. Isso só funciona com `SITE_URL` preenchido no `wrangler.toml`.

### Análise Editorial com Duas IAs (IA A e IA B)

Antes de qualquer publicação no blog (ou sob demanda com `/analise` e `/revisar`), o bot consulta **duas IAs independentes** em paralelo para trazer pontos de vista diferentes:

- **Visão Neutra e Comparativa:** Os pareceres chegam como `🤖 Opinião da IA A` e `🤖 Opinião da IA B`, sem indicar quais modelos foram chamados, permitindo avaliar sugestões sem viés de marca.
- **Nota (0 a 10) e Diagnóstico:** Cada IA avalia a relação entre o potencial do tema e o caminho/execução do texto, apontando se o tema é promissor e bem executado, se está em desenvolvimento, ou se a execução sustenta a ideia.
- **Ponto Forte e Ponto Mais Fraco:** Apresentados separadamente em cada análise (`🟢 Ponto Forte` e `🔴 Ponto Mais Fraco`).
- **Apenas Sugestões:** A IA atua como leitor crítico e conselheiro — com pontuação estritamente como última prioridade —, mas a decisão final é 100% do autor.
- **Confirmação Pré-Postagem:** Ao mandar `/end` ou enviar um `.md`, você recebe as duas opiniões e os botões:
  - `[ ✅ Publicar no Blog ]` ➔ Confirma e commita no GitHub.
  - `[ 🗑️ Cancelar ]` ➔ Desiste ou continua ajustando o texto.
- **Comandos `/analise` e `/revisar`:** `/analise` permite escolher qualquer artigo já publicado para receber as duas análises; `/revisar` permite consultar as IAs durante a escrita ou edição.

### Áudio e Transcrição (Whisper AI)

O bot conta com transcrição de voz nativa e gratuita usando o **Cloudflare Workers AI (Whisper)**:

- **Transcrição avulsa:** Mande um áudio de voz ou arquivo de áudio a qualquer momento. O bot transcreve e devolve o texto para você copiar e formatar em Markdown.
- **Durante o `/escrever`:** Você pode mandar mensagens de áudio enquanto escreve o ensaio; o bot transcreve e acumula o texto diretamente no corpo do ensaio.
- **Durante o `/editar`:** Mandar um áudio prepara o texto para `/colar` (adicionar no fim) ou `/reescrever` (substituir).

### `/criar`

Duas formas:

- **Mandar um arquivo `.md`:** se já tem `title`, `date` e `description` no frontmatter, publica na hora — só escolhe o número certo do arquivo (`NNNN.nome.md`). Se faltar algum desses campos, o bot avisa o que falta e pede para corrigir e mandar de novo.
- **`/escrever`** (depois de `/criar`): o bot pergunta, em sequência, **título**, **descrição**, **tags** (manda `-` para usar o padrão `filosofia`) e se quer **fixar** (`pinned`, manda `-` para não). Depois disso, escreva o ensaio à vontade — pode mandar quantas mensagens quiser, o bot só acumula em silêncio. Quando terminar, mande **`/end`** (sozinho, ou no fim da última mensagem, tipo "...e com isso concluímos o artigo /end") — isso publica o ensaio. Se quiser parar no meio e continuar outra hora, mande **`/rascunho`** em vez de `/end` — ele salva o que você já escreveu (até 30 dias) e você retoma depois com `/rascunhos`.

A data é sempre a de hoje; para mudar depois, use `/editar`.

### `/editar`, `/listar` e `/analise`

Eles buscam do mesmo jeito: `/editar`, `/listar` ou `/analise` lista todos os ensaios paginados de 10 em 10, ou aceita um filtro por termo (ex.: `/analise vargas`). Você toca no ensaio na lista:

- **`/listar`:** mostra o conteúdo (como texto, ou como arquivo `.md` se for grande demais para uma mensagem do Telegram — limite de ~4096 caracteres) junto com o link do ensaio no site. Não dá para alterar por aqui.
- **`/analise`:** consulta **duas IAs independentes (IA A e IA B)** com o manifesto filosófico do blog para trazer uma análise aprofundada de reflexões, argumentações e sugestões, com pontuação estritamente como última prioridade.
- **`/editar`:** mostra o conteúdo do mesmo jeito. Copie, edite (no próprio chat ou num editor, tanto faz) e mande de volta — como texto ou como arquivo. Depois, decida o que fazer com o que você mandou:
  - **`/reescrever`** — substitui o ensaio inteiro pelo que você mandou (precisa vir com o frontmatter completo).
  - **`/colar`** — acrescenta o que você mandou no fim do ensaio original, como um apêndice (não mexe no frontmatter).

  Sem mexer no texto, também dá para só alterar o cabeçalho:
  - **`/pin`** — liga ou desliga `pinned` (alterna; não precisa mandar conteúdo antes).
  - **`/tag nome-da-tag`** — adiciona a tag se o ensaio ainda não tiver, remove se já tiver.

### `/deletar`

Mesma busca de `/editar`/`/listar`. Ao escolher um ensaio, ele **não** é apagado na hora — fica marcado para apagar daqui a **20 minutos**, e o bot avisa. Se mudar de ideia nesse meio tempo, mande **`/cancelar`**, que desfaz a exclusão agendada (e qualquer outra sessão em andamento). Passados os 20 minutos, um Cron Trigger da Cloudflare (roda a cada minuto, configurado em `wrangler.toml`) executa a exclusão de verdade no GitHub e avisa quando terminar.

### `/link`

Manda o endereço do site (o `SITE_URL` do `wrangler.toml`). Sem configurar `SITE_URL`, ele avisa que falta configurar.

### `/rascunho` e `/rascunhos`

`/rascunho` só existe durante o `/escrever` (veja acima) — salva o que você já escreveu, sem publicar, por até 30 dias. `/rascunhos` lista os rascunhos salvos; ao escolher um, o bot retoma exatamente de onde parou (mesmo título/descrição/tags/pinned, e o texto que já tinha).

Fora do escopo por enquanto (dá pra adicionar depois): subpastas, imagens.

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

Cole o `id` que aparecer no campo `id` de `[[kv_namespaces]]` em `wrangler.toml`. No mesmo arquivo, troque `ALLOWED_USER_ID` pelo seu ID do Telegram e `SITE_URL` pelo endereço do site publicado (ex.: `https://aletheia-blog.vercel.app`, sem `/` no fim) — os campos `GITHUB_REPO`, `GITHUB_BRANCH` e `CONTENT_PATH` já estão certos para este projeto.

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

### 5. (Opcional) Mostrar os comandos no "/" do Telegram

```sh
curl -X POST "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[
    {"command":"criar","description":"Novo ensaio"},
    {"command":"editar","description":"Buscar e editar um ensaio"},
    {"command":"listar","description":"Buscar um ensaio para ler"},
    {"command":"deletar","description":"Buscar um ensaio e agendar exclusão"},
    {"command":"rascunhos","description":"Retomar um rascunho salvo"},
    {"command":"link","description":"Link do site"},
    {"command":"cancelar","description":"Desistir do que estiver em andamento"}
  ]}'
```

Isso faz o Telegram sugerir os comandos quando você digita `/` no chat do bot. É cosmético — o bot já aceita esses comandos sem isso, só não aparecem sugeridos.

### Depurar

```sh
npm run tail
```

Mostra os erros do Worker em tempo real enquanto você usa o bot.

## Limitações atuais

- Só lista arquivos direto em `src/content/articles` (sem subpastas) — igual à estrutura atual do blog.
- Não abre arquivos acima de 1 MB (nenhum ensaio chega perto disso).
- Não tem diff/prévia antes de publicar uma edição — `/reescrever` e `/colar` aplicam na hora. A única rede de segurança é a checagem de `title`/`date`/`description`.
- Não dá para mexer em subpastas ou imagens pelo bot.
- A exclusão agendada (`/deletar`) tem precisão de ~1 minuto (o Cron Trigger roda a cada minuto) — "20 minutos" é aproximado, não cravado no segundo.
