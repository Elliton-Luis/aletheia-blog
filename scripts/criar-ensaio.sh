#!/usr/bin/env bash
# Cria um novo ensaio em src/content/articles/ já com o próximo número da
# sequência (ex.: se o maior hoje é 87, o novo arquivo nasce como
# "88.artigo-exemplo.md"). Depois é só trocar o "artigo-exemplo" pelo nome
# real do ensaio (sem mexer no número) e editar o conteúdo.
#
# Uso: npm run criar:ensaio
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
dir="src/content/articles"
placeholder="artigo-exemplo"

max=0
for f in "$dir"/*.md; do
  name="$(basename "$f")"
  if [[ "$name" =~ ^([0-9]+)\. ]]; then
    n="${BASH_REMATCH[1]}"
    (( n > max )) && max=$n
  fi
done

next=$((max + 1))
file="$dir/$next.$placeholder.md"

if [[ -e "$file" ]]; then
  echo "O arquivo $file já existe. Apague-o ou ajuste a numeração antes de rodar de novo." >&2
  exit 1
fi

today="$(date +%F)"

cat > "$file" <<EOF
---
title: "Título do ensaio"
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
echo "Troque \"$placeholder\" pelo nome real do ensaio (mantenha o \"$next.\" na frente) e edite o conteúdo."
