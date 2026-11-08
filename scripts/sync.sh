#!/usr/bin/env bash
# Traz para este PC os ensaios criados em outro lugar (bot do Telegram, GitHub
# web/mobile) desde o último sync. Como só os artigos costumam mudar fora
# daqui, um merge simples resolve quase sempre sem conflito.
#
# Uso:
#   npm run sync             # sincroniza se a árvore local estiver limpa
#   npm run sync -- --stash  # guarda alterações locais temporariamente e restaura ao final
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

has_stashed=false
cleanup() {
  local exit_code=$?
  if $has_stashed; then
    if [[ -f .git/MERGE_HEAD ]]; then
      echo "" >&2
      echo "Aviso: Suas alterações continuam guardadas no stash." >&2
      echo "Após resolver o merge e fazer o commit, recupere-as rodando: git stash pop" >&2
    else
      echo "Restaurando alterações locais guardadas (stash)..."
      git stash pop --quiet || echo "Aviso: verifique suas alterações restauradas do stash." >&2
    fi
  fi
  exit "$exit_code"
}
trap cleanup EXIT

# 1. Verifica alterações locais
if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "${1:-}" == "--stash" ]]; then
    echo "Guardando alterações locais no stash..."
    git stash push -u -m "sync-auto-stash"
    has_stashed=true
  else
    echo "Há mudanças não commitadas aqui. Commite, descarte ou use '--stash':" >&2
    echo "  npm run sync -- --stash" >&2
    echo "" >&2
    git status --short >&2
    exit 1
  fi
fi

# 2. Busca novidades no GitHub
echo "Buscando mudanças no GitHub..."
if ! git fetch origin; then
  echo "Erro: Não foi possível conectar ao GitHub. Verifique sua conexão com a internet." >&2
  exit 1
fi

local_branch="$(git rev-parse --abbrev-ref HEAD)"
if ! git rev-parse --verify "origin/$local_branch" >/dev/null 2>&1; then
  echo "Branch remota 'origin/$local_branch' não encontrada." >&2
  exit 1
fi

ahead_behind="$(git rev-list --left-right --count "origin/$local_branch...$local_branch")"
behind="$(awk '{print $1}' <<< "$ahead_behind")"
ahead="$(awk '{print $2}' <<< "$ahead_behind")"

# 3. Verifica se há novidades
if [[ "$behind" == "0" ]]; then
  if [[ "$ahead" -gt 0 ]]; then
    echo "Nada de novo no GitHub, mas você tem $ahead commit(s) local(is) pronto(s) para enviar."
    echo "Rode 'git push' se quiser publicá-los."
  else
    echo "Já está tudo sincronizado. Nada para trazer."
  fi
  exit 0
fi

# 4. Mescla alterações
echo "Há $behind commit(s) novo(s) no GitHub. Trazendo..."
old_head="$(git rev-parse HEAD)"

if git merge "origin/$local_branch" --no-edit; then
  echo "Sincronizado com sucesso!"
  echo ""
  echo "Novidades trazidas do GitHub:"
  git log --oneline --color "$old_head..HEAD"
  echo ""
  if [[ "$ahead" -gt 0 ]]; then
    echo "Você tinha $ahead commit(s) local(is) combinados neste merge. Rode 'git push' para atualizar o GitHub."
  fi
else
  echo "" >&2
  echo "Deu conflito no merge — provavelmente edições conflitantes no mesmo arquivo." >&2
  echo "Resolva os conflitos (use 'git status' para vê-los) e depois:" >&2
  echo "  git add <arquivo>   # para alterações aceitas" >&2
  echo "  git rm <arquivo>    # para arquivos apagados" >&2
  echo "  git commit          # para concluir o merge" >&2
  echo "" >&2
  echo "Para cancelar o merge e voltar ao estado anterior: git merge --abort" >&2
  exit 1
fi
