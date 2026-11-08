#!/usr/bin/env bash
# Cria um novo ensaio em src/content/articles/ já com o próximo número da
# sequência, completado com zero à esquerda em 4 dígitos (ex.: se o maior
# hoje é 0007, o novo arquivo nasce como "0008.nome.md") — isso mantém a
# ordem alfabética igual à ordem numérica (sem isso, "10." viria antes de
# "2."). Com 4 dígitos, aguenta até 9999 ensaios sem precisar renumerar.
#
# Uso:
#   npm run criar:ensaio --nome "Sobre o agnosticismo"
#     -> cria 0008.sobre-o-agnosticismo.md, com esse título já preenchido
#   npm run criar:ensaio
#     -> cria 0008.artigo-exemplo.md; troque "artigo-exemplo" pelo nome real
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
dir="src/content/articles"
title="${1:-}"

max=0
for f in "$dir"/*.md; do
  name="$(basename "$f")"
  if [[ "$name" =~ ^([0-9]+)\. ]]; then
    n=$((10#${BASH_REMATCH[1]}))  # 10# força base decimal (zero à esquerda não é octal)
    (( n > max )) && max=$n
  fi
done

next=$(printf "%04d" $((max + 1)))

if [[ -n "$title" ]]; then
  slug="$(echo "$title" \
    | iconv -t ascii//TRANSLIT 2>/dev/null \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  [[ -z "$slug" ]] && { echo "Não foi possível gerar um nome de arquivo a partir de \"$title\"." >&2; exit 1; }
  title="$(echo "${title:0:1}" | tr '[:lower:]' '[:upper:]')${title:1}"
else
  slug="artigo-exemplo"
  title="Título do ensaio"
fi

file="$dir/$next.$slug.md"

if [[ -e "$file" ]]; then
  echo "O arquivo $file já existe. Apague-o, escolha outro nome ou ajuste a numeração." >&2
  exit 1
fi

today="$(date +%F)"

cat > "$file" <<EOF
---
title: "$title"
date: $today
description: "Uma frase curta descrevendo do que trata o ensaio."
tags:
  - filosofia
---

## Primeiro tópico

Texto de exemplo. Escreva aqui a primeira ideia do ensaio; o restante do texto pode vir em quantos tópicos (\`##\`) fizerem sentido.

## Segundo tópico

Mais um trecho de exemplo, só para lembrar que cada seção vira um item no índice lateral do ensaio.
EOF

echo "Criado: $file"
if [[ "$slug" == "artigo-exemplo" ]]; then
  echo "Troque \"artigo-exemplo\" pelo nome real do ensaio (mantenha o \"$next.\" na frente) e edite o conteúdo."
fi
