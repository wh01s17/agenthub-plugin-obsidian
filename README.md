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

## Privacidad y seguridad

- El plugin lanza como procesos locales los agentes que tú ya tienes instalados. No hace llamadas de
  red propias ni envía telemetría; cada agente se conecta a su proveedor por su cuenta.
- Los agentes pueden leer y modificar archivos del vault y ejecutar comandos según el modo de permisos
  que elijas. Ten el vault bajo control de versiones o con copia de seguridad.

## Licencia

MIT
