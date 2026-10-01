# AgentHub para Obsidian — Plan maestro

> **Documento vivo.** Es la fuente de verdad del proyecto. Este archivo es el **punto de entrada**: estado,
> protocolo, roadmap y convenciones. El resto del plan está en [`docs/plan/`](docs/plan/) (ver índice).
> Cualquier agente o persona que retome el trabajo debe **leer la §0 primero** y **actualizar el plan al terminar**.

- **Nombre provisional:** AgentHub · **id del plugin:** `agenthub` (verificar que no esté tomado; ver §14)
- **Repositorio local:** `~/workspace/agenthub-plugin-obsidian`
- **Creado:** 2026-10-01
- **Idioma del código:** inglés (identificadores, comentarios). **Idioma de docs/UI:** español + inglés (i18n).

---

## Índice

| § | Tema | Archivo |
|---|---|---|
| 0 | Estado actual y protocolo para retomar | este archivo |
| 1–2 | Visión, objetivos, requerimientos | [`docs/plan/01-vision-requerimientos.md`](docs/plan/01-vision-requerimientos.md) |
| 3 | Contexto técnico verificado (CLIs, ACP, paquetes) | [`docs/plan/02-contexto-tecnico.md`](docs/plan/02-contexto-tecnico.md) |
| 4 | Arquitectura | [`docs/plan/03-arquitectura.md`](docs/plan/03-arquitectura.md) |
| 5 | Especificación de adaptadores | [`docs/plan/04-adaptadores.md`](docs/plan/04-adaptadores.md) |
| 6–9 | Estructura del repo, stack, flujo de desarrollo, pruebas | [`docs/plan/05-desarrollo.md`](docs/plan/05-desarrollo.md) |
| 10, 13 | Seguridad, privacidad, riesgos | [`docs/plan/06-seguridad-riesgos.md`](docs/plan/06-seguridad-riesgos.md) |
| 11 | Roadmap y tareas | este archivo |
| 12 | Decisiones de arquitectura (ADR) | [`docs/plan/07-decisiones-adr.md`](docs/plan/07-decisiones-adr.md) |
| 14–16 | Preguntas abiertas, convenciones, glosario | este archivo |
| 17 | Bitácora | [`docs/plan/bitacora.md`](docs/plan/bitacora.md) |
| — | Informes de spikes | [`docs/spikes/`](docs/spikes/) |

---

## 0. Estado actual y protocolo para retomar

### 0.1 Estado (actualizar en cada sesión de trabajo)

| Campo | Valor |
|---|---|
| Fase actual | **Fase 2 — Núcleo + ACP** (T2.1 ✅, T2.2 ✅). Fase 0 cerrada. Pendiente manual: S5 (render en Obsidian, cuando haya mensajes). |
| Próxima tarea | **T2.3** (`ProcessRunner` + `ProcessRegistry` + `LineDecoder`) |
| Tareas en paralelo posibles | T2.2 ∥ T2.3 ∥ T2.4 (independientes entre sí) |
| Bloqueos | Ninguno |
| Última actualización | 2026-10-01 — scaffolding de Fase 0 (Claude Opus 5.5) |
| Código existente | Scaffolding: build/lint/test en verde, vista lateral vacía con Preact, i18n es/en, vault de pruebas. Repo git en rama `main` con los commits de Fase 0 (sin remoto). |

### 0.2 Protocolo para un agente que retoma el trabajo

1. **Leer** este archivo completo y, de `docs/plan/`, como mínimo la arquitectura (§4) y la última entrada de
   la bitácora (§17). El resto según la tarea (p. ej. §5 para adaptadores).
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
   - Añadir una entrada al final de la **Bitácora** (`docs/plan/bitacora.md`, §17): fecha, agente, qué se hizo, qué falta, bloqueos.
   - Si se tomó o cambió una decisión de arquitectura, **añadir un ADR nuevo** en `docs/plan/07-decisiones-adr.md` (§12)
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

## 11. Roadmap y tareas

> Cada tarea: ID, descripción, dependencias, criterio de aceptación (CA). Marcar `[x]` al completar.

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
- [~] **T0.7** *(workflow `.github/workflows/ci.yml` creado; falta remoto en GitHub)* CI de GitHub Actions (lint + test + build) — si hay remoto. *CA:* pipeline verde.

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
- [ ] **S5 Render** — En el vault de pruebas, medir `MarkdownRenderer.render` re-renderizando un
  mensaje de 20 KB cada 100 ms. *CA:* decidir throttle y si hace falta render incremental.

### Fase 2 — Núcleo + ACP (MVP)

- [x] **T2.1** `core/types.ts` y `core/AgentAdapter.ts` según §4.3–4.4. *CA:* compila; sin `any`.
- [x] **T2.2** `ShellEnv` + `BinaryResolver` + tests. *Dep:* S1. *CA:* resuelve `claude`, `codex`,
  `gemini`, `opencode`, `npx` en este equipo lanzando Obsidian desde el lanzador gráfico.
