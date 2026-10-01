import { describe, expect, it, vi } from 'vitest';
import { AgentRegistry } from '../../src/agents/AgentRegistry';
import { ProcessRegistry } from '../../src/process/ProcessRunner';
import { AGENT_PRESETS, newCustomAgent } from '../../src/settings/settings';

function makeRegistry(found: string[]) {
  const resolveCommand = vi.fn((command: string) =>
    Promise.resolve(
      found.includes(command)
        ? { path: `/bin/${command}`, env: {}, source: 'process' as const }
        : null,
    ),
  );
  const registry = new AgentRegistry({
    resolveCommand,
    processes: new ProcessRegistry(),
    hints: {
      install: (c) => `install: ${c}`,
      login: (c) => `login: ${c}`,
      unsupported: (t) => `unsupported: ${t}`,
      noCommand: () => 'no command',
    },
  });
  registry.setAgents(AGENT_PRESETS);
  return { registry, resolveCommand };
}

describe('AgentRegistry', () => {
  it('only exposes enabled agents', () => {
    const { registry } = makeRegistry([]);
    expect(registry.enabled().map((a) => a.id)).toEqual(['claude-acp', 'codex-acp', 'opencode']);
    expect(registry.get('claude-acp')?.label).toBe('Claude Code');
    expect(registry.get('gemini')).toBeUndefined();
  });

  it('detects agents with install hints and caches the result', async () => {
    const { registry, resolveCommand } = makeRegistry(['npx']);
    await expect(registry.detect('claude-acp')).resolves.toEqual({
      status: 'available',
      resolvedCommand: '/bin/npx',
    });
    await expect(registry.detect('opencode')).resolves.toEqual({
      status: 'missing',
      message: 'install: npm i -g opencode-ai',
    });
    await registry.detect('claude-acp');
    expect(resolveCommand).toHaveBeenCalledTimes(2);

    registry.invalidate();
    await registry.detect('claude-acp');
    expect(resolveCommand).toHaveBeenCalledTimes(3);
  });

  it('explains unsupported transports and agents without a command', async () => {
    const { registry } = makeRegistry([]);
    const custom = newCustomAgent([], (n) => `Custom ${n}`);
    registry.setAgents([
      { ...custom, id: 'native', transport: 'codex-native', command: 'codex', enabled: true },
      { ...custom, id: 'empty', enabled: true },
    ]);
    await expect(registry.detect('native')).resolves.toEqual({
      status: 'error',
      message: 'unsupported: codex-native',
    });
    await expect(registry.detect('empty')).resolves.toEqual({
      status: 'missing',
      message: 'no command',
    });
    await expect(registry.detect('nope')).resolves.toMatchObject({ status: 'error' });
  });
});
