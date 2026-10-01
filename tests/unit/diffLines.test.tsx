import { describe, expect, it } from 'vitest';
import { lineDiff } from '../../src/ui/diffLines';
import { render, screen, fireEvent } from '@testing-library/preact';
import { vi } from 'vitest';
import { DiffView } from '../../src/ui/components/DiffView';
describe('lineDiff', () => {
  it('marks added and removed lines', () => {
    expect(lineDiff('a\nb\nc\n', 'a\nB\nc\n')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'remove', text: 'b' },
      { kind: 'add', text: 'B' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('treats a new file as all additions', () => {
    expect(lineDiff(null, 'x\ny')).toEqual([
      { kind: 'add', text: 'x' },
      { kind: 'add', text: 'y' },
    ]);
  });

  it('collapses long unchanged runs, keeping context around changes', () => {
    const before = ['1', '2', '3', '4', '5', '6', '7', '8'].join('\n');
    const after = before.replace('7', 'siete');
    const kinds = lineDiff(before, after).map((l) => `${l.kind}:${l.text}`);
    expect(kinds).toEqual(['skip:…', 'same:5', 'same:6', 'remove:7', 'add:siete', 'same:8']);
  });
});

describe('DiffView', () => {
  it('renders marked lines and opens the file', () => {
    const onOpenPath = vi.fn(() => true);
    const { container } = render(
      <DiffView
        path="Notas/Ideas.md"
        oldText={'a\nb\n'}
        newText={'a\nB\n'}
        onOpenPath={onOpenPath}
      />,
    );
    expect(container.querySelector('.is-remove')?.textContent).toContain('b');
    expect(container.querySelector('.is-add')?.textContent).toContain('Added: B');
    fireEvent.click(screen.getByRole('link', { name: 'Notas/Ideas.md' }));
    expect(onOpenPath).toHaveBeenCalledWith('Notas/Ideas.md');
  });
});
