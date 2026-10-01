# Spike S1 — Entorno y PATH dentro de Obsidian (2026-10-01)

Obsidian 1.13.7 lanzado desde el lanzador de Hyprland (Omarchy), consola de DevTools.
Se comparó `command -v <cmd>` con `process.env` del renderer frente al entorno de
`$SHELL -ilc 'env -0'` (shell de login interactivo, zsh).

| cmd      | `process.env` de Obsidian            | entorno del shell de login                      |
| -------- | ------------------------------------ | ----------------------------------------------- |
| claude   | `~/.local/share/mise/shims/claude`   | `~/.local/bin/claude`                           |
| codex    | `~/.local/share/mise/shims/codex`    | `~/.local/bin/codex`                            |
| opencode | `~/.local/share/mise/shims/opencode` | `~/.local/bin/opencode`                         |
| node     | `~/.local/share/mise/shims/node`     | `~/.config/nvm/versions/node/v24.19.0/bin/node` |
| npx      | `~/.local/share/mise/shims/npx`      | `~/.config/nvm/versions/node/v24.19.0/bin/npx`  |

- Shell de login: **1437 ms**, exit 0. Hay 4 variables `ELECTRON_*`/`NODE_OPTIONS`/`CHROME*` en el entorno del
  renderer (nombres por revisar en T2.3).

## Conclusiones

1. En este equipo **`process.env` ya basta**: la sesión gráfica de Omarchy incluye los shims de mise.
   La hipótesis de §3.1 del plan ("Obsidian no verá los agentes") era incorrecta para este entorno, aunque sigue
   siendo cierta en macOS y en escritorios sin esa configuración.
2. El shell de login es **caro (≈1,4 s)** y **resuelve binarios distintos** (otro orden de PATH: nvm antes que
   mise). No debe ejecutarse siempre ni de forma síncrona.
3. Estrategia (ADR-017): resolver primero con `process.env`; solo si un comando no aparece, ejecutar el shell de
   login **de forma asíncrona**, cachear el resultado y añadir sus rutas **al final** del `PATH` (sin cambiar
   qué binario gana cuando ya existe). Ruta absoluta configurable por agente como último recurso.
