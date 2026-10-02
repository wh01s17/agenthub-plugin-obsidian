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
- Cada agente se identifica con su **logo original** (Claude, Codex, Gemini, OpenCode); los agentes personalizados, con un monograma de color.

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

Con **BRAT**, usa el comando **BRAT: Add a beta plugin** y añade
`wh01s17/agenthub-plugin-obsidian`. BRAT descarga los archivos de la release y gestiona las actualizaciones.

Para instalarlo manualmente:

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
  permisos que elijas. Codex empieza en **solo lectura** salvo que hayas configurado otro modo inicial.
  Los modos `bypassPermissions`, `danger-full-access`, `agent-full-access` y `yolo` requieren
  confirmación al activarse y muestran un aviso rojo en la cabecera. OpenCode conserva su modo
  propio: revisa el selector. Ten el vault bajo control de versiones o con copia de seguridad.
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
- **Opciones de Gemini:** modelo y modo aparecen después de iniciar la sesión ACP, también en
  versiones que usan los campos antiguos `models`/`modes`. Gemini 0.62 no ofrece un selector de
  esfuerzo por ACP. Si falla el inicio de sesión, revisa el aviso de autenticación del chat.
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

Sigue la política de [`plan.md` §8.4](plan.md#84-versionado-y-releases). En 0.x, **MINOR** para funciones
nuevas o cambios de comportamiento/datos; **PATCH** para arreglos, estilo, rendimiento o documentación.
La próxima release prevista es **0.1.0**, tras completar sus requisitos del plan.

1. Con `main` limpio y sincronizado, ejecutar `pnpm lint && pnpm test && pnpm build` y añadir las notas
   en `CHANGELOG.md` (Añadido / Cambiado / Corregido).
2. Cambiar la versión en `package.json` y ejecutar `npm_package_version=X.Y.Z node scripts/version-bump.mjs`
   para sincronizar `manifest.json` y `versions.json`. No usar `pnpm version`.
3. Crear el commit `chore(release): X.Y.Z` y el tag anotado **sin `v`**:
   `git tag -a X.Y.Z -m "AgentHub X.Y.Z"`. Subir `main` y ese tag.
4. El workflow `release.yml` valida, compila y crea un **borrador** con `main.js`, `manifest.json` y `styles.css`.
5. Publicar con la confirmación del usuario y las notas del changelog; registrar la release en la bitácora.
   Las versiones beta (`X.Y.Z-beta.N`) se publican como **pre-release**, sin marcar **Latest**, y se prueban con BRAT.

## Licencia

MIT. Los logos de los agentes provienen de [Lobe Icons](https://github.com/lobehub/lobe-icons) (MIT); las marcas
pertenecen a sus respectivos dueños y se usan solo para identificar cada herramienta.
