# AgentHub — Contexto técnico verificado

> Parte del plan maestro. Empieza siempre por [`plan.md`](../../plan.md) (estado actual y protocolo).
> Los números de sección (§) son los mismos en todos los archivos del plan.

## 3. Contexto técnico verificado

### 3.1 Entorno de desarrollo detectado ✅ (2026-10-01)

| Herramienta | Versión | Ruta |
|---|---|---|
| Obsidian | 1.13.7 (paquete Arch `obsidian`) | `/usr/bin/obsidian` |
| Node | v26.10.0 (mise) | `~/.local/share/mise/installs/node/latest/bin/node` |
| npm / pnpm | presentes | npm vía mise; pnpm vía nvm |
| Claude Code | 2.1.286 | `~/.local/share/mise/installs/claude/latest/claude` |
| Codex CLI | 0.159.3 | `~/.local/share/mise/installs/codex/latest/bin/codex` |
| Gemini CLI | 0.62.0 | `~/.local/share/mise/installs/gemini/latest/node_modules/.bin/gemini` |
| OpenCode | 1.18.34 | `~/.local/share/mise/installs/opencode/latest/opencode` |
| SO | Linux (Omarchy / Arch, Hyprland), shell zsh | — |

> **Actualizado tras S1** ✅: aunque los agentes están instalados con **mise**, Obsidian lanzado desde el lanzador
> de Hyprland **sí** los encuentra (la sesión de Omarchy incluye `~/.local/share/mise/shims` en el `PATH`). El shell
> de login tarda ≈1,4 s y resuelve otros binarios. La resolución de entorno (§4.7) sigue siendo necesaria para otros
> sistemas (macOS, escritorios sin esa configuración), pero como **respaldo perezoso**. Ver `docs/spikes/S1-env.md`.

### 3.2 API de Obsidian que usaremos

- `Plugin` (`onload`/`onunload`, `addRibbonIcon`, `addCommand`, `addSettingTab`, `registerView`,
  `registerEvent`, `registerDomEvent`, `registerInterval`, `loadData`/`saveData`).
- `ItemView` para el sidebar: `getViewType`, `getDisplayText`, `getIcon`, `onOpen`, `onClose`,
  `getState`/`setState` (para restaurar la sesión mostrada al reiniciar).
- Activación: `workspace.getLeavesOfType(TYPE)`; si no existe, `workspace.getRightLeaf(false)` +
  `leaf.setViewState({ type, active: true })` y `workspace.revealLeaf(leaf)` (async desde 1.7.2;
  con *deferred views* hay que tener en cuenta `leaf.loadIfDeferred()`).
- `MarkdownRenderer.render(app, markdown, el, sourcePath, component)` para renderizar respuestas.
- `FileSystemAdapter#getBasePath()` para la ruta absoluta del vault (comprobar `instanceof`).
- `Vault` (`read`, `cachedRead`, `process`/`modify`, `create`, `getAbstractFileByPath`),
  `Workspace` (`getActiveViewOfType(MarkdownView)`, `editor.getSelection()`, `openLinkText`),
  `prepareFuzzySearch` para el autocompletado de `@menciones`.
- `Platform.isDesktopApp`, `Notice`, `Modal`, `Setting`, `setIcon`, `Menu`, evento `editor-menu`.
- Guía oficial: `obsidian-sample-plugin` como plantilla y `eslint-plugin-obsidianmd` como linter.
- `minAppVersion`: **1.8.7** (necesario para `getLanguage()`, usado por i18n; ver ADR-011).

### 3.3 Agent Client Protocol (ACP)

Protocolo abierto (iniciado por Zed) para comunicar un **cliente** (editor) con un **agente** por
**JSON-RPC 2.0 sobre stdio** (NDJSON). Es exactamente el problema de este plugin. Sitio: `agentclientprotocol.com`.
SDK TypeScript: `@agentclientprotocol/sdk` (1.6.0 ✅ en npm, 2026-10-01).

