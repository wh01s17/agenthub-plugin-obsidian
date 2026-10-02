# Cierre de AgentHub 0.1.0

Estado: **0.1.0 publicada como Latest; aceptación manual y distribución cerradas**.
Versión pública actual: 0.1.0. Última comprobación: 2026-10-02 (Chile).

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
| Selección del mensaje propio con mouse | Corregido y comprobado | Arrastre nativo en Obsidian: antes user-select none y selección vacía; después text y texto seleccionado. |
| Axe en Obsidian | Sin violaciones en el estado probado | Quedan resultados de contraste inconclusos; no equivale a lector de pantalla. |
| Permisos Codex en Obsidian | Verificado por el usuario | Captura con permiso rechazado, herramienta fallida y turno detenido; siguiente intento aprobado y herramienta completada. Nota leída localmente con «Edición autorizada: ALFA-27.». |
| Codex: cancelar y volver a enviar | Pasa | Capturas muestran respuesta cortada, Stopped, nuevo mensaje y respuesta CANCELACIÓN OK. |
| Codex: reiniciar Obsidian y reanudar | Pasa | El usuario confirma cierre completo y reapertura antes de preguntar; recupera CLAVE-PUMA-83. |
| Codex: exportar a nota | Pasa en el caso mostrado | Nota exportada con propiedades, mensajes ordenados, adjuntos enlazados y razonamiento plegable; captura y transcript coinciden. |
| Changelog | Hecho | CHANGELOG.md; Notas de 0.1.0 cerradas para preparar la release. |
| Capturas README | Incorporadas | Chat con mensaje propio, nota, herramientas y solicitud de permiso; cuatro vistas de ajustes. El permiso de la captura tiene etiquetas cortas. |
| Metadatos 0.1.0 | Preparados | package.json, manifest.json y versions.json; minAppVersion 1.8.7 y autor wh01s17. |

## Aceptación humana — cerrada el 2026-10-02

El usuario confirma «ta todo ok» y aprueba el cierre general de las comprobaciones. Se registra su aceptación; no se presentan pruebas no observadas como verificaciones automáticas. Las capturas individuales y límites de evidencia se conservan debajo. Claude no fue repetido tras el error de cuota.

Usar un vault de prueba. Anotar versión de Obsidian, agente, sistema, resultado y cualquier fallo.

### 1. Capturas para el README

- [x] Chat: mensaje propio destacado, respuesta, opciones y herramientas visibles.
- [x] Ajustes: agentes detectados, sesiones, contexto y entorno; cuatro capturas incorporadas.
- [x] Permisos: captura con solicitud y botones de aprobar/denegar incorporada.
- [x] Permisos largos: captura del usuario con etiqueta larga envuelta y botones completos en su tema oscuro. Zoom 100/200 % y ambos temas comprobados automáticamente; no se infiere zoom de la captura.

Enviar las imágenes al agente para incorporarlas. La captura de nota y conversación ya está en docs/images/codex-note.png. (En 0.2.0 se reemplazó por `docs/images/chat.png`.)

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
| Aprobar permiso y comprobar edición | Pendiente | Verificado | Pendiente | Pendiente |
| Denegar permiso y comprobar que no edita | Pendiente | Rechazo de herramienta verificado | Pendiente | Pendiente |
| Cancelar durante streaming y volver a enviar | Pendiente | Verificado | Pendiente | Pendiente |
| Reiniciar Obsidian y recuperar sesión | Pendiente | Verificado y confirmado | Pendiente | Pendiente |
| Adjuntar @nota y selección | Pendiente | Mención con respuesta verificada; selección aceptada por el usuario, chip documentado | Pendiente | Pendiente |
| Exportar conversación y comprobar nota | Pendiente | Verificado en el caso mostrado | Pendiente | Pendiente |
| Cerrar vista y comprobar limpieza del proceso propio | Pendiente | Pendiente | Pendiente | Pendiente |
| Tema claro/oscuro, teclado y zoom en el uso real | Pendiente | Pendiente | Pendiente | Pendiente |

La bitácora §17 ya contiene verificaciones históricas de Claude sobre contexto, edición, historial, reinicio y exportación. Esta matriz distingue la pasada final de la release de esa evidencia previa.

Evidencia aportada por el usuario el 2026-10-02: [permisos](images/verification-0.1.0/codex-permissions.png),
[cancelación](images/verification-0.1.0/codex-cancel.png), [sugerencia @](images/verification-0.1.0/codex-mention.png),
[selección adjunta](images/verification-0.1.0/codex-selection.png), [reanudación](images/verification-0.1.0/codex-resume.png),
[exportación](images/verification-0.1.0/codex-export.png) y [permiso largo](images/verification-0.1.0/codex-permission-long.png).
La selección mostrada corresponde a «Edición autorizada: ALFA-27.», no al fragmento de ejemplo de la guía.
La nueva [captura de respuesta a @](images/verification-0.1.0/codex-mention-response.png) muestra la nota mencionada adjunta y una respuesta acorde a su contenido.

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

- [x] Incorporar las capturas enviadas por el usuario.
- [x] Registrar resultados humanos y aprobación general del usuario.
- [x] Cerrar T6.3 por aceptación manual del usuario y T6.6 por publicación y BRAT final.
- [x] Pasar lint/tests/build, cerrar notas de 0.1.0 y crear commit/tag anotado sin v.
- [x] Subir el tag y comprobar el borrador y sus tres assets: workflow 36959592684 correcto; SHA-256, versión y autor coinciden con el build local.
- [x] Publicar con confirmación explícita del usuario: 0.1.0 Latest, 2026-10-02.
- [x] BRAT 2.2.0: instalación limpia 0.1.0 y actualización 0.0.5 → 0.1.0; ajustes y contenido de transcripts conservados, plugin y vista cargados.

La revisión manual queda aceptada y la release está publicada y comprobada. No es necesario que el usuario ejecute el empaquetado, git o BRAT: el agente puede hacerlo. La fase 7 está descartada; el envío a la comunidad es opcional para 0.1.0.
