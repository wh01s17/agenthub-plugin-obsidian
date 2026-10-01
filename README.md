# AgentHub

Plugin de Obsidian (solo escritorio) para conversar con agentes de código como **Claude Code**,
**Codex** u **OpenCode** desde una vista lateral, con el contexto de tus notas.

> Estado: Fases 0–4 completas y Fase 6 (pulido) en curso. Ver [`plan.md`](plan.md) para la
> arquitectura, el roadmap y la bitácora.

## Qué hace

- **Chat con el agente en el sidebar**, con respuestas en streaming renderizadas con el Markdown de Obsidian.
- **Herramientas visibles:** cada lectura, edición o comando del agente aparece como una fila; las
  ediciones muestran el **diff** y la ruta abre la nota.
- **Permisos interactivos:** cuando el agente pide permiso (p. ej. para editar una nota) eliges
  permitir una vez, siempre o rechazar. Botón **Stop** para cortar un turno.
- **Contexto de Obsidian:** la nota actual viaja con el mensaje (desactivable con su chip), puedes
  enviar una **selección** y mencionar notas con **`@`**. Los comandos del agente se autocompletan con **`/`**.
- **Opciones del agente** (modo, modelo, esfuerzo…) elegibles antes de empezar a conversar.
- **Historial:** las conversaciones se guardan, se buscan, renombran, borran y **se reanudan** con
  el contexto del agente. La vista recuerda su conversación tras reiniciar Obsidian.
- **Exportar** una sesión a una nota Markdown.
- Cada agente tiene su **color y monograma** (Claude «C» naranja, Codex «Cx» verde, OpenCode «O» morado…).

## Requisitos

- Obsidian **de escritorio** 1.8.7 o superior (no funciona en móvil: necesita lanzar procesos).
- Los agentes que quieras usar, **instalados y con sesión iniciada** en tu equipo.
- **Node.js** (incluye `npx`) para Claude Code y Codex, que se conectan mediante adaptadores ACP
  que `npx` descarga la primera vez.

