# AgentHub — instrucciones para agentes

**Lee `plan.md` antes de hacer nada.** Es la fuente de verdad: la §0 dice el estado actual, la
próxima tarea y el protocolo para retomar y cerrar el trabajo (marcar tareas, actualizar §0.1,
añadir una entrada a la bitácora §17, registrar ADR en §12).

## Comandos

```bash
pnpm install       # config de pnpm en pnpm-workspace.yaml (allowBuilds, peers)
pnpm lint          # ESLint + reglas de eslint-plugin-obsidianmd
pnpm test          # Vitest (jsdom; `obsidian` se sustituye por tests/__mocks__/obsidian.ts)
pnpm build         # tsc --noEmit + esbuild producción → main.js
pnpm dev           # esbuild en modo watch
pnpm link-vault    # enlaza el build en test-vault/.obsidian/plugins/agenthub
```

Todo debe estar en verde antes de empezar y antes de cada commit.

## Reglas rápidas

- `src/core/` y `src/adapters/` no importan `obsidian` (ver plan §4.2).
- Ningún archivo de código supera 1000 líneas salvo justificación (no aplica a `plan.md` ni a `styles.css`, la única
  hoja que carga Obsidian).
- Nunca devolver un `Setting` ni componentes de Obsidian desde callbacks de promesa o funciones `async`: son
  *thenables* (Obsidian 1.13) y congelan la app. Usa cuerpos de bloque.
- Sin `innerHTML`; estilos solo en `styles.css` con prefijo `agenthub-` y variables CSS de Obsidian. La apariencia
  configurable cambia tokens `--agenthub-*` mediante atributos `data-*` de `.agenthub-app` (ADR-032).
- Textos de UI vía `t()` (`src/i18n/`), con las mismas claves en `en.ts` y `es.ts`.
- Commits: Conventional Commits con el ID de tarea, p. ej. `feat(ui): permission card [T2.8]`.
- Versiones y releases: seguir la política de `plan.md` §8.4 (SemVer, tag sin `v`, no usar `pnpm version`,
  push de `main` y del tag juntos, publicar solo con confirmación del usuario).
- Los datos marcados con ⚠️ en `plan.md` se verifican contra la herramienta real antes de usarlos.
