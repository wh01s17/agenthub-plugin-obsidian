/** ACP `fs/read_text_file` window: `line` is 1-based, `limit` is a number of lines. */
export function sliceLines(text: string, line?: number, limit?: number): string {
  if (line === undefined && limit === undefined) return text;
  const lines = text.split('\n');
  const start = Math.max((line ?? 1) - 1, 0);
  const end = limit === undefined ? lines.length : start + Math.max(limit, 0);
  return lines.slice(start, end).join('\n');
}