- [ ] **T2.3** `ProcessRunner` + `ProcessRegistry` + `LineDecoder` + tests (con scripts de prueba que
  emiten JSONL partido, UTF-8 multibyte, líneas enormes, y que ignoran SIGTERM).
  *CA:* ningún proceso huérfano tras `dispose()`/`onunload`.
- [ ] **T2.4** `scripts/fake-acp-agent.mjs` con los escenarios de §9. *Dep:* S2.
- [ ] **T2.5** `AcpAdapter` (§5.1) + `mapping.ts` + `pathGuard.ts` + tests de integración con el fake.
  *Dep:* T2.1–T2.4. *CA:* todos los escenarios del fake pasan.
- [ ] **T2.6** `reducer.ts` + `ChatSession` + `SessionManager` (sin persistencia aún) + tests con fixtures.
- [ ] **T2.7** `AgentRegistry` + presets (§5.4) + `SettingsTab` (lista de agentes, estado de
  detección, editar comando/args/env, agente por defecto, agentes personalizados). *CA:* RF-02, RF-15, RF-20.
- [ ] **T2.8** UI: `Header` (selector de agente + estado), `MessageList`, `AssistantMessage` +
  `Markdown` (throttle), `ToolCallCard`, `PermissionCard`, `PlanView`, `Composer` (enviar/detener),
  `StatusBar`, `DebugPanel`. *CA:* RF-04, RF-05, RF-06 (ACP), RF-07, RF-19.
- [ ] **T2.9** Selector de modo/modelo cuando el agente los expone. *CA:* RF-12 para ACP.
- [ ] **T2.10** Manejo de errores de §4.14 (binario faltante, auth, crash, timeout).

**Criterio de salida F2 (MVP):** desde el sidebar, con **Claude (ACP)** y **Codex (ACP)** —y Gemini/OpenCode
si están disponibles—: enviar un prompt, ver la respuesta en streaming renderizada, ver tool calls,
aprobar y denegar un permiso, cancelar un turno; al cerrar la vista o desactivar el plugin no quedan procesos.

### Fase 3 — Integración con Obsidian (contexto)

- [ ] **T3.1** `PromptBuilder` (§4.8) + tests (ACP y texto). *CA:* RF-08 (lógica).
- [ ] **T3.2** Chips de contexto: nota activa (toggle, sigue a la hoja activa), selección. *CA:* RF-08 (UI).
- [ ] **T3.3** Sugeridor `@` de archivos (fuzzy con `prepareFuzzySearch`, carpetas incluidas).
- [ ] **T3.4** Sugeridor `/` alimentado por `available_commands_update`. *CA:* RF-09.
- [ ] **T3.5** Comandos (§4.13) + entrada en menú contextual del editor ("Enviar selección a AgentHub"). *CA:* RF-14.
- [ ] **T3.6** Rutas y wikilinks clicables en mensajes y tool cards. *CA:* RF-17.
- [ ] **T3.7** Modos de directorio de trabajo + instrucciones del vault configurables. *CA:* RF-16.

### Fase 4 — Persistencia e historial

- [ ] **T4.1** `SessionStore` (índice + JSONL, debounce, retención) + tests.
- [ ] **T4.2** Panel de historial (listar, buscar, renombrar, borrar, reanudar). Reanudar con
  `loadSession` si existe; si no, modo lectura + "Continuar en sesión nueva". *CA:* RF-10.
- [ ] **T4.3** Restaurar la sesión mostrada en cada vista al reiniciar Obsidian (`getState/setState`). *CA:* RF-01.
- [ ] **T4.4** Export de sesión a nota (§4.10). *CA:* nota válida con callouts plegables.
- [ ] **T4.5** Múltiples vistas/sesiones simultáneas + reaper de inactividad. *CA:* RF-11; procesos liberados tras `idleTimeoutMin`.

### Fase 5 — Adaptadores directos (sin adaptadores ACP)

- [ ] **T5.1** `ClaudeNativeAdapter` + parser + tests con fixtures S3. *Dep:* S3.
- [ ] **T5.2** `CodexNativeAdapter` + parser + tests con fixtures S4. *Dep:* S4.
- [ ] **T5.3** UX de permisos en modo directo: selector de modo de Claude, denegaciones con
  "Permitir y reintentar", selector de sandbox de Codex con confirmación para modos peligrosos.
- [ ] **T5.4** Uso/coste en la barra de estado (Claude `result`, Codex `turn.completed`, ACP si lo reporta). *CA:* RF-13.
- [ ] **T5.5** *(Opcional)* `bridge/`: servidor MCP HTTP local (127.0.0.1 + token) con herramienta
  `approve` (para `--permission-prompt-tool`) y herramientas del vault (`get_active_note`,
  `search_vault`, `open_note`), inyectado en ACP (`mcpServers`) y en Claude (`--mcp-config`).
- [ ] **T5.6** *(Opcional)* Adaptador `codex app-server` (tipos con `generate-ts`) para aprobaciones
  interactivas sin `codex-acp`.

### Fase 6 — Pulido y publicación

