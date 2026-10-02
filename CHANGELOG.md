# Changelog

Cambios relevantes de AgentHub. Las versiones siguen la política de `plan.md` §8.4.
`Unreleased` contiene trabajo futuro. La sección 0.1.0 corresponde a la release preparada, pendiente de publicación.

## [Unreleased]

## [0.1.0] - 2026-10-02

### Añadido

- Historial de cambios de las versiones publicadas.
- Checklist de aceptación y guía de cierre para 0.1.0.

### Corregido

- Instrucciones del script de sincronización de versiones: indican el bump manual, sin crear tags con prefijo `v`.
- Los botones de permisos con comandos largos ajustan el texto al ancho del panel, también con zoom.
- Los mensajes del usuario permiten seleccionar y copiar texto con el mouse, incluidos sus adjuntos.

## [0.0.5] - 2026-10-01

### Añadido

- Confirmación y aviso visible para activar modos sin restricciones.
- Compatibilidad con selectores de modelo y modo de agentes que usan los campos antiguos de ACP, incluido Gemini CLI.

### Cambiado

- Codex inicia en solo lectura salvo configuración inicial explícita.
- Mensajes del usuario destacados con etiqueta «Tú»/«You», fondo, borde de acento y separación entre turnos.
- Logos originales de Claude, Codex, Gemini y OpenCode; monogramas para agentes personalizados.
- Animaciones de actividad, compatibles con la preferencia de movimiento reducido.
- Contraste de etiquetas y estado; adaptación del diálogo a paneles estrechos.

### Corregido

- Autor del manifest: `wh01s17`.

## [0.0.4] - 2026-10-01

### Añadido

- Ajustes buscables mediante la API declarativa de Obsidian 1.13+, conservando compatibilidad con versiones anteriores.

### Corregido

- El estado «Starting the agent…» vuelve a «Ready» al terminar el inicio anticipado de una sesión.

## [0.0.3] - 2026-10-01

### Añadido

- Primera release pública documentada: chat ACP, streaming, herramientas, permisos y opciones del agente.
- Contexto de nota activa, selecciones, menciones y autocompletado de comandos.
- Historial persistente, reanudación, exportación a notas y vistas adicionales.
- Diffs de ediciones, traducciones español/inglés y carga de mensajes anteriores por páginas.
- Directorio de trabajo configurable como carpeta de la nota activa.

### Cambiado

- Renderizado de Markdown por bloques para mantener la interfaz fluida durante respuestas largas.

### Corregido

- Delimitadores de código y enlaces relativos al vault en las notas exportadas.

La versión 0.0.1 fue scaffolding y 0.0.2 tuvo un tag y un borrador posteriormente eliminado; no fueron releases públicas.

[Unreleased]: https://github.com/wh01s17/agenthub-plugin-obsidian/compare/0.1.0...HEAD
[0.1.0]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.1.0
[0.0.5]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.5
[0.0.4]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.4
[0.0.3]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.3
