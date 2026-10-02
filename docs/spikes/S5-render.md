# Spike S5 — Rendimiento del Markdown en streaming (2026-10-01)

Obsidian 1.13.7 real, en una instancia aislada (perfil y vault temporales, `--remote-debugging-port`), con el agente
simulado (`/scenario stream-long`: ~20 KB de Markdown en fragmentos de 400 caracteres cada 5 ms, el peor caso). Medido
por CDP con `PerformanceObserver('longtask')` (tareas > 50 ms) y el mayor hueco entre `requestAnimationFrame`.

| Implementación                                                           | Tareas largas | La más larga | Mayor hueco entre fotogramas |
| ------------------------------------------------------------------------ | ------------- | ------------ | ---------------------------- |
| Mensaje entero con `MarkdownRenderer.render`, throttle 100 ms            | 4 (937 ms)    | 603 ms       | 667 ms                       |
| Por bloques (`splitBlocks`), solo el último bloque se re-renderiza       | 3 (491 ms)    | 220 ms       | 250 ms                       |
| **Por bloques + cola con presupuesto de 8 ms por tarea** (`renderQueue`) | **0**         | —            | **33 ms**                    |

Decisiones (ADR-026):

- `src/ui/markdownBlocks.ts` divide por líneas en blanco fuera de bloques de código (``` / ~~~, de cualquier longitud);
  cada bloque es un componente que solo llama a `MarkdownRenderer` cuando cambia su texto.
- `src/ui/renderQueue.ts` reparte los renders en tareas de ≤ 8 ms y cede a la UI entre ellas; también evita bloqueos
  al reabrir mensajes largos desde el historial.
- Se mantiene el throttle de 100 ms del texto en streaming.
- Coste aceptado: construcciones Markdown que cruzan líneas en blanco (p. ej. una lista con líneas vacías entre
  elementos) se renderizan como bloques separados, con un espaciado mínimamente distinto.
