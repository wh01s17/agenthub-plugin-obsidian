# AgentHub — Próximas funciones

Ideas acordadas con el usuario para versiones futuras. No están planificadas en `plan.md` todavía: cuando una se
aborde, se pasa a §11 como tarea con ID, criterio de aceptación y, si cambia la arquitectura, un ADR en §12.

---

## 1. Pestañas: varios agentes en paralelo en la misma vista

**Estado:** implementada el 2026-10-02 (plan §11 Fase 8, ADR-033), salvo lo que sigue abierto en T8.6: aviso de
conflictos de edición entre pestañas, límite de pestañas trabajando a la vez y reordenar arrastrando.

### Problema

Hoy cada vista de AgentHub muestra una sola conversación. Para tener a Claude revisando una nota mientras Codex
reorganiza una carpeta hay que abrir otra vista con *Open AgentHub in a new pane* (RF-11), lo que ocupa espacio y
obliga a ir cambiando de panel para ver cuál terminó o cuál pide permiso.

### Propuesta

Una barra de pestañas arriba de todo, sobre la cabecera de la vista (así quedó al implementarla). Cada pestaña es una conversación independiente, con su agente,
sus opciones y su proceso, y todas pueden trabajar a la vez.

```
┌──────────────────────────────────────┐
│ ✳ [Claude Code ▾]        [✎] [🕘] [⚙] │
│ [✳ Resumen ●] [Cx Carpetas ⚠] [+]     │  pestañas: logo, título, estado
├──────────────────────────────────────┤
│ …conversación de la pestaña activa…   │
```

- **Indicadores de estado por pestaña:** trabajando (punto animado con el color del agente), esperando permiso (⚠,
  la más importante), error, terminado sin leer.
- **Acciones:** `+` abre una pestaña nueva con el agente por defecto; clic central o `×` la cierra; doble clic
  renombra (reutiliza el título de sesión del historial); arrastrar para reordenar (opcional).
- **Agente por pestaña:** el selector de la cabecera cambia el agente de la pestaña activa (hoy crea una sesión
  nueva: se mantiene ese comportamiento dentro de la pestaña).
- **Permisos en segundo plano:** si una pestaña no visible pide permiso, se marca con ⚠ y se muestra un `Notice` de
  Obsidian con el nombre de la pestaña; nunca se aprueba nada automáticamente.
- **Persistencia:** el estado de la vista (`getState/setState`) guarda la lista de pestañas (ids locales de sesión) y
  la activa; al reiniciar Obsidian se reabren desde el historial como ya se hace con una sola sesión (ADR-022).
- **Comandos y atajos:** pestaña siguiente/anterior, nueva pestaña, cerrar pestaña (sin atajos por defecto, como el
  resto de comandos).

### Encaje con la arquitectura actual

- `SessionManager` ya crea, guarda y libera varias `ChatSession`; cada una tiene su proceso (ADR-005) y su
  `localId`. La pestaña sería solo estado de la vista: `AgentHubView` pasa de tener `session` a tener
  `tabs: localId[]` y `activeTab`.
- `App` renderiza la sesión activa; las otras siguen vivas y suscritas para alimentar los indicadores
  (`useSessionState` por pestaña, o un resumen de estado más barato).
- El reaper de inactividad (`idleTimeoutMin`) ya libera procesos de pestañas olvidadas; al volver a escribir se
  reanudan (ADR-022).
- `PromptHistory` es global y sigue compartida entre pestañas.
- El historial (`HistoryPanel`) abre una sesión guardada en una pestaña nueva en vez de reemplazar la actual.

### Riesgos y preguntas abiertas

- **Consumo:** varios agentes a la vez multiplican procesos, memoria y tokens. ¿Límite configurable de pestañas
  trabajando a la vez (p. ej. 3) o solo aviso?
- **Ancho del sidebar:** con muchas pestañas, ¿desplazamiento horizontal (como las pastillas de opciones) o menú
  desplegable de pestañas?
- **Conflictos de edición:** dos agentes pueden tocar la misma nota. Hoy solo hay una mitigación prevista en `plan.md` §13
  (aviso si el archivo está abierto con cambios sin guardar); con varias pestañas conviene avisar también cuando dos
  de ellas editan el mismo archivo.
- **Modos sin restricciones:** la confirmación (ADR-030) debe indicar de qué pestaña viene la petición.
- **¿Pestañas o vistas?** Mantener *Open AgentHub in a new pane* para quien prefiera paneles separados.

### Criterio de aceptación (borrador)

Dos pestañas con agentes distintos trabajando a la vez; cambiar de pestaña no interrumpe a ninguno; una petición de
permiso en una pestaña oculta se ve en su indicador y en un aviso; al reiniciar Obsidian vuelven las mismas
pestañas con su historial; cerrar una pestaña termina su proceso.

### Versión

Cambio de comportamiento y de estado guardado de la vista: **MINOR** (0.3.0 o la que corresponda) según §8.4.
