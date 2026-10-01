#!/usr/bin/env bash
# Spike S4: graba la salida `codex exec --json` en modo directo.
# Uso: bash scripts/spikes/codex-native-probe.sh   → tests/fixtures/codex/*.jsonl
# Sin -e: los casos que fallan a propósito (no-git) deben registrar su código de salida.
set -Euo pipefail
check_dependencies() {
  local -a missing=()
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    printf 'ERROR: faltan comandos: %s\n' "${missing[*]}" >&2
    exit 1
  fi
}
check_dependencies rsync codex

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
out="$root/tests/fixtures/codex"
mkdir -p "$out"
vault="$(mktemp -d -t agenthub-s4-XXXXXX)"
trap 'rm -rf -- "$vault"' EXIT
rsync -a --exclude .obsidian "$root/test-vault/" "$vault/"
scrub() { sed -e "s#$vault#/VAULT#g" -e "s#${vault#/}#VAULT#g" -e "s#$HOME#~#g" -E -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/<email>/g'; }

# 0) Sin --skip-git-repo-check fuera de un repo git.
echo 'Di hola' | codex exec --json -C "$vault" - >/dev/null 2>"$out/no-git.stderr"
echo "exit $? (no-git)"
sed -i -e "s#$vault#/VAULT#g" "$out/no-git.stderr"

# 1) Prompt por stdin, sandbox workspace-write.
echo 'Lee Notas/Ideas.md y crea resumen.md con un resumen de una línea. Responde en una frase.' |
  codex exec --json --skip-git-repo-check -C "$vault" -s workspace-write - 2>/dev/null | scrub >"$out/basic.jsonl"
echo "exit $? (basic)"
thread="$(grep -m1 -o '"thread_id":"[^"]*"' "$out/basic.jsonl" | cut -d'"' -f4)"
echo "thread=$thread"

# 2) Reanudar el hilo con prompt por stdin, sandbox read-only (debe impedir escribir).
echo 'Añade una segunda línea a resumen.md que diga "fin". Responde en una frase.' |
  (cd "$vault" && codex exec --json --skip-git-repo-check -s read-only resume "$thread" -) 2>"$out/resume.stderr" | scrub >"$out/resume.jsonl"
echo "exit $? (resume)"

echo "resumen.md: $(cat "$vault/resumen.md" 2>/dev/null || echo '(no existe)')"
