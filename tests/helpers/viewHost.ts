// Fake ViewHost wiring a real SessionManager and AgentRegistry around the stub agent.
import { vi } from 'vitest';
import type { App } from 'obsidian';
import { AgentRegistry } from '../../src/agents/AgentRegistry';
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
  const agents = new AgentRegistry({
    resolveCommand: () => Promise.resolve(null),
    processes: new ProcessRegistry(),
    hints: { install: String, login: String, unsupported: String, noCommand: () => '' },
  });
  const merged = { ...defaultSettings(), ...settings };
  agents.setAgents(merged.agents);
  const sessions = new SessionManager({
    getAdapter: (id) => (agents.config(id)?.enabled && id === adapter.id ? adapter : undefined),
    host: hostServices,
    sessionOptions: () => ({ cwd: '/vault' }),
    onCreate: (session) => store?.track(session),
  });
  const app = {
    workspace: { openLinkText: vi.fn(), requestSaveLayout: vi.fn() },
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
    },
    history: store,
    openSettings: vi.fn(),
    workingDirectory: () => '/vault',
  };
  return { host, adapter, sessions };
}