Flujo esencial (✅ verificado en S2 con SDK 1.6.0 y 3 agentes reales; detalle en `docs/spikes/S2-acp.md`):

1. Cliente lanza el agente y llama `initialize` con `protocolVersion`, `clientCapabilities`
   (`fs.readTextFile`, `fs.writeTextFile`, `terminal`) y `clientInfo`.
   Respuesta: `agentCapabilities` (`loadSession`, `promptCapabilities{image,audio,embeddedContext}`,
   `mcpCapabilities{http,sse}`) y `authMethods`.
2. (Si hace falta) `authenticate({ methodId })`.
3. `session/new { cwd, mcpServers[] }` → `sessionId` (+ opcionalmente `modes`, `models`).
4. `session/prompt { sessionId, prompt: ContentBlock[] }` → al final `{ stopReason }`
   (`end_turn`, `max_tokens`, `max_turn_requests`, `refusal`, `cancelled`).
5. Durante el turno el agente envía notificaciones `session/update` con `sessionUpdate` ∈
   `user_message_chunk`, `agent_message_chunk`, `agent_thought_chunk`, `tool_call`,
   `tool_call_update`, `plan`, `available_commands_update`, `current_mode_update`.
6. El agente puede pedir al cliente: `session/request_permission` (opciones `allow_once`,
   `allow_always`, `reject_once`, `reject_always`), `fs/read_text_file`, `fs/write_text_file`,
   `terminal/*` (si se anunció la capacidad).
7. Cancelar: notificación `session/cancel`; los permisos pendientes se responden con `cancelled`.
8. Reanudar: `session/load` (si `loadSession`), que re-emite el historial como `session/update`.
9. Modos y modelos: **`configOptions`** en la respuesta de `session/new` (`category: 'mode'|'model'`,
   `type: 'select'`, `currentValue`, `options[]`), cambiados con `session/set_config_option`. Algunos agentes
   envían además `modes` (`session/set_mode`) y `models`. OpenCode solo usa `configOptions`.
10. Otros métodos del agente (SDK 1.6.0): `session/{list,delete,fork,resume,close}`, `logout`, `providers/*`.
    `sessionCapabilities` anuncia cuáles soporta cada agente.

**API del SDK 1.6.0** ✅: `ClientSideConnection` está **deprecado**. Usar el builder:
`acp.client({ name }).onRequest(acp.methods.client.session.requestPermission, (ctx) => …).connectWith(acp.ndJsonStream(input, output), async (ctx) => …)`;
`ctx.request(acp.methods.agent.initialize, …)`; `ctx.buildSession(cwd).start()` → `ActiveSession`
(`prompt()`, `nextUpdate()` → `session_update` | `stop`, `dispose()`).

**Diferencias observadas respecto a la especificación base** ✅ (S2):
- `sessionUpdate` adicionales: `usage_update` (`{used, size, cost?}` = uso de la ventana de contexto) y
  `session_info_update` (Codex).
- Los chunks traen `messageId` del agente.
- Contenido de tool calls envuelto: `{type:'content', content:{type:'text', text}}`; diffs `{type:'diff', path, oldText, newText}`.
- Claude crea el `tool_call` vacío (`rawInput: {}`) y lo completa con `tool_call_update`.
- Con `terminal: false`, Codex envía igualmente contenido `{type:'terminal', terminalId}` y la salida en
  `_meta.terminal_output_delta` / `_meta.terminal_exit`.
- **Ningún agente probado usa `fs/read_text_file` ni `fs/write_text_file`**: escriben directamente en disco.

`ContentBlock` del prompt: `text`, `resource_link` (uri a archivo), `resource` (contenido embebido,
requiere `embeddedContext`), `image`, `audio`.