- [ ] **T6.1** Vista de diffs (jsdiff) para `ToolContent.diff` y `file_change`; botón "abrir archivo". *CA:* RF-18.
- [ ] **T6.2** i18n es/en completo; textos en *sentence case*.
- [ ] **T6.3** Accesibilidad (teclado, aria, foco tras enviar/permiso) y revisión de temas.
- [ ] **T6.4** Rendimiento: virtualización de la lista si S5/uso real lo exige; medir carga del plugin.
- [ ] **T6.5** README completo (capturas, requisitos, instalación de adaptadores, seguridad, privacidad).
- [ ] **T6.6** Workflow de release + BRAT + checklist manual (§9) + envío a la comunidad.

### Fase 7 — Opcional: modo terminal

- [ ] **T7.1** Spike de PTY sin módulos nativos (helper Python `pty` o `script(1)` en Linux/macOS;
  Windows: evaluar). Redimensionado de la terminal.
- [ ] **T7.2** Vista con `@xterm/xterm` que ejecuta la TUI original del agente. *CA:* RF-21.

---

## 14. Preguntas abiertas

| # | Pregunta | Supuesto actual (hasta que se decida) |
|---|---|---|
| Q1 | Nombre e `id` definitivos (¿"AgentHub" / `agenthub` libre en `community-plugins.json`?). | AgentHub / `agenthub`. |
| Q2 | Licencia. | MIT. |
| Q3 | ¿Publicar en la tienda de la comunidad o uso personal/BRAT? | Diseñar para publicar; decidir en Fase 6. |
| Q4 | ¿Prioridad de agentes para el MVP? | Claude Code y Codex (vía ACP); Gemini/OpenCode "gratis" por ACP. |
| Q5 | ¿Idioma principal de la UI? | Inglés por defecto + español completo (sigue el idioma de Obsidian). |
| Q6 | ¿Se requiere el modo directo si ACP funciona bien en S2? | Sí, pero en Fase 5 y re-evaluable tras S2. |
| Q8 | Codex por ACP arranca en modo `agent` (*Auto review*) y escribe sin pedir permiso; OpenCode tampoco pide. ¿AgentHub debe forzar un modo más conservador al crear la sesión (p. ej. `read-only` / `workspace-write` en Codex)? | Respetar el modo por defecto del agente pero mostrarlo siempre en la cabecera; decidir antes de T2.9. |
| Q7 | ¿Ofrecer instalación automática de adaptadores (`npm i -g …`) desde ajustes? | No en MVP; solo instrucciones y botón copiar comando. |

---

## 15. Convenciones y Definition of Done

**Código**
- TypeScript `strict`; sin `any` en `core/` y `adapters/` (usar `unknown` + guardas).
- `core/` y `adapters/` no importan `obsidian` (excepto `HostBridgeImpl.ts`).
- Nombres: clases `PascalCase`, archivos de clase `PascalCase.ts`, utilidades `camelCase.ts`, componentes `PascalCase.tsx`.
- Recursos de Obsidian siempre con `this.register*`; nada de listeners globales sin limpieza.
- Usar `this.app`, nunca el global `app`. Sin `innerHTML`/`outerHTML`. Estilos solo en `styles.css`
  con prefijo `agenthub-` y variables CSS de Obsidian.
- Textos de UI en *sentence case* y a través de `t()` (i18n).

**Commits**: Conventional Commits con ID de tarea: `feat(ui): permission card [T2.8]`, `fix(process): kill group on unload [T2.3]`.

**Tamaño de archivos**: ningún archivo debe superar **1000 líneas** salvo justificación explícita (archivos
generados como `pnpm-lock.yaml` o fixtures grabados). Antes de llegar al límite, dividir por responsabilidad
(código: un módulo por concepto; docs: un archivo por tema, como `docs/plan/`).

**Definition of Done de una tarea**
1. Código + tests (unitarios o de integración según la tarea).
2. `pnpm lint && pnpm test && pnpm build` en verde.
3. Si toca UI: probado manualmente en `test-vault` (anotar en la bitácora qué se probó).
4. Plan actualizado: checkbox y §0.1 en `plan.md`; bitácora; ADR si aplica; ⚠️ resueltos en `docs/plan/`.

---

### 15.1 Notas del entorno de trabajo

- Skills locales de agentes en `.agents/skills/` (enlazadas desde `.claude/skills/`) y `skills-lock.json`,
  instaladas con autoskills: accessibility, frontend-design, nodejs-backend-patterns,
  nodejs-best-practices, seo, typescript-advanced-types, vitest. **Están en `.gitignore`** (no se suben a GitHub).
  Útiles aquí: `vitest`, `typescript-advanced-types`, `accessibility`, `frontend-design`, `nodejs-best-practices`.
- Lint: las reglas de `eslint-plugin-obsidianmd` no permiten `eslint-disable` en línea; las excepciones
  para `scripts/` y `tests/` se configuran en `eslint.config.mjs`.
- El mock `tests/__mocks__/obsidian.ts` replica solo lo necesario (incluye `HTMLElement#addClass`); ampliarlo según haga falta.

---

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
