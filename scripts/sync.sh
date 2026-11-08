#!/usr/bin/env bash
# Traz para este PC os ensaios criados em outro lugar (bot do Telegram, GitHub
# web/mobile) desde o último sync. Como só os artigos costumam mudar fora
# daqui, um merge simples resolve quase sempre sem conflito.
#
# Uso: npm run sync
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Há mudanças não commitadas aqui. Commite ou descarte antes de sincronizar:" >&2
  git status --short >&2
  exit 1
fi

echo "Buscando mudanças no GitHub..."
git fetch origin

local_branch="$(git rev-parse --abbrev-ref HEAD)"
ahead_behind="$(git rev-list --left-right --count "origin/$local_branch...$local_branch")"
behind="$(awk '{print $1}' <<< "$ahead_behind")"
ahead="$(awk '{print $2}' <<< "$ahead_behind")"

if [[ "$behind" == "0" ]]; then
  echo "Já está tudo sincronizado. Nada para trazer."
  exit 0
fi

echo "Há $behind commit(s) novo(s) no GitHub. Trazendo..."
if git merge "origin/$local_branch" --no-edit; then
  echo "Sincronizado. ($ahead commit(s) seu(s) local(is) preservado(s).)"
else
  echo "Deu conflito no merge — provavelmente duas edições diferentes no mesmo ensaio." >&2
  echo "Resolva os conflitos manualmente (git status mostra os arquivos) e depois:" >&2
  echo "  git add <arquivo-resolvido>" >&2
  echo "  git commit" >&2
  exit 1
fi