`ToolCall`: `toolCallId`, `title`, `kind` (`read`, `edit`, `delete`, `move`, `search`, `execute`,
`think`, `fetch`, `other`), `status` (`pending`, `in_progress`, `completed`, `failed`),
`content[]` (texto, `diff {path, oldText, newText}`, terminal), `locations[]`, `rawInput`, `rawOutput`.

Agentes con ACP ✅ (2026-10-01):

| Agente | Comando ACP | Notas |
|---|---|---|
| Claude Code | `npx -y @agentclientprotocol/claude-agent-acp@0.85.0` | ✅ Reutiliza el login existente (sin API key). Pide permisos (`allow_once`, `allow_always`, `reject_once`). Modo por defecto `default` (Manual). ~20 s para la tarea de prueba. |
| Codex | `npx -y @agentclientprotocol/codex-acp@2.1.1` | ✅ Reutiliza el login de ChatGPT. Modo por defecto `agent` (*Auto review*: no pidió permisos para escribir). ~45 s. |
| Gemini CLI | `gemini --acp` | ⚠️ Handshake OK, pero con la cuenta personal de este equipo la sesión falla: *"no longer supported for Gemini Code Assist for individuals… migrate to Antigravity"*. Preset deshabilitado por defecto. |
| OpenCode | `opencode acp` | ✅ Nativo. No pidió permisos para escribir. Modelo vía `configOptions`. ~19 s. |

> Los paquetes antiguos `@zed-industries/claude-code-acp` y `@zed-industries/codex-acp` están
> **deprecados** ✅; no usarlos.

### 3.4 Claude Code CLI (modo directo) ✅ flags verificados en 2.1.286

- Modo no interactivo: `-p/--print`.
- `--output-format text|json|stream-json`; `--input-format text|stream-json` (streaming bidireccional por stdin).
- `--include-partial-messages` (deltas de texto; requiere `--print` + `stream-json`); `--verbose`
  ✅ **obligatorio** con `stream-json` (S3). El prompt puede ir por **stdin** ✅.
- Sesiones: `--session-id <uuid>` (fijar id al crear), `-r/--resume <id>`, `-c/--continue`, `--fork-session`.
- Permisos: `--permission-mode` ∈ `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`.
  `--permission-prompts host|none` (con `--print`: `host` = el host del SDK o `--permission-prompt-tool`
  responde; `none` = todo lo que pediría permiso se deniega automáticamente).
  `--permission-prompt-tool <mcp_tool>` existe (referenciado en la ayuda, no listado) ⚠️.
- Herramientas: `--tools`, `--allowedTools`, `--disallowedTools` (p. ej. `"Bash(git *)" Edit`).
- Contexto: `--append-system-prompt`, `--system-prompt`, `--add-dir`, `--mcp-config`, `--strict-mcp-config`,
  `--settings`, `--setting-sources`, `--model`, `--effort low|medium|high|xhigh|max`.
- Otros útiles: `--bare` (sin hooks/plugins), `--safe-mode`, `--replay-user-messages`, `--json-schema`.

Eventos de `stream-json` (✅ confirmados en S3, ver `docs/spikes/S3-claude-native.md`; además hay `system/hook_*`,
`system/commands_changed`, `system/status`, `system/thinking_tokens`, `system/permission_denied` en vivo y `rate_limit_event`): `system/init`
(session_id, model, tools, slash_commands, permissionMode, cwd), `assistant` (bloques `text`,
`thinking`, `tool_use`), `user` (bloques `tool_result`), `stream_event` (eventos crudos de la API
con `--include-partial-messages`), `result` (subtype, `is_error`, `result`, `session_id`,
`total_cost_usd`, `usage`, `num_turns`, `permission_denials`).

### 3.5 Codex CLI (modo directo) ✅ flags verificados en 0.159.3

