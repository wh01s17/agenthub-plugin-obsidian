import type { App, Plugin } from 'obsidian';
import { __resetThenCalls, __thenCalls } from '../__mocks__/obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AgentHubSettings, defaultSettings } from '../../src/settings/settings';
import { AgentHubSettingTab, type SettingsHost } from '../../src/settings/SettingsTab';

function makeTab() {
  const settings = defaultSettings();
  const detectAgent = vi.fn(() =>
    Promise.resolve({ status: 'available' as const, resolvedCommand: '/bin/npx' }),
  );
  const host: SettingsHost = {
    settings,
    updateSettings: (change: (s: AgentHubSettings) => void) => {
      change(settings);
      return Promise.resolve();
    },
    detectAgent,
    redetectAgents: vi.fn(),
  };
  const tab = new AgentHubSettingTab({} as App, {} as Plugin, host);
  return { tab, detectAgent };
}

describe('AgentHubSettingTab', () => {
  beforeEach(() => __resetThenCalls());

  // Regression: returning a Setting from a promise callback froze Obsidian 1.13 (thenable loop).
  it('shows detection results without ever adopting a Setting as a promise', async () => {
    const { tab, detectAgent } = makeTab();
    tab.display();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(__thenCalls()).toBe(0);
    expect(detectAgent).toHaveBeenCalledTimes(3); // enabled presets only
    expect(tab.containerEl.textContent).toContain('Available: /bin/npx');
    expect(tab.containerEl.textContent).toContain('Disabled'); // Gemini
  });
});

describe('declarative settings (T6.7)', () => {
  it('exposes searchable groups for Obsidian 1.13+ and hides per-agent detail rows from search', () => {
    const { tab } = makeTab();
    const groups = tab.getSettingDefinitions();
    const headings = groups.map((g) => ('heading' in g ? g.heading : ''));
    expect(headings).toEqual(['Agents', 'Sessions', 'Environment']);

    const names = groups.flatMap((g) =>
      'items' in g && g.items ? g.items.flatMap((i) => ('name' in i ? [i.name] : [])) : [],
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'Default agent',
        'Claude Code',
        'Working directory',
        'Extra PATH folders',
      ]),
    );
  });

  it('draws the same rows imperatively on older Obsidian (display fallback)', () => {
    const { tab } = makeTab();
    tab.display();
    const text = tab.containerEl.textContent ?? '';
    for (const name of [
      'Agents',
      'Default agent',
      'Claude Code',
      'Sessions',
      'Working directory',
      'Environment',
    ]) {
      expect(text).toContain(name);
    }
  });
});
