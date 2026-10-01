# AgentHub — Especificación de adaptadores

> Parte del plan maestro. Empieza siempre por [`plan.md`](../../plan.md) (estado actual y protocolo).
> Los números de sección (§) son los mismos en todos los archivos del plan.

## 5. Especificación de adaptadores

### 5.1 `AcpAdapter` (genérico, transporte principal)

1. `detect()`: resolver `command` (si es `npx`, comprobar `npx` y, si existe el binario global del
   adaptador — p. ej. `claude-agent-acp` ⚠️ nombre del bin —, preferirlo por velocidad). Versión vía
   `--version` cuando aplique.
2. `createSession()`:
   - spawn → `acp.client({ name: 'agenthub' }).onRequest(…).connectWith(ndJsonStream(...), …)` (`ClientSideConnection` está deprecado).
   - `initialize({ protocolVersion, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false }, clientInfo: { name: 'agenthub', version } })`.
   - Guardar `agentCapabilities` → mapear a `AgentCapabilities`.
   - `session/new({ cwd, mcpServers: [] })` (en Fase 5, añadir el servidor MCP del plugin si `mcpCapabilities.http`).
   - Emitir `session.ready` con `configOptions` (y `modes`/`models` si llegan).
3. `clientImpl`:
   - `sessionUpdate(n)` → mapear (tabla abajo) y emitir.
   - `requestPermission(p)` → `host.requestPermission()`; responder `{ outcome }`.
   - `readTextFile({path, line, limit})` → si está en el vault y hay un editor abierto con cambios sin
     guardar, devolver el contenido del editor; si no, `vault.read`. Fuera del vault: solo si está en `--add-dir` permitidos.
   - `writeTextFile({path, content})` → guardia de rutas (vault + dirs permitidos; `.obsidian/` bloqueado si
     `protectConfigDir`); dentro del vault usar `vault.process`/`create` (así Obsidian actualiza editores abiertos).
   - `terminal/*` → no anunciado en MVP (el agente ejecuta comandos por su cuenta).
4. `prompt()` → `connection.prompt({ sessionId, prompt })` → `turn.end`.
5. `cancel()` → `connection.cancel({ sessionId })` + resolver permisos pendientes con `cancelled`.
6. `loadSession()` → solo si `agentCapabilities.loadSession`.

Mapeo `session/update` → `AgentEvent`:

| `sessionUpdate` | Evento de dominio |
|---|---|
| `agent_message_chunk` (content text) | `message.chunk` (role assistant) |
| `user_message_chunk` | `message.chunk` (role user) — solo durante `session/load` |
| `agent_thought_chunk` | `thought.chunk` |
| `tool_call` | `tool.call` |
| `tool_call_update` | `tool.update` |
| `plan` | `plan` |
| `available_commands_update` | `commands` |
| `current_mode_update` | `mode` |
| `usage_update` | `usage` (`contextUsed`, `contextSize`, `costUsd` si `cost.currency` = USD) |
| `session_info_update` | `debug` (estado del hilo; sin UI por ahora) |
| `_meta.terminal_output_delta` / `terminal_exit` en `tool_call_update` | `tool.update` con `content: [{type:'terminal', output, exitCode}]` acumulado |
| desconocido | `debug` |

El `messageId` se toma del chunk si viene (todos los agentes probados lo envían); si no, se genera. Un mensaje del asistente termina (`message.end`) cuando llega
un evento de otro tipo (tool_call, plan…) o `turn.end`.

### 5.2 `ClaudeNativeAdapter` (modo directo, Fase 5)

Un proceso **por turno** (simple y robusto); la continuidad la da `--session-id`/`--resume`.

```bash
# primer turno (sessionId generado por el plugin)
claude -p --output-format stream-json --verbose --include-partial-messages \
  --session-id <uuid> --permission-mode <modo> --permission-prompts none \
  [--model <m>] [--append-system-prompt "<instrucciones vault>"] [--add-dir ...] [extraArgs]
# prompt por stdin ✅ (evita límites/escapado de argumentos); --verbose es obligatorio ✅

# turnos siguientes
claude -p ... --resume <uuid>
```

