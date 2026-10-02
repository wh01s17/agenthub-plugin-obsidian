// Spreads Markdown block rendering over several tasks so the UI never stalls (spike S5): each slice
// works for at most `BUDGET_MS`, then yields so the app can paint and handle input.

const BUDGET_MS = 8;

type Job = () => void;

const queue: Job[] = [];
let scheduled = false;

function runSlice(): void {
  scheduled = false;
  const start = performance.now();
  while (queue.length > 0 && performance.now() - start < BUDGET_MS) queue.shift()?.();
  if (queue.length > 0) schedule();
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(runSlice, 0);
}

/** Queues `job`; the returned function cancels it if it has not run yet. */
export function enqueueRender(job: Job): () => void {
  let cancelled = false;
  queue.push(() => {
    if (!cancelled) job();
  });
  schedule();
  return () => {
    cancelled = true;
  };
}
