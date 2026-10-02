// Caps how many sessions run a turn at once (ADR-034). Sessions over the limit wait in order and
// show as queued; the limit is read on every request, so a settings change applies at once.

export type ReleaseTurn = () => void;

interface Waiter {
  resolve: (release: ReleaseTurn | null) => void;
  signal: AbortSignal;
  onAbort: () => void;
}

export class TurnLimiter {
  private running = 0;
  private readonly waiting: Waiter[] = [];

  /** `limit()` returns the maximum turns at once; 0 means no limit. */
  constructor(private readonly limit: () => number) {}

  /** Number of turns running now. */
  get active(): number {
    return this.running;
  }

  /** Whether a turn requested now would have to wait. */
  get full(): boolean {
    const limit = this.limit();
    return limit > 0 && this.running >= limit;
  }

  /**
   * Resolves with a release function once a turn may run, or `null` if `signal` aborts first.
   * Every non-null release must be called exactly once (extra calls are ignored).
   */
  acquire(signal: AbortSignal): Promise<ReleaseTurn | null> {
    if (signal.aborted) return Promise.resolve(null);
    if (!this.full && this.waiting.length === 0) return Promise.resolve(this.take());
    return new Promise((resolve) => {
      const waiter: Waiter = {
        resolve,
        signal,
        onAbort: () => {
          const index = this.waiting.indexOf(waiter);
          if (index >= 0) this.waiting.splice(index, 1);
          resolve(null);
          this.pump();
        },
      };
      signal.addEventListener('abort', waiter.onAbort, { once: true });
      this.waiting.push(waiter);
    });
  }

  private take(): ReleaseTurn {
    this.running++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.running--;
      this.pump();
    };
  }

  private pump(): void {
    while (!this.full) {
      const waiter = this.waiting.shift();
      if (!waiter) return;
      waiter.signal.removeEventListener('abort', waiter.onAbort);
      waiter.resolve(this.take());
    }
  }
}
