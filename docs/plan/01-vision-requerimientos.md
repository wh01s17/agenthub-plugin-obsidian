# AgentHub — Visión y requerimientos

> Parte del plan maestro. Empieza siempre por [`plan.md`](../../plan.md) (estado actual y protocolo).
> Los números de sección (§) son los mismos en todos los archivos del plan.

## 1. Visión y objetivos

### 1.1 Problema

Los agentes de código por CLI (Claude Code, Codex, Gemini CLI, OpenCode…) son muy útiles para
trabajar sobre un vault de Obsidian (resumir, reorganizar, refactorizar notas, generar contenido,
mantener enlaces), pero obligan a salir de Obsidian a una terminal, perder el contexto de la nota
activa y revisar cambios fuera del editor.

### 1.2 Solución

Un plugin de Obsidian (escritorio) que **envuelve los agentes instalados en el sistema** y los
expone en una **vista lateral (sidebar)** tipo chat:

- Detecta qué agentes están disponibles y permite elegir uno por sesión.
- Lanza el agente como proceso hijo y habla con él por un **protocolo estructurado**
  (ACP — Agent Client Protocol — como vía principal; salida JSON nativa de cada CLI como vía directa).
- Renderiza respuestas con el motor Markdown de Obsidian, muestra llamadas a herramientas,
  diffs, planes y **solicitudes de permiso interactivas**.
- Inyecta contexto de Obsidian: nota activa, selección, notas mencionadas con `@`.
- Guarda historial de sesiones y permite reanudarlas o exportarlas como nota.

### 1.3 Objetivos

1. Usar Claude Code y Codex desde el sidebar con la misma calidad de experiencia que en la terminal
   para el 90 % de los casos de uso (chat, edición de archivos, comandos, permisos).
2. Arquitectura **agnóstica del agente**: añadir un agente nuevo compatible con ACP debe requerir
   solo configuración (comando + argumentos), sin código.
3. Seguridad por defecto: nada se ejecuta ni se escribe sin el modo de permisos que el usuario eligió.
4. Cumplir las guías de plugins de la comunidad de Obsidian para poder publicarlo.

### 1.4 No-objetivos (fuera de alcance)

- Soporte móvil (iOS/Android): imposible lanzar procesos. El plugin es `isDesktopOnly: true`.
- Implementar un agente propio o llamar directamente a APIs de LLM. El plugin **no** gestiona API keys
  ni hace llamadas de red propias: los agentes se autentican y conectan por su cuenta.
- Gestionar la instalación/actualización de los agentes (solo detectar y dar instrucciones).
- Emulación de terminal completa en el MVP (queda como fase opcional, ver Fase 7).

### 1.5 Escenarios de uso principales

1. "Resume esta nota y propón etiquetas" → contexto = nota activa → respuesta renderizada.
2. "Reorganiza las notas de `Proyectos/` en subcarpetas por año" → el agente pide permiso para
   mover/editar → el usuario aprueba → los cambios aparecen en el vault.
3. Selecciona un párrafo → comando "Enviar selección al agente" → "reescríbelo más claro".
4. Retoma ayer una sesión larga de Codex desde el historial y continúa.
5. Ejecuta un slash command del agente (p. ej. `/review`) desde el compositor.

---

## 2. Requerimientos

### 2.1 Funcionales

