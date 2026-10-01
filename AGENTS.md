# AgentHub — instrucciones para agentes

**Lee `plan.md` antes de hacer nada.** Es la fuente de verdad: la §0 dice el estado actual, la
próxima tarea y el protocolo para retomar y cerrar el trabajo (marcar tareas, actualizar §0.1,
añadir una entrada a la bitácora §17, registrar ADR en §12).

## Comandos

```bash
npm install          # .npmrc usa legacy-peer-deps (peer exacto de eslint-plugin-obsidianmd)
npm run lint         # ESLint + reglas de eslint-plugin-obsidianmd
npm test             # Vitest (jsdom; `obsidian` se sustituye por tests/__mocks__/obsidian.ts)
npm run build        # tsc --noEmit + esbuild producción → main.js
npm run dev          # esbuild en modo watch
npm run link-vault   # enlaza el build en test-vault/.obsidian/plugins/agenthub
```

Todo debe estar en verde antes de empezar y antes de cada commit.

## Reglas rápidas

- `src/core/` y `src/adapters/` no importan `obsidian` (ver plan §4.2).
- Sin `innerHTML`; estilos solo en `styles.css` con prefijo `agenthub-` y variables CSS de Obsidian.
- Textos de UI vía `t()` (`src/i18n/`), con las mismas claves en `en.ts` y `es.ts`.
- Commits: Conventional Commits con el ID de tarea, p. ej. `feat(ui): permission card [T2.8]`.
- Los datos marcados con ⚠️ en `plan.md` se verifican contra la herramienta real antes de usarlos.
