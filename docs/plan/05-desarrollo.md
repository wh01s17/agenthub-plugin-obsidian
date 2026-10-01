# AgentHub — Repositorio, stack, desarrollo y pruebas

> Parte del plan maestro. Empieza siempre por [`plan.md`](../../plan.md) (estado actual y protocolo).
> Los números de sección (§) son los mismos en todos los archivos del plan.

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
├── src/
│   ├── main.ts                     # AgentHubPlugin
│   ├── constants.ts                # VIEW_TYPE, ids
│   ├── i18n/                       # es.ts, en.ts, t()
│   ├── settings/
│   │   ├── settings.ts             # tipos, defaults, presets, migrate()
│   │   └── SettingsTab.ts
│   ├── core/
│   │   ├── types.ts                # §4.3
│   │   ├── AgentAdapter.ts         # §4.4
│   │   ├── AgentRegistry.ts        # presets → adaptadores, detección cacheada
│   │   ├── ChatSession.ts          # orquesta un AgentSession + estado + permisos pendientes
│   │   ├── reducer.ts              # (state, event) → state, puro
│   │   ├── SessionManager.ts       # crea/reanuda/cierra sesiones, reaper de inactividad
│   │   ├── PromptBuilder.ts        # §4.8
│   │   └── HostBridgeImpl.ts       # implementación con Obsidian (única pieza de core que importa obsidian)
│   ├── process/
│   │   ├── ProcessRunner.ts
│   │   ├── ProcessRegistry.ts
│   │   ├── LineDecoder.ts          # JSONL robusto
│   │   ├── ShellEnv.ts
│   │   └── BinaryResolver.ts
│   ├── adapters/
│   │   ├── acp/AcpAdapter.ts, mapping.ts, pathGuard.ts
│   │   ├── claude-native/ClaudeNativeAdapter.ts, args.ts, parser.ts, toolKinds.ts
│   │   ├── codex-native/CodexNativeAdapter.ts, args.ts, parser.ts
│   │   └── fake/FakeAdapter.ts     # en memoria, para UI/tests
│   ├── bridge/                     # Fase 5: servidor MCP local
│   ├── storage/
│   │   ├── SessionStore.ts
│   │   └── exportToNote.ts
│   ├── ui/
│   │   ├── AgentHubView.ts         # ItemView que monta Preact
│   │   ├── App.tsx
│   │   ├── components/             # Header, MessageList, AssistantMessage, Markdown, ToolCallCard,
│   │   │                           # PermissionCard, PlanView, Composer, ContextChips, StatusBar, HistoryPanel, DebugPanel
│   │   ├── hooks/                  # useSessionState, useThrottledValue
│   │   └── suggest/                # FileMentionSuggest, SlashCommandSuggest
│   └── utils/                      # logger, paths, throttle, ids
├── tests/
│   ├── __mocks__/obsidian.ts
│   ├── fixtures/acp/<agente>/*.jsonl
│   ├── fixtures/claude/*.jsonl
│   ├── fixtures/codex/*.jsonl
│   ├── unit/*.test.ts
│   └── integration/*.test.ts       # con fake-acp-agent; e2e reales tras AGENTHUB_E2E=1
├── scripts/
│   ├── fake-acp-agent.mjs          # agente ACP simulado con escenarios
│   ├── record-fixture.sh           # graba salidas reales de CLIs a tests/fixtures
│   ├── link-test-vault.mjs         # enlaza el build a test-vault/.obsidian/plugins/agenthub
│   └── version-bump.mjs
├── docs/
│   ├── spikes/S1-env.md … S5-render.md
│   └── adr/                        # ADR largos si no caben en §12
└── test-vault/                     # vault de desarrollo (notas de ejemplo; .obsidian parcialmente ignorado)
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
| `fake-agent` | Ejecuta `scripts/fake-acp-agent.mjs` para pruebas manuales. |
| `version` | `version-bump.mjs`: sincroniza `manifest.json` y `versions.json`. |

### 8.3 Depuración

- DevTools de Obsidian: `Ctrl+Shift+I`. Filtrar consola por `[AgentHub]`.
- Para simular el entorno real de lanzamiento (sin PATH de mise), arrancar Obsidian desde el lanzador
  de Hyprland, no desde una terminal.
- Agente simulado: añadir en ajustes un agente ACP personalizado con
  `command: node`, `args: [<ruta>/scripts/fake-acp-agent.mjs, --scenario, permissions]`.

### 8.4 Release

1. `pnpm version <patch|minor|major>` (actualiza manifest/versions).
2. Push del tag → workflow `release.yml` crea el release con `main.js`, `manifest.json`, `styles.css`.
3. Beta: distribuir con BRAT. Publicación: PR a `obsidianmd/obsidian-releases` (`community-plugins.json`).

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
