# AgentHub — Bitácora

> Parte del plan maestro. Empieza siempre por [`plan.md`](../../plan.md) (estado actual y protocolo).
> Los números de sección (§) son los mismos en todos los archivos del plan.
> Añadir entradas **al final**. Si este archivo se acerca a 1000 líneas, continuar en `bitacora-2.md` y enlazarlo aquí.

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
- **2026-10-01 · Claude (Opus 5.5)** — A pedido del usuario, límite de **1000 líneas por archivo** (salvo
  justificación). `plan.md` (1401 líneas) se dividió: queda como punto de entrada (§0, §11, §14–16) y el resto pasa a
  `docs/plan/` (01 visión/requerimientos, 02 contexto técnico, 03 arquitectura, 04 adaptadores, 05 desarrollo,
  06 seguridad/riesgos, 07 ADR, bitácora). Los números de sección se conservan.
