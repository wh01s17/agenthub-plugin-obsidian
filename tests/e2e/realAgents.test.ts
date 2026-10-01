// @vitest-environment node
// End-to-end against real agents. Costs tokens/time: runs only with AGENTHUB_E2E=1 (`pnpm test:e2e`),
// and only for the agents listed in AGENTHUB_E2E_AGENTS (default: opencode).
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AgentRegistry } from '../../src/agents/AgentRegistry';
import { ChatSession } from '../../src/core/ChatSession';
import { CommandResolver } from '../../src/process/BinaryResolver';
import { ProcessRegistry } from '../../src/process/ProcessRunner';
import { AGENT_PRESETS } from '../../src/settings/settings';
import { hostServices } from '../helpers/stubAgent';

const enabled = process.env.AGENTHUB_E2E === '1';
const agentIds = (process.env.AGENTHUB_E2E_AGENTS ?? 'opencode').split(',');
const processes = new ProcessRegistry();

afterAll(() => processes.killAll(1000));

describe.skipIf(!enabled)('real agents (e2e)', () => {
  const registry = new AgentRegistry({
    resolveCommand: (command) =>
      new CommandResolver({ baseEnv: process.env, platform: process.platform }).resolve(command),
    processes,
    hints: { install: String, login: String, unsupported: String, noCommand: () => '' },
  });
  registry.setAgents(AGENT_PRESETS.map((preset) => ({ ...preset, enabled: true })));

  it.each(agentIds)(
    '%s reads a note and writes a summary through AgentHub',
    async (agentId) => {
      const adapter = registry.get(agentId);
      expect(adapter, `unknown agent ${agentId}`).toBeDefined();
      if (!adapter) return;

      const vault = mkdtempSync(join(tmpdir(), 'agenthub-e2e-'));
      cpSync('test-vault', vault, { recursive: true, filter: (src) => !src.includes('.obsidian') });
      const session = new ChatSession({
        localId: 'e2e',
        adapter,
        // Approve whatever the agent asks for; this is a disposable copy of the vault.
        host: hostServices,
        options: { cwd: vault, config: agentId === 'codex-acp' ? { mode: 'workspace-write' } : {} },
      });
      const answerPermissions = session.subscribe((state) => {
        for (const item of state.items) {
          if (item.kind === 'permission' && !item.resolved) {
            const allow = item.request.options.find((o) => o.kind === 'allow_once');
            if (allow)
              session.resolvePermission(item.request.id, {
                outcome: 'selected',
                optionId: allow.id,
              });
          }
        }
      });
      try {
        await session.send([
          {
            type: 'text',
            text: 'Read Notas/Ideas.md and create resumen.md in the vault root with a one-line summary. Reply in one sentence.',
          },
        ]);
        const state = session.getState();
        const notices = state.items.filter((i) => i.kind === 'notice');
        expect(notices, JSON.stringify(notices)).toEqual([]);
        expect(state.nativeSessionId).toBeTruthy();
        expect(state.items.some((i) => i.kind === 'assistant' && i.text.length > 0)).toBe(true);
        expect(state.items.some((i) => i.kind === 'tool')).toBe(true);
        expect(readFileSync(join(vault, 'resumen.md'), 'utf8').length).toBeGreaterThan(0);
      } finally {
        answerPermissions.dispose();
        await session.dispose();
        rmSync(vault, { recursive: true, force: true });
      }
    },
    240_000,
  );

  it.each(agentIds)(
    '%s continues a reopened session in a new process (T4.2)',
    async (agentId) => {
      const adapter = registry.get(agentId);
      if (!adapter) return;
      const options = { cwd: process.cwd() };
      const first = new ChatSession({ localId: 'e2e-a', adapter, host: hostServices, options });
      await first.send([
        { type: 'text', text: 'Remember the code word: PELICANO. Reply only "ok".' },
      ]);
      const { nativeSessionId, items } = first.getState();
      await first.dispose();
      expect(nativeSessionId).toBeTruthy();

      const reopened = new ChatSession({
        localId: 'e2e-a',
        adapter,
        host: hostServices,
        options,
        restore: { items: [...items], nativeSessionId },
      });
      try {
        await reopened.send([
          { type: 'text', text: 'What was the code word? Reply with the word only.' },
        ]);
        const state = reopened.getState();
        expect(state.items.some((i) => i.kind === 'notice')).toBe(false);
        const last = [...state.items].reverse().find((i) => i.kind === 'assistant');
        expect(last?.kind === 'assistant' ? last.text.toUpperCase() : '').toContain('PELICANO');
      } finally {
        await reopened.dispose();
      }
    },
    240_000,
  );
});
