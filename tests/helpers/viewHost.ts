// Fake ViewHost wiring a real SessionManager and AgentRegistry around the stub agent.
import { vi } from 'vitest';
import type { App } from 'obsidian';
import { AgentRegistry } from '../../src/agents/AgentRegistry';
import { PromptHistory } from '../../src/core/PromptHistory';
import { SessionManager } from '../../src/core/SessionManager';
import { ProcessRegistry } from '../../src/process/ProcessRunner';
import { defaultSettings, type AgentHubSettings } from '../../src/settings/settings';
import type { SessionStore } from '../../src/storage/SessionStore';
import type { ViewHost } from '../../src/ui/ViewHost';
import { StubAdapter, hostServices, type StubScript } from './stubAgent';

export function makeViewHost(
  script: StubScript,
  settings: Partial<AgentHubSettings> = {},
  store?: SessionStore,
) {
  const adapter = new StubAdapter(script, 'claude-acp', 'Claude Code');
  // A second agent so tabs can run different agents side by side (ADR-033).
  const codex = new StubAdapter(script, 'codex-acp', 'Codex');
  const adapters = new Map([adapter, codex].map((a) => [a.id, a]));
  const agents = new AgentRegistry({
    resolveCommand: () => Promise.resolve(null),
    processes: new ProcessRegistry(),
    hints: { install: String, login: String, unsupported: String, noCommand: () => '' },
  });
  const merged = { ...defaultSettings(), ...settings };
  agents.setAgents(merged.agents);
  const sessions = new SessionManager({
    getAdapter: (id) => (agents.config(id)?.enabled ? adapters.get(id) : undefined),
    host: hostServices,
    sessionOptions: () => ({ cwd: '/vault' }),
    onCreate: (session) => store?.track(session),
  });
  const app = {
    workspace: { openLinkText: vi.fn(), requestSaveLayout: vi.fn(), getLeavesOfType: () => [] },
  } as unknown as App;
  const host: ViewHost = {
    app,
    settings: merged,
    agents,
    sessions,
    notes: {
      activeNotePath: () => null,
      onActiveNoteChange: () => () => {},
      readNote: () => Promise.resolve(null),
      listNotes: () => [],
      openPath: () => false,
      displayPath: (path: string) => path,
      displayText: (text: string) => text,
    },
    prompts: new PromptHistory(),
    history: store,
    openSettings: vi.fn(),
    exportSession: vi.fn(() => Promise.resolve()),
    workingDirectory: () => '/vault',
  };
  return { host, adapter, codex, sessions };
}
