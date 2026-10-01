# AgentHub — Seguridad, privacidad y riesgos

> Parte del plan maestro. Empieza siempre por [`plan.md`](../../plan.md) (estado actual y protocolo).
> Los números de sección (§) son los mismos en todos los archivos del plan.

## 10. Seguridad y privacidad

1. **El agente tiene el poder, no el plugin.** Claude/Codex pueden editar archivos y ejecutar
   comandos con los permisos del usuario. El plugin debe: usar modos conservadores por defecto
   (Claude `manual`/permisos interactivos, Codex `read-only`), exigir confirmación para modos
   peligrosos y recomendar en el README tener el vault bajo git o con copia de seguridad.
2. **Guardia de rutas** solo cubre el canal `fs/*` de ACP (el agente puede escribir por sus propias
   herramientas): documentarlo honestamente. Bloquear `.obsidian/` por defecto en ese canal.
3. **Contenido no confiable:** toda salida de agentes se renderiza con `MarkdownRenderer` o como
   texto; nunca `innerHTML`. Los enlaces externos se abren con el comportamiento estándar de Obsidian.
4. **Secretos:** el plugin no pide API keys. Si el usuario define variables de entorno por agente,
   se avisa que `data.json` se guarda en texto plano (y puede sincronizarse). No registrar env en logs.
5. **Servidor MCP local (Fase 5):** escuchar solo en `127.0.0.1`, puerto aleatorio, token aleatorio
   por sesión exigido en cabecera/URL; apagarlo con el plugin.
6. **Sin telemetría ni red propia.** Declararlo en el README (requisito de la revisión de Obsidian),
   junto con el uso de procesos externos y la condición de solo escritorio.
7. **Inyección de prompts desde notas:** el contenido del vault puede contener instrucciones
   maliciosas; por eso los permisos interactivos importan. Mencionarlo en el README.

---

## 13. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| ACP y sus adaptadores cambian rápido (SDK 1.x, adaptadores renombrados en 2026) | Alta | Medio | Versiones fijadas (ADR-010), tests de contrato con fixtures, negociación de `protocolVersion`, mapeo tolerante. |
| Formatos `stream-json`/`--json` de los CLIs cambian | Alta | Medio | Parsers tolerantes, fixtures por versión, adaptadores directos como vía secundaria. |
| Agentes que escriben sin pedir permiso en su modo por defecto (Codex `agent`, OpenCode) | Alta | Alto | Mostrar el modo activo siempre; Q8; recomendar git/backup. |
| PATH/entorno en apps GUI (mise/nvm/asdf) | Media (S1: no ocurre en este equipo) | Alto | §4.7 desde el MVP + ruta manual + botón re-detectar. |
| Obsidian en Flatpak/Snap | Media | Alto | Documentar no soportado; investigar `flatpak-spawn --host` más adelante. |
| Agente modifica una nota que el usuario está editando | Media | Medio | Escrituras ACP vía Vault API; aviso si el archivo está abierto con cambios sin guardar. |
| Agente destructivo en modo permisivo | Baja | Alto | Defaults conservadores, confirmación de modos peligrosos, recomendación de git/backup. |
| Procesos huérfanos | Media | Medio | `ProcessRegistry`, kill de grupo, EOF de stdin, prueba en checklist. |
| Coste/consumo de tokens inesperado | Media | Medio | Mostrar uso/coste; e2e reales fuera de CI. |
| Revisión de la comunidad rechaza algo (procesos externos) | Baja | Medio | Cumplir guías, `isDesktopOnly`, divulgación en README; hay precedentes de plugins que lanzan procesos. |
| Latencia de `npx` en el primer arranque | Alta | Bajo | Detectar binario global; mensaje "instalando adaptador…"; recomendar `npm i -g`. |
| Rendimiento con transcripts largos | Media | Medio | Throttle, items consolidados, virtualización (T6.4). |
