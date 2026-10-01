# AgentHub

Plugin de Obsidian (solo escritorio) para usar agentes de código como **Claude Code**, **Codex**,
**Gemini CLI** u **OpenCode** desde una vista lateral, con el contexto de tus notas.

> Estado: en desarrollo temprano (Fase 0). Ver [`plan.md`](plan.md) para la arquitectura y el roadmap.

## Desarrollo

```bash
npm install
npm run build
npm run link-vault   # luego abre test-vault/ como vault en Obsidian y activa AgentHub
npm run dev          # recompila en cada cambio (con el plugin Hot Reload en el vault de pruebas)
```

## Ejecutarlo desde Obsidian

Requisitos: Obsidian de escritorio 1.8.7 o superior y Node.js 22 o superior.

### 1. Compilar y enlazar el plugin al vault de pruebas

```bash
npm install
npm run build        # genera main.js
npm run link-vault   # enlaza main.js, manifest.json y styles.css en test-vault/.obsidian/plugins/agenthub/
```

`link-vault` crea enlaces simbólicos, así que solo hay que ejecutarlo una vez: cada build nuevo ya
queda visible para Obsidian.

### 2. Abrir el vault de pruebas

1. Abre Obsidian y, en el selector de vaults (icono de vault abajo a la izquierda → **Manage vaults**),
   elige **Open folder as vault**.
2. Selecciona la carpeta `test-vault/` de este repositorio.

### 3. Activar el plugin

1. Ve a **Settings → Community plugins**.
2. Si aparece **Restricted mode**, pulsa **Turn on community plugins**.
3. En **Installed plugins**, activa **AgentHub** (si no aparece, pulsa el botón de recargar de esa sección).

### 4. Abrir la vista lateral

- Pulsa el icono del robot en la barra lateral izquierda (la cinta), o
- abre la paleta de comandos (`Ctrl/Cmd + P`) y ejecuta **AgentHub: Open AgentHub**.

La vista se abre en el panel derecho.

### 5. Recarga automática mientras desarrollas (opcional)

1. En **Community plugins → Browse**, instala y activa **Hot Reload** (de pjeby) en el vault de pruebas.
2. Ejecuta `npm run dev`. Cada vez que guardes un archivo, esbuild recompila y Hot Reload recarga
   AgentHub sin reiniciar Obsidian (`link-vault` ya creó el archivo `.hotreload` que lo habilita).

Sin Hot Reload: tras recompilar, desactiva y vuelve a activar AgentHub en **Community plugins**, o
recarga Obsidian con la paleta de comandos → **Reload app without saving**.

### Usarlo en tu propio vault

Copia `main.js`, `manifest.json` y `styles.css` (tras `npm run build`) en
`<tu-vault>/.obsidian/plugins/agenthub/` y actívalo como en el paso 3. Recomendado solo cuando el
plugin esté más avanzado y con el vault respaldado (ver [Privacidad y seguridad](#privacidad-y-seguridad)).

### Problemas comunes

- **AgentHub no aparece en la lista:** comprueba que existe `test-vault/.obsidian/plugins/agenthub/main.js`
  (si no, ejecuta `npm run build` y `npm run link-vault`) y recarga la lista de plugins.
- **Errores al cargar:** abre la consola de desarrollador con `Ctrl+Shift+I` (`Cmd+Opt+I` en macOS)
  y filtra por `AgentHub`.
- **Agentes no encontrados (fases siguientes):** si instalaste los agentes con mise, nvm o similar y
  abres Obsidian desde el lanzador del escritorio, Obsidian puede no ver su `PATH`. AgentHub intentará
  resolverlo y permitirá configurar la ruta del binario a mano en los ajustes.

## Privacidad y seguridad

- El plugin lanza como procesos locales los agentes que tú ya tienes instalados. No hace llamadas de
  red propias ni envía telemetría; cada agente se conecta a su proveedor por su cuenta.
- Los agentes pueden leer y modificar archivos del vault y ejecutar comandos según el modo de permisos
  que elijas. Ten el vault bajo control de versiones o con copia de seguridad.

## Licencia

MIT
