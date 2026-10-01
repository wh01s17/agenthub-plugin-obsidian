# Spike S4 — Codex en modo directo, `exec --json` (2026-10-01, v0.159.3)

Script: `scripts/spikes/codex-native-probe.sh`. Fixtures: `tests/fixtures/codex/`.

| Caso            | Comando                                                                                      | Resultado                                                                               |
| --------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `no-git.stderr` | `codex exec --json -C <vault> -`                                                             | exit 1: _"Not inside a trusted directory and --skip-git-repo-check was not specified."_ |
| `basic.jsonl`   | `codex exec --json --skip-git-repo-check -C <vault> -s workspace-write -` (prompt por stdin) | Crea el archivo.                                                                        |
| `resume.jsonl`  | `cd <vault> && codex exec --json --skip-git-repo-check -s read-only resume <thread_id> -`    | Recuerda el contexto; se niega a escribir por el sandbox read-only.                     |

Confirmado:

- `--skip-git-repo-check` es **obligatorio** en un vault que no es repo git ni directorio de confianza.
- El prompt se lee de stdin con `-` (también en `resume`).
- **`resume` no acepta `-s`/`-C`** después del subcomando (_"unexpected argument '-s'"_): las opciones van
  **antes** de `resume`, y el directorio de trabajo es el `cwd` del proceso.
- Eventos: `thread.started{thread_id}`, `turn.started`, `item.started|item.completed{item}` con
  `agent_message{text}`, `command_execution{command, aggregated_output, exit_code, status}`,
  `file_change{changes[{path, kind}], status}`; `turn.completed{usage{input_tokens, cached_input_tokens,
cache_write_input_tokens, output_tokens, reasoning_output_tokens}}`. No hubo `reasoning` ni `todo_list` en
  estas pruebas. `agent_message` llega completo (sin deltas).
- Los comandos se ejecutan vía el shell de login (`/usr/bin/zsh -lc '…'`).
