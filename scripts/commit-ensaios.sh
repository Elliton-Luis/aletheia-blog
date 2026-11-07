#!/usr/bin/env bash
# Faz um commit por ensaio alterado em src/content/articles/.
#   arquivo novo        -> "novo: nome.md"
#   arquivo modificado  -> "revisão: nome.md"
#   arquivo removido    -> "remoção: nome.md"
# Só os ensaios entram nos commits; outras mudanças ficam como estão.
# Uso: npm run commit:ensaios [-- --dry-run]   (--dry-run só mostra o que seria feito)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
dir="src/content/articles"
dry=false
[[ "${1:-}" == "--dry-run" ]] && dry=true

found=false
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  status="${line:0:2}"
  file="${line:3}"
  file="${file##* -> }"          # renomeação: usa o nome novo
  file="${file%\"}"; file="${file#\"}"
  [[ "$file" == *.md ]] || continue
  name="$(basename "$file")"

  case "$status" in
    '??'|A?|?A|R?|?R) label="novo" ;;
    *D*)              label="remoção" ;;
    *)                label="revisão" ;;
  esac

  found=true
  msg="$label: $name"
  if $dry; then
    echo "[dry-run] $msg"
  else
    git add -A -- "$file"
    git commit -q -m "$msg" -- "$file"
    echo "commit: $msg"
  fi
done < <(git status --porcelain --untracked-files=all -- "$dir")

$found || echo "Nenhum ensaio alterado."