- `codex exec [OPTIONS] [PROMPT]` — no interactivo. `PROMPT` = `-` lee de stdin.
- `--json` → eventos JSONL por stdout. `-o/--output-last-message <FILE>`.
- `-C/--cd <DIR>`, `--add-dir <DIR>`, `-m/--model`, `-i/--image`, `-c key=value` (overrides de config TOML),
  `-p/--profile`, `--skip-git-repo-check` (**necesario**: un vault normalmente no es repo git),
  `--ephemeral` (no persiste sesión), `--ignore-user-config`.
- Sandbox: `-s/--sandbox read-only|workspace-write|danger-full-access`.
  `--approve-for-me` (aprobaciones revisadas automáticamente dentro de workspace-write),
  `--dangerously-bypass-approvals-and-sandbox`.
- Reanudar: `codex exec [--json -s … --skip-git-repo-check] resume <SESSION_ID> -` ✅. **Las opciones de sandbox van antes de
  `resume`** (después no las acepta) y el directorio de trabajo es el `cwd` del proceso.
- `codex app-server` [experimental]: servidor JSON-RPC (`--listen stdio://` por defecto) usado por
  integraciones de IDE; soporta aprobaciones interactivas. `codex app-server generate-ts` genera los tipos TS.
- Eventos `--json` (✅ confirmados en S4 salvo `reasoning`/`todo_list`/`mcp_tool_call`/`web_search`, que no aparecieron): `thread.started{thread_id}`, `turn.started`,
  `item.started|item.updated|item.completed{item}` con `item.type` ∈ `agent_message`, `reasoning`,
  `command_execution`, `file_change`, `mcp_tool_call`, `web_search`, `todo_list`, `error`;
  `turn.completed{usage}`, `turn.failed{error}`, `error`.
- Limitación: `exec` no permite aprobaciones interactivas → para eso, ACP (`codex-acp`) o `app-server`.

### 3.6 Otros agentes ✅

- **Gemini CLI 0.62.0:** `--acp`; headless `-p` con `-o text|json|stream-json`;
  `--approval-mode default|auto_edit|yolo|plan`; `-r/--resume`.
- **OpenCode 1.18.34:** `opencode acp`; `opencode run --format json`; `opencode serve` (servidor HTTP headless).

### 3.7 Paquetes npm relevantes ✅ (versiones al 2026-10-01)

| Paquete | Versión | Uso |
|---|---|---|
| `obsidian` | 1.13.1 | Tipos de la API (devDependency). |
| `@agentclientprotocol/sdk` | 1.6.0 | Cliente ACP (`ClientSideConnection`, `ndJsonStream`). |
| `@agentclientprotocol/claude-agent-acp` | 0.85.0 | Adaptador ACP de Claude (lo instala el usuario o se usa vía `npx`). |
| `@agentclientprotocol/codex-acp` | 2.1.1 | Adaptador ACP de Codex. |
| `@anthropic-ai/claude-agent-sdk` | 0.3.287 | Alternativa evaluable (no prevista en el MVP). |
| `@openai/codex-sdk` | 0.159.3 | Alternativa evaluable (no prevista en el MVP). |
| `preact` | 11.0.0 | UI. |
| `eslint-plugin-obsidianmd` | 0.4.2 | Lint de guías de Obsidian. |
| `@xterm/xterm` | 6.0.0 | Solo para el modo terminal opcional (Fase 7). |

### 3.8 Prior art a estudiar (⚠️ verificar estado actual antes de copiar patrones)

- **Agent Client** (plugin de Obsidian que usa ACP) — referencia directa del enfoque ACP en Obsidian.
- **Claudian** (Claude Code en el sidebar de Obsidian vía Claude Agent SDK).
- **obsidian-terminal** (polyipseity) — terminal en Obsidian; PTY sin módulos nativos (helper Python).
- **Zed** — cliente ACP de referencia (manejo de permisos, tool calls, diffs).
- Extensión de Codex para VS Code — consumidor de `codex app-server`.

Objetivo de estudiarlos: reutilizar ideas (no código sin revisar licencia) y diferenciarse
(multi-agente real, integración profunda con el vault, contexto `@`, export a notas).
