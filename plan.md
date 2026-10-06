# AgentHub para Obsidian — Plan maestro

> **Documento vivo.** Es la fuente de verdad del proyecto: visión, requerimientos, arquitectura,
> tareas, decisiones y bitácora. Cualquier agente (Claude Code, Codex, Gemini, etc.) o persona
> que retome el trabajo debe **leer la §0 primero** y **actualizar este archivo al terminar**.

- **Nombre provisional:** AgentHub · **id del plugin:** `agenthub` (verificar que no esté tomado; ver §14)
- **Repositorio local:** `~/workspace/agenthub-plugin-obsidian`
- **Creado:** 2026-10-01
- **Idioma del código:** inglés (identificadores, comentarios). **Idioma de docs/UI:** español + inglés (i18n).

---

## Índice

0. [Estado actual y protocolo para retomar](#0-estado-actual-y-protocolo-para-retomar)
1. [Visión y objetivos](#1-visión-y-objetivos)
2. [Requerimientos](#2-requerimientos)
3. [Contexto técnico verificado](#3-contexto-técnico-verificado)
4. [Arquitectura](#4-arquitectura)
5. [Especificación de adaptadores](#5-especificación-de-adaptadores)
6. [Estructura del repositorio](#6-estructura-del-repositorio)
7. [Stack y dependencias](#7-stack-y-dependencias)
8. [Flujo de desarrollo](#8-flujo-de-desarrollo)
9. [Estrategia de pruebas](#9-estrategia-de-pruebas)
10. [Seguridad y privacidad](#10-seguridad-y-privacidad)
11. [Roadmap y tareas](#11-roadmap-y-tareas)
12. [Decisiones de arquitectura (ADR)](#12-decisiones-de-arquitectura-adr)
13. [Riesgos y mitigaciones](#13-riesgos-y-mitigaciones)
14. [Preguntas abiertas](#14-preguntas-abiertas)
15. [Convenciones y Definition of Done](#15-convenciones-y-definition-of-done)
16. [Glosario](#16-glosario)
17. [Bitácora](#17-bitácora)

---

## 0. Estado actual y protocolo para retomar

### 0.1 Estado (actualizar en cada sesión de trabajo)

| Campo | Valor |
|---|---|
| Fase actual | **0.5.0 publicada como Latest** (Fase 9: imágenes pegadas, arrastradas o adjuntas en el chat, ADR-035). |
| Próxima tarea | Confirmar en Obsidian el arreglo del scroll horizontal en paneles estrechos (en `main`, sin publicar) y, con confirmación del usuario, release 0.5.1 (PATCH). Fase 5 condicional y Fase 7 descartada. |
| Tareas en paralelo posibles | Fase 5 solo si aparece una limitación real de ACP (ADR-025). |
| Bloqueos | Ninguno. |
| Última actualización | 2026-10-05 — Release 0.5.0: imágenes en el chat. Claude (Opus 5.5). |
| Código existente | Núcleo + ACP + UI + contexto de Obsidian (Fases 0–3 cerradas); guardado automático de sesiones con índice/JSONL, debounce, retención y ajustes de historial. Confirmación de modos sin restricciones, Codex en solo lectura y respaldo de opciones Gemini. Rediseño con pastillas de opciones, ajustes de apariencia, opciones persistentes por agente e historial de prompts (0.2.0). Pestañas con varias conversaciones en una vista (Fase 8, 0.3.0–0.4.1). Imágenes en el cuadro de mensaje (Fase 9, 0.5.0). Lint y build pasan (1 aviso intencionado: `display()`, ADR-027); 260 tests pasan, 2 e2e omitidos. Rama `main`. |

### 0.2 Protocolo para un agente que retoma el trabajo

1. **Leer** este documento completo; como mínimo §0, §4, §11 y la última entrada de §17.
2. **Inspeccionar el repo:** `git status`, `git log --oneline -20`.
3. **Comprobar que todo está verde** antes de tocar nada:
   `pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build`.
   Si algo falla, arreglarlo es la primera tarea (registrarlo en la bitácora).
4. **Elegir la tarea:** la primera tarea sin marcar `[ ]` de la fase actual cuyas dependencias
   estén completas. No saltar de fase sin cerrar los criterios de aceptación de la anterior.
5. **Trabajar en pasos pequeños.** Commits con Conventional Commits que citen la tarea:
   `feat(acp): map tool_call updates to domain events [T2.5]`.
6. **Al terminar (o al detenerse a medias):**
   - Marcar `[x]` las tareas completadas (o anotar avance parcial dentro de la tarea).
   - Actualizar la tabla §0.1.
   - Añadir una entrada a la **Bitácora (§17)**: fecha, agente, qué se hizo, qué falta, bloqueos.
   - Si se tomó o cambió una decisión de arquitectura, **añadir un ADR nuevo** en §12
     (nunca editar en silencio uno existente: se marca como "Reemplazado por ADR-0xx").
   - Si se verificó un dato marcado con ⚠️, actualizar el texto y quitar la marca.
7. **No inventar formatos de protocolo.** Todo lo marcado con ⚠️ debe confirmarse contra la
   herramienta real (spikes de la Fase 1, `--help`, fixtures grabados) antes de codificarlo.

### 0.3 Leyenda

- ⚠️ = dato no verificado o que cambia con frecuencia; confirmar antes de depender de él.
- ✅ = verificado en este entorno (con fecha y versión).
- `[~]` = tarea con avance parcial (se indica qué falta).
- **Must/Should/Could** = prioridad MoSCoW.

---

## 1. Visión y objetivos

### 1.1 Problema

Los agentes de código por CLI (Claude Code, Codex, Gemini CLI, OpenCode…) son muy útiles para
trabajar sobre un vault de Obsidian (resumir, reorganizar, refactorizar notas, generar contenido,
mantener enlaces), pero obligan a salir de Obsidian a una terminal, perder el contexto de la nota
activa y revisar cambios fuera del editor.

### 1.2 Solución

Un plugin de Obsidian (escritorio) que **envuelve los agentes instalados en el sistema** y los
expone en una **vista lateral (sidebar)** tipo chat:

- Detecta qué agentes están disponibles y permite elegir uno por sesión.
- Lanza el agente como proceso hijo y habla con él por un **protocolo estructurado**
  (ACP — Agent Client Protocol — como vía principal; salida JSON nativa de cada CLI como vía directa).
- Renderiza respuestas con el motor Markdown de Obsidian, muestra llamadas a herramientas,
  diffs, planes y **solicitudes de permiso interactivas**.
- Inyecta contexto de Obsidian: nota activa, selección, notas mencionadas con `@`.
- Guarda historial de sesiones y permite reanudarlas o exportarlas como nota.

### 1.3 Objetivos

1. Usar Claude Code y Codex desde el sidebar con la misma calidad de experiencia que en la terminal
   para el 90 % de los casos de uso (chat, edición de archivos, comandos, permisos).
2. Arquitectura **agnóstica del agente**: añadir un agente nuevo compatible con ACP debe requerir
   solo configuración (comando + argumentos), sin código.
3. Seguridad por defecto: nada se ejecuta ni se escribe sin el modo de permisos que el usuario eligió.
4. Cumplir las guías de plugins de la comunidad de Obsidian para poder publicarlo.

### 1.4 No-objetivos (fuera de alcance)

- Soporte móvil (iOS/Android): imposible lanzar procesos. El plugin es `isDesktopOnly: true`.
- Implementar un agente propio o llamar directamente a APIs de LLM. El plugin **no** gestiona API keys
  ni hace llamadas de red propias: los agentes se autentican y conectan por su cuenta.
- Gestionar la instalación/actualización de los agentes (solo detectar y dar instrucciones).
- Emulación de terminal completa: fuera del alcance por decisión del usuario (ADR-029).

### 1.5 Escenarios de uso principales

1. "Resume esta nota y propón etiquetas" → contexto = nota activa → respuesta renderizada.
2. "Reorganiza las notas de `Proyectos/` en subcarpetas por año" → el agente pide permiso para
   mover/editar → el usuario aprueba → los cambios aparecen en el vault.
3. Selecciona un párrafo → comando "Enviar selección al agente" → "reescríbelo más claro".
4. Retoma ayer una sesión larga de Codex desde el historial y continúa.
5. Ejecuta un slash command del agente (p. ej. `/review`) desde el compositor.

---

## 2. Requerimientos

### 2.1 Funcionales

| ID | Requerimiento | Prioridad | Fase |
|---|---|---|---|
| RF-01 | Vista lateral (derecha por defecto) abrible desde icono de cinta y comando; se restaura al reiniciar Obsidian (estado de la vista persistido). | Must | 0 / 4 |
| RF-02 | Detección de agentes disponibles: binario encontrado, versión, adaptador ACP presente; estado visible (disponible / no instalado / error) con instrucciones de instalación. | Must | 2 |
| RF-03 | Selección de agente por sesión. Cambiar de agente crea una sesión nueva. | Must | 2 |
| RF-04 | Enviar prompts y recibir respuestas **en streaming**, renderizadas con el Markdown de Obsidian (wikilinks, código, callouts). | Must | 2 |
| RF-05 | Mostrar llamadas a herramientas (tipo, título, estado, entrada/salida colapsable) y planes/TODOs del agente. | Must | 2 |
| RF-06 | Solicitudes de permiso interactivas (permitir una vez / siempre / denegar) cuando el agente lo soporta; si no, modo de permisos configurable antes del turno. | Must | 2 / 5 |
| RF-07 | Cancelar el turno en curso (botón detener + comando). | Must | 2 |
| RF-08 | Contexto de Obsidian: nota activa (toggle), selección, menciones `@nota` con autocompletado. | Must | 3 |
| RF-09 | Slash commands del agente con autocompletado en el compositor. | Should | 3 |
| RF-10 | Historial: listar, reanudar, renombrar, borrar y exportar sesiones a una nota Markdown. | Should | 4 |
| RF-11 | Varias sesiones simultáneas (varios paneles AgentHub). | Should | 4 |
| RF-12 | Selector de modelo y de modo (p. ej. plan / acceptEdits) cuando el agente los expone. | Should | 2 / 5 |
| RF-13 | Mostrar uso (tokens / coste) cuando el agente lo reporta. | Could | 5 |
| RF-14 | Comandos de Obsidian: abrir, nueva sesión, detener, enviar selección, preguntar sobre nota actual, exportar. Sin hotkeys por defecto. | Must | 3 |
| RF-15 | Pestaña de ajustes: agentes (preset + personalizados), directorio de trabajo, contexto, historial, seguridad, debug. | Must | 2 |
| RF-16 | Directorio de trabajo: raíz del vault (defecto), carpeta de la nota activa, o ruta personalizada. | Must | 3 |
| RF-17 | Rutas de archivos y wikilinks en la salida son clicables y abren la nota en Obsidian. | Should | 3 |
| RF-18 | Vista de diffs para ediciones de archivos. | Should | 6 |
| RF-19 | Panel de depuración opcional con eventos crudos y stderr del agente. | Should | 2 |
| RF-20 | Agentes ACP personalizados definidos solo por configuración (comando, args, env). | Must | 2 |
| RF-21 | Modo terminal: TUI original del agente en el sidebar vía xterm.js. **Descartado por decisión del usuario (ADR-029).** | Fuera de alcance | 7 (cancelada) |
| RF-22 | Apariencia configurable (estilo de mensajes, densidad, tamaño de texto, acento, ubicación de opciones, herramientas desplegadas, consumo) respetando el tema de Obsidian. | Should | 6 (T6.13, ADR-032) |
| RF-23 | Las opciones elegidas de cada agente (modo, modelo, esfuerzo…) se conservan entre sesiones y reinicios; los modos sin restricciones se confirman en cada inicio. | Should | 6 (T6.13) |
| RF-24 | Historial de prompts con ↑/↓ en el compositor, solo en memoria. | Could | 6 (T6.14) |
| RF-25 | Pestañas: varias conversaciones (con agentes distintos) trabajando a la vez en una misma vista, con indicadores de estado y aviso de permisos en pestañas ocultas; se conservan al reiniciar y se reordenan. Límite opcional de agentes trabajando a la vez y aviso de ediciones compartidas. | Should | 8 (T8.1–T8.6, ADR-033, ADR-034) |
| RF-26 | Imágenes en el chat: pegar capturas (Ctrl/Cmd+V), arrastrar archivos de imagen o elegirlos con un botón; miniaturas quitables antes de enviar, imágenes visibles en la conversación y en el historial; aviso si el agente no las acepta. | Should | 9 (T9.1–T9.3, ADR-035) |

### 2.2 No funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | **Plataformas:** Linux y macOS soportados; Windows "best effort" (rutas `.cmd`, comillas). |
| RNF-02 | **Sin procesos huérfanos:** todo proceso hijo se termina al cerrar la sesión, la vista, o al descargar el plugin. |
| RNF-03 | **Rendimiento:** la UI sigue fluida con sesiones de 1000+ mensajes; el re-render del mensaje en streaming se limita (throttle ~100 ms). Carga del plugin < 100 ms (los agentes se lanzan de forma perezosa). |
| RNF-04 | **Privacidad:** sin telemetría, sin llamadas de red propias. Los transcripts se guardan solo en local. |
| RNF-05 | **Robustez de parsing:** tipos de evento desconocidos se ignoran (y se registran en debug), nunca rompen la sesión. |
| RNF-06 | **Cumplimiento de guías de Obsidian:** sin `innerHTML` con contenido no confiable, limpieza con `register*`, estilos con variables CSS, textos en *sentence case*, sin hotkeys por defecto. |
| RNF-07 | **Accesibilidad:** navegable por teclado, roles/aria en lista de mensajes y tarjetas, contraste del tema. |
| RNF-08 | **Temas:** compatible con temas claro/oscuro y temas de la comunidad (solo variables CSS de Obsidian). |
| RNF-09 | **Tamaño del bundle:** `main.js` objetivo < 1,5 MB minificado. |
| RNF-10 | **Mantenibilidad:** TypeScript `strict`, núcleo sin dependencias de UI, adaptadores testeables sin Obsidian. |

### 2.3 Restricciones de plataforma

- Obsidian corre en el *renderer* de Electron con integración Node: `child_process`, `fs`, `http`
  están disponibles **solo en escritorio**.
- Un plugin de la comunidad se distribuye solo como `main.js`, `manifest.json` y `styles.css`:
  **no se pueden distribuir módulos nativos** (p. ej. `node-pty`) ni binarios. Todo debe ir en el bundle JS.
- Las apps GUI no heredan el `PATH` del shell interactivo del usuario (crítico en este entorno: ver §3.1).
- Obsidian empaquetado como Flatpak/Snap está aislado y no puede lanzar binarios del host sin
  `flatpak-spawn --host`: se documenta como no soportado inicialmente.

---

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
| `@xterm/xterm` | 6.0.0 | Referencia histórica; no se incorporará: Fase 7 descartada (ADR-029). |

### 3.8 Prior art a estudiar (⚠️ verificar estado actual antes de copiar patrones)

- **Agent Client** (plugin de Obsidian que usa ACP) — referencia directa del enfoque ACP en Obsidian.
- **Claudian** (Claude Code en el sidebar de Obsidian vía Claude Agent SDK).
- **obsidian-terminal** (polyipseity) — terminal en Obsidian; PTY sin módulos nativos (helper Python).
- **Zed** — cliente ACP de referencia (manejo de permisos, tool calls, diffs).
- Extensión de Codex para VS Code — consumidor de `codex app-server`.

Objetivo de estudiarlos: reutilizar ideas (no código sin revisar licencia) y diferenciarse
(multi-agente real, integración profunda con el vault, contexto `@`, export a notas).

---

## 4. Arquitectura

### 4.1 Vista general

```mermaid
flowchart LR
  subgraph OBS["Obsidian (renderer de Electron)"]
    UI["UI (Preact)<br/>AgentHubView"] --> SM["SessionManager"]
    SM --> CS["ChatSession<br/>(estado + reducer)"]
    SM --> REG["AgentRegistry"]
    SM --> STORE["SessionStore<br/>(JSONL)"]
    CS --> PB["PromptBuilder"]
    PB --> API["Obsidian API<br/>(Vault / Workspace)"]
    REG --> ACP["AcpAdapter"]
    REG --> CN["ClaudeNativeAdapter"]
    REG --> CX["CodexNativeAdapter"]
    ACP --> PR["ProcessRunner<br/>+ ShellEnv"]
    CN --> PR
    CX --> PR
    ACP -. "fs/read, fs/write" .-> API
  end
  PR -- "stdio · JSON-RPC (ACP)" --> A1["claude-agent-acp · codex-acp<br/>gemini --acp · opencode acp"]
  PR -- "stdout · JSONL" --> A2["claude -p --output-format stream-json<br/>codex exec --json"]
```

Principio rector: **el modelo de dominio interno tiene la forma de ACP.** El `AcpAdapter` es
casi una traducción 1:1; los adaptadores nativos son "shims" que convierten la salida JSONL de cada
CLI a los mismos eventos. La UI y el resto del núcleo nunca conocen el formato de un agente concreto.

### 4.2 Capas y responsabilidades

| Capa | Módulos | Responsabilidad | Depende de |
|---|---|---|---|
| Plugin | `main.ts` | Ciclo de vida, registro de vista/comandos/ajustes, apagado de procesos. | todas |
| UI | `ui/` | Renderizar estado de sesión, capturar input, resolver permisos. | core (lectura), Obsidian |
| Core | `core/` | Modelo de dominio, `SessionManager`, `ChatSession`, `PromptBuilder`, `AgentRegistry`. | interfaces |
| Adaptadores | `adapters/` | Traducir protocolo de cada agente ↔ eventos de dominio. | process, core/types |
| Proceso | `process/` | Spawn, stdio, terminación de árbol, entorno/PATH, binarios. | Node |
| Persistencia | `storage/` | Índice y transcripts de sesiones, export a nota. | Obsidian adapter |
| Puente (fase 5) | `bridge/` | Servidor MCP local (permisos para Claude directo, herramientas del vault). | Node http |

Regla: `core/` y `adapters/` **no importan `obsidian`** (salvo tipos inyectados por interfaces),
para poder testearlos con Vitest sin Obsidian. Lo que necesitan de Obsidian llega por un
`HostBridge` inyectado (leer/escribir archivos del vault, ruta base, etc.).

### 4.3 Modelo de dominio (`src/core/types.ts`)

> **Implementado en T2.1.** El código de `src/core/types.ts` es la fuente de verdad; el bloque siguiente es
> orientativo y puede quedar desfasado en detalles (p. ej. `rawOutput` en `ToolCall`, `SessionStatus`).

```ts
export type AgentId = string; // 'claude-acp', 'codex-acp', 'gemini', 'opencode', 'claude-native', ...

export type ToolKind =
  | 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'other';
export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type StopReason =
  | 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled' | 'error';

export interface ToolCall {
  id: string;
  title: string;
  kind: ToolKind;
  status: ToolStatus;
  rawInput?: unknown;
  locations?: { path: string; line?: number }[];
  content?: ToolContent[];
}
export type ToolContent =
  | { type: 'text'; text: string }
  | { type: 'diff'; path: string; oldText: string | null; newText: string }
  | { type: 'terminal'; output: string; exitCode?: number };

export interface PlanEntry { content: string; status: 'pending' | 'in_progress' | 'completed'; priority?: 'high' | 'medium' | 'low' }
export interface SlashCommand { name: string; description?: string; inputHint?: string }
export interface ModeInfo { id: string; name: string; description?: string }
export interface ModelInfo { id: string; name: string }
export interface Usage {
  inputTokens?: number; outputTokens?: number; cachedInputTokens?: number;
  costUsd?: number;
  contextUsed?: number; contextSize?: number;          // ACP usage_update {used, size}
}
export interface ConfigOption {                         // ACP configOptions (modo, modelo, …)
  id: string; name: string; description?: string;
  category?: 'mode' | 'model' | string;
  currentValue: string;
  options: { value: string; name: string; description?: string }[];
}

export type AgentEvent =
  | { type: 'session.ready'; nativeSessionId: string; configOptions?: ConfigOption[]; modes?: ModeInfo[]; currentModeId?: string; models?: ModelInfo[]; currentModelId?: string }
  | { type: 'config'; configOptions: ConfigOption[] }
  | { type: 'message.chunk'; role: 'assistant' | 'user'; messageId: string; text: string } // messageId del agente si lo envía
  | { type: 'thought.chunk'; messageId: string; text: string }
  | { type: 'message.end'; messageId: string }
  | { type: 'tool.call'; call: ToolCall }
  | { type: 'tool.update'; id: string; patch: Partial<Omit<ToolCall, 'id'>> }
  | { type: 'plan'; entries: PlanEntry[] }
  | { type: 'commands'; commands: SlashCommand[] }
  | { type: 'mode'; currentModeId: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'permission.denied'; toolName: string; input?: unknown } // modo directo sin prompts interactivos
  | { type: 'turn.end'; stopReason: StopReason }
  | { type: 'error'; message: string; recoverable: boolean; detail?: string }
  | { type: 'debug'; source: 'stdout' | 'stderr' | 'rpc'; line: string };

export type PromptBlock =
  | { type: 'text'; text: string }
  | { type: 'file'; path: string; absPath: string; text?: string }    // nota/archivo del vault
  | { type: 'selection'; path: string; text: string; fromLine: number; toLine: number }
  | { type: 'image'; mimeType: string; data: string };                  // base64

export interface PermissionRequest {
  id: string;
  toolCall: Pick<ToolCall, 'id' | 'title' | 'kind' | 'rawInput' | 'locations'>;
  options: { id: string; label: string; kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' }[];
}
export type PermissionOutcome = { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' };
```

Estado de UI (derivado por un *reducer* puro a partir de los eventos — testeable con fixtures):

```ts
export type TranscriptItem =
  | { kind: 'user'; id: string; blocks: PromptBlock[]; at: number }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean }
  | { kind: 'thought'; id: string; text: string; streaming: boolean }
  | { kind: 'tool'; call: ToolCall }
  | { kind: 'plan'; entries: PlanEntry[] }
  | { kind: 'permission'; request: PermissionRequest; resolved?: PermissionOutcome }
  | { kind: 'notice'; level: 'info' | 'warning' | 'error'; text: string };

export interface SessionViewState {
  localId: string;                 // uuid local de AgentHub
  agentId: AgentId;
  nativeSessionId?: string;        // id del agente (para reanudar)
  title: string;
  cwd: string;
  status: 'idle' | 'starting' | 'running' | 'awaiting-permission' | 'error' | 'closed';
  items: TranscriptItem[];
  modes?: ModeInfo[]; currentModeId?: string;
  models?: ModelInfo[]; currentModelId?: string;
  commands: SlashCommand[];
  usage?: Usage;
}
```

### 4.4 Interfaz de adaptadores (`src/core/AgentAdapter.ts`)

> **Implementado en T2.1** (fuente de verdad: `src/core/AgentAdapter.ts`). Cambios respecto al bloque: modo y
> modelo se fijan con `SessionOptions.config` (`{ mode: 'plan' }`) y `AgentSession.setConfigOption()` (ADR-015),
> sin `setMode`/`setModel`; `AgentCapabilities` tiene `configOptions` en lugar de `modes`/`models`.

```ts
export interface Disposable { dispose(): void }

export interface HostBridge {
  vaultBasePath: string;
  env: () => Promise<NodeJS.ProcessEnv>;                         // entorno resuelto (§4.7)
  readTextFile(absPath: string, line?: number, limit?: number): Promise<string>;
  writeTextFile(absPath: string, content: string): Promise<void>; // vía Vault API si está dentro del vault
  requestPermission(req: PermissionRequest): Promise<PermissionOutcome>; // la UI lo resuelve
  log: Logger;
}

export interface AgentCapabilities {
  streaming: boolean;              // deltas de texto
  interactivePermissions: boolean;
  loadSession: boolean;            // reanudar con historial
  embeddedContext: boolean;        // acepta contenido de archivos embebido
  images: boolean;
  modes: boolean;
  models: boolean;
  slashCommands: boolean;
  usage: boolean;
}

export interface DetectionResult {
  status: 'available' | 'missing' | 'error';
  version?: string;
  resolvedCommand?: string;        // ruta absoluta del binario/comando
  message?: string;                // instrucciones si falta o falla
}

export interface SessionOptions {
  cwd: string;
  modeId?: string;
  modelId?: string;
  systemPromptAppend?: string;     // instrucciones del vault (§4.8)
  extraArgs?: string[];
  env?: Record<string, string>;
}

export interface AgentSession {
  readonly nativeSessionId: string | undefined; // puede llegar tras el primer turno (modo directo)
  readonly capabilities: AgentCapabilities;
  onEvent(listener: (e: AgentEvent) => void): Disposable;
  prompt(blocks: PromptBlock[]): Promise<StopReason>;
  cancel(): Promise<void>;
  setMode?(modeId: string): Promise<void>;
  setModel?(modelId: string): Promise<void>;
  setConfigOption?(id: string, value: string): Promise<void>; // preferido sobre setMode/setModel si existe
  dispose(): Promise<void>;        // mata el proceso, libera recursos
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly label: string;
  detect(host: HostBridge): Promise<DetectionResult>;
  createSession(opts: SessionOptions, host: HostBridge): Promise<AgentSession>;
  loadSession?(nativeSessionId: string, opts: SessionOptions, host: HostBridge): Promise<AgentSession>;
}
```

### 4.5 Flujo de un turno (ACP)

```mermaid
sequenceDiagram
  actor U as Usuario
  participant V as AgentHubView
  participant S as ChatSession
  participant A as AcpAdapter
  participant P as Proceso agente
  U->>V: escribe prompt (+ nota activa, @menciones)
  V->>S: send(text, attachments)
  S->>S: PromptBuilder → PromptBlock[]
  S->>A: prompt(blocks)
  A->>P: session/prompt
  loop streaming
    P-->>A: session/update (agent_message_chunk, tool_call, plan...)
    A-->>S: AgentEvent
    S-->>V: estado (throttle ~100 ms)
  end
  P->>A: session/request_permission
  A->>S: host.requestPermission(req)
  S->>V: tarjeta de permiso (status = awaiting-permission)
  U->>V: "Permitir una vez"
  V->>S: resolve(optionId)
  S-->>A: PermissionOutcome
  A-->>P: respuesta JSON-RPC
  P-->>A: resultado de session/prompt {stopReason}
  A-->>S: turn.end
  S->>S: persistir transcript
```

Cancelación: botón detener → `session.cancel()` → ACP `session/cancel`; los permisos pendientes se
resuelven con `cancelled`; si el agente no responde en 5 s, se mata el proceso y la sesión queda
reanudable (si `loadSession`) o se marca cerrada.

### 4.6 Gestión de procesos (`src/process/ProcessRunner.ts`)

- Lanzar con `cross-spawn` (manejo correcto de `.cmd` y comillas en Windows) o `child_process.spawn`
  en POSIX. `stdio: ['pipe','pipe','pipe']`, `cwd` de la sesión, `env` resuelto + env del agente.
- Variables añadidas por defecto: `NO_COLOR=1`, `FORCE_COLOR=0`, `TERM=dumb` (evitar ANSI en JSON).
  ⚠️ En S1 comprobar si heredar variables `ELECTRON_*`/`NODE_OPTIONS` del renderer causa problemas; si es así, filtrarlas.
- POSIX: `detached: true` para crear grupo de procesos y poder matar el árbol con
  `process.kill(-pid, 'SIGTERM')` → `SIGKILL` a los 3 s. Windows: `taskkill /PID <pid> /T /F`.
- **Registro global** de procesos vivos (`ProcessRegistry`): `onunload` del plugin y
  `window` `beforeunload` matan todos. Además, al cerrarse Obsidian la tubería stdin se cierra y los
  agentes ACP terminan por EOF.
- stdout: decodificación UTF-8 con `StringDecoder` (caracteres multibyte partidos entre chunks),
  separación por líneas (JSONL), límite de longitud de línea configurable (p. ej. 10 MB) para no reventar memoria.
- stderr: *ring buffer* de las últimas ~200 líneas para mostrar en errores y en el panel de debug.
- Para ACP: convertir stdio a web streams (`Writable.toWeb(stdin)`, `Readable.toWeb(stdout)`) y
  pasarlas a `ndJsonStream` del SDK.
- **Reaper de inactividad:** sesiones sin actividad durante `idleTimeoutMin` (defecto 15) liberan su
  proceso; se relanzan al enviar el siguiente prompt (vía `loadSession`/`--resume`).

### 4.7 Resolución de entorno y binarios (`src/process/ShellEnv.ts`, `BinaryResolver.ts`)

0. Resolver primero con `process.env` (S1: suficiente en este equipo). Solo si algún comando no se encuentra:
1. Ejecutar **de forma asíncrona** (≈1,4 s medidos en S1; nunca `spawnSync` en el hilo de la UI) y cachear el shell de login del usuario:
   `$SHELL -ilc 'printf "__AGH_START__"; env -0; printf "__AGH_END__"'` con timeout de 5 s.
   Los marcadores aíslan ruido de `.zshrc` (banners, prompts). Parsear `env -0` (separado por NUL).
2. Fusionar: `process.env`; las rutas del `PATH` del shell se **añaden al final** (no cambian qué binario gana si ya existía);
   `settings.env.extraPath` se antepone; luego el env del agente.
3. Si el shell falla o excede el timeout: usar `process.env` + rutas comunes:
   `~/.local/bin`, `~/.local/share/mise/shims`, `~/.local/share/mise/installs/*/latest{,/bin}`,
   `~/.npm-global/bin`, `~/.bun/bin`, `~/.cargo/bin`, `/usr/local/bin`, `/opt/homebrew/bin`,
   versiones de `~/.nvm` / `~/.config/nvm`.
4. `BinaryResolver.which(cmd, env)`: recorre `PATH` (y `PATHEXT` en Windows). Si el usuario configuró
   una ruta absoluta en ajustes, se usa tal cual.
5. Botón "Re-detectar agentes" en ajustes invalida la caché.
6. Windows: no se hace paso 1; se usa `process.env` (las GUI heredan el PATH de usuario).

### 4.8 Contexto de Obsidian → prompt (`src/core/PromptBuilder.ts`)

Entradas: texto del usuario, nota activa (si el toggle está activo), selección, `@menciones`,
imágenes pegadas (fase posterior), instrucciones del vault.

- **ACP:** `text` con el mensaje; cada nota → `resource_link` (`file:///abs/path`); la selección →
  `resource` embebido (`text/markdown`) si `embeddedContext`, si no → bloque de texto.
- **Modo directo (Claude/Codex):** todo se serializa como texto antes del mensaje:

```text
<obsidian-context>
Vault: /ruta/absoluta/al/vault   (directorio de trabajo)
Nota activa: Proyectos/Idea.md
Selección (Proyectos/Idea.md, líneas 10–24):
"""
…texto seleccionado…
"""
Notas referenciadas: Proyectos/A.md, Proyectos/B.md
</obsidian-context>

<mensaje del usuario>
```

- **Instrucciones del vault** (configurables, texto por defecto en ajustes): que es un vault de
  Obsidian, usar `[[wikilinks]]`, respetar frontmatter YAML, no tocar `.obsidian/`, preferir
  rutas relativas al vault. Claude directo → `--append-system-prompt`; ACP/Codex → se antepone en el
  **primer** prompt de la sesión como bloque de texto.
- Las rutas se pasan **relativas al vault** en el texto y **absolutas** en `resource_link`.
- Límite de tamaño de contexto embebido (p. ej. 200 KB) con aviso si se trunca.

### 4.9 Permisos

| Vía | Mecanismo | Fase |
|---|---|---|
| ACP | `session/request_permission` → tarjeta inline en el chat con las opciones del agente. "Siempre" lo gestiona el propio agente (la opción `allow_always`). | 2 |
| Claude directo (básico) | El usuario elige `--permission-mode` antes del turno; `--permission-prompts none`; las denegaciones (`permission_denials` del `result`) se muestran con botón "Permitir y reintentar" (relanza con `--allowedTools` añadido y `--resume`). | 5 |
| Claude directo (interactivo) | Servidor MCP local del plugin + `--permission-prompt-tool mcp__agenthub__approve` ⚠️. | 5 (opcional) |
| Codex directo | Selector de sandbox (`read-only` por defecto, `workspace-write`, `danger-full-access` con confirmación). Aprobaciones interactivas solo vía ACP o `app-server`. | 5 |

Reglas de UI: mientras haya un permiso pendiente, el estado es `awaiting-permission`, el compositor
sigue activo pero el botón principal muestra "Detener"; notificación (`Notice`) si la vista no es visible.
Modos peligrosos (`bypassPermissions`, `danger-full-access`, `agent-full-access`, `yolo`) piden confirmación explícita
cada vez que se activan y muestran un distintivo rojo en la cabecera. También se confirma al iniciar o
reanudar un proceso con un modo sin restricciones. Codex ACP inicia en `read-only` si no hay un modo
explícito en los ajustes (ADR-030). Cancelar no aplica el cambio; cerrar la sesión cierra el diálogo.

### 4.10 Persistencia (`src/storage/SessionStore.ts`)

```
<vault>/.obsidian/plugins/agenthub/
├── main.js · manifest.json · styles.css
├── data.json                    # ajustes (loadData/saveData)
└── sessions/
    ├── index.json               # [{localId, agentId, nativeSessionId, title, cwd, createdAt, updatedAt}]
    └── <localId>.jsonl          # transcript: 1 línea = {v:1, t, item}  (TranscriptItem consolidado)
```

- Se persisten **items consolidados** (mensajes completos, no cada chunk) para que los archivos sean pequeños.
- Escrituras con *debounce* (1 s) y al terminar cada turno; acceso vía `app.vault.adapter` (funciona en `.obsidian`).
- **T4.1 implementada:** se reemplaza el snapshot JSONL completo para consolidar también cambios en herramientas
  y planes. Escrituras serializadas con `.tmp` y respaldo `.bak`: `DataAdapter.rename()` no sobrescribe destinos;
  se restaura el respaldo si falla el reemplazo o al leer después de una interrupción (ADR-021).
  Un índice corrupto produce un error sin sobrescribirlo; registros JSONL inválidos se omiten con aviso.
  Los snapshots guardados no contienen streaming activo ni permisos pendientes accionables.
- La reanudación real del contexto del modelo la hace el **agente** (`session/load`, `--resume`,
  `codex exec resume`); el transcript local es para mostrar historial. Si el agente no puede reanudar,
  la sesión se abre en modo lectura con botón "Continuar en sesión nueva".
- Retención configurable (`maxSessions`, defecto 200). Opción para desactivar historial.
- Aviso en ajustes: si el vault se sincroniza (Sync/git), los transcripts se sincronizan también.
- **Export a nota:** Markdown con frontmatter (`agent`, `created`, `session`), mensajes como
  secciones y tool calls como callouts plegables (`> [!tool]- Read Proyectos/A.md`).

### 4.11 UI

Disposición a 0.2.0 (T6.12, ADR-032; ajustes por defecto):

```
┌──────────────────────────────────────┐
│ [✳ Resumen ●][Cx Carpetas ●×]     [+] │ pestañas arriba de todo (0.3.0, ADR-033): logo, título, indicador
│ ✳ [Claude Code ▾]        [✎] [🕘] [⚙] │ cabecera de la pestaña activa: logo, agente, nueva sesión, historial, ajustes
├──────────────────────────────────────┤
│        ╭ Summarize this note… ╮       │ mensaje propio: burbuja (o tarjeta / línea plana)
│        ╰ Note: Projects/X.md  ╯       │
│ 📄 Read Meetings/Kickoff.md       ✓   │ herramienta: fila compacta, detalle en tarjeta al abrir
│ ┌ 🛡 Permission requested ─────────┐  │ permiso: tarjeta con una acción primaria
│ │ Edit Website Redesign.md         │  │ (rutas relativas al vault)
│ │ [Yes] [Allow all edits] [No]     │  │
│ └──────────────────────────────────┘  │
│ La nota describe… (Markdown)          │ respuesta del agente: texto plano
├──────────────────────────────────────┤
│ Ready                 Context 4% $0.23│ línea de estado (consumo opcional)
│ ╭──────────────────────────────────╮ │
│ │ [📄 Current note ×] [✂ Selection ×]│ │ contexto arriba, dentro del cuadro
│ │ Message Claude Code…             │ │ textarea (@ notas, / comandos, ↑↓ historial)
│ │ (🛡Manual)(✦Opus)(◔Medium)(⚡)   (↑)│ │ pastillas de opciones + enviar/parar redondo
│ ╰──────────────────────────────────╯ │
└──────────────────────────────────────┘
```

**Pestañas (ADR-033):** la barra va arriba de todo, sobre la cabecera (pedido del usuario al revisarla). Cada pestaña es una `ChatSession` con su proceso. Indicador: naranja = espera permiso,
punto animado del color del agente = trabajando, rojo = error, acento = terminó sin leer. `+` abre pestaña con el agente
por defecto; `×` o clic central la cierra (termina su proceso, queda en el historial); doble clic o F2 renombra. La cabecera
(agente, ✎) actúa sobre la pestaña activa. Las pestañas ocultas siguen montadas (borrador, scroll) con `hidden`.

Las pastillas abren un panel que sale del cuadro de mensaje: lista con descripciones, medidor de niveles para el
esfuerzo, interruptor directo para opciones de dos estados y modo sin restricciones en rojo. Con
`optionsPlacement: 'header'` los selectores vuelven a la cabecera como en 0.1.x.

- **Tecnología:** Preact montado en `contentEl` del `ItemView` (desmontar en `onClose`).
  Estado: `ChatSession` expone `subscribe/getSnapshot`; hook `useSessionState()`.
- **Markdown:** componente `<Markdown>` que usa `MarkdownRenderer.render` dentro de un `Component`
  hijo (se descarga al desmontar). Mientras hace streaming: re-render con throttle de ~100 ms.
  Interceptar clics en `a.internal-link` → `workspace.openLinkText(href, sourcePath)`.
- **Tarjetas de herramientas:** icono por `kind`, título, estado (spinner/✓/✗), entrada (JSON
  formateado o comando), salida truncada con "mostrar más"; rutas clicables si están dentro del vault.
- **Pensamiento (thinking):** colapsado por defecto (ajuste `showThoughts`).
- **Compositor:** `Enter` envía / `Shift+Enter` nueva línea (o `Mod+Enter` según ajuste);
  `@` abre sugeridor de archivos (fuzzy), `/` abre slash commands; historial de prompts con `↑`.
- **Lista de mensajes:** auto-scroll solo si el usuario está al final. Las sesiones largas muestran solo el final y un
  botón «Show earlier» (T6.4); no hubo que virtualizar.
- **Sin `innerHTML`**: usar JSX/`createEl`; todo texto de agentes se trata como no confiable.
- CSS: clases con prefijo `agenthub-`, solo variables de Obsidian (`--background-secondary`,
  `--text-muted`, `--interactive-accent`, …).

### 4.12 Ajustes (`src/settings/settings.ts`)

Esquema real (Zod, plano, validado campo a campo por `migrate()`; el diseño inicial anidado se simplificó):

```ts
AgentConfig = {
  id, label, enabled, transport: 'acp' | 'claude-native' | 'codex-native',
  command, args: string[], env: Record<string, string>,   // env en texto plano: aviso en la UI
  config: Record<string, string>,  // valores iniciales de las opciones; se actualiza con lo elegido en la vista
  installCommand?, loginCommand?, builtin,
}

AgentHubSettings = {
  schemaVersion: 1, defaultAgentId, agents: AgentConfig[],
  cwdMode: 'vault' | 'active-note-folder' | 'custom', customCwd, vaultInstructions,
  includeActiveNote, sendWith: 'enter' | 'mod-enter', showThoughts, debugPanel,
  historyEnabled, maxSessions, exportFolder, idleTimeoutMin,
  maxWorkingAgents,                // turnos a la vez entre todas las pestañas/paneles; 0 = sin límite (ADR-034)
  warnEditConflicts,               // aviso si dos sesiones abiertas editan el mismo archivo (ADR-034)
  knownConfigOptions,              // opciones anunciadas por cada agente (se muestran antes de arrancar)
  resolveLoginShell, extraPath: string[],
  // Apariencia (ADR-032)
  messageStyle: 'bubbles' | 'cards' | 'plain', density: 'compact' | 'comfortable',
  chatFontSize: 'small' | 'medium' | 'large', accentColor: 'agent' | 'theme',
  optionsPlacement: 'composer' | 'header', expandToolCalls, showUsage,
}
```

- `loadSettings()` aplica migraciones por `schemaVersion` (función `migrate(raw): AgentHubSettings`, con tests).
- Los presets se fusionan con lo guardado (si llega un preset nuevo en una versión del plugin, aparece deshabilitado).

### 4.13 Comandos de Obsidian

| id (sin prefijo del plugin) | Nombre |
|---|---|
| `open-view` | Open AgentHub |
| `new-session` | New session |
| `stop-turn` | Stop current turn |
| `send-selection` | Send selection to agent (también en menú contextual del editor) |
| `ask-about-note` | Ask about current note |
| `switch-agent` | Switch agent (SuggestModal) |
| `export-session` | Export session to note |
| `open-history` | Open session history |
| `open-new-view` | Open AgentHub in a new pane |
| `new-tab` | Open a new AgentHub tab (ADR-033) |
| `close-tab` | Close the current AgentHub tab |
| `next-tab` / `previous-tab` | Go to the next / previous AgentHub tab |

Sin hotkeys por defecto (guía de Obsidian); los usuarios las asignan.

### 4.14 Manejo de errores

| Situación | Detección | Respuesta en UI |
|---|---|---|
| Binario no encontrado | `BinaryResolver` / `ENOENT` en spawn | Estado "no instalado" + comando de instalación + enlace a ajustes para ruta manual. |
| No autenticado | ACP `auth_required` / texto de error conocido / código de salida | Aviso con instrucción (`claude` → `/login`, `codex login`, `gemini` → login) o `authenticate` ACP si hay método. |
| Proceso muere | evento `exit` con código ≠ 0 durante un turno | Tarjeta de error con últimas líneas de stderr + botón "Reintentar" (relanza y reanuda). |
| Línea JSON inválida | `JSON.parse` falla | Se ignora, se registra en debug; nunca rompe la sesión. |
| Evento desconocido | tipo no mapeado | Evento `debug`; no se muestra al usuario. |
| Timeout de arranque | sin `initialize`/`init` en 30 s | Error con stderr; matar proceso. |
| Escritura fuera del vault (ACP fs) | guardia de rutas | Rechazo JSON-RPC con mensaje claro; aviso en UI. |

### 4.15 Logging y debug

- `Logger` con niveles (`error|warn|info|debug`), prefijo `[AgentHub]`, nivel según ajuste.
- Panel de debug (opcional) en la vista: eventos crudos (stdout/stderr/RPC) de la sesión actual, con botón copiar.
- Nunca registrar el contenido de variables de entorno (pueden contener secretos).

---

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

---

## 6. Estructura del repositorio

```
agenthub-plugin-obsidian/
├── plan.md                         # este documento (fuente de verdad)
├── AGENTS.md / CLAUDE.md           # punteros breves a plan.md + comandos clave
├── README.md                       # para usuarios finales
├── LICENSE
├── manifest.json                   # id, name, version, minAppVersion, isDesktopOnly: true
├── versions.json                   # versión del plugin → minAppVersion
├── package.json
├── tsconfig.json
├── esbuild.config.mjs              # bundle cjs, externals: obsidian, electron, @codemirror/*, @lezer/*, builtins
├── vitest.config.ts                # alias 'obsidian' → tests/__mocks__/obsidian.ts
├── eslint.config.mjs               # eslint-plugin-obsidianmd + typescript-eslint
├── styles.css
├── .github/workflows/ci.yml        # lint + test + build
├── .github/workflows/release.yml   # en tag: build y release con main.js, manifest.json, styles.css
├── src/                            # estructura real a 0.2.0 (difiere del diseño inicial: ADR-020, host/)
│   ├── main.ts                     # AgentHubPlugin: SettingsHost + ViewHost, comandos, registro de la vista
│   ├── constants.ts                # VIEW_TYPE, ids
│   ├── i18n/                       # index.ts (t()), en.ts, es.ts
│   ├── settings/
│   │   ├── settings.ts             # esquema Zod, defaults, presets, migrate() (incl. apariencia, ADR-032)
│   │   └── SettingsTab.ts          # secciones Agents / Sessions / Appearance / Environment (ADR-027)
│   ├── agents/AgentRegistry.ts     # presets → adaptadores, detección cacheada (ADR-020)
│   ├── core/                       # sin `obsidian`
│   │   ├── types.ts, AgentAdapter.ts, errors.ts, text.ts
│   │   ├── ChatSession.ts          # orquesta un AgentSession + estado + permisos + opciones elegidas
│   │   ├── reducer.ts              # (state, event) → state, puro
│   │   ├── SessionManager.ts       # crea/reanuda/cierra sesiones, hooks de configuración
│   │   ├── PromptBuilder.ts        # §4.8
│   │   ├── images.ts               # límites de imágenes adjuntas (ADR-035)
│   │   ├── PromptHistory.ts        # historial de prompts en memoria (T6.14)
│   │   ├── permissionModes.ts      # modos sin restricciones, config inicial (ADR-030)
│   │   ├── pathGuard.ts            # guardia de rutas del canal fs/* (ADR-014)
│   │   └── suggest.ts              # `@` y `/` en el compositor
│   ├── host/                       # puente con Obsidian: ObsidianHost.ts, NoteContext.ts, openSettings.ts
│   ├── process/                    # ProcessRunner.ts (incl. ProcessRegistry), LineDecoder.ts, ShellEnv.ts, BinaryResolver.ts
│   ├── adapters/acp/               # AcpAdapter.ts, AcpSession.ts, mapping.ts, promptBlocks.ts
│   ├── storage/                    # SessionStore.ts, sessionSchema.ts, exportToNote.ts
│   └── ui/
│       ├── AgentHubView.ts         # ItemView con pestañas (ADR-033) que monta Preact; refresh() al cambiar ajustes
│       ├── App.tsx, ViewHost.ts, hooks.ts, DangerousModeDialog.tsx, tabs.ts (indicadores de pestañas),
│       │   imageFiles.ts (leer/redimensionar imágenes, ADR-035)
│       ├── agentIdentity.ts, logos.ts, diffLines.ts, markdownBlocks.ts, renderQueue.ts
│       └── components/             # Header, ConfigOptions, OptionPicker (pastillas y panel), MessageList, Markdown,
│                                   # ToolCallCard, DiffView, PermissionCard, PlanView, NoticeItem, Composer,
│                                   # ContextChips, StatusBar, HistoryPanel, DebugPanel, AgentBadge, Icon, TabBar
├── tests/
│   ├── __mocks__/obsidian.ts, setup.ts, helpers/ (stubAgent, viewHost)
│   ├── fixtures/acp/<agente>/, fixtures/claude/, fixtures/codex/  # salidas reales grabadas
│   ├── unit/, integration/         # integración con fake-acp-agent
│   └── e2e/realAgents.test.ts      # agentes reales, solo con AGENTHUB_E2E=1
├── scripts/
│   ├── fake-acp-agent.mjs          # agente ACP simulado con escenarios (--no-resume, --broken-resume…)
│   ├── link-test-vault.mjs         # enlaza el build a test-vault/.obsidian/plugins/agenthub
│   ├── version-bump.mjs
│   └── spikes/                     # sondas de los spikes S2–S4 y saneado de fixtures
├── docs/
│   ├── spikes/S1-env.md … S5-render.md
│   ├── images/                     # capturas del README; verification-0.1.0/ = evidencias de 0.1.0
│   └── release-*.md, checklist-0.1.0.md
└── test-vault/                     # vault de desarrollo en inglés (Projects/, Meetings/; .obsidian parcialmente ignorado)
```

---

## 7. Stack y dependencias

| Área | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript `strict` | Estándar de plugins de Obsidian. |
| Bundler | esbuild (formato `cjs`, target `es2022`) | Plantilla oficial; rápido. |
| UI | Preact + JSX (`jsxImportSource: preact`) | API tipo React (familiar para agentes), ~10 KB. |
| Protocolo | `@agentclientprotocol/sdk` | Cliente ACP oficial. |
| Spawn | `cross-spawn` | Portabilidad Windows (`.cmd`, comillas). |
| Diffs | `diff` (jsdiff) | Diff unificado para la vista de cambios (Fase 6). |
| Tests | Vitest + jsdom + `@testing-library/preact` | Rápido, ESM, buen soporte TS. |
| Lint/format | ESLint (flat config) + `eslint-plugin-obsidianmd` + Prettier | Cumplir guías de revisión. |
| Node de desarrollo | ≥ 22 (instalado v26) | — |
| Gestor de paquetes | **pnpm** (12.3.4, fijado en `packageManager`) | Preferencia del usuario (ADR-013). No usar npm/yarn en el repo. |

Dependencias que **no** se usan: `node-pty` (nativo, no distribuible), React completo (tamaño),
librerías de estado pesadas.

---

## 8. Flujo de desarrollo

### 8.1 Primer setup

```bash
cd ~/workspace/agenthub-plugin-obsidian
pnpm install
pnpm build                    # genera main.js
pnpm link-vault   # symlink de main.js/manifest.json/styles.css a test-vault/.obsidian/plugins/agenthub/
```

Abrir `test-vault/` en Obsidian (abrir carpeta como vault), activar plugins de la comunidad y
habilitar AgentHub. Instalar el plugin **Hot Reload** (pjeby) en el vault de pruebas y crear
`test-vault/.obsidian/plugins/agenthub/.hotreload` para recargar en cada build.

### 8.2 Scripts de `package.json`

| Script | Acción |
|---|---|
| `dev` | esbuild en modo watch (sourcemaps inline) → salida enlazada al vault de pruebas. |
| `build` | `tsc --noEmit` + esbuild producción (minificado). |
| `test` / `test:watch` | Vitest. |
| `test:e2e` | Tests contra CLIs reales (`AGENTHUB_E2E=1`; consumen tokens: no en CI). |
| `lint` / `lint:fix` | ESLint. |
| `format` | Prettier. |
| `fake-agent` | Ejecuta `scripts/fake-acp-agent.mjs` para pruebas manuales (`pnpm fake-agent --scenario tools`). |
| `version` | `version-bump.mjs`: sincroniza `manifest.json` y `versions.json`. |

### 8.3 Depuración

- DevTools de Obsidian: `Ctrl+Shift+I`. Filtrar consola por `[AgentHub]`.
- Para simular el entorno real de lanzamiento (sin PATH de mise), arrancar Obsidian desde el lanzador
  de Hyprland, no desde una terminal.
- Agente simulado: añadir en ajustes un agente ACP personalizado con
  `command: node`, `args: [<ruta>/scripts/fake-acp-agent.mjs, --scenario, permissions]`.

### 8.4 Versionado y releases

**Esquema: SemVer `MAJOR.MINOR.PATCH`**, igual en `package.json`, `manifest.json` y `versions.json`. El **tag de git es
exactamente la versión, sin prefijo `v`** (Obsidian y BRAT lo exigen; `release.yml` falla si no coincide con el manifest).

**Mientras la versión sea 0.x (desarrollo inicial):**

| Sube | Cuándo | Ejemplos |
|---|---|---|
| **MINOR** (`0.X.0`) | Funcionalidad nueva visible para el usuario, cambio de comportamiento, cambio en el formato de ajustes o sesiones guardadas (con migración), o subida de `minAppVersion`. | Historial, exportar a nota, ajustes buscables, nuevo agente soportado. |
| **PATCH** (`0.x.Y`) | Solo arreglos, ajustes visuales, rendimiento o documentación, sin funciones nuevas. | Arreglar "Starting the agent…", animación de los puntos, color de un logo. |

**Hitos:**

- **0.1.0 — primera versión funcionalmente completa.** Fases 0–4 y 6 cerradas y verificadas en Obsidian
  (Fases 0–4 hechas; revisión manual de Fase 6 aceptada por el usuario), más:
  `CHANGELOG.md` creado, capturas en el README y la instalación desde la release probada con BRAT. Es la versión que
  sigue a 0.0.5.
- **1.0.0 — versión estable.** Aceptada en la tienda de plugins de la comunidad de Obsidian, con el formato de ajustes y
  de sesiones guardadas estable (todo cambio posterior lleva migración).

**Desde 1.0.0:** **MAJOR** si rompe compatibilidad (datos o ajustes sin migración, subida de `minAppVersion` que deja
fuera a usuarios, quitar una función), **MINOR** para funciones nuevas compatibles, **PATCH** para arreglos.

**Pre-releases** para probar con BRAT antes de publicar: `0.2.0-beta.1`, `0.2.0-beta.2`… publicadas en GitHub como
*pre-release* (no *Latest*).

**`versions.json`:** cada versión publicada se añade con su `minAppVersion`; nunca se borran entradas.

**Procedimiento** (lo ejecuta un agente; **publicar requiere la confirmación del usuario**, porque es visible para otros):

1. `main` limpio y sincronizado con `origin`; `pnpm lint && pnpm test && pnpm build` en verde.
2. Decidir MINOR o PATCH con la tabla anterior y añadir la entrada en `CHANGELOG.md` (formato *Keep a Changelog*:
   Añadido / Cambiado / Corregido).
3. Cambiar la versión en `package.json` y ejecutar `npm_package_version=X.Y.Z node scripts/version-bump.mjs`
   (actualiza `manifest.json` y `versions.json`). **No usar `pnpm version`**: crea el tag con prefijo `v`.
4. Commit `chore(release): X.Y.Z`, tag anotado `git tag -a X.Y.Z -m "AgentHub X.Y.Z"` y **push de `main` y del tag
   juntos** (`git push origin main X.Y.Z`): Obsidian lee la versión del `manifest.json` de `main`, y un manifest sin su release
   rompe instalaciones y actualizaciones (pasó brevemente con 0.1.1).
5. El workflow `release.yml` valida, compila, genera las *attestations* y crea el **borrador** con `main.js`, `manifest.json` y
   `styles.css`. Descargar los assets y comparar su SHA-256 con el build local; `gh attestation verify main.js`.
6. Con la confirmación del usuario: `gh release edit X.Y.Z --draft=false --latest`, con las notas del `CHANGELOG.md`.
   Para una beta: `gh release edit X.Y.Z-beta.N --draft=false --prerelease --latest=false`.
7. Anotar la release en la bitácora (§17) y pulsar **Check for new releases** en community.obsidian.md para que la revisión
   automática analice la versión nueva.

**Historial:** 0.0.1 (scaffolding, sin release) · 0.0.2 (tag; borrador eliminado) · 0.0.3, 0.0.4, 0.0.5, 0.1.0, 0.1.1,
0.2.0 y 0.2.1 publicadas; 0.3.0 (MINOR: pestañas, cambio del estado guardado de la vista) publicada; 0.4.0 (MINOR: límite de agentes a la vez, aviso de ediciones compartidas, reordenar pestañas; ajustes nuevos con valores por defecto) publicada; 0.4.1 (PATCH: hover y foco de las filas del historial) publicada. 0.5.0 (MINOR: imágenes pegadas, arrastradas o adjuntas en el chat, ADR-035). 0.5.1 (PATCH: scroll horizontal en paneles estrechos).
La numeración 0.0.x se preparó sin esta regla; desde aquí se aplica. 0.1.0 y 0.1.1 publicadas; 0.1.1 corrige los avisos de la revisión de la comunidad. 0.2.0 (MINOR): rediseño, ajustes de apariencia, opciones persistentes e historial de prompts.

**Tienda de la comunidad (camino a 1.0.0):** desde 2026 el envío ya no es un PR a `obsidianmd/obsidian-releases`: se hace en
[community.obsidian.md](https://community.obsidian.md) con la cuenta de Obsidian del usuario y GitHub vinculado (T6.11).
Cada release nueva pasa una revisión automática (comportamiento, lint del código y del CSS, dependencias, build reproducible,
attestations); se lanza con **Check for new releases**.

---

## 9. Estrategia de pruebas

| Nivel | Qué | Cómo |
|---|---|---|
| Unitarias | `LineDecoder`, `ShellEnv` (parseo `env -0`), `BinaryResolver`, `PromptBuilder`, `reducer`, parsers Claude/Codex, `mapping` ACP, `pathGuard`, `migrate()` de ajustes | Vitest, sin Obsidian (mock en `tests/__mocks__/obsidian.ts`). |
| Contrato | Parsers contra **fixtures grabados de CLIs reales** (una carpeta por versión del CLI) | Si un CLI cambia de formato, se graba un fixture nuevo y el test indica qué rompió. |
| Integración | `AcpAdapter` ↔ `fake-acp-agent.mjs` (texto en streaming, tool calls, permisos, plan, cancelación, crash del agente, auth requerida) | Proceso real, sin red, sin coste. |
| UI | Componentes clave (`ToolCallCard`, `PermissionCard`, `Composer`) | `@testing-library/preact` + jsdom. |
| E2E manual | Checklist en `test-vault` con cada agente real | Ver lista abajo; se ejecuta antes de cada release. |
| E2E automatizado (opcional) | Prompts mínimos contra CLIs reales | `pnpm test:e2e`, nunca en CI. |

**Checklist manual de release** (por agente disponible): abrir vista · detectar agente · enviar
prompt · streaming visible · tool call visible · permiso aprobado y denegado · cancelar a mitad ·
reanudar sesión tras reiniciar Obsidian · `@mención` · selección · export a nota · cerrar vista y
comprobar que no quedan procesos (`pgrep -fa 'claude|codex|gemini|opencode|acp'`) · tema claro/oscuro.

**Escenarios del `fake-acp-agent`** (`--scenario`): `echo`, `stream-long` (20 KB en chunks),
`tools`, `permissions`, `plan`, `slow` (para cancelar), `crash`, `auth-required`, `load-session`.

---

## 10. Seguridad y privacidad

1. **El agente tiene el poder, no el plugin.** Claude/Codex pueden editar archivos y ejecutar
   comandos con los permisos del usuario. El plugin debe: usar modos conservadores por defecto
   (Claude `manual`/permisos interactivos, Codex `read-only`), exigir confirmación para modos
   peligrosos y recomendar en el README tener el vault bajo git o con copia de seguridad.
2. **Guardia de rutas** solo cubre el canal `fs/*` de ACP (el agente puede escribir por sus propias
   herramientas): documentarlo honestamente. Bloquear `.obsidian/` por defecto en ese canal.
3. **Contenido no confiable:** toda salida de agentes se renderiza con `MarkdownRenderer` o como
   texto; nunca `innerHTML`. Los enlaces externos se abren con el comportamiento estándar de Obsidian.
4. **Secretos:** el plugin no pide API keys. Si el usuario define variables de entorno por agente,
   se avisa que `data.json` se guarda en texto plano (y puede sincronizarse). No registrar env en logs.
5. **Servidor MCP local (Fase 5):** escuchar solo en `127.0.0.1`, puerto aleatorio, token aleatorio
   por sesión exigido en cabecera/URL; apagarlo con el plugin.
6. **Sin telemetría ni red propia.** Declararlo en el README (requisito de la revisión de Obsidian),
   junto con el uso de procesos externos y la condición de solo escritorio.
7. **Imágenes (ADR-035):** las imágenes pegadas o adjuntas viajan al agente y se guardan en el historial de sesiones
   (`sessions/*.jsonl`, en base64) como el resto del mensaje; si el vault se sincroniza, también ellas. El README lo dice.
8. **Inyección de prompts desde notas:** el contenido del vault puede contener instrucciones
   maliciosas; por eso los permisos interactivos importan. Mencionarlo en el README.

---

## 11. Roadmap y tareas

> Cada tarea: ID, descripción, dependencias, criterio de aceptación (CA). Marcar `[x]` al completar.
> Las funciones futuras aún sin planificar están en [`next.md`](next.md) (las pestañas ya pasaron a la Fase 8).

### Fase 0 — Fundaciones

- [x] **T0.1** `git init`, `.gitignore` (node_modules, main.js, data.json, test-vault/.obsidian/*
  excepto lo necesario), licencia (por decidir, §14), README mínimo. *CA:* repo con primer commit.
- [x] **T0.2** Scaffolding: `package.json`, `tsconfig.json` (strict, `jsx: react-jsx`,
  `jsxImportSource: preact`), `esbuild.config.mjs`, `manifest.json` (`isDesktopOnly: true`,
  `minAppVersion: 1.8.7`), `versions.json`, `styles.css`. *CA:* `pnpm build` genera `main.js`.
- [x] **T0.3** Calidad: ESLint (`eslint-plugin-obsidianmd`), Prettier, Vitest con mock de `obsidian`,
  un test trivial. *CA:* `pnpm lint && pnpm test` en verde.
- [x] **T0.4** `test-vault/` con notas de ejemplo + `scripts/link-test-vault.mjs` + script `dev`.
  *CA:* el plugin aparece y se habilita en el vault de pruebas.
- [x] **T0.5** Vista lateral vacía: `registerView`, icono de cinta, comando `open-view`,
  activación en hoja derecha, `getState/setState`, montaje/desmontaje de Preact con un "Hola".
  *CA:* abrir/cerrar la vista repetidas veces sin errores ni fugas; se restaura al reiniciar.
- [x] **T0.6** `AGENTS.md` y `CLAUDE.md` (breves: "lee plan.md §0", comandos de build/test).
- [x] **T0.7** CI de GitHub Actions (lint + test + build) — si hay remoto. *CA:* pipeline verde.

**Criterio de salida F0:** plugin cargable con sidebar vacío; lint/test/build verdes.

### Fase 1 — Spikes de validación (pueden ir en paralelo con F0; resultado en `docs/spikes/`)

- [x] **S1 Entorno** — Desde la consola de DevTools de Obsidian lanzado desde el lanzador de
  Hyprland: `require('child_process').spawnSync('claude',['--version'])` con `process.env` vs con el
  entorno de `$SHELL -ilc 'env -0'`. Medir el tiempo del shell de login. Revisar variables `ELECTRON_*`.
  *CA:* estrategia de §4.7 confirmada o ajustada.
- [x] **S2 ACP** — Script Node mínimo con `@agentclientprotocol/sdk` que haga `initialize` →
  `session/new` → `prompt` ("lee README.md y crea notas/prueba.md") contra `gemini --acp`,
  `opencode acp`, `claude-agent-acp` y `codex-acp`. Grabar todo el tráfico JSON-RPC en
  `tests/fixtures/acp/<agente>/`. Confirmar: capacidades, `authMethods`, uso de `fs/*` del cliente,
  forma de `request_permission`, `loadSession`, modos/modelos, y que Claude/Codex reutilizan el login
  existente (suscripción) sin API key. *CA:* §3.3 y §5.1 actualizados sin ⚠️ críticos.
- [x] **S3 Claude directo** — Grabar fixtures `stream-json`: texto simple, con `Read`, con edición
  denegada (`--permission-prompts none`), con `--resume`, con `--include-partial-messages`.
  Confirmar si `-p` lee el prompt de stdin y si `--verbose` es obligatorio. *CA:* §3.4/§5.2 confirmados.
- [x] **S4 Codex directo** — Grabar fixtures `exec --json` fuera de un repo git
  (`--skip-git-repo-check`), con comando, con `file_change`, y `exec resume` con prompt por stdin.
  *CA:* §3.5/§5.3 confirmados.
- [x] **S5 Render** — En el vault de pruebas, medir `MarkdownRenderer.render` re-renderizando un
  mensaje de 20 KB cada 100 ms. *CA:* decidir throttle y si hace falta render incremental.

### Fase 2 — Núcleo + ACP (MVP)

- [x] **T2.1** `core/types.ts` y `core/AgentAdapter.ts` según §4.3–4.4. *CA:* compila; sin `any`.
- [x] **T2.2** `ShellEnv` + `BinaryResolver` + tests. *Dep:* S1. *CA:* resuelve `claude`, `codex`,
  `gemini`, `opencode`, `npx` en este equipo lanzando Obsidian desde el lanzador gráfico.
- [x] **T2.3** `ProcessRunner` + `ProcessRegistry` + `LineDecoder` + tests (con scripts de prueba que
  emiten JSONL partido, UTF-8 multibyte, líneas enormes, y que ignoran SIGTERM).
  *CA:* ningún proceso huérfano tras `dispose()`/`onunload`.
- [x] **T2.4** `scripts/fake-acp-agent.mjs` con los escenarios de §9. *Dep:* S2.
- [x] **T2.5** `AcpAdapter` (§5.1) + `mapping.ts` + `pathGuard.ts` + tests de integración con el fake.
  *Dep:* T2.1–T2.4. *CA:* todos los escenarios del fake pasan.
- [x] **T2.6** `reducer.ts` + `ChatSession` + `SessionManager` (sin persistencia aún) + tests con fixtures.
- [x] **T2.7** `AgentRegistry` + presets (§5.4) + `SettingsTab` (lista de agentes, estado de
  detección, editar comando/args/env, agente por defecto, agentes personalizados). Los ajustes leídos de `data.json`
  se validan con un esquema (Zod, ya incluido por el SDK de ACP, o Valibot) dentro de `migrate()`. *CA:* RF-02, RF-15, RF-20.
- [x] **T2.8** UI: `Header` (selector de agente + estado), `MessageList`, `AssistantMessage` +
  `Markdown` (throttle), `ToolCallCard`, `PermissionCard`, `PlanView`, `Composer` (enviar/detener),
  `StatusBar`, `DebugPanel`. `onunload` llama a `ProcessRegistry.killAll()` (con test). Accesibilidad (skill
  `accessibility`): todo control es un `<button>`/`<select>`/`<textarea>` nativo con etiqueta, foco visible, objetivos
  ≥ 24×24 px, operable solo con teclado, avisos de estado y streaming en región `aria-live="polite"`, sin animaciones
  sin `prefers-reduced-motion`. Dirección visual según ADR-018. *CA:* RF-04, RF-05, RF-06 (ACP), RF-07, RF-19.
- [x] **T2.9** Selector de modo/modelo cuando el agente los expone. *CA:* RF-12 para ACP.
- [x] **T2.10** Manejo de errores de §4.14 (binario faltante, auth, crash, timeout).

**Criterio de salida F2 (MVP):** desde el sidebar, con **Claude (ACP)** y **Codex (ACP)** —y Gemini/OpenCode
si están disponibles—: enviar un prompt, ver la respuesta en streaming renderizada, ver tool calls,
aprobar y denegar un permiso, cancelar un turno; al cerrar la vista o desactivar el plugin no quedan procesos.

### Fase 3 — Integración con Obsidian (contexto)

- [x] **T3.1** `PromptBuilder` (§4.8) + tests (ACP y texto). *CA:* RF-08 (lógica).
- [x] **T3.2** Chips de contexto: nota activa (toggle, sigue a la hoja activa), selección. *CA:* RF-08 (UI).
- [x] **T3.3** Sugeridor `@` de archivos (fuzzy con `prepareFuzzySearch`, carpetas incluidas).
- [x] **T3.4** Sugeridor `/` alimentado por `available_commands_update`. *CA:* RF-09.
- [x] **T3.5** Comandos (§4.13) + entrada en menú contextual del editor ("Enviar selección a AgentHub"). *CA:* RF-14.
- [x] **T3.6** Rutas y wikilinks clicables en mensajes y tool cards. *CA:* RF-17.
- [x] **T3.7** Modos de directorio de trabajo + instrucciones del vault configurables. *(Hecho: raíz del vault, carpeta de la
  nota actual y carpeta personalizada + instrucciones con `{{configDir}}`.)* *CA:* RF-16.

### Fase 4 — Persistencia e historial

- [x] **T4.1** `SessionStore` (índice + JSONL, debounce, retención) + tests. Guardado conectado a
  `SessionManager` y cierre de vistas/plugin; ajustes `historyEnabled` y `maxSessions` (defecto 200).
  Verificado en Obsidian 1.13.7 con agente simulado, dos turnos, cierre y controles de ajustes.
- [x] **T4.2** Panel de historial (listar, buscar, renombrar, borrar, reanudar). Reanudar con
  `loadSession` si existe; si no, modo lectura + "Continuar en sesión nueva". *CA:* RF-10.
- [x] **T4.3** Restaurar la sesión mostrada en cada vista al reiniciar Obsidian (`getState/setState`). *CA:* RF-01.
- [x] **T4.4** Export de sesión a nota (§4.10). *CA:* nota válida con callouts plegables.
- [x] **T4.5** Múltiples vistas/sesiones simultáneas + reaper de inactividad. *CA:* RF-11; procesos liberados tras `idleTimeoutMin`.

### Fase 5 — Opcional / condicional: adaptadores directos (sin adaptadores ACP)

> **No se implementa salvo que ocurra un disparador (ADR-025).** ACP ya cubre Claude, Codex y OpenCode con permisos
> interactivos, streaming, reanudación y opciones. El trabajo previo (spikes S3/S4, fixtures en `tests/fixtures/claude`
> y `tests/fixtures/codex`, §5.2–5.3) queda listo para retomarla. **Disparadores:**
> 1. El adaptador ACP de Claude o Codex se rompe, se abandona o queda muy atrás respecto al CLI.
> 2. Hace falta funcionar sin Node/npm (`npx` no disponible).
> 3. Se necesita una función del CLI que ACP no expone.

- [ ] **T5.1** `ClaudeNativeAdapter` + parser + tests con fixtures S3. *Dep:* S3.
- [ ] **T5.2** `CodexNativeAdapter` + parser + tests con fixtures S4. *Dep:* S4.
- [ ] **T5.3** UX de permisos en modo directo: selector de modo de Claude, denegaciones con
  "Permitir y reintentar", selector de sandbox de Codex con confirmación para modos peligrosos.
- [x] **T5.4** Uso/coste en la barra de estado (Claude `result`, Codex `turn.completed`, ACP si lo reporta). *CA:* RF-13.
- [ ] **T5.5** *(Opcional)* `bridge/`: servidor MCP HTTP local (127.0.0.1 + token) con herramienta
  `approve` (para `--permission-prompt-tool`) y herramientas del vault (`get_active_note`,
  `search_vault`, `open_note`), inyectado en ACP (`mcpServers`) y en Claude (`--mcp-config`).
- [ ] **T5.6** *(Opcional)* Adaptador `codex app-server` (tipos con `generate-ts`) para aprobaciones
  interactivas sin `codex-acp`.

### Fase 6 — Pulido y publicación

- [x] **T6.1** Vista de diffs (jsdiff) para `ToolContent.diff` y `file_change`; botón "abrir archivo". *CA:* RF-18.
- [x] **T6.2** i18n es/en completo; textos en *sentence case*.
- [x] **T6.3** Accesibilidad y revisión de temas: pruebas automáticas/nativas registradas; el usuario aprueba el cierre manual general el 2026-10-02. Evidencias y límites en `docs/checklist-0.1.0.md`; esa aprobación no se presenta como prueba automática de lector de pantalla o alto contraste.
- [x] **T6.4** Rendimiento: virtualización de la lista si S5/uso real lo exige; medir carga del plugin.
- [x] **T6.5** README completo (capturas, requisitos, instalación de adaptadores, seguridad, privacidad).
- [x] **T6.7** Pestaña de ajustes con la API declarativa `getSettingDefinitions()` (buscable en Obsidian 1.13+) y `display()` como respaldo para versiones anteriores; `minAppVersion` se mantiene en 1.8.7 (ADR-027).
- [x] **T6.6** Release **0.1.0 publicada como Latest** con autorización del usuario, workflow correcto y tres assets verificados. BRAT 2.2.0: instalación limpia y actualización 0.0.5 → 0.1.0 correctas, ajustes/transcripts conservados. Revisión manual aceptada; comunidad opcional.

- [x] **T6.8** Confirmación explícita y aviso rojo para modos sin restricciones; Codex ACP en solo lectura por defecto (ADR-030).
- [x] **T6.9** Mostrar y cambiar modelo/modo de agentes ACP que anuncian `models`/`modes` sin `configOptions` (Gemini 0.62); no fabricar opciones de esfuerzo ausentes (ADR-031).

- [x] **T6.10** Mensajes del usuario con etiqueta «Tú»/«You», tarjeta de fondo propio, borde de acento y espacio entre turnos; estilos del tema de Obsidian y texto seleccionable con el mouse.

- [~] **T6.11** Envío al directorio de la comunidad (Q3). Hecho: id `agenthub` libre, LICENSE, manifest y release válidos, divulgaciones del README según las *Developer policies*; el usuario envió y publicó la entrada (live) el 2026-10-02; revisión automática de 0.1.0 completada **sin errores** (build reproducido byte a byte). Avisos corregidos en 0.1.1: timers de `window` en `AcpSession`/`ProcessRunner`/`SessionStore`, `clip-path` sustituido, attestations de los assets en `release.yml`. Se mantienen, por diseño y divulgados: acceso `fs` y `child_process` (núcleo del plugin), enumeración del vault (sugerencias `@`) y `display()` (ADR-027). 0.1.1 publicada como Latest el 2026-10-02. Falta: relanzar la revisión con 0.1.1 y verificar que aparece e instala desde Obsidian. *CA:* plugin instalable desde Obsidian.

- [x] **T6.12** Pulido visual inspirado en shadcn/ui y en las apps oficiales de los agentes, solo con variables de Obsidian (ADR-018, ADR-032): tokens (`--agenthub-accent`, borde, superficie, anillo de foco, espaciado, tamaño de texto); mensajes propios como burbujas; razonamiento con chevron; herramientas y planes como tarjetas suaves; permiso como tarjeta con una sola acción primaria y rechazos en rojo de contorno; cuadro de mensaje redondeado con sombra, contexto arriba y botón de enviar redondo solo con icono; opciones del agente como pastillas con icono que abren un panel que sale del cuadro de mensaje (lista con descripciones, o medidor de niveles para el esfuerzo; modo sin restricciones en rojo); logo del agente en el estado vacío. Revisado por el usuario en Obsidian durante la sesión (capturas del README).
- [x] **T6.13** Ajustes de apariencia (sección *Apariencia*, ADR-032): estilo de mensajes (burbujas/tarjetas/sin formato), densidad, tamaño del texto, color de acento (agente/tema), ubicación de las opciones (cuadro de mensaje por defecto/cabecera), desplegar herramientas y mostrar consumo. Se aplican al momento en las vistas abiertas. Las opciones del agente que el usuario cambia (modo, modelo, esfuerzo…) se guardan como valores iniciales del agente (`AgentConfig.config`) cuando surten efecto; los modos sin restricciones se siguen confirmando en cada inicio (ADR-030). Revisado por el usuario en Obsidian.
- [x] **T6.14** Historial de prompts en el cuadro de mensaje: ↑ en la primera línea recupera el prompt anterior y ↓ en la última avanza hasta volver al borrador sin enviar; editar un prompt recuperado lo convierte en el nuevo borrador. Solo en memoria (`PromptHistory`, compartido por las vistas, máx. 100, sin duplicados consecutivos): se vacía al reiniciar Obsidian, a pedido del usuario. *CA:* tests de navegación y de texto multilínea.

### Fase 8 — Varias conversaciones en una vista (0.3.0)

Origen: [`next.md`](next.md) §1. Decisión en ADR-033.

- [x] **T8.1** Pestañas en `AgentHubView`: lista de `ChatSession` y pestaña activa; nueva/cerrar/seleccionar/ciclar;
  la cabecera reemplaza la sesión solo en la pestaña activa; el historial abre en pestaña nueva (o en la activa si está
  vacía); cerrar una pestaña termina su proceso salvo que otra vista la muestre. *CA:* dos pestañas con agentes distintos
  trabajan a la vez y cambiar de pestaña no interrumpe a ninguna (`tests/unit/Tabs.test.tsx`).
- [x] **T8.2** Persistencia: `getState/setState` guardan `{tabs, activeTab}` (y `sessionId` = activa, para volver a 0.2.x);
  `parseViewState` acepta el `{sessionId}` de 0.2.x. Solo la pestaña visible arranca su agente al restaurar. *CA:* al
  reiniciar vuelven las mismas pestañas con su historial.
- [x] **T8.3** `TabBar` e indicadores (`TabActivity`): permiso, trabajando, error, terminado sin leer; `Notice` de 10 s
  cuando una pestaña oculta pide permiso (nunca se aprueba nada solo); el diálogo de modo sin restricciones nombra la
  pestaña (`DangerousModeRequest.sessionTitle`); renombrar con doble clic/F2 (`ChatSession.rename`, también desde el
  historial). *CA:* auditoría axe del `TabBar` sin violaciones.
- [x] **T8.4** Comandos `new-tab`, `close-tab`, `next-tab`, `previous-tab` sin atajos; i18n es/en; README y CHANGELOG.
- [x] **T8.5** Revisión del usuario en Obsidian: la barra va arriba de todo, sobre la cabecera, y la pestaña activa queda a la
  vista al cambiar de pestaña (antes el scroll horizontal volvía al inicio). Aprobada por el usuario («ya funciona»).
- [x] **T8.6** Cierre de lo abierto en `next.md` (ADR-034): `TurnLimiter` (núcleo) compartido por todas las sesiones con el
  ajuste `maxWorkingAgents` (0 = sin límite): los turnos de más esperan en orden con estado `queued` («Esperando a que
  termine otra pestaña…», punto hueco en la pestaña); Detener o cerrar sacan el mensaje de la cola sin enviarlo.
  `EditConflictWatcher` (núcleo) avisa con un `Notice` cuando una sesión abierta edita (`edit`/`delete`/`move`, por
  `locations` o diffs) un archivo que otra sesión abierta ya editó; una vez por archivo y par, ajuste `warnEditConflicts`;
  las ediciones de transcripts reabiertos cuentan pero no avisan solas. Reordenar pestañas arrastrando o con
  Ctrl/Cmd+Shift+←/→ (`AgentHubView.moveTab`). *CA:* `TurnLimiter.test.ts`, `EditConflicts.test.ts`, `Tabs.test.tsx`.

### Fase 9 — Imágenes en el chat (0.5.0)

Origen: pedido del usuario (2026-10-05). Decisión en ADR-035. RF-26.

- [x] **T9.1** Núcleo y adaptador: `src/core/images.ts` (formatos PNG/JPEG/GIF/WebP, máx. 3,75 MB por archivo para no
  pasar de 5 MB en base64, lado máximo 8000 px, 10 imágenes por mensaje); `buildPrompt({ images })` pone las imágenes tras
  el texto y omite el bloque de texto vacío si solo hay imágenes; `ChatSession.send` quita las imágenes si el agente no
  anuncia `promptCapabilities.image` y deja el aviso `imagesNotSent` (si no queda nada, la sesión vuelve a `idle`). El
  bloque `image` ya existía en el modelo, el esquema y `toContentBlocks`. Esquema: se añade también `contextNotRestored`,
  que faltaba (un transcript con ese aviso perdía el registro al leerse). *CA:* `tests/unit/Images.test.tsx`.
- [x] **T9.2** UI: pegar (si el portapapeles trae también texto plano se pega el texto, como hojas de cálculo), arrastrar
  archivos al cuadro de mensaje (borde de acento al arrastrar) y botón *Adjuntar imágenes* con selector de archivos;
  `src/ui/imageFiles.ts` lee en base64 y redibuja en un canvas lo que excede los límites (lado 2048 px, PNG o JPEG sobre
  blanco) o los formatos que los agentes no aceptan (BMP…); los rechazos salen en un `Notice`. Miniaturas con botón de
  quitar sobre el texto; se puede enviar solo imágenes; la conversación las muestra y un clic las amplía; la exportación
  a nota las lista sin incrustarlas. i18n es/en; README y CHANGELOG. *CA:* `Images.test.tsx` y auditoría axe del
  cuadro de mensaje con imágenes (`a11y.test.tsx`).
- [x] **T9.3** Revisión del usuario en Obsidian: pegar una captura, arrastrar una imagen y adjuntar con el botón; enviarlas
  a Claude Code y a Codex y comprobar que el agente las describe; imagen grande (> 3,75 MB) reducida; reabrir la sesión
  desde el historial con las imágenes. Aprobada por el usuario el 2026-10-05 («funciona de pana»). Publicada en 0.5.0.

### Fase 7 — Descartada: modo terminal

**Fuera del alcance por decisión del usuario (ADR-029).** Estas tareas quedan canceladas y no cuentan como pendientes.

- **T7.1 — Cancelada:** spike de PTY sin módulos nativos y redimensionado de la terminal.
- **T7.2 — Cancelada:** vista con `@xterm/xterm` que ejecuta la TUI original del agente (RF-21).

---

## 12. Decisiones de arquitectura (ADR)

| ID | Decisión | Motivo | Alternativas descartadas | Estado |
|---|---|---|---|---|
| ADR-001 | Plugin solo escritorio, TypeScript + esbuild, estructura de `obsidian-sample-plugin`. | Necesita `child_process`; estándar del ecosistema. | Móvil (imposible lanzar procesos). | Aceptada |
| ADR-002 | **ACP como protocolo principal** de integración; el modelo de dominio interno replica ACP. | Un solo cliente cubre Claude, Codex, Gemini, OpenCode y futuros agentes; permisos interactivos, streaming, tool calls y diffs estandarizados. | Un adaptador ad-hoc por agente como única vía (más código, permisos pobres). | Aceptada |
| ADR-003 | Adaptadores directos (Claude `stream-json`, Codex `exec --json`) como vía secundaria en Fase 5. | Funcionan con los binarios ya instalados, sin adaptadores npm extra. | Hacerlos el MVP (peores permisos; dos parsers frágiles antes de tener núcleo). | Aceptada |
| ADR-004 | UI con Preact + `MarkdownRenderer` de Obsidian; prohibido `innerHTML`. | Ergonomía tipo React con bundle pequeño; render nativo de Markdown (wikilinks, temas). | React (tamaño), Svelte (menos familiar para agentes), DOM manual (inmantenible). | Aceptada |
| ADR-005 | Un proceso de agente por sesión activa; reaper de inactividad; matar árbol de procesos al cerrar. | Aislamiento de fallos, `cwd` por sesión, sin huérfanos. | Una conexión ACP compartida multiplexando sesiones (fallo de una afecta a todas). | Aceptada |
| ADR-006 | Resolver el entorno con el shell de login + rutas comunes + ruta manual. | Agentes instalados con mise/nvm no están en el PATH de apps GUI. | Exigir al usuario rutas absolutas (mala UX). | Aceptada |
| ADR-007 | Transcripts locales en JSONL dentro de la carpeta del plugin; la reanudación del contexto la hace el agente. | Mostrar historial sin depender de formatos internos de cada agente. | Leer los logs nativos de `~/.claude` / `~/.codex` (frágil, privado). | Aceptada |
| ADR-008 | Sin módulos nativos (`node-pty`); modo terminal pospuesto a Fase 7. | Los plugins de la comunidad solo distribuyen JS. | `node-pty` empaquetado (ABI de Electron, no distribuible). | Matizada por ADR-029: modo terminal descartado; se mantiene la exclusión de módulos nativos |
| ADR-009 | Las escrituras `fs/write_text_file` de ACP pasan por la Vault API con guardia de rutas. | Obsidian refresca editores abiertos; control de `.obsidian/`. | Escritura directa con `fs` (desincroniza editores). | Aceptada |
| ADR-010 | Fijar versiones de adaptadores ACP en los presets. | Los adaptadores evolucionan rápido (p. ej. renombres de paquetes). | `@latest` (roturas silenciosas). | Aceptada |
| ADR-011 | `minAppVersion` 1.8.7 (antes 1.7.2). | `getLanguage()` (i18n) existe desde 1.8.7; el entorno usa 1.13.7. | Leer el idioma de `localStorage` (no documentado). | Aceptada |
| ADR-012 | TypeScript 6.0.x (no 7) y ESLint 9 (no 10); `strictPeerDependencies: false` en `pnpm-workspace.yaml`. | `typescript-eslint` 8.71 exige TS < 6.1; `eslint-plugin-obsidianmd` 0.4.2 exige ESLint ≥ 9 y declara `obsidian@1.8.7` como peer exacto. Vitest 5 necesita `vite` explícito. | Seguir los peers exactos (tipos de Obsidian antiguos). | Aceptada |
| ADR-013 | **pnpm** como gestor de paquetes; config en `pnpm-workspace.yaml` (`allowBuilds: esbuild`, `strictPeerDependencies: false`); lockfile `pnpm-lock.yaml`. | Preferencia del usuario. | npm (usado al inicio, reemplazado). | Aceptada |
| ADR-014 | Los agentes escriben directamente en disco (S2); el refresco de editores depende del watcher de Obsidian. Se siguen anunciando y sirviendo `fs/*` (con guardia), pero la protección real del vault es el **modo de permisos** del agente. | Ningún agente probado usa `fs/*` del cliente. | Forzar escrituras por `fs/*` (no está en nuestra mano). | Aceptada (matiza ADR-009) |
| ADR-015 | Modo y modelo se exponen en la UI a partir de `configOptions` (`session/set_config_option`); `modes`/`models` solo como respaldo. | Es lo único común a Claude, Codex y OpenCode. | Selectores separados por `modes`/`models` (OpenCode quedaría sin selector). | Aceptada |
| ADR-016 | Usar el builder `acp.client()` del SDK 1.6, no `ClientSideConnection`. | `ClientSideConnection` está deprecado. | API deprecada. | Aceptada |
| ADR-017 | `PATH`: `process.env` primero; shell de login solo como respaldo asíncrono y cacheado, añadiendo rutas al final. | S1: en este equipo `process.env` ya encuentra todo; el shell cuesta ≈1,4 s y cambia el binario elegido. | Fusionar siempre el entorno del shell (lento y cambia binarios). | Aceptada (matiza ADR-006) |
| ADR-018 | La skill `frontend-design` se aplica solo en su principio (dirección visual intencional y coherente), no en su estética "audaz" (fuentes propias, fondos con texturas, paletas propias). | Las guías de Obsidian exigen respetar el tema del usuario: solo variables CSS de Obsidian, sin fuentes impuestas. | Seguir la skill al pie de la letra (rompería temas y la revisión de la comunidad). | Aceptada |
| ADR-019 | La pestaña de ajustes usa `PluginSettingTab.display()` (deprecado en Obsidian 1.13) en lugar de la API declarativa `getSettingDefinitions()`. | La API nueva exige `minAppVersion` ≥ 1.13; mantener 1.8.7 de momento. El lint lo marca como aviso. | Subir ya `minAppVersion` a 1.13 (excluye usuarios en versiones anteriores). | Reemplazada por ADR-027 |
| ADR-020 | `AgentRegistry` vive en `src/agents/` (capa de composición), no en `src/core/`. | Construye adaptadores concretos; en `core/` invertiría la dependencia núcleo → adaptadores. | `core/AgentRegistry.ts` (plan original). | Aceptada |
| ADR-021 | `SessionStore` recibe un subconjunto estructural de `DataAdapter` y guarda snapshots JSONL completos, serializados, con `.tmp` y respaldo `.bak` recuperable. El núcleo lo conecta mediante `SessionManager.onCreate`. | Herramientas y planes cambian después de insertarse; snapshots evitan duplicados. Verificado en Obsidian 1.13.7: `rename()` rechaza destinos existentes. El respaldo conserva la versión anterior durante el reemplazo. | Append de cada snapshot (duplicación); usar `fs.rename` directamente (acoplamiento a disco); asumir que `DataAdapter.rename` sobrescribe. | Aceptada |
| ADR-022 | Reabrir una sesión guardada usa `session/resume` si el agente lo anuncia; si no, `session/load` ignorando la repetición del historial (ya está en el transcript local); si no, sesión nueva con aviso `contextNotRestored`. | El transcript local es la fuente de lo que se muestra; el agente solo necesita recuperar su contexto. S2: Claude, Codex y OpenCode anuncian `resume`. | Usar siempre `session/load` (duplicaría el historial). | Aceptada |
| ADR-023 | Identidad por agente: monograma + color de la paleta del tema (`--color-orange`, `--color-green`…): Claude naranja «C», Codex verde «Cx», Gemini azul «G», OpenCode morado «O»; los personalizados, color estable por hash del id e iniciales. Sin logotipos de marca. | Distinguir de un vistazo qué agente se usa, respetando temas claro/oscuro (ADR-018). | Logotipos oficiales (restricciones de marca, no se adaptan al tema). | Matizada por ADR-028 (los agentes conocidos usan su logo) |
| ADR-024 | El agente arranca en segundo plano al mostrar una sesión (no con el primer mensaje), para que modo/modelo/esfuerzo se elijan **antes** de conversar. Mientras arranca se muestran las opciones que anunció al iniciar la última vez (`knownConfigOptions` en `data.json`, solo valores iniciales: un modo peligroso nunca queda fijado); un cambio hecho antes o durante el arranque se aplica al iniciar. Arrancar no bloquea el envío. | Pedido del usuario: configurar antes de iniciar la conversación. | Arranque perezoso (las opciones no aparecían hasta el primer mensaje). | Aceptada — revisar consumo con el reaper (T4.5) |
| ADR-025 | La Fase 5 (adaptadores directos `stream-json` / `exec --json`) pasa a **opcional y condicional**, con tres disparadores (adaptador ACP roto o abandonado, entorno sin Node/npm, función del CLI ausente en ACP). | ACP ya da todo lo necesario con mejores permisos y streaming; dos formatos extra que mantener no compensan hoy. Se conserva la investigación (S3/S4). | Implementarla ya (coste de una fase para una segunda vía a lo mismo); borrarla (perder el trabajo previo y la salida de emergencia). | Aceptada (decidido con el usuario) |
| ADR-026 | El Markdown de los agentes se renderiza **por bloques** (párrafos fuera de bloques de código) y con una **cola de ≤ 8 ms por tarea**. | S5 en Obsidian real: renderizar el mensaje entero bloqueaba la UI hasta 603 ms; con bloques + cola, 0 tareas largas y 33 ms de hueco máximo. | Renderizar entero con throttle (bloqueos visibles); texto plano durante el streaming (pierde formato mientras escribe). | Aceptada |
| ADR-027 | Ajustes definidos una vez como secciones y filas: `getSettingDefinitions()` los entrega a Obsidian 1.13+ (aparecen en su buscador; las filas de detalle por agente con `searchable: false`) y `display()` dibuja las mismas filas en versiones anteriores; cambios de estructura con `update()` (1.13+) o `display()`. **`minAppVersion` sigue en 1.8.7.** | La documentación de 1.13 indica que `display()` no se llama si hay definiciones y recomienda conservarlo para versiones antiguas: no hace falta excluir usuarios. Verificado en Obsidian 1.13.7 real. | Subir `minAppVersion` a 1.13 (excluye usuarios sin necesidad). | Aceptada (reemplaza ADR-019) |
| ADR-028 | Los agentes conocidos (Claude, Codex, Gemini, OpenCode) se identifican con su **logo original en su color**; los personalizados conservan el monograma de color (ADR-023). SVG de Lobe Icons (MIT) convertidos a datos (`src/ui/logos.ts`) y dibujados con Preact sin `innerHTML`, con ids de degradado únicos por instancia. | Pedido del usuario; reconocer cada herramienta de un vistazo. Uso solo identificativo de las marcas (habitual en integraciones). OpenAI/Codex no está en Simple Icons; Lobe Icons tiene los cuatro. | Monogramas (menos reconocibles); Simple Icons (sin Codex). | Aceptada |
| ADR-029 | La Fase 7 (modo terminal), T7.1, T7.2 y RF-21 quedan fuera del alcance y cancelados. | El usuario decidió que no realizará la Fase 7. | Mantener el modo terminal como tarea opcional pendiente. | Aceptada (decidido por el usuario; matiza ADR-008) |
| ADR-030 | Codex ACP usa `read-only` por defecto; las opciones explícitas prevalecen. Confirmación por activación/inicio/reanudación de los cuatro modos sin restricciones y distintivo rojo; rechazo o cierre bloquean el cambio. | Resolver Q8 y cumplir §10 y §4.9 también al restaurar sesiones. | Mantener Auto review como valor implícito; confiar solo en el selector. | Aceptada; resuelve Q8 |
| ADR-031 | Normalizar `modes`/`models` ACP antiguos a `ConfigOption` cuando falta su equivalente moderno. Cambios mediante `session/set_mode` y `session/set_model`; `configOptions` tiene prioridad. | Gemini 0.62 real anuncia estas opciones y no ofrece esfuerzo por ACP. | Inventar una lista de modelos/esfuerzos; usar `set_config_option` con agentes que no lo implementan. | Aceptada; completa ADR-015 |
| ADR-034 | Límite de turnos simultáneos y aviso de ediciones compartidas en el núcleo, comunes a todas las vistas y pestañas: `SessionManager` posee un `TurnLimiter` (FIFO, límite leído en cada petición, 0 = sin límite) que `ChatSession.send` usa tras arrancar el agente (arrancar no cuenta); el estado `queued` solo aparece si hay que esperar y cuenta como ocupado. `EditConflictWatcher` sigue a cada sesión creada y avisa sin bloquear. | Cerrar los riesgos de `next.md` §1 (consumo de varios agentes, conflictos de edición) sin cambiar el modelo de permisos. | Rechazar el mensaje al superar el límite (pierde el texto); bloquear la segunda edición (los agentes que escriben solos, ADR-014, no pasan por AgentHub); detectar conflictos solo dentro de una vista. | Aceptada |
| ADR-035 | Imágenes en el prompt como bloques `image` de ACP (base64 + `mimeType`), sin escribir archivos en el vault. Se adjuntan al pegar, arrastrar o con un botón; los límites viven en el núcleo (`src/core/images.ts`) y la lectura/redimensionado en la UI (`src/ui/imageFiles.ts`, canvas solo si hace falta). Se guardan en el JSONL del historial como el resto del mensaje (los límites acotan el tamaño) y la exportación a nota las lista sin incrustarlas. Si el agente no anuncia `promptCapabilities.image`, `ChatSession` las quita y lo dice en la conversación en vez de descartarlas en silencio. Un pegado que trae texto plano se trata como texto. | RF-26: pedir sobre capturas sin guardarlas a mano en el vault. Los cuatro agentes incluidos anuncian `image: true` en sus fixtures ACP. | Guardar las imágenes como adjuntos del vault y mandar `resource_link` (ensucia el vault, no todos los agentes leen imágenes por ruta); no guardarlas en el historial (al reabrir se perdería qué se preguntó); redimensionar siempre (pierde detalle que el modelo puede usar). | Aceptada |
| ADR-033 | Pestañas en la vista: `AgentHubView` guarda una lista de `ChatSession` (una por pestaña, cada una con su proceso, ADR-005) y la activa; el núcleo no cambia salvo `ChatSession.rename()` y `sessionTitle` en la petición de modo sin restricciones. Todas las pestañas quedan montadas y las ocultas llevan `hidden` (conservan borrador y scroll); `TabActivity` vigila estado y título de cada una para los indicadores y el `Notice` de permisos en segundo plano. Estado de vista `{tabs, activeTab, sessionId}`, compatible con 0.2.x; al restaurar, solo la pestaña visible arranca su agente y el reaper (T4.5) libera las olvidadas. Sin límite de pestañas trabajando a la vez por ahora. *Open AgentHub in a new pane* se mantiene. | Varias conversaciones a la vez sin ocupar más paneles (RF-25, `next.md` §1). | Solo varias vistas (RF-11: ocupa espacio, hay que cambiar de panel para ver quién terminó); montar solo la pestaña activa (pierde borrador y scroll); un `SessionManager` por vista. | Aceptada |
| ADR-032 | Apariencia configurable: ajustes planos validados campo a campo (`messageStyle`, `density`, `chatFontSize`, `accentColor`, `optionsPlacement`, `expandToolCalls`, `showUsage`) que la vista expone como atributos `data-*` en `.agenthub-app`; `styles.css` solo cambia tokens propios derivados de variables de Obsidian. Formas de componentes según shadcn/ui y las apps oficiales, sin copiar a Claudian: las opciones del agente son pastillas con panel propio (lista con descripciones o medidor de niveles) y se ubican por defecto en el cuadro de mensaje. Amplía ADR-018. | Personalización sin romper temas ni la revisión de la comunidad; menos selectores nativos en el sidebar. | Temas CSS propios (rompen temas de Obsidian); variables CSS editables por el usuario (difícil de mantener); copiar el selector combinado de Claudian. | Aceptada |

---

## 13. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| ACP y sus adaptadores cambian rápido (SDK 1.x, adaptadores renombrados en 2026) | Alta | Medio | Versiones fijadas (ADR-010), tests de contrato con fixtures, negociación de `protocolVersion`, mapeo tolerante. |
| Formatos `stream-json`/`--json` de los CLIs cambian | Alta | Medio | Parsers tolerantes, fixtures por versión, adaptadores directos como vía secundaria. |
| Agentes que escriben sin pedir permiso en su modo por defecto (Codex `agent`, OpenCode) | Alta | Alto | Mostrar el modo activo siempre; Q8; recomendar git/backup. |
| PATH/entorno en apps GUI (mise/nvm/asdf) | Media (S1: no ocurre en este equipo) | Alto | §4.7 desde el MVP + ruta manual + botón re-detectar. |
| Obsidian en Flatpak/Snap | Media | Alto | Documentar no soportado; investigar `flatpak-spawn --host` más adelante. |
| Agente modifica una nota que el usuario está editando | Media | Medio | Escrituras ACP vía Vault API; aviso si el archivo está abierto con cambios sin guardar. |
| Agente destructivo en modo permisivo | Baja | Alto | Defaults conservadores, confirmación de modos peligrosos, recomendación de git/backup. |
| Procesos huérfanos | Media | Medio | `ProcessRegistry`, kill de grupo, EOF de stdin, prueba en checklist. |
| Coste/consumo de tokens inesperado | Media | Medio | Mostrar uso/coste; e2e reales fuera de CI. |
| Revisión de la comunidad rechaza algo (procesos externos) | Baja | Medio | Cumplir guías, `isDesktopOnly`, divulgación en README; hay precedentes de plugins que lanzan procesos. |
| La revisión objeta que los presets usen `npx` (descarga de adaptadores en tiempo de ejecución; las políticas prohíben que un plugin instale sus dependencias) | Media | Medio | Divulgado en el README: versión fijada, la descarga la hace `npx` y no el plugin, alternativa de instalación global. Si se exige, cambiar los presets a los binarios globales (`claude-agent-acp`, `codex-acp`) con `npx` como opción manual (MINOR). |
| Latencia de `npx` en el primer arranque | Alta | Bajo | Detectar binario global; mensaje "instalando adaptador…"; recomendar `npm i -g`. |
| Vulnerabilidad moderada en `moment` (GHSA-4p3w-j4w9-5jqw), vía el paquete de tipos `obsidian` | Baja | Bajo | No se incluye en el bundle (`obsidian` es externo). Revisar al actualizar `obsidian`. |
| Rendimiento con transcripts largos | Media | Medio | Throttle, items consolidados, virtualización (T6.4). |

---

## 14. Preguntas abiertas

| # | Pregunta | Supuesto actual (hasta que se decida) |
|---|---|---|
| Q1 | Nombre e `id` definitivos (¿"AgentHub" / `agenthub` libre en `community-plugins.json`?). | Resuelta: AgentHub / `agenthub`; el id no figura entre los 8301 plugins de `community-plugins.json` (comprobado el 2026-10-02) y no contiene `obsidian`. |
| Q2 | Licencia. | MIT. |
| Q3 | ¿Publicar en la tienda de la comunidad o uso personal/BRAT? | Resuelta: publicar en el directorio de la comunidad (T6.11); BRAT sigue disponible. |
| Q4 | ¿Prioridad de agentes para el MVP? | Claude Code y Codex (vía ACP); Gemini/OpenCode "gratis" por ACP. |
| Q5 | ¿Idioma principal de la UI? | Inglés por defecto + español completo (sigue el idioma de Obsidian). |
| Q6 | ¿Se requiere el modo directo si ACP funciona bien en S2? | Resuelta: Fase 5 condicional, solo ante una limitación real (ADR-025). |
| Q8 | Codex por ACP arranca en modo `agent` (*Auto review*) y escribe sin pedir permiso; OpenCode tampoco pide. ¿AgentHub debe forzar un modo más conservador al crear la sesión (p. ej. `read-only` / `workspace-write` en Codex)? | Resuelta por ADR-030: Codex ACP en `read-only` salvo configuración explícita; modos sin restricciones con confirmación y aviso. |
| Q7 | ¿Ofrecer instalación automática de adaptadores (`npm i -g …`) desde ajustes? | No en MVP; solo instrucciones y botón copiar comando. |

---

## 15. Convenciones y Definition of Done

**Código**
- TypeScript `strict`; sin `any` en `core/` y `adapters/` (usar `unknown` + guardas).
- `core/` y `adapters/` no importan `obsidian` (excepto `HostBridgeImpl.ts`).
- Nombres: clases `PascalCase`, archivos de clase `PascalCase.ts`, utilidades `camelCase.ts`, componentes `PascalCase.tsx`.
- Recursos de Obsidian siempre con `this.register*`; nada de listeners globales sin limpieza.
- Usar `this.app`, nunca el global `app`.
- **Nunca devolver un `Setting` ni un componente de Obsidian (`BaseComponent`: toggles, dropdowns, botones, textos)
  desde un callback de promesa o una función `async`.** Desde Obsidian 1.13 tienen un `then()` fluido y son
  *thenables*: la promesa los "adopta" en un bucle infinito de microtareas que congela la app. Usar cuerpos de bloque
  (`.then((r) => { row.setDesc(r); })`). El mock de `obsidian` reproduce esto y `no-misused-promises` lo marca. Sin `innerHTML`/`outerHTML`. Estilos solo en `styles.css`
  con prefijo `agenthub-` y variables CSS de Obsidian.
- Textos de UI en *sentence case* y a través de `t()` (i18n).

**Commits**: Conventional Commits con ID de tarea: `feat(ui): permission card [T2.8]`, `fix(process): kill group on unload [T2.3]`.

**Tamaño de archivos de código**: ningún archivo de código (`src/`, `tests/`, `scripts/`) debe superar
**1000 líneas** salvo justificación explícita (indicada en el propio archivo). Dividir por responsabilidad antes de
llegar al límite. No aplica a este plan, a archivos generados (`pnpm-lock.yaml`) ni a fixtures grabados.

**Definition of Done de una tarea**
1. Código + tests (unitarios o de integración según la tarea).
2. `pnpm lint && pnpm test && pnpm build` en verde.
3. Si toca UI: probado manualmente en `test-vault` (anotar en la bitácora qué se probó).
4. `plan.md` actualizado (checkbox, §0.1, bitácora, ADR si aplica, ⚠️ resueltos).

---

### 15.1 Notas del entorno de trabajo

- Skills locales de agentes en `.agents/skills/` (enlazadas desde `.claude/skills/`) y `skills-lock.json`,
  instaladas con autoskills: accessibility, bash-defensive-patterns, frontend-design, nodejs-backend-patterns,
  nodejs-best-practices, seo, typescript-advanced-types, vite, vitest. **Están en `.gitignore`** (no se suben a GitHub).
  Útiles aquí: `vitest`, `vite` (Vitest 5 corre sobre Vite 8: config con `oxc`, no `esbuild`), `typescript-advanced-types`,
  `accessibility`, `frontend-design`, `nodejs-best-practices`, `bash-defensive-patterns` (scripts de `scripts/spikes/`).
- Lint: las reglas de `eslint-plugin-obsidianmd` no permiten `eslint-disable` en línea; las excepciones
  para `scripts/` y `tests/` se configuran en `eslint.config.mjs`.
- Vitest usa `pool: 'vmThreads'`: un jsdom por worker en lugar de uno por archivo (suite ≈ 2× más rápida; cada archivo sigue aislado en su contexto VM).
- El mock `tests/__mocks__/obsidian.ts` replica solo lo necesario (incluye `HTMLElement#addClass`); ampliarlo según haga falta.

## 16. Glosario

| Término | Significado |
|---|---|
| **ACP** | Agent Client Protocol: JSON-RPC sobre stdio entre un editor (cliente) y un agente. |
| **Adaptador** | Implementación de `AgentAdapter` que traduce un protocolo concreto al modelo de dominio. |
| **Modo directo / nativo** | Hablar con el CLI del agente por su salida JSON propia, sin ACP. |
| **Sesión local** | Conversación en AgentHub (`localId`), con su transcript. |
| **Sesión nativa** | Id de la conversación en el agente (`nativeSessionId`), usado para reanudar. |
| **Turno** | Un prompt del usuario y toda la actividad del agente hasta `turn.end`. |
| **Tool call** | Acción del agente (leer, editar, ejecutar, buscar…) mostrada como tarjeta. |
| **Fixture** | Salida real grabada de un agente, usada en tests de contrato. |
| **Vista / leaf** | Panel de Obsidian; AgentHub es un `ItemView` en el sidebar. |

---

## 17. Bitácora

> Añadir entradas al final. Formato: fecha · agente/persona · hecho · pendiente/bloqueos.

- **2026-10-01 · Claude (Opus 5.5)** — Creado `plan.md`. Verificado el entorno: Obsidian 1.13.7;
  Claude Code 2.1.286, Codex 0.159.3, Gemini 0.62.0 y OpenCode 1.18.34, todos instalados vía mise
  (riesgo de PATH en apps GUI → §4.7). Revisadas las flags actuales de cada CLI (`--help`) y las
  versiones npm de `@agentclientprotocol/*` (los paquetes `@zed-industries/*-acp` están deprecados).
  Decisión principal: ACP como protocolo principal + adaptadores directos en Fase 5.
  **Pendiente:** empezar T0.1; los spikes S1–S4 pueden hacerse en paralelo. No hay código aún.
- **2026-10-01 · Claude (Opus 5.5)** — Fase 0 implementada salvo verificaciones manuales.
  Hecho: `package.json` (TS 6.0, esbuild 0.28, Preact 11, Vitest 5 + vite 8, ESLint 9 + obsidianmd),
  `tsconfig.json`, `esbuild.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `manifest.json`
  (`minAppVersion` 1.8.7, ADR-011), `versions.json`, `styles.css`, `src/main.ts` (vista, icono, comando
  `open-view`), `src/ui/AgentHubView.ts` (monta Preact, `getState/setState` con `sessionId`),
  `src/ui/App.tsx`, `src/i18n/` (es/en), mock de Obsidian, 11 tests, `test-vault/` con notas,
  `scripts/link-test-vault.mjs` (symlinks + `.hotreload`), `scripts/version-bump.mjs`, `AGENTS.md`,
  `CLAUDE.md` (importa AGENTS.md), README, CI, LICENSE (MIT). Skills locales añadidas al `.gitignore`.
  `npm run lint && npm test && npm run build` en verde.
  **Pendiente:** abrir `test-vault/` en Obsidian, activar el plugin y comprobar T0.4/T0.5 (abrir/cerrar la
  vista, reinicio); luego spikes S1–S4 y T2.1. Commits de Fase 0 creados en `main`.
- **2026-10-01 · Claude (Opus 5.5)** — Migrado de npm a **pnpm** (ADR-013): eliminado `package-lock.json` y
  `.npmrc`; añadido `pnpm-workspace.yaml` y `pnpm-lock.yaml`; `packageManager: pnpm@12.3.4`; CI, README,
  AGENTS.md y este plan usan comandos `pnpm`. Las instrucciones para usuarios finales sobre instalar
  adaptadores globales (`npm i -g …`) se mantienen con npm. lint/test/build en verde con pnpm.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — Verificación manual en Obsidian 1.13.7 con `test-vault/`:
  el plugin aparece en *Installed plugins* (v0.0.1), se activa, el icono de cinta funciona y la vista se
  abre en el panel derecho mostrando "No session yet". T0.4 cerrada. **Pendiente de T0.5:** reiniciar
  Obsidian y confirmar que la vista AgentHub sigue abierta.
- **2026-10-01 · Claude (Opus 5.5)** — Spikes **S2, S3 y S4** completados (informes en `docs/spikes/`, fixtures en
  `tests/fixtures/{acp,claude,codex}/`, scripts en `scripts/spikes/`). ACP funciona de punta a punta con
  Claude (adaptador 0.85.0), Codex (codex-acp 2.1.1) y OpenCode, todos con el login existente; Gemini falla
  por la cuenta (Code Assist individual discontinuado). Hallazgos que cambian el diseño: SDK con API builder
  (ADR-016), modos/modelos vía `configOptions` (ADR-015), `usage_update`, `messageId` del agente, ningún
  agente usa `fs/*` (ADR-014), Codex/OpenCode escriben sin pedir permiso por defecto (Q8). Claude directo:
  `--verbose` obligatorio, prompt por stdin, `permission_denied` en vivo. Codex directo:
  `--skip-git-repo-check` obligatorio y opciones antes de `resume`. Se añadió `@agentclientprotocol/sdk@1.6.0`
  como dependencia. **Pendiente:** S1 y S5 (en Obsidian), T0.5 (reinicio); siguiente tarea de código: T2.1.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — **S1** completado (`docs/spikes/S1-env.md`): Obsidian lanzado desde
  Hyprland encuentra `claude`, `codex`, `opencode`, `node` y `npx` vía shims de mise; el shell de login tarda
  1,4 s y resuelve binarios distintos → ADR-017 (shell solo como respaldo asíncrono). T2.2 ya no depende de nada.
- **2026-10-01 · Claude (Opus 5.5)** — **T2.1** hecho: `src/core/types.ts` (modelo de dominio con `ConfigOption`,
  `usage` de contexto, `AGENT_EVENT_TYPES` verificado por un test de tipos) y `src/core/AgentAdapter.ts`
  (`HostBridge`, `Logger`, `AgentCapabilities`, `AgentSession.setConfigOption`). Sin `any`; 12 tests en verde.
  Siguiente: T2.2 y T2.3.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — **T0.5** verificada: tras reiniciar Obsidian la vista AgentHub sigue
  abierta en el panel derecho. **Fase 0 cerrada.**
- **2026-10-01 · Claude (Opus 5.5)** — **T2.2** hecho: `src/process/ShellEnv.ts` (`LoginShellEnv` asíncrono y
  cacheado con `invalidate()`, parseo de `env -0` entre marcadores, `mergePath`) y `src/process/BinaryResolver.ts`
  (`which` con PATHEXT en Windows, `CommandResolver`: `process.env` → shell de login solo si falta el comando,
  rutas del shell añadidas al final, `extraPath` primero). 16 tests nuevos (28 en total). La comprobación real en
  Obsidian queda cubierta por S1 y se repetirá al conectar la detección de agentes (T2.7).
- **2026-10-01 · Claude (Opus 5.5)** — Límite de **1000 líneas por archivo de código** (petición del usuario; §15).
  Se probó dividir `plan.md` en `docs/plan/`, pero el usuario aclaró que el límite es solo para el código: se
  revirtió y el plan sigue en un único archivo.
- **2026-10-01 · Claude (Opus 5.5)** — **T2.3** hecho: `src/process/LineDecoder.ts` (JSONL seguro con UTF-8 partido, truncado de líneas largas, `RingBuffer`) y `src/process/ProcessRunner.ts` (`spawnProcess` con `cross-spawn`, grupo de procesos propio, `kill()` SIGTERM→SIGKILL del árbol completo, `taskkill /T` en Windows, cola de stderr, `ProcessRegistry.killAll()`). Tests de integración con procesos reales (`tests/integration/`, helper `tests/helpers/child-tree.mjs`). Lint: `prefer-window-timers` desactivada en `src/core|process|adapters` (código sin DOM probado en Node).
- **2026-10-01 · Claude (Opus 5.5)** — **T2.4** hecho: `scripts/fake-acp-agent.mjs` (SDK `acp.agent()`), escenarios `echo`, `stream-long`, `tools` (incl. terminal estilo Codex y diff), `permissions`, `plan`, `slow`, `crash`, `auth-required`; `configOptions` de modo/modelo con `session/set_config_option`; cancelación. El escenario también se elige por prompt (`/scenario tools`). Script `pnpm fake-agent`. Verificado con `acp-probe.mjs`.
- **2026-10-01 · Claude (Opus 5.5)** — Nuevas skills locales cargadas: `vite` y `bash-defensive-patterns`. Aplicado: `vitest.config.ts` migra de `esbuild` (deprecado en Vite 8) a `oxc` para JSX; los scripts de spikes usan modo estricto y `trap` para borrar el vault temporal.
- **2026-10-01 · Claude (Opus 5.5)** — Auditoría frente a las skills locales y ajustes aplicados: Vitest con
  `restoreMocks`/`unstubEnvs`/`unstubGlobals` y cobertura v8 (`pnpm test:coverage`, 58,8 % de sentencias);
  `SessionViewState` inmutable (`readonly`); `main.ts` sin promesas sin manejar (helper `run()` con `Notice`); scripts de
  spikes con `check_dependencies` y UUID portable. Criterios añadidos: validación de ajustes con esquema (T2.7),
  checklist de accesibilidad y `killAll()` en `onunload` (T2.8, T6.3), ADR-018 (frontend-design dentro del tema de
  Obsidian), riesgo `moment`. Las guardas de tipo en `mapping.ts`/`AcpSession.ts` se aplican con T2.5.
- **2026-10-01 · Claude (Opus 5.5)** — **T2.5** hecho: `src/adapters/acp/` → `AcpAdapter` (detección + creación de sesión), `AcpSession` (SDK `acp.client()`, handshake con timeout de 30 s, `configOptions` iniciales, permisos que se cancelan con el turno, `session/cancel` con kill a los 5 s si el agente no responde, caída detectada aunque la conexión se cierre antes del `exit`), `mapping.ts` (guardas de tipo sin `as`), `promptBlocks.ts` (la selección se envía siempre como texto: más simple y universal que un recurso embebido) y `src/core/errors.ts` (`AgentError` con `kind`/`hint`/`detail`). La guardia de rutas de `fs/*` se implementa en `HostBridgeImpl` (T2.8). 12 tests de integración con el agente simulado + 8 de mapeo con fixtures reales (59 en total, estables).
- **2026-10-01 · Claude (Opus 5.5)** — **T2.6** hecho: `src/core/reducer.ts` (puro e inmutable; acciones locales + `AgentEvent`; un plan por turno; ids de aviso deterministas), `src/core/ChatSession.ts` (agente perezoso, `subscribe/getState`, permisos vía estado, cancelación que resuelve permisos pendientes, reintento tras error de arranque, agente nuevo tras caída, log de debug separado, título desde el primer mensaje) y `src/core/SessionManager.ts`. Los avisos del transcript son datos (`Notice` con `key`) para que la UI los traduzca con `t()`. Arreglo en `AcpSession`: los eventos emitidos antes de la primera suscripción (`session.ready`) se guardan y entregan al suscribirse. 79 tests, cobertura 83,8 %.
- **2026-10-01 · Claude (Opus 5.5)** — **T2.7** hecho: `src/settings/settings.ts` (esquema Zod, `migrate()` campo a campo, presets fijados de Claude/Codex/OpenCode y Gemini desactivado, presets nuevos aparecen desactivados, instrucciones del vault con `{{configDir}}`), `src/agents/AgentRegistry.ts` (ADR-020; detección cacheada con pistas de instalación/login traducidas), `src/settings/SettingsTab.ts` (agentes con estado de detección, activar, editar comando/args/env/opciones iniciales, añadir/eliminar personalizados, re-detectar; sesiones; entorno). `main.ts`: ajustes, resolver por llamada según ajustes, `killAll()` en `onunload`. `t()` admite `{placeholders}`. ADR-019 (`display()` frente a la API declarativa de 1.13). 91 tests; bundle 565 KB.
- **2026-10-01 · Claude (Opus 5.5)** — **T2.8** hecho (código; verificación manual en Obsidian pendiente): `src/ui/` → `App.tsx`, `AgentHubView.ts` (sesión por vista; cerrar la vista termina la sesión y su proceso; nueva sesión / cambio de agente), `hooks.ts` (`useSessionState`, `useThrottledValue` 100 ms), `components/` (`Header` con selector de agente y selectores de `configOptions`, `MessageList` con auto-scroll que respeta la lectura, `Markdown` con `MarkdownRenderer` y enlaces internos, `ToolCallCard`, `PermissionCard`, `PlanView`, `NoticeItem` que traduce avisos, `Composer` Enter/Mod+Enter + Detener, `StatusBar` como única región live, `DebugPanel`, `Icon`). `src/host/ObsidianHost.ts` (lectura con contenido no guardado del editor, escritura por Vault API, `src/core/pathGuard.ts` + `text.ts`), `src/host/openSettings.ts` (API privada `app.setting` comprobada en ejecución). `main.ts` crea `SessionManager` y en `onunload` cierra sesiones y mata procesos. Estilos solo con variables del tema, foco visible, objetivos ≥ 24 px, spinner con `prefers-reduced-motion`. Tests de UI con Testing Library (`tests/setup.ts` hace `cleanup()`). 103 tests; bundle 593 KB.
- **2026-10-01 · Claude (Opus 5.5)** — **T2.9** hecho: la cabecera muestra un `<select>` etiquetado por cada `configOption` (modo, modelo…) y llama a `session/set_config_option`; se bloquea mientras el agente trabaja. Tests de UI.
- **2026-10-01 · Claude (Opus 5.5)** — **T2.10** hecho: binario ausente (`AgentError` `missing-binary` + comando de instalación), login requerido (`auth` + comando de login), caída (aviso con las últimas líneas de stderr; el siguiente mensaje arranca un agente nuevo), timeout de arranque (30 s) y cancelación sin respuesta (kill a los 5 s). La UI los muestra con `NoticeItem` (rol `alert`, pista y detalles plegables). 107 tests. **Fase 2 completa en código; falta la verificación manual con agentes reales en Obsidian (criterio de salida F2).**
- **2026-10-01 · Claude (Opus 5.5)** — Test e2e con agentes reales (`tests/e2e/realAgents.test.ts`, `pnpm test:e2e`,
  solo con `AGENTHUB_E2E=1`; agentes en `AGENTHUB_E2E_AGENTS`). Pasa con **OpenCode, Claude (claude-agent-acp 0.85.0)
  y Codex (codex-acp 2.1.1)** recorriendo todo el stack (registro → `AcpAdapter` → `ChatSession` → archivo escrito en
  el vault de prueba), con permisos aprobados vía el estado de la sesión. Sin procesos huérfanos tras los tests.
  Pendiente: la verificación visual en Obsidian.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — **Bug: abrir los ajustes de AgentHub congelaba Obsidian.** Reproducido
  lanzando Obsidian con `--remote-debugging-port` y controlándolo por CDP (scripts en el scratchpad de la sesión), y
  aislado por bisección: el disparador era `detectAgent(id).then((r) => row.setDesc(...))`. **Causa raíz:** en Obsidian
  1.13 `Setting` (y todo `BaseComponent`) tiene un método fluido `then(cb)` → es un *thenable*; al devolverlo desde el
  callback, la promesa lo adopta, su `then` se llama a sí mismo y se forma un bucle infinito de microtareas (la UI
  nunca vuelve a pintar). No tenía relación con la detección ni con la ventana separada de ajustes. **Arreglo:** cuerpo de
  bloque. **Regresión:** el mock de `obsidian` ahora implementa `Setting`/componentes como thenables con un contador que
  convierte el bucle en fallo (`tests/unit/SettingsTab.test.ts`; verificado que falla con el bug y pasa con el arreglo).
  Regla añadida en §15 y `AGENTS.md`. Además se verificó **en Obsidian real** (vía CDP, agente simulado): chat con
  streaming, tarjetas de herramientas, flujo de permisos (Allow), Detener y limpieza de procesos al cerrar la sesión.
- **2026-10-01 · usuario** — Verificación manual de la Fase 2 en Obsidian: ajustes con los tres agentes detectados y vista lista. **Fase 2 cerrada.**
- **2026-10-01 · Claude (Opus 5.5)** — **T3.1, T3.2, T3.5, T3.6** hechos: `src/core/PromptBuilder.ts` (mensaje + selección
  + menciones `@[[ruta]]` + nota activa, sin duplicados, presupuesto de 200 000 caracteres embebidos),
  `src/host/NoteContext.ts` (nota activa vía `file-open`, lectura con `cachedRead`, resolución por ruta o enlace,
  abrir rutas del vault), `ContextChips` (nota actual activable con `aria-pressed`, selección capturada con quitar),
  adjuntos visibles en los mensajes del usuario, rutas de herramientas clicables. Ajuste `includeActiveNote`.
  Comandos: enviar selección (también en el menú contextual del editor), preguntar sobre la nota actual, nueva sesión,
  detener. 115 tests.
- **2026-10-01 · Claude (Opus 5.5)** — **T3.3, T3.4** hechos: `src/core/suggest.ts` (disparadores `@nota` y `/comando`,
  puntuación por prefijo de nombre > subcadena > subsecuencia, inserción de `@[[ruta]]`/`/comando`) y `Composer` con lista
  de sugerencias (flechas, Intro/Tab, Escape, ratón sin perder el foco; `textarea` nativo con `aria-autocomplete`,
  `aria-controls` y `aria-activedescendant`, `listbox`/`option`). Los comandos `/` salen de `available_commands_update`.
  **Fase 3 completa en código** (T3.7 sin el modo "carpeta de la nota activa"). 120 tests; falta verificación manual.
- **2026-10-01 · usuario** — Verificación de la Fase 3 en Obsidian con Claude Code real: nota actual adjunta
  automáticamente ("Note: Bienvenida.md"), lectura y edición de la nota con tarjeta de permiso ("Yes, allow all edits
  during this session"), cambio aplicado en el editor, selectores de `configOptions` (modo, modelo, esfuerzo,
  razonamiento), uso de contexto (4 %) y coste ($0.26) en la barra de estado. **Fase 3 cerrada.**
- **2026-10-01 · Codex (GPT-6)** — **T4.1 completada:** `src/storage/SessionStore.ts` y
  `sessionSchema.ts` implementan índice validado, transcripts JSONL versionados y consolidados, cola de escrituras,
  debounce de 1 s, guardado al terminar turno/cerrar vista/descargar plugin, retención y operaciones de lectura,
  renombrado y borrado para T4.2. `SessionManager.onCreate` conecta el guardado sin importar Obsidian en el núcleo.
  Ajustes traducidos `historyEnabled`/`maxSessions` (200 por defecto), migración de ajustes antiguos y aviso sobre
  sincronización. Reintentos conservan la revisión más reciente; índices corruptos no se sobrescriben; registros
  JSONL corruptos se omiten con aviso; IDs locales validados antes de formar rutas. **ADR-021** registra el formato
  y el reemplazo con respaldo: prueba real mostró que `DataAdapter.rename()` no sobrescribe archivos existentes;
  se corrigió con `.tmp`/`.bak` y recuperación tras fallo/interrupción, y el mock reproduce esa restricción.
  **Validación:** instalación congelada, lint sin errores (9 avisos preexistentes), **141 tests pasan** y 1 e2e
  optativo omitido, build correcto. Las pruebas de procesos requieren salir del sandbox de Codex (15 fallos
  ambientales dentro; pasan fuera). Obsidian **1.13.7** abierto con perfil/vault temporal en `/tmp`: dos turnos ACP
  con agente simulado, transcript de 4 items, `nativeSessionId`, sobrescritura y cierre; ajustes de historial y
  retención operados y guardados en `data.json`, captura revisada. README y §0.1 corregidos (indicaban Fase 0).
  **Pendiente:** T4.2 (panel de historial y reanudación), T4.3–T4.5; S5 y modo carpeta de nota activa siguen pendientes.
- **2026-10-01 · Claude (Opus 5.5)** — **T4.2 y T4.3** hechos sobre el `SessionStore` de Codex (T4.1).
  `AcpSession` acepta `resumeId` (ADR-022) y expone `restored`; `AcpAdapter.loadSession`; `ChatSession` con `restore`
  (transcript + `nativeSessionId`; solo el primer agente reanuda; aviso si no hay contexto); `SessionManager.restore`.
  UI: botón de historial en la cabecera y `HistoryPanel` (búsqueda, abrir, renombrar en línea, borrar en dos pasos,
  sesiones de agentes desactivados no abribles). `AgentHubView.openSession` (viva o guardada) y `deleteSession`
  (cierra antes de borrar para que el cierre no la vuelva a guardar). T4.3: `setState` reabre desde el store tras
  reiniciar Obsidian. Agente simulado con `session/resume` (`--no-resume` para el caso contrario). `MemoryAdapter`
  pasa a `tests/helpers/`. 148 tests; e2e opcional de reanudación real pasa con OpenCode (recordó una palabra clave
  en un proceso nuevo).
- **2026-10-01 · Claude (Opus 5.5)** — **T4.4** hecho: `src/storage/exportToNote.ts` (frontmatter con agente, sesión y
  fecha; mensajes como secciones; adjuntos como `[[enlaces]]`; herramientas, razonamiento, plan, permisos y avisos como
  callouts plegables; nombre de archivo saneado) y comando "Exportar la sesión de AgentHub a una nota", que crea la
  nota en la carpeta configurable `exportFolder` (por defecto `AgentHub`, sin sobrescribir) y la abre. 150 tests.
- **2026-10-01 · usuario** — Verificación de **T4.2** en Obsidian con Claude Code: el panel de historial lista dos
  sesiones (título, agente, fecha, "Current"), y alternar entre ellas restaura cada transcript completo (mensajes,
  herramientas, permisos y respuestas). Observación: los selectores de modo/modelo de una sesión reabierta aparecen
  recién tras el primer mensaje, porque el agente arranca de forma perezosa (mejora posible: guardar `configOptions`).
- **2026-10-01 · usuario + Claude (Opus 5.5)** — Rediseño **compacto y sobrio** pedido por el usuario (historial,
  mensajes, cabecera/selectores, compositor/estado): herramientas como filas finas sin caja, plan y permisos con acento
  lateral, avisos sin recuadro, selectores de opciones compactos, el compositor pasa a ser una caja única (texto +
  barra con chips de contexto y Enviar) que toma el color del agente al enfocar, historial con acciones al pasar el
  ratón o con foco de teclado, etiqueta "You" solo para lectores de pantalla. **Identidad por agente** (ADR-023):
  `src/ui/agentIdentity.ts` + `AgentBadge` en la cabecera y en cada fila del historial. 152 tests. Falta revisión
  visual del usuario.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — Las opciones del agente (modo, modelo, esfuerzo…) tienen etiqueta visible
  y se pueden configurar **antes** del primer mensaje (ADR-024): `ChatSession.prepare()` desde la vista,
  `initialConfigOptions`/`onAgentReady` en `ChatSession` y `SessionManager`, `knownConfigOptions` en ajustes, cambios
  pendientes aplicados al arrancar, y el envío durante el arranque espera en vez de ignorarse (el test de historial lo
  destapó). 154 tests.
- **2026-10-01 · Claude (Opus 5.5)** — **T4.5** hecho: `ChatSession.suspend()` libera el proceso de un agente inactivo y
  el siguiente mensaje continúa la misma conversación (resume con el `nativeSessionId` del propio agente);
  `SessionManager.reapIdle()` cada minuto desde `main.ts` según `idleTimeoutMin` (15 por defecto, 0 = nunca), nunca a
  mitad de un turno. Comando "Abrir AgentHub en un panel nuevo"; una vista no cierra una sesión que otra vista sigue
  mostrando. 156 tests. **Fase 4 completa en código.**
- **2026-10-01 · Claude (Opus 5.5)** — **Fase 5 aplazada**: ACP ya cubre Claude, Codex y OpenCode (los adaptadores se
  instalan solos con `npx`), así que los adaptadores directos aportan poco por ahora; se retoman si hiciera falta
  funcionar sin npm o con funciones que ACP no exponga. **T5.4** se da por cubierta vía ACP (`usage_update`: contexto y
  coste en la barra de estado). **T6.1** hecho: `src/ui/diffLines.ts` (jsdiff 9, contexto de 2 líneas y tramos sin
  cambios colapsados) y `DiffView` en las tarjetas de edición (añadidos/eliminados con colores del tema, prefijos
  "Añadido/Eliminado" para lectores de pantalla, enlace para abrir el archivo). 160 tests.
- **2026-10-01 · Claude (Opus 5.5)** — **T6.2** hecho: los errores del agente llevan su tipo (`AgentErrorKind` en
  `AgentEvent`/`Notice`) y la UI los traduce (`errorMissingBinary`, `errorAuth`, `errorStartup`, `errorCrash`); los
  errores de protocolo muestran el mensaje del propio agente. Toda la UI pasa por `t()` con las mismas claves en/es
  (comprobado por test). 161 tests.
- **2026-10-01 · Claude (Opus 5.5)** — **T6.5** hecho: README para usuarios (qué hace, requisitos y tabla de agentes
  con su comando y login, instalación manual, uso, comandos, ajustes, privacidad y seguridad, problemas comunes,
  desarrollo).
- **2026-10-01 · Claude (Opus 5.5)** — **T6.6 (parcial):** `.github/workflows/release.yml` (en cada tag: lint, test,
  build, comprobación tag = versión del manifest, borrador de release con `main.js`/`manifest.json`/`styles.css`) y
  sección "Publicar una versión" en el README. Falta: el primer tag/release, probar con BRAT y el PR a
  `obsidianmd/obsidian-releases`.
- **2026-10-01 · Claude (Opus 5.5)** — **Corrección:** el repositorio ya existía en GitHub (`origin` =
  `github.com/wh01s17/agenthub-plugin-obsidian`, público) y el usuario hace los push; el workflow de CI pasa en verde
  en cada push. Se marca **T0.7** como hecha y se quitan del plan las menciones a "falta remoto". Lección: comprobar
  `git remote -v` y `gh run list` antes de afirmar el estado del repositorio.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — Decidido con el usuario: **Fase 5 opcional/condicional** (ADR-025), con
  tres disparadores para retomarla. Se sigue con la Fase 6.
- **2026-10-01 · Claude (Opus 5.5)** — **T6.3 (parte automática):** `tests/unit/a11y.test.tsx` audita con **axe-core**
  (WCAG 2.0/2.1/2.2 A y AA, sin contraste porque jsdom no calcula estilos y los colores son del tema) la vista de chat
  con todos los tipos de elemento (mensajes, razonamiento, herramienta con diff y terminal, plan, permiso, aviso de
  error, chips, selectores) y el panel de historial: **0 violaciones**. Guardas: exige reglas superadas (no pasa en
  vacío) y un control negativo comprueba que detecta un botón sin nombre. Falta la checklist manual (§11 T6.3).
- **2026-10-01 · Claude (Opus 5.5)** — **T6.4** hecho: `MessageList` renderiza solo los últimos 100 elementos
  (`PAGE_SIZE`) y un botón "Mostrar N mensajes anteriores" carga más en bloques conservando la posición de lectura.
  La carga del plugin no lanza procesos (los agentes arrancan al mostrar una sesión). 165 tests.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — Verificado en Obsidian por el usuario: **exportar a nota (T4.4)**,
  **segunda vista (T4.5)**, **diff tras una edición (T6.1)** y **recorrido solo con teclado (T6.3)**. Corregido a partir
  de sus capturas: la exportación usa un delimitador de código más largo que cualquiera del texto (la salida de `Read`
  de Claude ya trae ``` y rompía el callout); las rutas de herramientas y diffs se muestran relativas al vault
  (`NoteContext.displayPath`). Para cerrar un panel extra: clic derecho en su pestaña (icono del robot) → Close.
- **2026-10-01 · Claude (Opus 5.5)** — Exportación verificada sobre la nota que generó el usuario: 6 bloques de código
  en callouts, todos cerrados, 4 con delimitador largo. Ajuste: las rutas de archivos del vault se exportan como
  `[[enlaces]]` relativos (`ExportLabels.vaultPath`) y las de fuera del vault como código. 167 tests.
- **2026-10-01 · Claude (Opus 5.5)** — Limpieza del vault de pruebas a pedido del usuario: borradas las notas creadas
  al probar (`AgentHub/`, `Kurt Rosenwinkel.md`, `test.md`) y restauradas `Bienvenida.md` e `Ideas.md`, cuyas ediciones
  de prueba se habían colado en commits anteriores por usar `git add -A` (lección: excluir `test-vault/` al
  commitear); `test-vault/AgentHub/` pasa al `.gitignore`. **Primera release:** versión **0.0.2** (`package.json`,
  `manifest.json`, `versions.json`), tag `0.0.2` sin prefijo, push de `main` y del tag; el workflow `release.yml` pasó
  (lint, test, build, tag = manifest) y creó el **borrador** de release con `main.js` (632 KB), `manifest.json` y
  `styles.css`. Publicarlo queda en manos del usuario.
- **2026-10-01 · usuario** — Verificado **T4.3**: tras reiniciar Obsidian la vista recupera su conversación. Con esto
  toda la Fase 4 (T4.1–T4.5) está verificada en Obsidian.
- **2026-10-01 · Claude (Opus 5.5)** — **T3.7 completa:** modo de directorio de trabajo "carpeta de la nota actual"
  (`cwdMode: 'active-note-folder'`: la carpeta de la nota abierta al crear la sesión; notas en la raíz usan el vault).
  La bienvenida muestra el `cwd` real de la sesión. 168 tests.
- **2026-10-01 · Claude (Opus 5.5)** — **S5 completado** (`docs/spikes/S5-render.md`) en una instancia aislada de
  Obsidian 1.13.7 (perfil y vault temporales, sin tocar la del usuario). El render del mensaje entero bloqueaba la UI
  (603 ms, hueco de 667 ms); ahora se renderiza por bloques con una cola de 8 ms (ADR-026): **0 tareas largas, hueco
  máximo 33 ms**. El agente simulado busca `/scenario` en cualquier línea (el primer mensaje empieza con las
  instrucciones del vault). 174 tests. Con S5 y T3.7, **no queda nada pendiente de las fases 0–4**; la Fase 5 sigue
  condicional (ADR-025).
- **2026-10-01 · Claude (Opus 5.5)** — **Release 0.0.3 publicada** (`github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.3`,
  marcada como *Latest*): versión subida en `package.json`/`manifest.json`/`versions.json`, tag `0.0.3`, workflow
  `release.yml` en verde y borrador publicado con `gh release edit --draft=false --latest`. Incluye S5, T3.7 y los
  enlaces en la exportación. El borrador antiguo de 0.0.2 se borró a pedido del usuario (el tag `0.0.2` se conserva).
- **2026-10-01 · Claude (Opus 5.5)** — **T6.7 hecho** (ADR-027): `SettingsTab` define secciones y filas una sola vez;
  `getSettingDefinitions()` para Obsidian 1.13+ y `display()` como respaldo, sin subir `minAppVersion`. Las funciones
  `render` devuelven `unknown` y se llaman dentro de un envoltorio con cuerpo de bloque, para que un `Setting`
  (thenable) nunca llegue a Obsidian. Verificado en una instancia aislada de Obsidian 1.13.7: la pestaña se dibuja,
  el buscador de ajustes encuentra "AgentHub → Working directory" y el lápiz despliega los detalles del agente vía
  `update()`. El mock de `obsidian` simula `requireApiVersion`. 176 tests.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — Bug reportado: "Starting the agent…" no desaparecía. Con el arranque
  anticipado (ADR-024) nadie devolvía el estado a `idle` cuando el agente terminaba de iniciar sin un mensaje en curso.
  `ChatSession.startAgent` ahora pasa de `starting` a `idle` (si un mensaje enviado mientras arrancaba ya puso
  `running`, no lo toca). Test de regresión añadido. 177 tests.
- **2026-10-01 · Claude (Opus 5.5)** — **Release 0.0.4 publicada** como *Latest* (T6.7 ajustes buscables y el arreglo
  de "Starting the agent…"). Animación de los puntos de "Working…" (aparecen de uno en uno; texto plano para lectores de
  pantalla; fijos con `prefers-reduced-motion`) hecha después del tag: irá en la próxima versión.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — A pedido del usuario, la cabecera y el historial muestran el **logo
  original** de cada agente (ADR-028): Claude (estrella `#D97757`), Codex y Gemini con sus degradados, OpenCode
  monocromo siguiendo el tema; agentes personalizados con monograma. `src/ui/logos.ts` (generado desde Lobe Icons, MIT)
  y `AgentBadge`. Crédito y nota de marcas en el README. 182 tests.
- **2026-10-01 · usuario + Codex** — El usuario decide que **no realizará la Fase 7**. Se registra
  **ADR-029**: modo terminal fuera del alcance, T7.1/T7.2 canceladas y RF-21 descartado. Actualizadas las
  referencias del roadmap, no-objetivos y próxima tarea. Quedan por cerrar accesibilidad manual y distribución
  (T6.3/T6.6); la Fase 5 conserva su carácter condicional (ADR-025). Cambio exclusivamente documental.

- **2026-10-01 · Codex** — **T6.8/T6.9 completas:** guardia de modos sin restricciones en el núcleo y diálogo modal nativo con Escape, foco inicial en cancelar, restauración de foco y cancelación al cerrar. Codex ACP inicia en solo lectura; ADR-030 resuelve Q8. Respaldo ACP `modes`/`models` con RPC antiguos y prioridad de `configOptions` (ADR-031). Gemini 0.62 real inició una sesión y cambió desde el selector a `gemini-2.5-pro`; no se envió ningún prompt ni se inventó esfuerzo. BRAT 2.2.0 instaló 0.0.3 y actualizó a 0.0.4 en vault temporal. Corregido contraste de etiquetas/estado y aviso, botones adaptables a zoom. 198 pruebas pasan y 2 e2e omitidas fuera del sandbox; las pruebas de tuberías fallan dentro del sandbox. Versión 0.0.5 preparada con logos/animaciones posteriores a 0.0.4. Evidencias y límites en `docs/release-0.0.5.md`; lector de pantalla y alto contraste nativo siguen pendientes. Fase 7 sigue descartada.

- **2026-10-01 · Codex** — **T6.10 completa** a pedido del usuario: la etiqueta accesible «Tú»/«You» pasa a ser visible; los mensajes se distinguen con tarjeta, fondo, borde de acento, leve desplazamiento a la derecha y separación inferior. Estilos con variables de Obsidian, texto y adjuntos legibles y ajuste de líneas largas. Revisado en Obsidian 1.13.7, tema claro/oscuro y panel estrecho: la tarjeta no desborda horizontalmente. Sin cambios en los datos del historial. Lint/build sin errores (7 advertencias preexistentes); 198 pruebas pasan y 2 e2e omitidas.

- **2026-10-01 · Codex** — Corrección de metadatos de T6.6 a pedido del usuario: `manifest.json` identifica al autor como `wh01s17`. Se incorpora a la release 0.0.5 junto al diseño de mensajes de T6.10.
- **2026-10-01 · usuario + Claude (Opus 5.5)** — Política de versiones explícita en **§8.4** a pedido del usuario: SemVer
  sin prefijo `v`; en 0.x, MINOR para funciones y cambios de datos o de `minAppVersion`, PATCH para arreglos y estilo;
  hitos 0.1.0 (funcionalmente completa: falta `CHANGELOG.md`, capturas y prueba con BRAT) y 1.0.0 (tienda de la
  comunidad); pre-releases `-beta.N`; procedimiento paso a paso con la publicación sujeta a confirmación del usuario.

- **2026-10-01 · Codex** — **Release 0.0.5 publicada como Latest**: incluye T6.8/T6.9/T6.10, logos y animaciones, con `author: wh01s17` en el manifest. El borrador inicial se regeneró antes de publicarlo para que el tag incluyera la corrección de autor (commit `d29f034`). Workflow Release `36954228850` en verde. Descargados y comparados por SHA-256 `main.js`, `manifest.json` y `styles.css`: coinciden con el build local; autor y versión verificados. Release: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.5. La revisión manual pendiente de T6.3/T6.6 permanece documentada.

- **2026-10-01 · Codex** — Revisadas las adiciones del usuario a §8.4 y AGENTS.md: próxima release 0.1.0; MINOR para funciones/comportamiento/datos y PATCH para arreglos/estilo/rendimiento/docs. README y comentario del workflow sincronizados con el bump manual y tag sin `v`; procedimiento de beta documentado como pre-release sin Latest. Añadida 0.0.5 al historial y corregido el estado del hito: T6.3/T6.6 mantienen sus comprobaciones manuales pendientes. §0.1 incorpora changelog y capturas como requisitos de 0.1.0. Publicación solo con confirmación del usuario. Sin cambios de código ejecutable ni nueva release. Lint/build sin errores y 198 pruebas pasan (2 e2e omitidas).

- **2026-10-01 · usuario + Codex** — Preparación local de **0.1.0 [T6.3/T6.5/T6.6]**: creado CHANGELOG.md con releases publicadas y Unreleased; metadatos sincronizados sin tag ni publicación; instrucciones del script corregidas. A pedido del usuario, capturas exclusivamente aportadas por él: nota con conversación Codex y cuatro vistas de ajustes incorporadas al README; pendientes chat con mensaje propio visible y nueva captura de permisos. La captura de permisos mostró un botón largo que desbordaba: CSS corregido con texto envuelto, comprobado en Obsidian 1.13.7 claro/oscuro al 100/200 %, tarjeta sin desborde. Recorrido nativo del diálogo al 200 %: Tab dentro de los dos botones, Escape conserva modo y devuelve foco. BRAT 2.2.0 verificó instalación limpia 0.0.5 y actualización 0.0.4 → 0.0.5; ajustes y cuatro elementos del transcript conservados (timestamps de guardado cambian). E2e reales: OpenCode/Codex pasan lectura/escritura y reanudación (4 pruebas); Claude falla sus dos pruebas con cuota agotada del proveedor. Suite normal: 198 pasan, 2 optativas omitidas; lint/build sin errores, 7 avisos existentes. Evidencia y guía humana en `docs/release-0.1.0.md` y `docs/checklist-0.1.0.md`. T6.3/T6.6 siguen parciales por lector de pantalla, alto contraste nativo, contraste inconcluso y pasada visual final; después tag/borrador, confirmación y BRAT final 0.1.0. Cambios del usuario en test-vault se dejan fuera del commit de preparación. Fase 7 descartada.

- **2026-10-01 · usuario + Codex** — **T6.10:** corregido el texto del mensaje propio no seleccionable. Reproducción nativa en Obsidian 1.13.7: estilo calculado `user-select: none`, arrastre con mouse sin selección. La tarjeta declara `user-select: text`, también para autor/adjuntos; tras corregir, el mismo arrastre selecciona «Seleccionar este mensaje». Changelog y evidencias actualizados; paquete local 0.1.0 regenerado. Lint/build correctos, 198 pruebas pasan y 2 optativas omitidas; 7 avisos existentes. Sin publicación.

- **2026-10-02 · usuario + Codex** — **T6.3/T6.6 (avance manual):** capturas de Codex real verifican rechazo de permiso (herramienta fallida/Stopped), aprobación posterior y escritura, cancelación de streaming y nuevo mensaje respondido con CANCELACIÓN OK, exportación a nota y permiso largo envuelto sin desborde. El usuario confirma explícitamente cierre completo de Obsidian y reapertura antes de recuperar CLAVE-PUMA-83: reanudación manual marcada como comprobada. Nota de prueba leída localmente con ambas líneas autorizadas. Sugerencia @ y chip de selección visibles; sus respuestas de contexto no aparecen, por lo que el flujo completo sigue pendiente. Capturas guardadas y enlazadas desde la checklist; permiso largo añadido al README. Pendientes: resto de pasada visual por agentes, limpieza de proceso, accesibilidad humana y cuota de Claude; luego tag/borrador, confirmación y BRAT 0.1.0. Sin cambios de código ni publicación. Lint/build correctos; 198 pruebas pasan, 2 omitidas, 7 avisos existentes.

- **2026-10-02 · usuario + Codex** — El usuario confirma «ta todo ok» y aprueba el cierre de la revisión manual de 0.1.0. T6.3 cerrada por aceptación; se conserva la evidencia individual sin inventar pruebas no observadas ni nueva ejecución de Claude. Nueva captura verifica @nota con adjunto y respuesta correcta. Changelog cerrado en 0.1.0 para preparar commit/tag y borrador; publicación requiere confirmación según §8.4. BRAT final de 0.1.0 pendiente hasta publicar.

- **2026-10-02 · usuario + Codex** — Tag anotado **0.1.0** en `88967dc`, push y workflow Release `36959592684` correcto: borrador con main.js/manifest.json/styles.css. Assets descargados y comparados por SHA-256 con el build local; versión 0.1.0 y autor wh01s17 verificados. Retirado del README el estado interno de fases/preparación a pedido del usuario. El usuario elige **documentación pública en inglés, documentos internos conservados y UI bilingüe**: README, CHANGELOG y notas del borrador traducidos, con links locales comprobados. Se conserva la documentación interna en español; sin cambios de comportamiento ni assets. Publicación con confirmación y BRAT final aún pendientes.

- **2026-10-02 · usuario + Codex** — El usuario autoriza publicar 0.1.0. Release publicada como **Latest**, sin draft ni prerelease: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.1.0. BRAT 2.2.0 en Obsidian aislado verificó instalación limpia de 0.1.0, actualización 0.0.5 → 0.1.0, plugin/vista cargados y autor wh01s17. Ajustes y contenido de transcripts conservados. T6.6 y Fase 6 cerradas; no queda trabajo obligatorio para este hito. Documentación pública en inglés; sin modificaciones de las notas de prueba del usuario.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — Análisis del proyecto y preparación del envío a la comunidad **[T6.11]**. Revisadas las *Developer policies* y *Submission requirements* actuales: el envío ya no es un PR a `obsidian-releases`, sino desde community.obsidian.md con cuenta de Obsidian y GitHub vinculado, y revisión automática; el directorio lee el `manifest.json` de la rama por defecto y los assets de la release con el mismo tag. Id `agenthub` libre (8301 plugins comprobados). README: nueva sección *Disclosures* (procesos externos, red de los agentes, descarga de adaptadores por `npx` con versión fijada, cuentas necesarias, archivos fuera del vault; el canal ACP `fs/*` solo permite el vault). Q1 y Q3 resueltas; ADR-012/013 reordenados; §0.1 corregida (texto cortado). Lint: reglas `hardcoded-config-path` y `no-deprecated` desactivadas solo en tests (datos de prueba y respaldo `display()` intencionado); queda 1 aviso intencionado en `SettingsTab.ts` (ADR-027). Vitest con `pool: 'vmThreads'`: 21 s → 11 s. E2e reales de Claude (`claude-acp`): 2/2 pasan (antes fallaban por cuota). test-vault depurado: restauradas `Bienvenida.md` y `Notas/Proyecto Alfa.md`; restos de pruebas manuales (`Prueba-AgentHub.md`, `Notas/Fibonacci.md`, export `AgentHub/`, sesiones del plugin) movidos a una copia fuera del repo. Sin cambios de código ejecutable: no hace falta nueva release. Lint/build correctos; 198 pruebas pasan, 2 omitidas. Pendiente: envío por el usuario.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.11:** el usuario publicó la entrada en community.obsidian.md. Revisión automática de 0.1.0 (commit `88967dc`) completada sin errores: dependencias sin vulnerabilidades y build reproducido byte a byte. Avisos atendidos para **0.1.1** (PATCH): `setTimeout`/`clearTimeout` → `window.*` en `AcpSession`, `ProcessRunner` y `SessionStore` (eliminada la excepción de `prefer-window-timers`; `tests/setup.ts` define `window` para los tests en Node); `.agenthub-visually-hidden` usa `clip: rect(0 0 0 0)` en lugar de `clip-path`; `release.yml` genera attestations (`actions/attest-build-provenance@v4`, permisos `id-token`/`attestations`). Sin cambiar, por diseño y divulgados en el README: `fs`, `child_process`, enumeración del vault y `display()` (ADR-027). §8.4 actualizado con el nuevo proceso de envío. Lint (1 aviso intencionado), build y 198 pruebas correctos. Pendiente: publicar 0.1.1 con confirmación y relanzar la revisión.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Release 0.1.1 publicada como Latest** [T6.11]: el usuario subió `main` y el tag `0.1.1` (anotado, en `c630bc7`) y publicó el borrador; notas tomadas del CHANGELOG. Workflow Release correcto; `main.js`, `manifest.json` y `styles.css` coinciden por SHA-256 con el build local; `gh attestation verify` de `main.js` correcto. README: las capturas de permisos y ajustes dejan de estar plegadas en `<details>` (en GitHub solo se veía una imagen). Hubo un intervalo en que `main` declaraba 0.1.1 sin release; queda como aprendizaje: subir `main` y el tag juntos. Revisadas las capturas de `docs/images/verification-0.1.0/`: se conservan como evidencia del checklist, no aptas para el README (español, textos de prueba); faltan capturas en inglés de `@`, selección y exportación. Pendiente: revisión de 0.1.1 en el directorio y aparición en Browse.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — Ficha pública comprobada en https://community.obsidian.md/plugins/agenthub (también redirige `obsidian.md/plugins?id=agenthub`). README: índice, instalación desde *Community plugins* como vía principal (BRAT queda para betas) y retirada la frase «not yet available»; el subtítulo de capturas pasa a *Settings screens* para no duplicar el ancla `#settings`. Cambio solo de documentación, sin release.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.12/T6.13 (en curso):** pulido visual (shadcn/ui + apps oficiales) y sección *Apariencia* con siete ajustes (ADR-032). Por petición del usuario, las opciones del agente pasan al cuadro de mensaje como pastillas con panel propio, distinto del selector de Claudian que mostró como referencia: panel que sale del cuadro con borde de acento, lista con descripciones, medidor de niveles para el esfuerzo y modo sin restricciones en rojo; teclado (flechas, Escape devuelve el foco) y cierre al hacer clic fuera. Nuevos: `ConfigOptions.tsx`, `OptionPicker.tsx`, `tests/unit/Appearance.test.tsx`; las vistas abiertas se redibujan al cambiar ajustes sin arrancar el agente (`AgentHubView.refresh()`). `styles.css` supera las 1000 líneas: es la única hoja que carga Obsidian y la regla de tamaño aplica a `src/`, `tests/` y `scripts/`. Lint (1 aviso intencionado), build y 205 pruebas correctos. Pendiente: revisión visual del usuario y release 0.2.0 con confirmación.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.12/T6.13:** a pedido del usuario, las opciones elegidas en el cuadro de mensaje persisten entre reinicios: `ChatSession` avisa con `onConfigChosen` solo cuando el cambio surte efecto (no si se rechaza la confirmación o falla el agente) y `main.ts` lo guarda en `agents[].config`, que ya se aplicaba al arrancar. Opciones de dos estados (On/Off) como pastillas interruptor con su nombre; el icono de «Fast mode» deja de confundirse con el modo de permisos. 207 pruebas, lint (1 aviso intencionado) y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.14:** historial de prompts con flechas, solo en memoria (`src/core/PromptHistory.ts`, `ViewHost.prompts`, `Composer`). README y CHANGELOG actualizados. 210 pruebas, lint (1 aviso intencionado) y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.12:** la lista de sugerencias (`@`, `/`) desplaza la opción activa a la vista al moverse con las flechas (`scrollIntoView({ block: 'nearest' })`), y las descripciones largas se limitan a dos líneas con `max-height` (sin `line-clamp`, para no sumar avisos de CSS en la revisión de la comunidad). 211 pruebas, lint y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.12:** pastillas más compactas (22 px, iconos de 13 px, flecha discreta); los interruptores (p. ej. *Fast mode*) muestran solo el icono, con el nombre en el tooltip y el nombre accesible; la fila de opciones no salta de línea (desplazamiento horizontal) y el botón de enviar queda fijo; icono propio para *Collaboration mode* de Codex. 211 pruebas, lint y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.12:** botón de parar rediseñado: tinte del color de acento, cuadrado relleno y arco giratorio mientras el agente trabaja (sin animación con movimiento reducido). Build correcto.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Fix (ADR-022):** al reiniciar Obsidian, Gemini respondía `session/load` con error interno (-32603) y la vista mostraba «The agent stopped». `AcpSession.openSession` ahora trata cualquier respuesta de error del agente a `session/resume`/`session/load` como «no se puede continuar»: prueba la siguiente vía y termina en `session/new` con `restored = false`, así la vista muestra el aviso de contexto no recuperado y la conversación sigue. Tiempos de espera, caídas y autenticación siguen siendo errores. Agente simulado con `--broken-resume` y prueba de integración nueva. E2e reales de Gemini: la reanudación en proceso nuevo pasa; la prueba de escritura de `resumen.md` falla (Gemini no crea el archivo; Gemini no estaba en el conjunto e2e habitual), pendiente de revisar aparte. 212 pruebas, lint y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — test-vault en inglés para las nuevas capturas del README: a pedido del usuario se eliminan `Bienvenida.md`, `Notas/Ideas.md` y `Notas/Proyecto Alfa.md`, y se añaden `Projects/Website Redesign.md` y `Meetings/Kickoff.md`. La e2e real y los scripts de los spikes leen ahora `Meetings/Kickoff.md`; los fixtures grabados conservan las rutas antiguas (son registros históricos). Tests unitarios sin cambios (usan rutas como texto).

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.12:** los títulos de herramientas y permisos muestran rutas relativas al vault (`NoteContext.displayText`); la ruta completa queda en el tooltip de la fila. Detectado en la captura del README, que mostraba la ruta del home del usuario. 213 pruebas, lint y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.12:** la detección de agentes en ajustes abrevia la carpeta del usuario con `~` (`tildePath`), para no mostrar la ruta del home en capturas. Capturas nuevas del README guardadas: `chat.png`, `options-panel.png`, `permission.png`, `context.png`. Se descartó, a pedido del usuario, un cambio para mantener abiertas las sugerencias al perder el foco la ventana.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T6.5:** capturas del README rehechas con el nuevo diseño y el test-vault en inglés: `chat.png` (portada), `permission.png`, `options-panel.png` + `context.png` (misma celda), y ajustes Agents/Sessions/Appearance/Environment recortados por sección con ImageMagick a partir de capturas del usuario. Eliminadas `codex-note.png`, `codex-permission.png` y `settings-context.png`; `codex-permission-long.png` pasa a `docs/images/verification-0.1.0/` (evidencia enlazada desde `checklist-0.1.0.md`). Nota de demostración restaurada tras la edición de prueba. El README con las capturas nuevas no se sube hasta publicar 0.2.0: la ficha de la comunidad toma el README de `main`.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Release 0.2.0 (preparación):** el usuario pide la release. CHANGELOG cerrado en 0.2.0 (Added/Changed/Fixed), `package.json` 0.2.0 y `version-bump.mjs` para `manifest.json`/`versions.json`; T6.12 y T6.13 cerradas tras la revisión visual del usuario. Lint (1 aviso intencionado), build y 214 pruebas correctos. Siguiente: tag `0.2.0`, push, borrador del workflow, verificación de assets y publicación con confirmación.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Auditoría de documentación para 0.2.0** a pedido del usuario. Revisados todos los `.md` (README, CHANGELOG, AGENTS, CLAUDE, plan, docs/): sin enlaces ni rutas rotas. README: funciones (pastillas de opciones persistentes, historial de prompts, apariencia), uso, sección de ajustes con *Appearance*, seguridad (modo sin restricciones guardado se reconfirma; historial solo en memoria) y pasos de release (push de `main` y tag juntos, *attestations*, *Check for new releases*). plan.md: §0.1, RF-22/23/24, §4.11 (disposición real), §4.12 (esquema real de ajustes), §6 (árbol real de `src/`, `tests/`, `scripts/`, `docs/`), §8.4 (procedimiento e historial). AGENTS.md: `styles.css` fuera del límite de 1000 líneas, tokens de apariencia (ADR-032) y push conjunto. `checklist-0.1.0.md`: nota sobre la captura reemplazada. Los documentos históricos (spikes, notas de 0.0.5/0.1.0, bitácora) se conservan como registro.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Release 0.2.0 publicada como Latest** con confirmación del usuario: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.2.0. Tag anotado `0.2.0` subido junto con `main`; workflow Release correcto; `main.js`, `manifest.json` y `styles.css` coinciden por SHA-256 con el build local; `gh attestation verify` de `main.js` correcto; notas tomadas del CHANGELOG. Pendiente: *Check for new releases* en el directorio de la comunidad.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **E2e de Gemini revisada:** no era un fallo del plugin. Con una traza temporal se vio que Gemini lee la nota, pide permiso (aprobado con `proceed_once`) y escribe `resumen.md` **por el canal `fs/write_text_file` de ACP**, con su diff; pero las e2e usaban `hostServices` de los tests, cuyo `writeTextFile` no hace nada (Claude y Codex escriben en disco por su cuenta, ADR-014, por eso no se notaba). La e2e usa ahora `diskHost(vault)`, que lee y escribe de verdad en la copia temporal del vault, como `ObsidianHost`. OpenCode e2e: 2/2. La repetición con Gemini quedó bloqueada por la cuota diaria agotada del proveedor («You have exhausted your daily quota on this model»): pendiente de repetir. 214 pruebas y lint correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — Creado `next.md` para funciones futuras, a pedido del usuario. Primera entrada: **pestañas** para varios agentes en paralelo en la misma vista (indicadores de estado, permisos en segundo plano con aviso, persistencia en el estado de la vista, encaje con `SessionManager`/ADR-005/ADR-022, riesgos y CA en borrador). Sin código. Puntero añadido en §11.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Fix y release 0.2.1** a pedido del usuario: el botón de un permiso nuevo quedaba oculto bajo el cuadro de mensaje. `MessageList` fuerza el seguimiento al llegar una petición de permiso no vista (aunque el usuario haya subido) y observa con `ResizeObserver` una columna interna (`.agenthub-messages-content`) para seguir abajo mientras el contenido crece tras dibujarse (Markdown por bloques). Prueba nueva `MessageScroll.test.tsx`. 215 pruebas, lint (1 aviso intencionado) y build correctos. Publicada con autorización explícita del usuario («cuando termines lanza la release»).

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Fase 8: pestañas** (T8.1–T8.4, ADR-033, RF-25) a pedido del usuario, desde `next.md` §1. `AgentHubView` pasa de una sesión a una lista de pestañas con la activa; `TabBar.tsx` (logo, título, indicador, cerrar, `+`, doble clic/F2 para renombrar, clic central cierra) y `ui/tabs.ts` (`TabActivity`: indicadores permiso/trabajando/error/sin leer y `Notice` cuando una pestaña oculta pide permiso). Núcleo: `ChatSession.rename()` y `sessionTitle` en `DangerousModeRequest` (el diálogo nombra la pestaña). Estado de vista `{tabs, activeTab, sessionId}` compatible con 0.2.x; solo la pestaña visible arranca su agente al restaurar. El historial abre en pestaña nueva (o en la activa si está vacía) y renombrar en el historial renombra la pestaña abierta. Comandos `new-tab`, `close-tab`, `next-tab`, `previous-tab`. Pruebas nuevas en `Tabs.test.tsx`, axe del `TabBar`, `rename` y título en la confirmación; el helper de vista tiene un segundo agente (`codex-acp`) y el mock de `Notice` registra los mensajes. 230 pruebas, lint (1 aviso intencionado) y build correctos. Pendiente: T8.5 (revisión visual del usuario), release 0.3.0 con confirmación y T8.6 (conflictos de edición entre pestañas, límite de concurrencia, reordenar).

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T8.5 y preparación de 0.3.0.** Revisión del usuario en Obsidian: la barra de pestañas pasa arriba de todo, sobre la cabecera, y `TabBar` desplaza la pestaña activa a la vista al montarse (la barra se recrea dentro de la pestaña activa y su scroll volvía al inicio); prueba nueva. El usuario confirma que funciona y pide preparar la release. MINOR por §8.4 (función nueva y cambio del estado guardado de la vista, compatible con 0.2.x). CHANGELOG 0.3.0 (y enlaces de versiones al pie), `package.json`, `manifest.json` y `versions.json` en 0.3.0; commit `chore(release): 0.3.0` y tag anotado `0.3.0` **solo locales**: el push conjunto y la publicación esperan la confirmación del usuario. 231 pruebas, lint (1 aviso intencionado) y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Release 0.3.0 publicada como Latest** con confirmación del usuario («lanza la release»): https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.3.0. El usuario subió `main` (CI correcto) pero el tag no estaba en `origin`, así que `main` tuvo unos minutos el manifest en 0.3.0 sin release; se subió el tag `0.3.0` de inmediato. Workflow Release correcto; `main.js`, `manifest.json` y `styles.css` del borrador coinciden por SHA-256 con el build local; `gh attestation verify` de `main.js` correcto; notas tomadas del CHANGELOG. Pendiente: *Check for new releases* en el directorio de la comunidad.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **T8.6 cerrada** (ADR-034) tras la observación del usuario de que 0.3.0 salió con tareas abiertas: límite de agentes trabajando a la vez (`TurnLimiter`, estado `queued`, ajuste `maxWorkingAgents`), aviso de ediciones compartidas (`EditConflictWatcher`, ajuste `warnEditConflicts`) y reordenar pestañas (arrastrar o Ctrl/Cmd+Shift+←/→). Un test antiguo de `ChatSession` dependía del número de microtareas de `send`: sin límite configurado `send` conserva exactamente el flujo anterior y `queued` solo aparece si hay que esperar. 242 pruebas, lint y build correctos. **E2e de Gemini repetida a pedido del usuario:** los 2 tests agotaron 240 s. No es el plugin: `gemini -p` directo, sin AgentHub, recibe **503 UNAVAILABLE** («high demand… try again later») en todos los reintentos, y Gemini CLI reintenta con backoff hasta el timeout. Además, Gemini CLI 0.62 en modo `-p` exige carpeta de confianza (`GEMINI_CLI_TRUST_WORKSPACE=true` o `--skip-trust`); por ACP no se pudo comprobar si afecta mientras dure el 503. El usuario descarta repetirla (no usa Gemini): deja de figurar como pendiente.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Preparación de 0.4.0** a pedido del usuario. MINOR por §8.4 (funciones nuevas y dos ajustes nuevos, `maxWorkingAgents` y `warnEditConflicts`, que `migrate()` completa con sus valores por defecto). CHANGELOG 0.4.0; `package.json`, `manifest.json` y `versions.json` en 0.4.0; commit `chore(release): 0.4.0` y tag anotado `0.4.0` **solo locales**, a la espera de la confirmación del usuario para el push conjunto y la publicación. 242 pruebas, lint (1 aviso intencionado) y build correctos.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Release 0.4.0 publicada como Latest** con confirmación del usuario: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.4.0. Push conjunto de `main` y del tag `0.4.0`; CI y Release correctos; `main.js`, `manifest.json` y `styles.css` del borrador coinciden por SHA-256 con el build local; `gh attestation verify` de `main.js` correcto; notas tomadas del CHANGELOG. Pendiente: *Check for new releases* en el directorio de la comunidad.

- **2026-10-02 · usuario + Claude (Opus 5.5)** — **Fix y release 0.4.1** a pedido del usuario: el hover de las filas del historial se veía tosco (el estilo de botón de Obsidian ganaba al botón interno y dibujaba borde y sombra dentro de la fila; la fila tenía la esquina izquierda recta). Fila redondeada (`--radius-m`) con transición corta, botón interno sin borde/sombra/relleno con más especificidad (`.agenthub-app button.agenthub-history-open`), sesión actual con barra de acento interna y anillo de foco de teclado en toda la fila (`:has(:focus-visible)`). PATCH por §8.4. Publicada con autorización del usuario («si»): push conjunto de `main` y tag, assets verificados por SHA-256 y attestation.

- **2026-10-05 · Claude (Opus 5.5)** — **Fase 9 (T9.1, T9.2): imágenes en el chat** a pedido del usuario («agregar soporte para pegar capturas o imágenes en el chat»). Partida en verde (242 tests). El modelo ya tenía el bloque `image`, el esquema lo aceptaba y `toContentBlocks` lo traducía si el agente anuncia `promptCapabilities.image` (los fixtures de Claude, Codex, Gemini y OpenCode lo anuncian), pero no había forma de adjuntarlas ni de verlas. Nuevo: `core/images.ts` (límites), `ui/imageFiles.ts` (lectura y redimensionado con canvas), pegar/arrastrar/botón en `Composer`, miniaturas, imágenes en la conversación (clic para ampliar), aviso `imagesNotSent` en `ChatSession` y lista en la exportación. Los tests encontraron que un mensaje solo de imágenes a un agente sin soporte dejaba la sesión ocupada: ahora vuelve a `idle`. De paso, el esquema del transcript acepta `contextNotRestored`, que faltaba. ADR-035, RF-26, §10.7. Lint (1 aviso intencionado), 260 tests y build en verde. Falta: T9.3 (revisión del usuario en Obsidian con agentes reales; no probado aún contra Claude/Codex reales ni el canvas de Electron) y release 0.5.0 con su confirmación.

- **2026-10-05 · usuario + Claude (Opus 5.5)** — **T9.3:** el usuario revisó las imágenes en Obsidian y las aprobó («funciona de pana»). Fase 9 cerrada; falta solo la release 0.5.0, que requiere su confirmación.

- **2026-10-05 · usuario + Claude (Opus 5.5)** — **Release 0.5.0 publicada como Latest** con confirmación del usuario: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.5.0. Push conjunto de `main` y del tag `0.5.0`; CI y Release correctos; `main.js`, `manifest.json` y `styles.css` del borrador coinciden por SHA-256 con el build local; `gh attestation verify` de `main.js` correcto; notas tomadas del CHANGELOG. Pendiente: que el usuario pulse **Check for new releases** en community.obsidian.md.

- **2026-10-06 · usuario + Claude (Opus 5.5)** — **Fix de scroll horizontal** reportado por el usuario tras 0.5.0 (panel estrecho: barra horizontal y botones del cuadro de mensaje fuera de la vista). No se reproducía con el CSS de Obsidian 1.14.4 + tema Tokyo Night + letra 20 px en un arnés con Chromium headless (componentes reales, `playwright-core` fuera del repo); un snippet en la consola del usuario mostró `view-content` con `scrollWidth` 478 frente a `clientWidth` 331 y las pastillas como lo que sobresalía. Causa: la etiqueta `.agenthub-visually-hidden` (absoluta) de la pastilla de dos estados tomaba como bloque contenedor el cuadro de mensaje y escapaba del recorte de la fila desplazable `.agenthub-config.is-inline`; el botón de adjuntar de 0.5.0 empujó las pastillas y lo dejó a la vista. Arreglo: `position: relative` en `.agenthub-pill` (el panel de opciones es hermano del botón y sigue ocupando el ancho del cuadro, comprobado). De paso, las rutas largas de adjuntos y de ubicaciones de herramientas se parten. Verificado en el arnés a 500/380/300/240 px sin desbordamiento. El usuario lo confirmó en su vault («ahora sii») y subió `main`; release 0.5.1 (PATCH) con su confirmación.
