import { describe, expect, it, vi } from 'vitest';
import { ChatSession } from '../../src/core/ChatSession';
import { AgentError } from '../../src/core/errors';
import { SessionManager } from '../../src/core/SessionManager';
import type { PermissionOutcome } from '../../src/core/types';
import { StubAdapter, hostServices, type StubScript } from '../helpers/stubAgent';

const say =
  (text: string): StubScript =>
  ({ emit }) => {
    emit({ type: 'message.chunk', role: 'assistant', messageId: 'm', text });
    emit({ type: 'message.end', messageId: 'm' });
    return 'end_turn';
  };

function makeSession(script: StubScript) {
  const adapter = new StubAdapter(script);
  const session = new ChatSession({
    localId: 'l1',
    adapter,
    host: hostServices,
    options: { cwd: '/vault' },
    now: () => 42,
  });
  return { adapter, session };
}

describe('ChatSession', () => {
  it('starts the agent lazily, records the turn and titles the session', async () => {
    const { adapter, session } = makeSession(say('Hola'));
    expect(adapter.sessions).toHaveLength(0);

    const listener = vi.fn();
    session.subscribe(listener);
    await session.send([{ type: 'text', text: '  Resume   esta nota  ' }]);

    expect(adapter.sessions).toHaveLength(1);
    const state = session.getState();
    expect(state.title).toBe('Resume esta nota');
    expect(state.status).toBe('idle');
    expect(state.items.map((i) => i.kind)).toEqual(['user', 'assistant']);
    expect(listener).toHaveBeenCalled();
  });

  it('reuses the agent across turns and ignores sends while busy', async () => {
    let release!: () => void;
    const { adapter, session } = makeSession(
      () => new Promise((resolve) => (release = () => resolve('end_turn'))),
    );
    const first = session.send([{ type: 'text', text: 'uno' }]);
    await vi.waitFor(() => expect(session.getState().status).toBe('running'));
    await session.send([{ type: 'text', text: 'ignorado' }]);
    release();
    await first;
    const second = session.send([{ type: 'text', text: 'dos' }]);
    await vi.waitFor(() => expect(session.getState().status).toBe('running'));
    release();
    await second;
    expect(adapter.sessions).toHaveLength(1);
    expect(adapter.sessions[0]?.prompts.map((p) => p[0])).toEqual([
      { type: 'text', text: 'uno' },
      { type: 'text', text: 'dos' },
    ]);
  });

  it('routes permission requests through the view state', async () => {
    let outcome: PermissionOutcome | undefined;
    const { session } = makeSession(async ({ host }) => {
      outcome = await host.requestPermission({
        id: 'p1',
        toolCall: { id: 'c1', title: 'Write', kind: 'edit' },
        options: [{ id: 'ok', label: 'Allow', kind: 'allow_once' }],
      });
      return 'end_turn' as const;
    });
    const turn = session.send([{ type: 'text', text: 'go' }]);
    await vi.waitFor(() => expect(session.getState().status).toBe('awaiting-permission'));
    session.resolvePermission('p1', { outcome: 'selected', optionId: 'ok' });
    await turn;
    expect(outcome).toEqual({ outcome: 'selected', optionId: 'ok' });
  });

  it('cancels pending permissions when the user stops the turn', async () => {
    let outcome: PermissionOutcome | undefined;
    const { adapter, session } = makeSession(async ({ host, cancelled }) => {
      outcome = await host.requestPermission({
        id: 'p1',
        toolCall: { id: 'c1', title: 'Write', kind: 'edit' },
        options: [],
      });
      return cancelled() ? 'cancelled' : 'end_turn';
    });
    const turn = session.send([{ type: 'text', text: 'go' }]);
    await vi.waitFor(() => expect(session.getState().status).toBe('awaiting-permission'));
    await session.cancel();
    await turn;
    expect(outcome).toEqual({ outcome: 'cancelled' });
    expect(session.getState().status).toBe('idle');
    expect(adapter.sessions).toHaveLength(1);
  });

  it('shows start-up failures with their hint and allows retrying', async () => {
    const { adapter, session } = makeSession(say('ok'));
    adapter.failWith = new AgentError('auth', 'Login needed', 'Run `x login`');
    await session.send([{ type: 'text', text: 'hola' }]);
    expect(session.getState().status).toBe('error');
    expect(session.getState().items.at(-1)).toMatchObject({
      kind: 'notice',
      notice: { key: 'agentError', message: 'Login needed', hint: 'Run `x login`' },
    });

    adapter.failWith = null;
    await session.send([{ type: 'text', text: 'otra vez' }]);
    expect(session.getState().status).toBe('idle');
    expect(session.getState().items.at(-1)).toMatchObject({ kind: 'assistant', text: 'ok' });
  });

  it('starts a fresh agent after an unrecoverable error', async () => {
    let crash = true;
    const { adapter, session } = makeSession(({ emit }) => {
      if (crash) {
        crash = false;
        emit({ type: 'error', message: 'stopped', recoverable: false });
        return 'error';
      }
      return 'end_turn';
    });
    await session.send([{ type: 'text', text: 'uno' }]);
    expect(adapter.sessions[0]?.disposed).toBe(true);
    await session.send([{ type: 'text', text: 'dos' }]);
    expect(adapter.sessions).toHaveLength(2);
  });

  it('keeps debug output out of the transcript', async () => {
    const { session } = makeSession(({ emit }) => {
      emit({ type: 'debug', source: 'stderr', line: 'warming up' });
      return 'end_turn';
    });
    await session.send([{ type: 'text', text: 'x' }]);
    expect(session.debugLog()).toEqual(['[stderr] warming up']);
    expect(session.getState().items.map((i) => i.kind)).toEqual(['user']);
  });

  it('disposes the agent and stops notifying', async () => {
    const { adapter, session } = makeSession(say('x'));
    await session.send([{ type: 'text', text: 'x' }]);
    const listener = vi.fn();
    session.subscribe(listener);
    await session.dispose();
    expect(adapter.sessions[0]?.disposed).toBe(true);
    expect(session.getState().status).toBe('closed');
    listener.mockClear();
    await session.send([{ type: 'text', text: 'y' }]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('SessionManager', () => {
  it('creates sessions for known agents and disposes them all', async () => {
    const adapter = new StubAdapter(say('x'));
    const manager = new SessionManager({
      getAdapter: (id) => (id === 'stub' ? adapter : undefined),
      host: hostServices,
      sessionOptions: () => ({ cwd: '/vault', config: { mode: 'plan' } }),
      newId: () => 'fixed',
    });
    expect(manager.create('unknown')).toBeUndefined();

    const session = manager.create('stub');
    expect(manager.get('fixed')).toBe(session);
    await session?.send([{ type: 'text', text: 'x' }]);
    expect(adapter.options[0]).toEqual({ cwd: '/vault', config: { mode: 'plan' } });

    await manager.disposeAll();
    expect(manager.list()).toEqual([]);
    expect(adapter.sessions[0]?.disposed).toBe(true);
  });
});

describe('options before the first message', () => {
  const modeOption = {
    id: 'mode',
    name: 'Mode',
    category: 'mode',
    currentValue: 'default',
    options: [
      { value: 'default', name: 'Manual' },
      { value: 'plan', name: 'Plan' },
    ],
  };

  it('shows remembered options and applies a change made before start-up', async () => {
    const adapter = new StubAdapter(say('ok'));
    const session = new ChatSession({
      localId: 'l1',
      adapter,
      host: hostServices,
      options: { cwd: '/vault', config: { model: 'x' } },
      initialConfigOptions: [modeOption],
    });
    expect(session.getState().configOptions).toEqual([modeOption]);

    await session.setConfigOption('mode', 'plan');
    expect(adapter.sessions).toHaveLength(0); // no process just to change an option
    expect(session.getState().configOptions[0]?.currentValue).toBe('plan');

    await session.send([{ type: 'text', text: 'hola' }]);
    expect(adapter.options[0]?.config).toEqual({ model: 'x', mode: 'plan' });
  });

  it('prepare() starts the agent early and a message sent meanwhile waits for it', async () => {
    let release!: () => void;
    const adapter = new StubAdapter(say('ok'));
    const create = adapter.createSession.bind(adapter);
    adapter.createSession = (options, host) =>
      new Promise((resolve) => {
        release = () => resolve(create(options, host));
      });
    const session = new ChatSession({
      localId: 'l1',
      adapter,
      host: hostServices,
      options: { cwd: '/vault' },
    });

    const preparing = session.prepare();
    expect(session.getState().status).toBe('starting');
    expect(session.busy).toBe(false);
    const sending = session.send([{ type: 'text', text: 'hola' }]);
    release();
    await Promise.all([preparing, sending]);

    expect(adapter.sessions).toHaveLength(1);
    expect(session.getState().items.map((i) => i.kind)).toEqual(['user', 'assistant']);
  });
});
