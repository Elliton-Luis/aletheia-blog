# Guia de Markdown para os ensaios

Cada ensaio é um arquivo `.md` em `src/content/articles/`. Ele tem duas partes: o **frontmatter** (os dados entre `---`) e o **texto**, em Markdown normal.

## Frontmatter

```md
---
title: "Sobre o agnosticismo"
date: 2026-11-08
description: "Uma frase curta que resume o ensaio."
tags:
  - filosofia
  - teologia
pinned: true
---
```

| Campo | Obrigatório | O que é |
|---|---|---|
| `title` | sim | Título do ensaio, entre aspas. |
| `date` | sim | Data no formato `AAAA-MM-DD`, sem aspas. |
| `description` | sim | Frase curta que aparece na listagem e nas redes sociais. |
| `tags` | não | Lista de assuntos, um por linha com `-`. Sem tags, omita o campo inteiro. |
| `pinned` | não | `true` para fixar o ensaio no topo (além da posição normal na ordem cronológica). Se omitido, vale `false`. |

Não existe campo para categoria, contagem de caracteres ou tempo de leitura — isso é calculado sozinho a partir do texto, toda vez que o site é gerado.

## O texto

Depois do segundo `---`, é Markdown comum:

```md
## Um tópico

Um parágrafo normal. *Itálico* com asteriscos simples, **negrito** com
asteriscos duplos.

### Um subtópico

- item de lista
- outro item

1. item numerado
2. outro item

> Uma citação.

[Texto do link](https://exemplo.com)
```

- **Tópicos:** use `##` para as seções principais e `###` para subseções. Todo `##` e `###` vira um item no índice lateral do ensaio — não precisa fazer nada além de escrever o título.
- **Parágrafos:** basta pular uma linha em branco entre eles.
- **Ênfase:** `*itálico*` e `**negrito**`.
- **Listas:** `-` para lista simples, `1.` `2.` para numerada.
- **Citação:** uma linha começando com `>`.
- **Linha divisória:** uma linha só com `---` (três traços).
- **Link:** `[texto visível](endereço)`.
- **Imagem:** `![descrição da imagem](caminho-ou-url)`.
- **Código:** uma palavra entre crases (`` `assim` ``) para código no meio do texto; um bloco entre três crases para trechos maiores.

### Linkar outro ensaio ou assunto

```md
Como já falei em [Verdade e mentira social](/ensaios/verdade-e-mentira-social/)...

Esse tema também aparece em [outros textos sobre filosofia](/assuntos/filosofia/).
```

O endereço de um ensaio é sempre `/ensaios/` mais o nome do arquivo sem o número e sem `.md` — por exemplo, `0007.sobre-o-agnosticismo.md` vira `/ensaios/sobre-o-agnosticismo/`.

## Exemplo completo

```md
---
title: "Conhecimento e inteligência"
date: 2026-11-08
description: "Uma reflexão sobre conhecimento e capacidade de julgamento."
tags:
  - filosofia
  - conhecimento
---

## O que é saber algo

O texto começa aqui, explicando a primeira ideia do ensaio.

## O limite entre saber e decorar

Mais um trecho, com a segunda ideia, que vai aparecer como outro item no índice.
```

Veja também o [guia de comandos](guia-comandos.md) para criar o arquivo já com o nome certo.
