# Cierre de AgentHub 0.1.0

Estado: **preparada localmente; pendiente de aceptación manual y publicación**.
Versión pública actual: 0.0.5. Fecha de comprobación: 2026-10-01 (Chile).

## Resultados comprobados

| Comprobación | Resultado | Evidencia / límite |
|---|---|---|
| Instalación congelada, lint, tests y build | Pasa | 198 pruebas; 2 e2e optativas omitidas en la suite normal; 7 avisos de lint existentes. |
| OpenCode real: leer y escribir nota | Pasa | Prueba e2e existente; copia temporal del vault. |
| OpenCode real: reanudar en un proceso nuevo | Pasa | Recupera la palabra acordada. |
| Codex real: leer y escribir nota | Pasa | Prueba e2e existente; copia temporal del vault y modo de escritura explícito. |
| Codex real: reanudar en un proceso nuevo | Pasa | Recupera la palabra acordada. |
| Claude real | Bloqueado por cuota | El proveedor informa «You've hit your session limit». Las dos pruebas no pasan; no se atribuye a un fallo del plugin. |
| Gemini real: modelo y modo | Verificado previamente | Sesión ACP y cambio a gemini-2.5-pro, sin prompts; ver release-0.0.5.md. No anuncia esfuerzo por ACP. |
| BRAT 2.2.0: instalación limpia 0.0.5 | Pasa | Vault aislado, plugin cargado, versión y autor wh01s17 comprobados. |
| BRAT 2.2.0: actualización 0.0.4 → 0.0.5 | Pasa | Plugin recargado en 0.0.5. |
| Conservación de datos con BRAT | Pasa en el caso probado | data.json idéntico y cuatro elementos de la conversación conservados. Las marcas de tiempo de guardado del JSONL cambian al recargar. |
| Diálogo al 200 %: teclado | Pasa | Build local 0.1.0: foco inicial en cancelar; Tab recorre ambos botones y vuelve al primero; Escape conserva modo y devuelve foco a Mode. Diálogo de 510 px sin desborde; pasada previa de 196 px también comprobada. |
| Botones de permisos largos | Corregido y comprobado | Texto envuelto, incluso argumentos sin espacios. Temas claro/oscuro, zoom 100/200 %; tarjeta de 250/238 px con scrollWidth idéntico al ancho. |
| Axe en Obsidian | Sin violaciones en el estado probado | Quedan resultados de contraste inconclusos; no equivale a lector de pantalla. |
| Permiso Codex en Obsidian | Evidencia del usuario | Capturas muestran solicitud, aprobación «Yes, proceed» y respuesta terminada; no comprueban denegación. |
| Changelog | Hecho | CHANGELOG.md; 0.1.0 sigue en Unreleased hasta publicar. |
| Capturas README | Incorporadas; selección final parcial | Nota y conversación, agentes, sesiones, contexto y entorno; falta chat con mensaje propio visible y permiso tras corregir el desborde. |
| Metadatos 0.1.0 | Preparados | package.json, manifest.json y versions.json; minAppVersion 1.8.7 y autor wh01s17. |

## Lo que requiere revisión humana

Usar un vault de prueba. Anotar versión de Obsidian, agente, sistema, resultado y cualquier fallo.

### 1. Capturas para el README

- [ ] Chat: mensaje propio destacado y respuesta breve; plegar Reasoning si ocupa demasiado espacio.
- [x] Ajustes: agentes detectados, sesiones, contexto y entorno; cuatro capturas incorporadas.
- [ ] Permisos: repetir la captura con un texto largo después de cargar el CSS corregido; todos los botones deben caber.

Enviar las imágenes al agente para incorporarlas. La captura de nota y conversación ya está en docs/images/codex-note.png.

### 2. Lector de pantalla

- [ ] Abrir Obsidian con Orca, NVDA o VoiceOver operativo.
- [ ] Recorrer selectores, compositor, historial y permisos; comprobar nombres, valores y orden.
- [ ] Abrir la confirmación de modo sin restricciones; comprobar título, descripción, cancelar y vuelta del foco.
- [ ] Enviar un mensaje; comprobar anuncios de estado y que el streaming permita seguir usando los controles.

