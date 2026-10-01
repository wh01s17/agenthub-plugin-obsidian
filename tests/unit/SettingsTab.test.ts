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
