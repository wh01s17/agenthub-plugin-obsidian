import { describe, expect, it } from 'vitest';
import { WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_AGENTHUB } from '../../src/constants';
import { AgentHubView, parseViewState } from '../../src/ui/AgentHubView';
import { makeViewHost } from '../helpers/viewHost';

const noop = () => 'end_turn' as const;

describe('parseViewState', () => {
  it('keeps the tabs and the active one', () => {
    expect(parseViewState({ tabs: ['a', 'b', 'a', 3, ''], activeTab: 'b' })).toEqual({
      tabs: ['a', 'b'],
      activeTab: 'b',
    });
  });

  it('reads the single session saved by 0.2.x', () => {
    expect(parseViewState({ sessionId: 'abc' })).toEqual({ tabs: ['abc'], activeTab: 'abc' });
  });

  it('falls back to the first tab when the active one is unknown', () => {
    expect(parseViewState({ tabs: ['a', 'b'], activeTab: 'zzz' })).toEqual({
      tabs: ['a', 'b'],
      activeTab: 'a',
    });
  });

  it.each([undefined, null, 'x', {}, { sessionId: 3 }, { sessionId: '' }, { tabs: 'a' }])(
    'ignores invalid state %j',
    (state) => {
      expect(parseViewState(state)).toEqual({ tabs: [], activeTab: null });
    },
  );
});

describe('AgentHubView', () => {
  it('opens a session for the default agent and ends it on close', async () => {
    const { host, sessions } = makeViewHost(noop);
    const view = new AgentHubView(new WorkspaceLeaf(), host);
    expect(view.getViewType()).toBe(VIEW_TYPE_AGENTHUB);

    await view.onOpen();
    const [session] = sessions.list();
    expect(session?.getState().agentId).toBe('claude-acp');
    expect(view.getState()).toMatchObject({
      tabs: [session?.localId],
      activeTab: session?.localId,
      sessionId: session?.localId,
    });
    expect(view.contentEl.querySelector('.agenthub-composer-input')).not.toBeNull();

    await view.onClose();
    expect(sessions.list()).toEqual([]);
    expect(view.contentEl.querySelector('.agenthub-app')).toBeNull();
  });

  it('starts a new session and closes the previous one', async () => {
    const { host, sessions } = makeViewHost(noop);
    const view = new AgentHubView(new WorkspaceLeaf(), host);
    await view.onOpen();
    const first = sessions.list()[0]?.localId;
    view.startNewSession();
    const ids = sessions.list().map((s) => s.localId);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(first);
  });

  it('shows how to enable agents when none is available', async () => {
    const { host } = makeViewHost(noop, { defaultAgentId: 'missing', agents: [] });
    const view = new AgentHubView(new WorkspaceLeaf(), host);
    await view.onOpen();
    expect(view.contentEl.textContent).toContain('No agents enabled');
  });
});
