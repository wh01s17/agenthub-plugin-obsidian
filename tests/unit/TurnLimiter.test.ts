// Limit of agents working at once (ADR-034).
import { describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../../src/core/SessionManager';
import { TurnLimiter } from '../../src/core/TurnLimiter';
import { StubAdapter, hostServices, type StubScript } from '../helpers/stubAgent';

const signal = () => new AbortController().signal;

describe('TurnLimiter', () => {
  it('lets turns through up to the limit and the rest in order', async () => {
    const limiter = new TurnLimiter(() => 1);
    const first = await limiter.acquire(signal());
    const order: string[] = [];
    const second = limiter.acquire(signal()).then((release) => (order.push('second'), release));
    const third = limiter.acquire(signal()).then((release) => (order.push('third'), release));
    await Promise.resolve();
    expect(order).toEqual([]);
    first?.();
    (await second)?.();
    (await third)?.();
    expect(order).toEqual(['second', 'third']);
    expect(limiter.active).toBe(0);
  });

  it('has no limit at 0 and ignores repeated releases', async () => {
    const limiter = new TurnLimiter(() => 0);
    const releases = await Promise.all([1, 2, 3].map(() => limiter.acquire(signal())));
    expect(limiter.active).toBe(3);
    releases[0]?.();
    releases[0]?.();
    expect(limiter.active).toBe(2);
  });

  it('drops a waiting turn when it is aborted', async () => {
    const limiter = new TurnLimiter(() => 1);
    const first = await limiter.acquire(signal());
    const controller = new AbortController();
    const waiting = limiter.acquire(controller.signal);
    controller.abort();
    expect(await waiting).toBeNull();
    first?.();
    expect(limiter.active).toBe(0);
  });
});

describe('sessions over the limit', () => {
  function setup(script: StubScript, limit = 1) {
    const adapter = new StubAdapter(script);
    const manager = new SessionManager({
      getAdapter: () => adapter,
      host: hostServices,
      sessionOptions: () => ({ cwd: '/vault' }),
      maxWorking: () => limit,
    });
    return { adapter, manager };
  }

  it('queue until another session finishes its turn', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    let calls = 0;
    const { manager } = setup(async () => {
      if (++calls === 1) await gate;
      return 'end_turn' as const;
    });
    const a = manager.create('stub')!;
    const b = manager.create('stub')!;
    const turnA = a.send([{ type: 'text', text: 'one' }]);
    await vi.waitFor(() => expect(a.getState().status).toBe('running'));
    const turnB = b.send([{ type: 'text', text: 'two' }]);
    await vi.waitFor(() => expect(b.getState().status).toBe('queued'));
    expect(b.busy).toBe(true);
    expect(calls).toBe(1);

    finish();
    await Promise.all([turnA, turnB]);
    expect(calls).toBe(2);
    expect(b.getState().status).toBe('idle');
  });

  it('stopping a queued message never sends it to the agent', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const { manager, adapter } = setup(async () => {
      await gate;
      return 'end_turn' as const;
    });
    const a = manager.create('stub')!;
    const b = manager.create('stub')!;
    const turnA = a.send([{ type: 'text', text: 'one' }]);
    await vi.waitFor(() => expect(a.getState().status).toBe('running'));
    const turnB = b.send([{ type: 'text', text: 'two' }]);
    await vi.waitFor(() => expect(b.getState().status).toBe('queued'));

    await b.cancel();
    await turnB;
    expect(b.getState().status).toBe('idle');
    expect(adapter.sessions[1]?.prompts ?? []).toHaveLength(0);
    expect(manager.turns.active).toBe(1);
    finish();
    await turnA;
    expect(manager.turns.active).toBe(0);
  });

  it('closing a queued session frees its place', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const { manager } = setup(async () => {
      await gate;
      return 'end_turn' as const;
    });
    const a = manager.create('stub')!;
    const b = manager.create('stub')!;
    const turnA = a.send([{ type: 'text', text: 'one' }]);
    await vi.waitFor(() => expect(a.getState().status).toBe('running'));
    const turnB = b.send([{ type: 'text', text: 'two' }]);
    await vi.waitFor(() => expect(b.getState().status).toBe('queued'));
    await manager.close(b.localId);
    await turnB;
    finish();
    await turnA;
    expect(manager.turns.active).toBe(0);
  });
});
