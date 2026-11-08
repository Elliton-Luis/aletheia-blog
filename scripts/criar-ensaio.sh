#!/usr/bin/env bash
# Cria um novo ensaio em src/content/articles/ já com o próximo número da
# sequência (ex.: se o maior hoje é 7, o novo arquivo nasce como "8.nome.md").
#
# Uso:
#   npm run criar:ensaio --nome "Sobre o agnosticismo"
#     -> cria 8.sobre-o-agnosticismo.md, com esse título já preenchido
#   npm run criar:ensaio
#     -> cria 8.artigo-exemplo.md; troque "artigo-exemplo" pelo nome real
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
dir="src/content/articles"
title="${1:-}"

max=0
for f in "$dir"/*.md; do
  name="$(basename "$f")"
  if [[ "$name" =~ ^([0-9]+)\. ]]; then
    n="${BASH_REMATCH[1]}"
    (( n > max )) && max=$n
  fi
done

next=$((max + 1))

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
