# Aletheia

Blog pessoal estático feito com Astro. Os ensaios vivem em `src/content/articles/`; cada arquivo Markdown gera sua página, entra no arquivo cronológico e tem suas tags indexadas automaticamente.

O arquivo `/ensaios/` permite filtrar publicações por período. Ao rolar, ele acrescenta os próximos ensaios e retira os mais distantes da tela, preservando a posição de leitura. O botão **Tema** alterna entre claro e escuro e guarda a preferência neste navegador.

Os ensaios e as páginas de assunto são agrupados por mês. Em cada ensaio, o índice lateral acompanha os títulos das seções. O arquivo-fonte `src/content/articles/example.md` fica fora da coleção publicada; seus textos foram separados em artigos próprios.

Guias rápidos: [comandos do projeto](docs/guia-comandos.md) e [Markdown dos ensaios](docs/guia-markdown.md).

## Começar

O projeto inclui o runtime Node.js 22.23.4 como dependência local para que os comandos Astro usem a versão compatível mesmo se o Node global estiver um pouco desatualizado. Para builds na Vercel, configure Node.js 22.23.4 ou mais recente.

```sh
npm install
npm run dev
```

## Publicar um ensaio

```sh
npm run criar:ensaio --nome "Conhecimento e inteligência"
```

Isso cria um arquivo `.md` em `src/content/articles/`, já com o próximo número da sequência (ex.: `8.conhecimento-e-inteligencia.md`) e o frontmatter básico preenchido. O número organiza a pasta, mas não aparece na URL: o endereço usa só o nome, por exemplo `/ensaios/conhecimento-e-inteligencia/`. Para manter um endereço já publicado, não altere a parte do nome depois de criado.

Veja o [guia de Markdown](docs/guia-markdown.md) para os campos do frontmatter e a formatação do texto, e o [guia de comandos](docs/guia-comandos.md) para build, preview e commit.

## Configuração antes de publicar

1. Em `astro.config.mjs`, troque `https://seudominio.com.br` pelo domínio definitivo (ou domínio `vercel.app`). Esse valor é usado no sitemap e em URLs canônicas.
2. Ajuste nome, apresentação e texto provisório em `src/layouts/BaseLayout.astro`, `src/pages/index.astro` e `src/pages/sobre.astro`.
3. Execute `npm run build` para validar e gerar o site em `dist/`.

## Deploy na Vercel

1. Crie um repositório no GitHub e envie este projeto com `package.json` e `package-lock.json`.
2. Na Vercel, selecione **Add New → Project** e importe o repositório GitHub.
3. Mantenha o preset **Astro**, o comando de build `npm run build` e a pasta de saída `dist`.
4. Clique em **Deploy**. A Vercel fará novo build automaticamente a cada push na branch conectada.

Não é necessário adapter para a publicação estática. O RSS é gerado em `/rss.xml` e o sitemap em `/sitemap-index.xml`.
