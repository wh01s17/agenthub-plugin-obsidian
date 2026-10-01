// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcpAdapter } from '../../src/adapters/acp/AcpAdapter';
import type { AgentSession, HostBridge } from '../../src/core/AgentAdapter';
import { AgentError } from '../../src/core/errors';
import type { AgentEvent, PermissionOutcome, PermissionRequest } from '../../src/core/types';
import { ProcessRegistry } from '../../src/process/ProcessRunner';

const fakeAgent = fileURLToPath(new URL('../../scripts/fake-acp-agent.mjs', import.meta.url));
const registry = new ProcessRegistry();
const sessions: AgentSession[] = [];

afterEach(async () => {
  await Promise.all(sessions.splice(0).map((s) => s.dispose()));
  await registry.killAll(500);
});

function makeAdapter(scenario: string, resolvable = true): AcpAdapter {
  return new AcpAdapter(
    {
      id: 'fake',
      label: 'Fake',
      command: process.execPath,
      args: [fakeAgent, '--scenario', scenario, '--delay', '1'],
      installHint: 'Install the fake agent',
      loginHint: 'Run `fake login`',
    },
    {
      resolveCommand: () =>
        Promise.resolve(
          resolvable ? { path: process.execPath, env: process.env, source: 'process' } : null,
        ),
      registry,
    },
  );
}

function makeHost(
  decide: (request: PermissionRequest) => Promise<PermissionOutcome> = (request) =>
    Promise.resolve({ outcome: 'selected', optionId: request.options[0]?.id ?? '' }),
) {
  const requestPermission = vi.fn(decide);
  const host: HostBridge = {
    vaultBasePath: process.cwd(),
    env: () => Promise.resolve(process.env),
    readTextFile: () => Promise.resolve(''),
    writeTextFile: () => Promise.resolve(),
    requestPermission,
    log: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
  };
  return { host, requestPermission };
}

async function start(
  scenario: string,
  options: { config?: Record<string, string>; instructions?: string } = {},
) {
  const events: AgentEvent[] = [];
  const { host, requestPermission } = makeHost();
  const session = await makeAdapter(scenario).createSession(
    { cwd: process.cwd(), config: options.config, systemPromptAppend: options.instructions },
    host,
  );
  sessions.push(session);
  session.onEvent((event) => events.push(event));
  return { session, events, requestPermission };
}

const text = (events: AgentEvent[]) =>
  events.flatMap((e) => (e.type === 'message.chunk' ? [e.text] : [])).join('');
const ofType = <T extends AgentEvent['type']>(events: AgentEvent[], type: T) =>
  events.filter((e): e is Extract<AgentEvent, { type: T }> => e.type === type);