| Agente      | Comando que usa AgentHub                                                    | Antes de usarlo                                                                                   |
| ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Claude Code | `npx -y @agentclientprotocol/claude-agent-acp@0.85.0`                       | Inicia sesión en `claude` (`/login`).                                                             |
| Codex       | `npx -y @agentclientprotocol/codex-acp@2.1.1`                               | `codex login`.                                                                                    |
| OpenCode    | `opencode acp`                                                              | `opencode auth login`.                                                                            |
| Gemini CLI  | `gemini --acp`                                                              | Desactivado por defecto: las cuentas personales de Gemini Code Assist ya no admiten este cliente. |
| Otros       | Cualquier agente que hable [ACP](https://agentclientprotocol.com) por stdio | Añádelo en los ajustes.                                                                           |

Para que el primer arranque sea más rápido puedes instalar los adaptadores de forma global:
`npm i -g @agentclientprotocol/claude-agent-acp @agentclientprotocol/codex-acp`.

## Instalación

El plugin aún no está en la tienda de la comunidad. Hasta entonces:

1. Compila (ver [Desarrollo](#desarrollo)) o descarga `main.js`, `manifest.json` y `styles.css`.
2. Cópialos en `<tu-vault>/.obsidian/plugins/agenthub/`.
3. En **Settings → Community plugins**, activa **AgentHub**.

Ten el vault bajo control de versiones o con copia de seguridad antes de dejar que un agente lo edite
(ver [Privacidad y seguridad](#privacidad-y-seguridad)).

## Uso

- Abre la vista con el **icono del robot** de la cinta o el comando **Open AgentHub**.
- Elige el agente y sus opciones en la cabecera, escribe y pulsa **Intro** (Mayús+Intro para nueva línea;
  configurable a Ctrl/Cmd+Intro).
- **`@`** para mencionar una nota, **`/`** al inicio para los comandos del agente.
- Icono de **reloj**: historial de sesiones. Icono de **lápiz**: sesión nueva.

Comandos de la paleta (sin atajos por defecto; asígnalos en **Settings → Hotkeys**):

| Comando                               | Qué hace                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Open AgentHub                         | Abre o muestra la vista.                                                                     |
| Open AgentHub in a new pane           | Otra vista con su propia sesión.                                                             |
| Send selection to AgentHub            | Adjunta el texto seleccionado al próximo mensaje (también en el menú contextual del editor). |
| Ask AgentHub about the current note   | Abre la vista con la nota actual adjunta.                                                    |
| Start a new AgentHub session          | Sesión nueva con el mismo agente.                                                            |
| Stop the current AgentHub turn        | Detiene al agente.                                                                           |
| Export the AgentHub session to a note | Crea una nota con la conversación en la carpeta de exportación.                              |

## Ajustes

- **Agentes:** activar o desactivar, ver si se encontraron, editar comando, argumentos, variables de
  entorno y opciones iniciales, añadir agentes ACP propios, volver a detectar.
- **Sesiones:** directorio de trabajo (raíz del vault o carpeta propia), instrucciones para el vault,
  incluir la nota actual por defecto, tecla de envío, mostrar el razonamiento, panel de depuración,
  guardado y retención del historial, carpeta de exportación, minutos de inactividad antes de detener
  un agente (15 por defecto; la conversación continúa al volver a escribir).
- **Entorno:** usar el `PATH` de tu shell de inicio si un comando no aparece, y carpetas extra de `PATH`.

## Privacidad y seguridad

- AgentHub lanza como procesos locales los agentes que tú ya tienes instalados. No hace llamadas de red
  propias ni envía telemetría; cada agente se conecta a su proveedor por su cuenta.
- Los agentes pueden **leer y modificar archivos del vault y ejecutar comandos** según el modo de
  permisos que elijas. Algunos (Codex en "Auto review", OpenCode) editan sin preguntar en su modo por
  defecto: revisa el modo en la cabecera. Ten el vault bajo control de versiones o con copia de seguridad.
- Las notas pueden contener instrucciones maliciosas que un agente podría seguir; los permisos
  interactivos son tu control.
- Las conversaciones se guardan en `<configDir>/plugins/agenthub/sessions/` (normalmente dentro de
  `.obsidian`), con las notas y selecciones adjuntas. La sincronización del vault o Git puede incluirlas.
  Puedes desactivar el guardado y cambiar la retención (200 sesiones por defecto) en los ajustes.
- Las variables de entorno que definas por agente se guardan en texto plano en los datos del plugin.

## Problemas comunes

- **"No se encontró el comando del agente":** instala el agente o fija su ruta absoluta en los ajustes.
  Si lo instalaste con mise, nvm o similar y abres Obsidian desde el lanzador del escritorio, activa
  "Usar el PATH del shell de inicio" o añade la carpeta en "Carpetas extra de PATH".
- **"El agente necesita que inicies sesión":** ejecuta en una terminal el comando de login de la tabla.
- **La primera respuesta tarda:** `npx` está descargando el adaptador ACP; instálalo de forma global.
- **Errores al cargar:** consola de desarrollador con `Ctrl+Shift+I` (`Cmd+Opt+I` en macOS), filtra por
  `AgentHub`. Activa el **panel de depuración** en los ajustes para ver la salida cruda del agente.

## Desarrollo

Requisitos: Node.js 22 o superior y pnpm.

```bash
pnpm install
pnpm build         # tsc + esbuild → main.js
pnpm link-vault    # enlaza el build en test-vault/.obsidian/plugins/agenthub/
pnpm dev           # recompila en cada cambio
pnpm lint
pnpm test          # Vitest; pnpm test:coverage para cobertura
pnpm test:e2e      # contra agentes reales (AGENTHUB_E2E_AGENTS=opencode,claude-acp,codex-acp)
pnpm fake-agent    # agente ACP simulado para probar sin gastar tokens
```

Para probar en Obsidian: abre `test-vault/` como vault (**Manage vaults → Open folder as vault**),
activa los plugins de la comunidad y AgentHub. Con el plugin **Hot Reload** (pjeby) instalado en ese
vault, `pnpm dev` recarga AgentHub en cada cambio. La guía para agentes de código está en
[`AGENTS.md`](AGENTS.md) y el plan completo en [`plan.md`](plan.md).

## Publicar una versión

1. `pnpm version patch` (o `minor`/`major`): actualiza `package.json`, `manifest.json` y `versions.json`.
2. `git push && git push --tags`: el workflow `release.yml` valida, compila y crea un **borrador** de
   release con `main.js`, `manifest.json` y `styles.css`. Revísalo y publícalo.
3. Para probar versiones beta antes de la tienda, instala el plugin con **BRAT** apuntando al repositorio.

## Licencia

MIT
