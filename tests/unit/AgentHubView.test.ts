import { describe, expect, it } from 'vitest';
import { WorkspaceLeaf } from 'obsidian';
import { AgentHubView, parseViewState } from '../../src/ui/AgentHubView';
import { VIEW_TYPE_AGENTHUB } from '../../src/constants';

describe('parseViewState', () => {
  it('keeps a valid session id', () => {
    expect(parseViewState({ sessionId: 'abc' })).toEqual({ sessionId: 'abc' });
  });

  it.each([undefined, null, 'x', {}, { sessionId: 3 }, { sessionId: '' }])(
    'ignores invalid state %j',
    (state) => {
      expect(parseViewState(state)).toEqual({ sessionId: null });
    },
  );
});

describe('AgentHubView', () => {
  it('mounts the app, persists the session id and unmounts on close', async () => {
    const view = new AgentHubView(new WorkspaceLeaf());
    expect(view.getViewType()).toBe(VIEW_TYPE_AGENTHUB);

    await view.onOpen();
    expect(view.contentEl.querySelector('.agenthub-app')).not.toBeNull();

    await view.setState({ sessionId: 's-1' }, { history: false });
    expect(view.getState()).toMatchObject({ sessionId: 's-1' });
    expect(view.contentEl.querySelector('[data-session-id="s-1"]')).not.toBeNull();

    await view.onClose();
    expect(view.contentEl.querySelector('.agenthub-app')).toBeNull();
  });
});
