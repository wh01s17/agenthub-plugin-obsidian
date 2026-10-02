# Preparación de 0.1.0

Estado: **build local preparado, sin tag ni release pública**. 0.0.5 sigue siendo la versión publicada.
Fecha: 2026-10-01 (Chile). Checklist de cierre: [checklist-0.1.0.md](checklist-0.1.0.md).

## Cambios preparados

- CHANGELOG.md con historial de las releases 0.0.3–0.0.5 y sección Unreleased para 0.1.0.
- Capturas aportadas por el usuario: nota y conversación Codex con mensaje propio, solicitud de permiso y cuatro vistas de ajustes.
- Corrección de botones de permisos con comandos largos: texto adaptable al panel, sin scroll horizontal.
- Mensajes propios seleccionables con el mouse: la tarjeta declara user-select: text para sustituir el none heredado de Obsidian.
- Instrucciones del script de versiones alineadas con el bump manual de plan §8.4.
- package.json y manifest.json en 0.1.0; entrada añadida a versions.json. Autor wh01s17 y minAppVersion 1.8.7.

## Pruebas reales

La suite optativa ejecutada con `AGENTHUB_E2E_AGENTS=opencode,claude-acp,codex-acp pnpm test:e2e`
terminó con **4 pruebas correctas y 2 fallidas**:

- OpenCode: lectura/escritura y reanudación correctas.
- Codex: lectura/escritura y reanudación correctas.
- Claude: la prueba de lectura/escritura recibió el error del proveedor «You've hit your session limit»;
  la de reanudación tampoco pasó. Queda pendiente repetir ambas con cuota disponible.

Las pruebas de escritura utilizan copias temporales de las notas. La prueba de reanudación existente
usa el directorio del proyecto, con prompts limitados a recordar y recuperar una palabra.
No certifican toda la interacción visual en Obsidian ni la denegación manual de permisos.

## BRAT 2.2.0 en Obsidian 1.13.7

- Instalación limpia de la release pública 0.0.5: éxito, plugin cargado, autor wh01s17.
- Instalación de 0.0.4 y actualización a 0.0.5: éxito y plugin recargado.
- Ajustes data.json idénticos antes/después de actualizar.
- Cuatro elementos de la conversación conservados; cambian las marcas de tiempo de guardado del JSONL.

Estas comprobaciones corresponden a releases públicas existentes. BRAT hacia 0.1.0 queda pendiente
hasta que esa versión esté publicada.

## Interfaz nativa con el build local 0.1.0

Perfil y vault de prueba aislados en /tmp; agente ACP simulado. No se capturaron imágenes para el README:
las imágenes incorporadas fueron enviadas por el usuario.

- Diálogo al 200 %: ancho/scrollWidth 510/510 px; botones de 33 px de alto.
- Foco inicial en «Keep current mode»; Tab pasa a activar y vuelve a cancelar.
- Escape cierra, mantiene el modo manual y devuelve foco al selector Mode.
- Botón con un permiso largo y un argumento sin espacios:

| Tema | Zoom | Ancho de tarjeta | scrollWidth | Ancho del botón |
|---|---|---|---|---|
| Oscuro | 100 % | 250 px | 250 px | 226 px |
| Oscuro | 200 % | 238 px | 238 px | 214 px |
| Claro | 100 % | 250 px | 250 px | 226 px |
| Claro | 200 % | 238 px | 238 px | 214 px |

La comprobación de botones usa la tarjeta real, con texto de prueba largo colocado en su botón.
No equivale a una nueva interacción de permisos con un proveedor real.

## Pendientes

Lector de pantalla, alto contraste nativo, contraste inconcluso con el tema del usuario, pasada visual final
de los agentes y Claude con cuota disponible. Capturas del README incorporadas. Después: cierre del changelog,
commit/tag de release, borrador, confirmación de publicación y comprobación final con BRAT.