Mapeo (✅ fixtures en `tests/fixtures/claude/`):

| stream-json | Evento de dominio |
|---|---|
| `system` / `init` | `session.ready` (session_id, comandos de `slash_commands`, modo) |
| `stream_event` → `content_block_delta.text_delta` | `message.chunk` |
| `stream_event` → `thinking_delta` | `thought.chunk` |
| `assistant` bloque `text` | si no hubo parciales: `message.chunk` completo; luego `message.end` |
| `assistant` bloque `tool_use` | `tool.call` (`kind` por nombre: `Read`→read; `Edit`/`Write`/`MultiEdit`/`NotebookEdit`→edit; `Bash`→execute; `Grep`/`Glob`→search; `WebFetch`/`WebSearch`→fetch; `TodoWrite`→**plan**; `Task`/`mcp__*`→other) |
| `user` bloque `tool_result` | `tool.update` (status completed/failed según `is_error`, contenido) |
| `system` / `permission_denied` (en vivo) | `permission.denied` |
| `result` | `usage` (`total_cost_usd`, `usage`) + `turn.end` (`success`→`end_turn`; `error_max_turns`→`max_turn_requests`; otros errores→`error`) |

Mejora posible (evaluar): proceso persistente con `--input-format stream-json` (menos latencia por turno).

### 5.3 `CodexNativeAdapter` (modo directo, Fase 5)

```bash
codex exec --json --skip-git-repo-check -C <cwd> -s <sandbox> [-m <modelo>] [--add-dir ...] -   # prompt por stdin
cd <cwd> && codex exec --json --skip-git-repo-check -s <sandbox> resume <thread_id> -   # ✅ opciones ANTES de `resume`
```

Mapeo (✅ fixtures en `tests/fixtures/codex/`):

| Evento `--json` | Evento de dominio |
|---|---|
| `thread.started` | `session.ready` (`thread_id` → nativeSessionId) |
| `item.started` `command_execution` | `tool.call` (execute, in_progress, título = comando) |
| `item.completed` `command_execution` | `tool.update` (completed/failed por `exit_code`, salida agregada) |
| `item.*` `file_change` | `tool.call`/`tool.update` (edit, `locations` = rutas cambiadas) |
| `item.*` `mcp_tool_call` / `web_search` | `tool.call`/`tool.update` (other / fetch) |
| `item.*` `todo_list` | `plan` |
| `item.completed` `agent_message` | `message.chunk` (texto completo) + `message.end` |
| `item.completed` `reasoning` | `thought.chunk` + fin |
| `turn.completed` | `usage` + `turn.end(end_turn)` |
| `turn.failed` / `error` | `error` + `turn.end(error)` |

Nota: `exec` no emite deltas de texto → la respuesta aparece completa (capacidad `streaming: false`).

### 5.4 Presets de agentes (incluidos en ajustes por defecto)

| id | label | transport | command | args |
|---|---|---|---|---|
| `claude-acp` | Claude Code | acp | `npx` | `-y @agentclientprotocol/claude-agent-acp` |
| `codex-acp` | Codex | acp | `npx` | `-y @agentclientprotocol/codex-acp` |
| `gemini` | Gemini CLI (deshabilitado por defecto, ver §3.3) | acp | `gemini` | `--acp` |
| `opencode` | OpenCode | acp | `opencode` | `acp` |
| `claude-native` | Claude Code (directo) | claude-native | `claude` | — |
| `codex-native` | Codex (directo) | codex-native | `codex` | — |

- Fijar versiones de los adaptadores en los presets (p. ej. `@agentclientprotocol/claude-agent-acp@0.85`)
  para evitar roturas por actualizaciones; actualizar deliberadamente.
- Recomendar instalación global para evitar la latencia de `npx` en el primer arranque:
  `npm i -g @agentclientprotocol/claude-agent-acp @agentclientprotocol/codex-acp`.
