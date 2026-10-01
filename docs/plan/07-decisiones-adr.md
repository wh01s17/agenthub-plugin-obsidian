# AgentHub — Decisiones de arquitectura (ADR)

> Parte del plan maestro. Empieza siempre por [`plan.md`](../../plan.md) (estado actual y protocolo).
> Los números de sección (§) son los mismos en todos los archivos del plan.

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
| ADR-008 | Sin módulos nativos (`node-pty`); modo terminal pospuesto a Fase 7. | Los plugins de la comunidad solo distribuyen JS. | `node-pty` empaquetado (ABI de Electron, no distribuible). | Aceptada |
| ADR-009 | Las escrituras `fs/write_text_file` de ACP pasan por la Vault API con guardia de rutas. | Obsidian refresca editores abiertos; control de `.obsidian/`. | Escritura directa con `fs` (desincroniza editores). | Aceptada |
| ADR-010 | Fijar versiones de adaptadores ACP en los presets. | Los adaptadores evolucionan rápido (p. ej. renombres de paquetes). | `@latest` (roturas silenciosas). | Aceptada |
| ADR-011 | `minAppVersion` 1.8.7 (antes 1.7.2). | `getLanguage()` (i18n) existe desde 1.8.7; el entorno usa 1.13.7. | Leer el idioma de `localStorage` (no documentado). | Aceptada |
| ADR-014 | Los agentes escriben directamente en disco (S2); el refresco de editores depende del watcher de Obsidian. Se siguen anunciando y sirviendo `fs/*` (con guardia), pero la protección real del vault es el **modo de permisos** del agente. | Ningún agente probado usa `fs/*` del cliente. | Forzar escrituras por `fs/*` (no está en nuestra mano). | Aceptada (matiza ADR-009) |
| ADR-015 | Modo y modelo se exponen en la UI a partir de `configOptions` (`session/set_config_option`); `modes`/`models` solo como respaldo. | Es lo único común a Claude, Codex y OpenCode. | Selectores separados por `modes`/`models` (OpenCode quedaría sin selector). | Aceptada |
| ADR-016 | Usar el builder `acp.client()` del SDK 1.6, no `ClientSideConnection`. | `ClientSideConnection` está deprecado. | API deprecada. | Aceptada |
| ADR-017 | `PATH`: `process.env` primero; shell de login solo como respaldo asíncrono y cacheado, añadiendo rutas al final. | S1: en este equipo `process.env` ya encuentra todo; el shell cuesta ≈1,4 s y cambia el binario elegido. | Fusionar siempre el entorno del shell (lento y cambia binarios). | Aceptada (matiza ADR-006) |
| ADR-013 | **pnpm** como gestor de paquetes; config en `pnpm-workspace.yaml` (`allowBuilds: esbuild`, `strictPeerDependencies: false`); lockfile `pnpm-lock.yaml`. | Preferencia del usuario. | npm (usado al inicio, reemplazado). | Aceptada |
| ADR-012 | TypeScript 6.0.x (no 7) y ESLint 9 (no 10); `strictPeerDependencies: false` en `pnpm-workspace.yaml`. | `typescript-eslint` 8.71 exige TS < 6.1; `eslint-plugin-obsidianmd` 0.4.2 exige ESLint ≥ 9 y declara `obsidian@1.8.7` como peer exacto. Vitest 5 necesita `vite` explícito. | Seguir los peers exactos (tipos de Obsidian antiguos). | Aceptada |
