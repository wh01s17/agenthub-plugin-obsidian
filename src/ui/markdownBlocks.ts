// Splits Markdown into top-level blocks so a streamed message re-renders only its last block
// (spike S5: re-rendering a whole 14 KB message on every update blocked the UI for ~600 ms).

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Blocks are separated by blank lines, except inside fenced code (which may contain blank lines).
 * Joining the blocks with "\n\n" gives back equivalent Markdown.
 */
export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;

  for (const line of text.split('\n')) {
    const marker = FENCE.exec(line)?.[1];
    if (marker) {
      if (fence === null) fence = marker[0]!.repeat(marker.length);
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    }
    if (fence === null && line.trim() === '') {
      if (current.length > 0) blocks.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'));
  return blocks;
}