describe('AcpAdapter with the fake ACP agent', () => {
  it('detects the command, or explains how to install it', async () => {
    await expect(makeAdapter('echo').detect()).resolves.toMatchObject({ status: 'available' });
    await expect(makeAdapter('echo', false).detect()).resolves.toEqual({
      status: 'missing',
      message: 'Install the fake agent',
    });
  });

  it('streams a reply, closes the message and reports usage', async () => {
    const { session, events } = await start('echo');
    expect(session.nativeSessionId).toMatch(/^sess_/);
    expect(session.capabilities).toMatchObject({ configOptions: true, embeddedContext: true });

    await expect(session.prompt([{ type: 'text', text: 'hola' }])).resolves.toBe('end_turn');
    expect(text(events)).toBe('Recibido: hola');
    expect(ofType(events, 'message.end')).toHaveLength(1);
    expect(ofType(events, 'usage')[0]?.usage).toMatchObject({
      contextUsed: 1234,
      contextSize: 200000,
    });
    expect(events.at(-1)).toEqual({ type: 'turn.end', stopReason: 'end_turn' });
  });

  it('sends the vault instructions only with the first prompt', async () => {
    const { session, events } = await start('echo', { instructions: 'Usa wikilinks.' });
    await session.prompt([{ type: 'text', text: 'uno' }]);
    expect(text(events)).toContain('<instructions>\nUsa wikilinks.\n</instructions>');
    events.length = 0;
    await session.prompt([{ type: 'text', text: 'dos' }]);
    expect(text(events)).toBe('Recibido: dos');
  });

  it('maps tool calls, terminal output and diffs', async () => {
    const { session, events } = await start('tools');
    await session.prompt([{ type: 'text', text: 'go' }]);
    expect(ofType(events, 'tool.call').map((e) => e.call.kind)).toEqual([
      'read',
      'execute',
      'edit',
    ]);
    const terminal = ofType(events, 'tool.update').flatMap((e) => e.patch.content ?? []);
    expect(terminal).toContainEqual({
      type: 'terminal',
      output: 'Ideas.md\nProyecto Alfa.md\n',
      exitCode: 0,
    });
  });

  it('asks the host for permission and honours the answer', async () => {
    const allowed = await start('permissions');
    await allowed.session.prompt([{ type: 'text', text: 'go' }]);
    expect(allowed.requestPermission).toHaveBeenCalledTimes(1);
    expect(allowed.requestPermission.mock.calls[0]?.[0].options.map((o) => o.kind)).toEqual([
      'allow_once',
      'allow_always',
      'reject_once',
    ]);
    expect(text(allowed.events)).toBe('Archivo escrito.');

    const events: AgentEvent[] = [];
    const { host } = makeHost(() => Promise.resolve({ outcome: 'selected', optionId: 'reject' }));
    const rejected = await makeAdapter('permissions').createSession({ cwd: process.cwd() }, host);
    sessions.push(rejected);
    rejected.onEvent((e) => events.push(e));
    await rejected.prompt([{ type: 'text', text: 'go' }]);
    expect(text(events)).toBe('Permiso denegado.');
  });

  it('delivers session.ready to late subscribers and applies config', async () => {
    const { session, events } = await start('echo', { config: { mode: 'auto' } });
    const ready = ofType(events, 'session.ready')[0];
    expect(ready?.nativeSessionId).toBe(session.nativeSessionId);
    expect(ready?.configOptions?.find((o) => o.id === 'mode')?.currentValue).toBe('auto');

    await session.setConfigOption?.('model', 'fake-large');
    const options = ofType(events, 'config')[0]?.configOptions ?? [];
    expect(options.find((o) => o.id === 'model')?.currentValue).toBe('fake-large');
  });

  it('cancels a running turn', async () => {
    const { session, events } = await start('slow');
    const turn = session.prompt([{ type: 'text', text: 'go' }]);
    await vi.waitFor(() => expect(text(events)).toContain('línea 1'));
    await session.cancel();
    await expect(turn).resolves.toBe('cancelled');
  });

  it('cancels a turn that is waiting for a permission answer', async () => {
    const events: AgentEvent[] = [];
    const { host, requestPermission } = makeHost(() => new Promise(() => {}));
    const session = await makeAdapter('permissions').createSession({ cwd: process.cwd() }, host);
    sessions.push(session);
    session.onEvent((e) => events.push(e));
    const turn = session.prompt([{ type: 'text', text: 'go' }]);
    await vi.waitFor(() => expect(requestPermission).toHaveBeenCalled());
    await session.cancel();
    await expect(turn).resolves.toBe('cancelled');
  });

  it('reports a crash during a turn with the agent stderr', async () => {
    const { session, events } = await start('crash');
    await expect(session.prompt([{ type: 'text', text: 'go' }])).resolves.toBe('error');
    const errors = ofType(events, 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ recoverable: false });
    expect(errors[0]?.detail).toContain('simulated crash');
  });

  it('turns "auth required" into an AgentError with the login hint', async () => {
    const { host } = makeHost();
    const failure = makeAdapter('auth-required').createSession({ cwd: process.cwd() }, host);
    await expect(failure).rejects.toBeInstanceOf(AgentError);
    await expect(failure).rejects.toMatchObject({ kind: 'auth', hint: 'Run `fake login`' });
    expect(registry.size).toBe(0);
  });

  it('fails clearly when the command cannot be resolved', async () => {
    const { host } = makeHost();
    await expect(
      makeAdapter('echo', false).createSession({ cwd: process.cwd() }, host),
    ).rejects.toMatchObject({ kind: 'missing-binary', hint: 'Install the fake agent' });
  });

  it('stops the agent process on dispose', async () => {
    const { session } = await start('echo');
    expect(registry.size).toBe(1);
    await session.dispose();
    await vi.waitFor(() => expect(registry.size).toBe(0));
  });
});

describe('AcpAdapter.loadSession (T4.2)', () => {
  it('resumes a native session when the agent supports session/resume', async () => {
    const { host } = makeHost();
    const resumed = await makeAdapter('echo').loadSession('sess_old', { cwd: process.cwd() }, host);
    sessions.push(resumed);
    expect(resumed.restored).toBe(true);
    expect(resumed.nativeSessionId).toBe('sess_old');
    await expect(resumed.prompt([{ type: 'text', text: 'sigo' }])).resolves.toBe('end_turn');
  });

  it('falls back to a new session when the agent cannot resume', async () => {
    const { host } = makeHost();
    const adapter = new AcpAdapter(
      {
        id: 'fake',
        label: 'Fake',
        command: process.execPath,
        args: [fakeAgent, '--no-resume', '--delay', '1'],
      },
      {
        resolveCommand: () =>
          Promise.resolve({ path: process.execPath, env: process.env, source: 'process' }),
        registry,
      },
    );
    const fresh = await adapter.loadSession('sess_old', { cwd: process.cwd() }, host);
    sessions.push(fresh);
    expect(fresh.restored).toBe(false);
    expect(fresh.nativeSessionId).not.toBe('sess_old');
  });
});
