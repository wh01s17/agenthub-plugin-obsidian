import { render } from '@testing-library/preact';
import type { App as ObsidianApp } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { TranscriptItem } from '../../src/core/types';
import { MessageList } from '../../src/ui/components/MessageList';

const assistant = (id: string): TranscriptItem => ({
  kind: 'assistant',
  id,
  text: 'Some text',
  streaming: false,
});

const permission: TranscriptItem = {
  kind: 'permission',
  request: {
    id: 'p1',
    toolCall: { id: 't1', title: 'Run command', kind: 'execute' },
    options: [{ id: 'yes', label: 'Yes, proceed', kind: 'allow_once' }],
  },
};

function renderList(items: TranscriptItem[]) {
  const props = {
    app: {} as ObsidianApp,
    showThoughts: false,
    onPermission: vi.fn(),
    onOpenPath: () => false,
  };
  const view = render(<MessageList {...props} items={items} />);
  const list = view.container.querySelector<HTMLElement>('.agenthub-messages')!;
  // jsdom has no layout: give the list a fixed size and let the test move it.
  Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => 1000 });
  Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => 200 });
  return {
    list,
    rerender: (next: TranscriptItem[]) => view.rerender(<MessageList {...props} items={next} />),
  };
}

describe('message list scrolling', () => {
  it('keeps the reading position for new text but scrolls to a new permission request', () => {
    const { list, rerender } = renderList([assistant('a1')]);
    // The user scrolls up to read.
    list.scrollTop = 100;
    list.dispatchEvent(new Event('scroll'));

    rerender([assistant('a1'), assistant('a2')]);
    expect(list.scrollTop).toBe(100);

    rerender([assistant('a1'), assistant('a2'), permission]);
    expect(list.scrollTop).toBe(1000);
  });
});