No hay lector instalado en el entorno de comprobación. Registrar un fallo de configuración del lector por separado de un fallo del plugin.

### 3. Alto contraste nativo y tema habitual

- [ ] Activar un tema de contraste del sistema (p. ej. Windows → Accesibilidad → Temas de contraste).
- [ ] Revisar etiquetas, estados, permisos, mensajes y foco; ninguna acción debe depender solo del color.
- [ ] Revisar contraste con el tema de Obsidian que utilizará el usuario.

La emulación forced-colors ya realizada no cierra la comprobación nativa. Puede hacerla otra persona que disponga del entorno.

### 4. Checklist visual con agentes reales

Las e2e cubren lectura, escritura y reanudación, no toda la interacción en Obsidian.
Repetir con los agentes disponibles; marcar «no aplica» solo con explicación de la capacidad ausente.

| Prueba | Claude | Codex | OpenCode | Gemini |
|---|---|---|---|---|
| Abrir, detectar y seleccionar opciones | Pendiente | Captura | Pendiente | Modelo/modo verificados |
| Enviar y ver streaming/herramientas | Pendiente | Captura | Pendiente | Pendiente |
| Aprobar permiso y comprobar edición | Pendiente | Captura | Pendiente | Pendiente |
| Denegar permiso y comprobar que no edita | Pendiente | Pendiente | Pendiente | Pendiente |
| Cancelar durante streaming y volver a enviar | Pendiente | Pendiente | Pendiente | Pendiente |
| Reiniciar Obsidian y recuperar sesión | Pendiente | Pendiente | Pendiente | Pendiente |
| Adjuntar @nota y selección | Pendiente | Pendiente | Pendiente | Pendiente |
| Exportar conversación y comprobar nota | Pendiente | Pendiente | Pendiente | Pendiente |
| Cerrar vista y comprobar limpieza del proceso propio | Pendiente | Pendiente | Pendiente | Pendiente |
| Tema claro/oscuro, teclado y zoom en el uso real | Pendiente | Pendiente | Pendiente | Pendiente |

La bitácora §17 ya contiene verificaciones históricas de Claude sobre contexto, edición, historial, reinicio y exportación. Esta matriz distingue la pasada final de la release de esa evidencia previa.

Para permisos, pedir una edición de una nota desechable, denegar y comprobar que no cambió; repetir y aprobar.
Para cancelar, solicitar una respuesta larga, detener durante el streaming y enviar otro mensaje.
Para contexto, mencionar otra nota con @ y adjuntar una selección desde el editor.
Para reanudar, recordar una palabra, reiniciar Obsidian y pedirla en la sesión recuperada.
Para limpiar procesos, comparar antes/después y distinguir otros agentes abiertos en terminales.

Claude requiere cuota disponible; se puede repetir su e2e con:

```bash
AGENTHUB_E2E_AGENTS=claude-acp pnpm test:e2e
```

## Cierre que puede ejecutar el agente

- [ ] Incorporar las capturas restantes enviadas por el usuario.
- [ ] Registrar resultados humanos y corregir los fallos encontrados.
- [ ] Cerrar T6.3/T6.6 cuando los criterios estén realmente comprobados.
- [ ] Pasar lint/tests/build, cerrar notas de 0.1.0 y crear commit/tag anotado sin v.
- [ ] Subir el tag y comprobar el borrador y sus tres assets.
- [ ] Publicar con confirmación explícita del usuario, según AGENTS.md y plan §8.4.
- [ ] Instalar/actualizar a la release pública 0.1.0 con BRAT y registrar resultados.

El tag de 0.1.0 se deja pendiente hasta cerrar las comprobaciones. No es necesario que el usuario ejecute el empaquetado, git o BRAT: el agente puede hacerlo. La fase 7 está descartada; el envío a la comunidad es opcional para 0.1.0.
