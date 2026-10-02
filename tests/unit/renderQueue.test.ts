import { describe, expect, it, vi } from 'vitest';
import { enqueueRender } from '../../src/ui/renderQueue';

describe('enqueueRender', () => {
  it('runs jobs asynchronously, in order, and skips cancelled ones', async () => {
    const done: number[] = [];
    enqueueRender(() => done.push(1));
    const cancel = enqueueRender(() => done.push(2));
    enqueueRender(() => done.push(3));
    cancel();
    expect(done).toEqual([]);
    await vi.waitFor(() => expect(done).toEqual([1, 3]));
  });

  it('yields between slices when jobs exceed the time budget', async () => {
    const spy = vi.spyOn(window, 'setTimeout');
    const slow = () => {
      const end = performance.now() + 5;
      while (performance.now() < end) {
        // busy
      }
    };
    let count = 0;
    for (let i = 0; i < 6; i++) enqueueRender(() => (slow(), count++));
    await vi.waitFor(() => expect(count).toBe(6));
    expect(spy.mock.calls.length).toBeGreaterThan(1); // more than one slice was scheduled
  });
});
