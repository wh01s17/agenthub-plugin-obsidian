# Spike S3 — Claude Code en modo directo, `stream-json` (2026-10-01, v2.1.286)

Script: `scripts/spikes/claude-native-probe.sh` (+ `sanitize-claude-fixture.py`). Fixtures: `tests/fixtures/claude/`.

| Caso                | Comando                                                                                                                                                                | Resultado                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `denied.jsonl`      | `claude -p --output-format stream-json --verbose --include-partial-messages --session-id <uuid> --permission-mode manual --permission-prompts none` (prompt por stdin) | Lee el archivo; el `Write` se deniega; responde explicándolo.                  |
| `resume.jsonl`      | `claude -p --output-format stream-json --verbose --resume <uuid> --permission-mode acceptEdits`                                                                        | Recuerda el contexto y crea el archivo.                                        |
| `no-verbose.stderr` | `claude -p --output-format stream-json`                                                                                                                                | Error: _"When using --print, --output-format=stream-json requires --verbose"_. |

Confirmado:

- `-p` **lee el prompt de stdin** si no se pasa como argumento.
- `--verbose` **es obligatorio** con `stream-json`.
- `--permission-mode manual` se refleja como `permissionMode: "default"` en `init`.
- `--session-id` en el primer turno + `--resume` en los siguientes mantiene la conversación.
- La denegación llega **en vivo** como `{"type":"system","subtype":"permission_denied","tool_name","tool_use_id","decision_reason"}`
  y otra vez en `result.permission_denials[{tool_name, tool_use_id, tool_input}]`.

Tipos de línea observados: `system` (`hook_started`, `hook_response`, `commands_changed`, `init`, `status`,
`thinking_tokens`, `permission_denied`), `stream_event` (`message_start`, `content_block_start`,
`content_block_delta` con `text_delta` / `thinking_delta` / `signature_delta` / `input_json_delta`,
`content_block_stop`, `message_delta`, `message_stop`), `assistant`, `user` (`tool_result` + `tool_use_result`),
`rate_limit_event`, `result` (`subtype`, `is_error`, `result`, `session_id`, `total_cost_usd`, `usage`,
`num_turns`, `permission_denials`, `terminal_reason`, `stop_reason`).

`init` incluye datos de configuración del usuario (skills, plugins, MCP, hooks, rutas de memoria): no
registrarlos en logs ni guardarlos completos.
