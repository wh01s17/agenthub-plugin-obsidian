// Session → Markdown note (plan §4.10, T4.4). Pure: the caller writes the file.

import type { PromptBlock, SessionViewState, ToolCall, TranscriptItem } from '../core/types';

export interface ExportLabels {
  agent: string;
  you: string;
  thinking: string;
  plan: string;
  permission: string;
  notice: (item: TranscriptItem & { kind: 'notice' }) => string;
  /** Vault-relative path for a file inside the vault, or `null` for paths outside it. */
  vaultPath?: (path: string) => string | null;
}

/** Prefixes every line so multi-line text stays inside a callout. */
const quote = (text: string) =>
  text
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');

const yamlString = (value: string) => JSON.stringify(value);

function userMarkdown(blocks: readonly PromptBlock[]): string {
  const text = blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n\n');
  const attachments = blocks.flatMap((b) => {
    if (b.type === 'file') return [`- [[${b.path}]]`];
    if (b.type === 'selection') return [`- [[${b.path}]] (${b.fromLine}–${b.toLine})`];
    return [];
  });
  return attachments.length > 0 ? `${text}\n\n${attachments.join('\n')}` : text;
}

/** A code fence longer than any backtick run in `text`, so the text cannot close it early. */
function fenced(text: string): string[] {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return [fence, text, fence];
}

function toolMarkdown(call: ToolCall, link: (path: string) => string): string {
  const body: string[] = [];
  for (const location of call.locations ?? []) body.push(`- ${link(location.path)}`);
  for (const content of call.content ?? []) {
    if (content.type === 'text') body.push(...fenced(content.text));
    if (content.type === 'terminal') body.push(...fenced(content.output));
    if (content.type === 'diff') body.push(link(content.path), ...fenced(content.newText));
  }
  const header = `[!tool]- ${call.title} (${call.status})`;
  return quote([header, ...body].join('\n'));
}

export function sessionToMarkdown(
  state: SessionViewState,
  labels: ExportLabels,
  now: Date,
): string {
  const front = [
    '---',
    `agent: ${yamlString(labels.agent)}`,
    `session: ${yamlString(state.localId)}`,
    `exported: ${now.toISOString()}`,
    '---',
    '',
    `# ${state.title || state.localId}`,
    '',
  ];
  // Files inside the vault become [[links]] (vault-relative); anything else stays as code.
  const link = (path: string) => {
    const inVault = labels.vaultPath?.(path);
    return inVault ? `[[${inVault}]]` : `\`${path}\``;
  };
  const body = state.items.map((item): string => {
    switch (item.kind) {
      case 'user':
        return `## ${labels.you}\n\n${userMarkdown(item.blocks)}`;
      case 'assistant':
        return `## ${labels.agent}\n\n${item.text}`;
      case 'thought':
        return quote(`[!note]- ${labels.thinking}\n${item.text}`);
      case 'tool':
        return toolMarkdown(item.call, link);
      case 'plan':
        return quote(
          [
            `[!todo] ${labels.plan}`,
            ...item.entries.map((e) => `- [${e.status === 'completed' ? 'x' : ' '}] ${e.content}`),
          ].join('\n'),
        );
      case 'permission': {
        const resolved = item.resolved;
        const answer =
          resolved?.outcome === 'selected'
            ? item.request.options.find((o) => o.id === resolved.optionId)?.label
            : resolved?.outcome;
        return quote(
          `[!warning] ${labels.permission}: ${item.request.toolCall.title}${answer ? ` → ${answer}` : ''}`,
        );
      }
      case 'notice':
        return quote(`[!${item.level === 'error' ? 'failure' : 'info'}] ${labels.notice(item)}`);
    }
  });
  return [...front, body.join('\n\n'), ''].join('\n');
}

/** A safe, unique-ish file name from the session title. */
export function exportFileName(title: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
  const safe =
    title
      .replace(/[\\/:*?"<>|#^[\]]/g, '')
      .trim()
      .slice(0, 60) || 'AgentHub session';
  return `${safe} ${stamp}.md`;
}
