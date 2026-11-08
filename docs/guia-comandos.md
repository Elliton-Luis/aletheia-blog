# Guia de comandos

Referência rápida dos comandos deste projeto. Rode todos a partir da raiz do repositório.

## Rodar o site localmente

```sh
npm install        # só na primeira vez, ou quando as dependências mudarem
npm run dev         # abre o site em http://localhost:4321, com recarregamento automático
```

## Conferir antes de publicar

```sh
npm run build        # gera o site em dist/ e aponta erros (ex.: frontmatter inválido)
npm run preview      # serve a versão de dist/, igual ao que vai para o ar
```

Rode `npm run build` sempre que mexer em algo estrutural (layout, estilos, scripts) ou em caso de dúvida — ele falha alto se algum ensaio tiver um erro de formatação.

## Criar um ensaio novo

```sh
npm run criar:ensaio
# cria src/content/articles/N.artigo-exemplo.md (N = próximo número livre)

npm run criar:ensaio --nome "Sobre o agnosticismo"
# cria N.sobre-o-agnosticismo.md, já com esse título preenchido
```

- `N` é sempre o maior número já usado na pasta, mais um — não precisa calcular.
- Sem `--nome`, o arquivo nasce com o nome `artigo-exemplo`; troque pelo nome real (mantendo o número na frente) e edite o título dentro do arquivo.
- O número é só para organizar a pasta — não aparece na URL do ensaio.
- Veja o [guia de Markdown](guia-markdown.md) para o que preencher dentro do arquivo.

## Commitar ensaios

```sh
npm run commit:ensaios              # commita cada ensaio alterado (um commit por arquivo) e dá git push
npm run commit:ensaios -- --dry-run # só mostra o que seria commitado, sem commitar nada
```

- Mensagens automáticas: `novo: nome.md`, `revisão: nome.md` ou `remoção: nome.md`.
- Só afeta arquivos `.md` dentro de `src/content/articles/`; mudanças em código não entram nesses commits.
- Ao final, se algo foi commitado, o script já envia para o repositório remoto (`git push`). Se o push falhar, os commits continuam salvos localmente — rode `git push` manualmente depois.

## Trazer ensaios criados em outro lugar (bot do Telegram, GitHub)

```sh
npm run sync
```

Busca o que mudou no GitHub e traz para cá com um merge. Use sempre que suspeitar que um ensaio foi criado ou editado fora deste PC (pelo bot do Telegram, ou direto pelo GitHub) — ele avisa se há algo novo, se já está tudo sincronizado, ou se deu conflito (nesse caso, mostra os comandos para resolver).

- Recusa rodar se houver mudanças não commitadas aqui — commite ou descarte antes.
- Não substitui o `git push`: ele só traz, não manda nada daqui para o GitHub.

## Git, no dia a dia

```sh
git status           # o que mudou desde o último commit
git add -A            # inclui tudo o que mudou
git commit -m "..."   # registra o commit
git push              # envia para o GitHub (dispara o deploy na Vercel)
```

Para mudanças de código (layout, estilo, scripts), prefira commitar separado dos ensaios, com uma mensagem descritiva (ex.: `feat: ...`, `fix: ...`).