| ID | Requerimiento | Prioridad | Fase |
|---|---|---|---|
| RF-01 | Vista lateral (derecha por defecto) abrible desde icono de cinta y comando; se restaura al reiniciar Obsidian (estado de la vista persistido). | Must | 0 / 4 |
| RF-02 | Detección de agentes disponibles: binario encontrado, versión, adaptador ACP presente; estado visible (disponible / no instalado / error) con instrucciones de instalación. | Must | 2 |
| RF-03 | Selección de agente por sesión. Cambiar de agente crea una sesión nueva. | Must | 2 |
| RF-04 | Enviar prompts y recibir respuestas **en streaming**, renderizadas con el Markdown de Obsidian (wikilinks, código, callouts). | Must | 2 |
| RF-05 | Mostrar llamadas a herramientas (tipo, título, estado, entrada/salida colapsable) y planes/TODOs del agente. | Must | 2 |
| RF-06 | Solicitudes de permiso interactivas (permitir una vez / siempre / denegar) cuando el agente lo soporta; si no, modo de permisos configurable antes del turno. | Must | 2 / 5 |
| RF-07 | Cancelar el turno en curso (botón detener + comando). | Must | 2 |
| RF-08 | Contexto de Obsidian: nota activa (toggle), selección, menciones `@nota` con autocompletado. | Must | 3 |
| RF-09 | Slash commands del agente con autocompletado en el compositor. | Should | 3 |
| RF-10 | Historial: listar, reanudar, renombrar, borrar y exportar sesiones a una nota Markdown. | Should | 4 |
| RF-11 | Varias sesiones simultáneas (varios paneles AgentHub). | Should | 4 |
| RF-12 | Selector de modelo y de modo (p. ej. plan / acceptEdits) cuando el agente los expone. | Should | 2 / 5 |
| RF-13 | Mostrar uso (tokens / coste) cuando el agente lo reporta. | Could | 5 |
| RF-14 | Comandos de Obsidian: abrir, nueva sesión, detener, enviar selección, preguntar sobre nota actual, exportar. Sin hotkeys por defecto. | Must | 3 |
| RF-15 | Pestaña de ajustes: agentes (preset + personalizados), directorio de trabajo, contexto, historial, seguridad, debug. | Must | 2 |
| RF-16 | Directorio de trabajo: raíz del vault (defecto), carpeta de la nota activa, o ruta personalizada. | Must | 3 |
| RF-17 | Rutas de archivos y wikilinks en la salida son clicables y abren la nota en Obsidian. | Should | 3 |
| RF-18 | Vista de diffs para ediciones de archivos. | Should | 6 |
| RF-19 | Panel de depuración opcional con eventos crudos y stderr del agente. | Should | 2 |
| RF-20 | Agentes ACP personalizados definidos solo por configuración (comando, args, env). | Must | 2 |
| RF-21 | (Opcional) Modo terminal: TUI original del agente en el sidebar vía xterm.js. | Could | 7 |

### 2.2 No funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | **Plataformas:** Linux y macOS soportados; Windows "best effort" (rutas `.cmd`, comillas). |
| RNF-02 | **Sin procesos huérfanos:** todo proceso hijo se termina al cerrar la sesión, la vista, o al descargar el plugin. |
| RNF-03 | **Rendimiento:** la UI sigue fluida con sesiones de 1000+ mensajes; el re-render del mensaje en streaming se limita (throttle ~100 ms). Carga del plugin < 100 ms (los agentes se lanzan de forma perezosa). |
| RNF-04 | **Privacidad:** sin telemetría, sin llamadas de red propias. Los transcripts se guardan solo en local. |
| RNF-05 | **Robustez de parsing:** tipos de evento desconocidos se ignoran (y se registran en debug), nunca rompen la sesión. |
| RNF-06 | **Cumplimiento de guías de Obsidian:** sin `innerHTML` con contenido no confiable, limpieza con `register*`, estilos con variables CSS, textos en *sentence case*, sin hotkeys por defecto. |
| RNF-07 | **Accesibilidad:** navegable por teclado, roles/aria en lista de mensajes y tarjetas, contraste del tema. |
| RNF-08 | **Temas:** compatible con temas claro/oscuro y temas de la comunidad (solo variables CSS de Obsidian). |
| RNF-09 | **Tamaño del bundle:** `main.js` objetivo < 1,5 MB minificado. |
| RNF-10 | **Mantenibilidad:** TypeScript `strict`, núcleo sin dependencias de UI, adaptadores testeables sin Obsidian. |

### 2.3 Restricciones de plataforma

- Obsidian corre en el *renderer* de Electron con integración Node: `child_process`, `fs`, `http`
  están disponibles **solo en escritorio**.
- Un plugin de la comunidad se distribuye solo como `main.js`, `manifest.json` y `styles.css`:
  **no se pueden distribuir módulos nativos** (p. ej. `node-pty`) ni binarios. Todo debe ir en el bundle JS.
- Las apps GUI no heredan el `PATH` del shell interactivo del usuario (crítico en este entorno: ver §3.1).
- Obsidian empaquetado como Flatpak/Snap está aislado y no puede lanzar binarios del host sin
  `flatpak-spawn --host`: se documenta como no soportado inicialmente.
