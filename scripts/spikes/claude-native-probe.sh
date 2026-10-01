#!/usr/bin/env bash
# Spike S3: graba la salida stream-json de Claude Code en modo directo.
# Uso: bash scripts/spikes/claude-native-probe.sh   → tests/fixtures/claude/*.jsonl
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/tests/fixtures/claude"
mkdir -p "$out"
vault="$(mktemp -d -t agenthub-s3-XXXXXX)"
rsync -a --exclude .obsidian "$root/test-vault/" "$vault/"
sid="$(cat /proc/sys/kernel/random/uuid)"
scrub() { sed -e "s#$vault#/VAULT#g" -e "s#${vault#/}#VAULT#g" -e "s#$HOME#~#g" -E -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/<email>/g'; }
cd "$vault"

# 1) Prompt por stdin, parciales activados, escritura denegada (manual + sin prompts).
echo 'Lee Notas/Ideas.md y crea resumen.md con un resumen de una línea. Responde en una frase.' |
  claude -p --output-format stream-json --verbose --include-partial-messages \
    --session-id "$sid" --permission-mode manual --permission-prompts none \
    2>"$out/denied.stderr" | scrub >"$out/denied.jsonl" || echo "exit $? (denied)"

# 2) Reanudar la misma sesión, sin parciales, con acceptEdits.
echo 'Ahora sí, crea resumen.md. Responde en una frase.' |
  claude -p --output-format stream-json --verbose --resume "$sid" --permission-mode acceptEdits \
    2>"$out/resume.stderr" | scrub >"$out/resume.jsonl" || echo "exit $? (resume)"

# 3) ¿stream-json sin --verbose?
echo 'Di hola' | claude -p --output-format stream-json >"$out/no-verbose.jsonl" 2>"$out/no-verbose.stderr" || echo "exit $? (no-verbose)"

echo "resumen.md: $(cat "$vault/resumen.md" 2>/dev/null || echo '(no existe)')"
rm -rf "$vault"

python3 "$root/scripts/spikes/sanitize-claude-fixture.py" "$out"/*.jsonl
