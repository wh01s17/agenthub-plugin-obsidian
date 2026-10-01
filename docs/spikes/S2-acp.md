# Spike S2 — ACP con agentes reales (2026-10-01)

Script: `scripts/spikes/acp-probe.mjs <nombre> <comando> [args…]`. Fixtures (tráfico JSON-RPC completo,
anonimizado; listas de comandos truncadas a 3): `tests/fixtures/acp/<agente>/{basic.jsonl,summary.json}`.

Tarea del prompt: leer `Notas/Ideas.md` y crear `resumen.md` en una copia temporal de `test-vault/`.
Permisos: el script elige automáticamente `allow_once`.

## Resultados

| Agente   | Comando                                               | Resultado                                                                                                                               | Tiempo | Permisos pedidos                                                | `fs/*` del cliente |
| -------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- | ------------------ |
| Claude   | `npx -y @agentclientprotocol/claude-agent-acp@0.85.0` | ✅ `end_turn`, archivo creado                                                                                                           | 20 s   | 1 (`Write resumen.md`: allow_once / allow_always / reject_once) | no                 |
| Codex    | `npx -y @agentclientprotocol/codex-acp@2.1.1`         | ✅ `end_turn`, archivo creado                                                                                                           | 45 s   | 0 (modo por defecto `agent` = auto review)                      | no                 |
| OpenCode | `opencode acp`                                        | ✅ `end_turn`, archivo creado                                                                                                           | 19 s   | 0                                                               | no                 |
| Gemini   | `gemini --acp`                                        | ❌ handshake OK, la sesión falla: _"This client is no longer supported for Gemini Code Assist for individuals… migrate to Antigravity"_ | 5 s    | —                                                               | —                  |

- **Autenticación:** Claude y Codex reutilizan el login existente (suscripción), sin API key.
  `authMethods`: Claude `[]`; Codex `api-key`, `chat-gpt`; OpenCode `opencode-login` (_"Run `opencode auth login`"_);
  Gemini `oauth-personal`, `gemini-api-key`, `vertex-ai`, `gateway`.
- **SDK 1.6.0:** `ClientSideConnection` está **deprecado**. API actual:
  `acp.client({name}).onRequest(acp.methods.client.session.requestPermission, ctx => …)
.onRequest(acp.methods.client.fs.readTextFile, …).connectWith(acp.ndJsonStream(input, output), async ctx => …)`;
  `ctx.request(acp.methods.agent.initialize, …)`; `ctx.buildSession(cwd).start()` → `ActiveSession`
  (`prompt()`, `nextUpdate()` → `{kind:'session_update', update}` | `{kind:'stop', stopReason}`, `dispose()`).
  Métodos del agente: `session/{new,load,list,delete,fork,resume,close,set_mode,set_config_option,prompt,cancel}`,
  `authenticate`, `logout`, `providers/*`. Métodos del cliente: `session`, `fs`, `terminal`, `elicitation`.

## Formas observadas (difieren del plan original)

1. **Modos y modelos llegan como `configOptions`** en la respuesta de `session/new`
   (`{id, name, category: 'mode'|'model', type: 'select', currentValue, options[{value,name,description}]}`),
   y se cambian con `session/set_config_option`. OpenCode **solo** expone el modelo así (sin `modes`).
   Claude y Codex además envían `modes` (`currentModeId`, `availableModes`); Codex también `models`.
   - Claude: `default` (Manual), `acceptEdits`, `plan`, `auto`, `bypassPermissions`. Por defecto `default`.
   - Codex: `read-only`, `workspace-write`, `agent` (Auto review), `agent-full-access`. Por defecto `agent`.
2. **`sessionUpdate` extra:** `usage_update` (`{used, size, cost?: {amount, currency}}`, uso de la ventana de
   contexto) y `session_info_update` (Codex, estado del hilo en `_meta`).
3. **`messageId`** viene en `agent_message_chunk` / `agent_thought_chunk`: usarlo en lugar de generar ids.
4. **Tool calls:** Claude crea el `tool_call` con `rawInput: {}` y título provisional ("Preparing file…") y lo
   completa con `tool_call_update` (título, `rawInput`, `locations`, `rawOutput`, `content`). El contenido de
   texto viene envuelto: `{type:'content', content:{type:'text', text}}`. Codex envía diffs
   `{type:'diff', path, oldText:null, newText, _meta:{kind:'add'}}`.
5. **Terminal sin capacidad:** con `terminal: false`, Codex igualmente manda `content: [{type:'terminal', terminalId}]`
   y la salida por `_meta.terminal_output_delta {data}` / `_meta.terminal_exit {exit_code}` en `tool_call_update`.
6. **Ningún agente usó `fs/read_text_file` ni `fs/write_text_file`**: escriben directamente en disco.
   El watcher de Obsidian recoge los cambios; la guardia de rutas de ADR-009 no protege nada en la práctica.
7. **`sessionCapabilities`:** Claude/Codex `resume, list, close, delete, fork, additionalDirectories, subagents`;
   OpenCode `close, fork, list, resume`. Todos `loadSession: true`.
8. `available_commands_update` incluye las skills del usuario (Claude 300+), conviene filtrar/buscar en la UI.
