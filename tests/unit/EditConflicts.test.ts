// Two open sessions editing the same file (ADR-034).
import { describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '../../src/core/ChatSession';
import { EditConflictWatcher, editedPaths, type EditConflict } from '../../src/core/EditConflicts';
import { SessionManager } from '../../src/core/SessionManager';
import type { AgentEvent, ToolCall } from '../../src/core/types';
import { StubAdapter, hostServices } from '../helpers/stubAgent';

const edit = (id: string, path: string): AgentEvent => ({
  type: 'tool.call',
  call: { id, title: `Edit ${path}`, kind: 'edit', status: 'completed', locations: [{ path }] },
});

function setup(enabled = () => true) {
  const onConflict = vi.fn<(conflict: EditConflict) => void>();
  const watcher = new EditConflictWatcher(onConflict, enabled);
  // Each prompt edits the paths in its text, separated by spaces.
  const adapter = new StubAdapter(({ emit, blocks }) => {
    const text = blocks[0]?.type === 'text' ? blocks[0].text : '';
    for (const [n, path] of text.split(' ').entries()) emit(edit(`${text}-${n}`, path));
    return 'end_turn';
  });
  const manager = new SessionManager({
    getAdapter: () => adapter,
    host: hostServices,
    sessionOptions: () => ({ cwd: '/vault' }),
    onCreate: (session) => watcher.track(session),
  });
  return { manager, onConflict };
}

const send = (session: ChatSession, text: string) => session.send([{ type: 'text', text }]);

describe('editedPaths', () => {
  it('reads locations and diffs of writing tools only', () => {
    const call: ToolCall = {
      id: 'c',
      title: 'Edit',
      kind: 'edit',
      status: 'completed',
      locations: [{ path: '/v/A.md' }],
      content: [{ type: 'diff', path: '/v/B.md', oldText: null, newText: 'x' }],
    };
    expect(editedPaths(call)).toEqual(['/v/A.md', '/v/B.md']);
    expect(editedPaths({ ...call, kind: 'read' })).toEqual([]);
    expect(editedPaths({ ...call, status: 'failed' })).toEqual([]);
  });
});

describe('EditConflictWatcher', () => {
  it('warns once when a second session edits the same file', async () => {
    const { manager, onConflict } = setup();
    const a = manager.create('stub')!;
    const b = manager.create('stub')!;
    await send(a, '/vault/A.md');
    await send(b, '/vault/B.md');
    expect(onConflict).not.toHaveBeenCalled();

    await send(b, '/vault/A.md');
    expect(onConflict).toHaveBeenCalledOnce();
    expect(onConflict.mock.calls[0]?.[0]).toMatchObject({
      path: '/vault/A.md',
      session: { localId: b.localId },
      others: [{ localId: a.localId }],
    });
    await send(a, '/vault/A.md');
    expect(onConflict).toHaveBeenCalledOnce();
  });

  it('forgets closed sessions and respects the setting', async () => {
    let enabled = false;
    const { manager, onConflict } = setup(() => enabled);
    const a = manager.create('stub')!;
    const b = manager.create('stub')!;
    await send(a, '/vault/A.md');
    await send(b, '/vault/A.md');
    expect(onConflict).not.toHaveBeenCalled();

    enabled = true;
    await manager.close(a.localId);
    const c = manager.create('stub')!;
    await send(c, '/vault/A.md');
    expect(onConflict).toHaveBeenCalledOnce();
    expect(onConflict.mock.calls[0]?.[0].others).toEqual([
      expect.objectContaining({ localId: b.localId }),
    ]);
  });
});
