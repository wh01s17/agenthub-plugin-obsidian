# Verificación de 0.0.5

[Release 0.0.5 publicada](https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.5) como Latest, con autor `wh01s17`.

Fecha: 2026-10-01 (Chile). Obsidian 1.13.7, Linux, perfil y vault temporales en `/tmp`.

## Cambios

- Confirmación modal para `bypassPermissions`, `danger-full-access`, `agent-full-access` y `yolo`.
  Cancelar/Escape conservan el modo; cerrar la sesión cancela la confirmación. El chat bloquea
  mensajes mientras se decide. Los modos sin restricciones tienen un distintivo rojo con texto.
- Codex ACP inicia en `read-only` salvo modo inicial explícito.
- Respaldo de `models` y `modes` antiguos de ACP, con sus métodos de cambio correspondientes.
  Las opciones modernas tienen prioridad. No se inventan modelos ni opciones de esfuerzo.
- Etiquetas y estado usan colores legibles del tema. Diálogo adaptable a anchos pequeños.
- Mensajes del usuario destacados con etiqueta «Tú»/«You», tarjeta, borde de acento y separación entre turnos.
- Incluye logos de agentes y animaciones posteriores a 0.0.4.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Pruebas | 198 pasan; 2 e2e omitidas. Las pruebas de procesos se ejecutaron fuera del sandbox. |
| Lint/build | Sin errores; 7 advertencias preexistentes por API de ajustes antigua y rutas de fixtures. |
| Gemini CLI 0.62 real | Sesión ACP inicializada; selectores `Mode`/`Model` visibles; selección de `gemini-2.5-pro` aplicada. Sin enviar prompts. |
| Compatibilidad ACP | Pruebas de inicio, cambio y reanudación con `modes`/`models`; prueba de prioridad moderna sin duplicar selectores. |
| BRAT 2.2.0 | Instalación real de 0.0.3 y actualización a 0.0.4: ambas devuelven éxito; plugin recargado en 0.0.4. |
| Teclado del diálogo | Foco inicial en cancelar; Tab llega a activar; Escape cancela; foco vuelve al selector cuando se desbloquea. |
| Árbol accesible Chromium | Diálogo con nombre, descripción asociada y dos botones nombrados. No equivale a una prueba con lector de pantalla. |
| Axe-core en Obsidian | Chat y diálogo sin violaciones en temas claro/oscuro. Algunos estados del chat requieren revisión manual de contraste (`incomplete`); diálogo claro sin resultados incompletos. |
| Zoom 200 % | Chat sin desborde horizontal: ancho y scrollWidth de 276 px. Diálogo permite envolver texto y botones; repetir su recorrido manual al 200 % antes de cerrar T6.3. |
| Movimiento reducido | Emulación Chromium: `prefers-reduced-motion: reduce` activo y animación de estado `none`. |
| Alto contraste | Emulación Chromium de `forced-colors: active`; falta comprobar un sistema con alto contraste nativo. |
| Objetivos | Controles visibles del chat sin objetivos inferiores a 24 × 24 px; botones del diálogo superiores a ese mínimo. |

Las pruebas con agente simulado no certifican permisos/ediciones de todos los proveedores reales.
La revisión manual histórica del proyecto está en §17 de `plan.md`.

## Pendiente para cerrar la revisión manual

- Lector de pantalla: nombre y descripción del diálogo, anuncio del estado y aviso de modo,
  orden del foco y vuelta al selector. Este entorno no tiene lector instalado.
- Alto contraste nativo y revisión de los resultados incompletos de contraste con el tema del usuario.
- Repetir el recorrido del diálogo al 200 % y la checklist de §9 con los agentes reales disponibles.
- Verificar la actualización a 0.0.5 por BRAT. La instalación/actualización comprobada
  corresponde a 0.0.3 → 0.0.4. 0.0.5 está publicada; sus tres archivos se descargaron y coinciden
  por SHA-256 con el build local. Autor y versión del manifest descargado verificados.
- Envío a la comunidad: opcional; no realizado. Fase 7: descartada.

## Reproducir Gemini

1. Activar Gemini CLI en los ajustes, tener `gemini --acp` instalado y autenticado.
2. Abrir una sesión nueva y esperar al inicio ACP.
3. Comprobar los selectores de modo/modelo y cambiar el modelo antes de enviar un mensaje.
4. Seleccionar YOLO y comprobar cancelar/confirmar y el aviso rojo.

Gemini 0.62 no anuncia esfuerzo por ACP. Sus ajustes avanzados de razonamiento se documentan en
la [guía oficial de generación](https://geminicli.com/docs/cli/generation-settings/).
