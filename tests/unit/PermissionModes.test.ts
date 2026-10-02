import { describe, expect, it, vi } from 'vitest';
import { ChatSession } from '../../src/core/ChatSession';
import { initialSessionConfig, type ConfirmDangerousMode } from '../../src/core/permissionModes';
import type { SessionOptions } from '../../src/core/AgentAdapter';
import { StubAdapter, hostServices } from '../helpers/stubAgent';

function setup(allowed = true, config?: SessionOptions['config']) {
  const adapter = new StubAdapter(() => 'end_turn');
  const confirm = vi.fn<ConfirmDangerousMode>(() => Promise.resolve(allowed));
  const chosen = vi.fn();
  const session = new ChatSession({
    localId: 's1',
    adapter,
    host: hostServices,
    options: { cwd: '/vault', config },
    confirmDangerousMode: confirm,
    onConfigChosen: chosen,
  });
  return { adapter, session, confirm, chosen };
}

describe('permission modes', () => {
  it('uses read-only for unconfigured Codex and preserves explicit mode choices', () => {
    expect(initialSessionConfig('codex-acp')).toEqual({ mode: 'read-only' });
    expect(initialSessionConfig('codex-acp', { model: 'm' })).toEqual({
      mode: 'read-only',
      model: 'm',
    });
    expect(initialSessionConfig('codex-acp', { mode: 'workspace-write' }).mode).toBe(
      'workspace-write',
    );
    expect(initialSessionConfig('custom', { mode: 'manual' })).toEqual({ mode: 'manual' });
  });

  it.each(['bypassPermissions', 'danger-full-access', 'agent-full-access', 'yolo'])(
    'confirms every activation of %s',
    async (value) => {
      const { session, adapter, confirm } = setup(true);
      await session.setConfigOption('mode', value);
      expect(adapter.sessions).toHaveLength(0);
      await session.setConfigOption('mode', value);
      expect(confirm).toHaveBeenCalledTimes(2);
    },
  );

  it('does not send a rejected initial dangerous mode to the adapter', async () => {
    const { session, adapter, confirm } = setup(false, { mode: 'bypassPermissions' });
    await session.send([{ type: 'text', text: 'go' }]);
    expect(confirm).toHaveBeenCalledOnce();
    expect(adapter.sessions).toHaveLength(0);
    expect(session.getState().status).toBe('error');
  });

  it('fails closed when no confirmation service is available', async () => {
    const adapter = new StubAdapter(() => 'end_turn');
    const session = new ChatSession({
      localId: 's1',
      adapter,
      host: hostServices,
      options: { cwd: '/vault', config: { mode: 'yolo' } },
    });
    await session.prepare();
    expect(adapter.sessions).toHaveLength(0);
    expect(session.getState().status).toBe('error');
  });

  it('preserves the current mode when an idle session rejects a change', async () => {
    const { session, adapter, confirm } = setup(false);
    await session.prepare();
    const set = vi.fn(() => Promise.resolve());
    adapter.sessions[0]!.setConfigOption = set;
    await session.setConfigOption('mode', 'agent-full-access');
    expect(confirm).toHaveBeenCalledOnce();
    expect(set).not.toHaveBeenCalled();
    expect(session.getState().status).toBe('idle');
    expect(session.busy).toBe(false);
  });

  it('remembers choices that take effect, but not rejected or failed ones', async () => {
    const { session, adapter, chosen } = setup(false);
    // Before the agent starts the choice is applied at start-up, so it counts already.
    await session.setConfigOption('model', 'fast-model');
    expect(chosen).toHaveBeenLastCalledWith('model', 'fast-model');

    await session.prepare();
    adapter.sessions[0]!.setConfigOption = vi.fn(() => Promise.resolve());
    await session.setConfigOption('mode', 'plan');
    expect(chosen).toHaveBeenLastCalledWith('mode', 'plan');

    await session.setConfigOption('mode', 'agent-full-access'); // confirmation declined
    adapter.sessions[0]!.setConfigOption = vi.fn(() => Promise.reject(new Error('nope')));
    await session.setConfigOption('model', 'broken-model');
    expect(chosen).toHaveBeenCalledTimes(2);
  });

  it('applies an approved live change and does not prompt for ordinary choices', async () => {
    const { session, adapter, confirm } = setup(true);
    await session.prepare();
    const set = vi.fn(() => Promise.resolve());
    adapter.sessions[0]!.setConfigOption = set;
    await session.setConfigOption('mode', 'agent-full-access');
    await session.setConfigOption('model', 'normal-model');
    expect(confirm).toHaveBeenCalledOnce();
    expect(set.mock.calls).toEqual([
      ['mode', 'agent-full-access'],
      ['model', 'normal-model'],
    ]);
  });

  it('rejects prompts and duplicate changes while a confirmation is open, then cancels on close', async () => {
    const { session, adapter, confirm } = setup(true);
    confirm.mockImplementation(
      (_request, signal) =>
        new Promise((resolve) =>
          signal.addEventListener('abort', () => resolve(false), { once: true }),
        ),
    );
    const change = session.setConfigOption('mode', 'yolo');
    expect(session.busy).toBe(true);
    await session.send([{ type: 'text', text: 'blocked' }]);
    await session.setConfigOption('mode', 'yolo');
    expect(confirm).toHaveBeenCalledOnce();
    await session.dispose();
    await change;
    expect(session.getState().status).toBe('closed');
    expect(adapter.sessions).toHaveLength(0);
  });

  it('confirms an unrestricted mode reported when resuming, and kills a rejected agent', async () => {
    const adapter = new StubAdapter(() => 'end_turn');
    const create = adapter.createSession.bind(adapter);
    adapter.createSession = async (options, host) => {
      const agent = await create(options, host);
      const subscribe = agent.onEvent.bind(agent);
      agent.onEvent = (listener) => {
        listener({
          type: 'session.ready',
          nativeSessionId: 'native',
          configOptions: [
            {
              id: 'mode',
              name: 'Mode',
              currentValue: 'yolo',
              options: [{ value: 'yolo', name: 'Unrestricted' }],
            },
          ],
        });
        return subscribe(listener);
      };
      return agent;
    };
    const confirm = vi.fn(() => Promise.resolve(false));
    const session = new ChatSession({
      localId: 's1',
      adapter,
      host: hostServices,
      options: { cwd: '/vault' },
      restore: { nativeSessionId: 'native', items: [] },
      confirmDangerousMode: confirm,
    });
    await session.send([{ type: 'text', text: 'go' }]);
    expect(confirm).toHaveBeenCalledOnce();
    expect(adapter.sessions[0]?.disposed).toBe(true);
    expect(adapter.sessions[0]?.prompts).toEqual([]);
  });

  it('keeps a session closed when disposal cancels its initial confirmation', async () => {
    const { session, adapter, confirm } = setup(true, { mode: 'yolo' });
    confirm.mockImplementation(
      (_request, signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => resolve(false), { once: true });
        }),
    );
    const preparing = session.prepare();
    await session.dispose();
    await preparing;
    expect(session.getState().status).toBe('closed');
    expect(adapter.sessions).toHaveLength(0);
  });
});
