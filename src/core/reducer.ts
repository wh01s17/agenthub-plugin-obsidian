// Pure (state, action) → state for one chat session (plan §4.3). Never mutates its input.

import type {
  AgentEvent,
  AgentId,
  ConfigOption,
  Notice,
  PlanEntry,
  PermissionOutcome,
  PermissionRequest,
  PromptBlock,
  SessionStatus,
  SessionViewState,
  ToolCall,
  TranscriptItem,
  Usage,
} from './types';

/** Things the session itself does, as opposed to what the agent reports (`AgentEvent`). */
export type LocalAction =
  | { type: 'local.user'; id: string; blocks: PromptBlock[]; at: number }
  | { type: 'local.status'; status: SessionStatus }
  | { type: 'local.permission.request'; request: PermissionRequest }
  | { type: 'local.permission.resolve'; id: string; outcome: PermissionOutcome }
  | { type: 'local.notice'; level: 'info' | 'warning' | 'error'; notice: Notice }
  | { type: 'local.title'; title: string };

export type SessionAction = AgentEvent | LocalAction;

export interface InitialSession {
  localId: string;
  agentId: AgentId;
  cwd: string;
  title?: string;
  /** Transcript and native id of a stored session being reopened. */
  items?: TranscriptItem[];
  nativeSessionId?: string;
  /** Options the agent announced last time, shown before it starts (it starts lazily). */
  configOptions?: ConfigOption[];
}

export function createInitialState({
  localId,
  agentId,
  cwd,
  title = '',
  items = [],
  nativeSessionId,
  configOptions = [],
}: InitialSession): SessionViewState {
  return {
    localId,
    agentId,
    cwd,
    title,
    nativeSessionId,
    status: 'idle',
    items,
    configOptions,
    commands: [],
  };
}

export function reduce(state: SessionViewState, action: SessionAction): SessionViewState {
  switch (action.type) {
    case 'session.ready':
      return {
        ...state,
        nativeSessionId: action.nativeSessionId,
        configOptions: action.configOptions ?? state.configOptions,
        modes: action.modes,
        currentModeId: action.currentModeId,
        models: action.models,
        currentModelId: action.currentModelId,
      };
    case 'config':
      return { ...state, configOptions: action.configOptions };
    case 'mode':
      return {
        ...state,
        currentModeId: action.currentModeId,
        configOptions: state.configOptions.map((option) =>
          option.category === 'mode' ? { ...option, currentValue: action.currentModeId } : option,
        ),
      };
    case 'commands':
      return { ...state, commands: action.commands };
    case 'usage':
      return { ...state, usage: mergeUsage(state.usage, action.usage) };

    case 'message.chunk':
      return action.role === 'assistant'
        ? appendText(state, 'assistant', action.messageId, action.text)
        : appendUserText(state, action.messageId, action.text);
    case 'thought.chunk':
      return appendText(state, 'thought', action.messageId, action.text);
    case 'message.end':
      return updateItems(state, (item) =>
        (item.kind === 'assistant' || item.kind === 'thought') && item.id === action.messageId
          ? { ...item, streaming: false }
          : item,
      );

    case 'tool.call':
      return upsertTool(state, action.call.id, (existing) => ({ ...existing, ...action.call }));
    case 'tool.update':
      return upsertTool(state, action.id, (existing) => ({ ...existing, ...action.patch }));
    case 'plan':
      return upsertPlan(state, action.entries);

    case 'permission.denied':
      return pushNotice(state, 'warning', { key: 'permissionDenied', toolName: action.toolName });
    case 'error': {
      const next = pushNotice(state, 'error', {
        key: 'agentError',
        message: action.message,
        detail: action.detail,
      });
      return action.recoverable ? next : { ...next, status: 'error' };
    }
    case 'turn.end': {
      const settled = updateItems(state, (item) =>
        (item.kind === 'assistant' || item.kind === 'thought') && item.streaming
          ? { ...item, streaming: false }
          : item.kind === 'permission' && !item.resolved
            ? { ...item, resolved: { outcome: 'cancelled' } }
            : item,
      );
      const status: SessionStatus = state.status === 'error' ? 'error' : 'idle';
      const next = { ...settled, status };
      return action.stopReason === 'end_turn' || action.stopReason === 'error'
        ? next
        : pushNotice(next, 'info', { key: 'turnStopped', stopReason: action.stopReason });
    }
    case 'debug':
      return state;

    case 'local.user':
      return {
        ...state,
        status: 'running',
        items: [
          ...state.items,
          { kind: 'user', id: action.id, blocks: action.blocks, at: action.at },
        ],
      };
    case 'local.status':
      return { ...state, status: action.status };
    case 'local.permission.request':
      return {
        ...state,
        status: 'awaiting-permission',
        items: [...state.items, { kind: 'permission', request: action.request }],
      };
    case 'local.permission.resolve': {
      const next = updateItems(state, (item) =>
        item.kind === 'permission' && item.request.id === action.id
          ? { ...item, resolved: action.outcome }
          : item,
      );
      const stillWaiting = next.items.some((item) => item.kind === 'permission' && !item.resolved);
      return state.status === 'awaiting-permission' && !stillWaiting
        ? { ...next, status: 'running' }
        : next;
    }
    case 'local.notice':
      return pushNotice(state, action.level, action.notice);
    case 'local.title':
      return { ...state, title: action.title };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function updateItems(
  state: SessionViewState,
  update: (item: TranscriptItem) => TranscriptItem,
): SessionViewState {
  let changed = false;
  const items = state.items.map((item) => {
    const next = update(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...state, items } : state;
}

/** Index of the last item matching `predicate`; recent items are the likely targets. */
function findLastIndex(
  items: readonly TranscriptItem[],
  predicate: (item: TranscriptItem) => boolean,
): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item && predicate(item)) return i;
  }
  return -1;
}

function replaceAt(state: SessionViewState, index: number, item: TranscriptItem): SessionViewState {
  const items = [...state.items];
  items[index] = item;
  return { ...state, items };
}

function appendText(
  state: SessionViewState,
  kind: 'assistant' | 'thought',
  id: string,
  text: string,
): SessionViewState {
  const index = findLastIndex(state.items, (item) => item.kind === kind && item.id === id);
  const existing = state.items[index];
  if (existing && (existing.kind === 'assistant' || existing.kind === 'thought')) {
    return replaceAt(state, index, { ...existing, text: existing.text + text, streaming: true });
  }
  return { ...state, items: [...state.items, { kind, id, text, streaming: true }] };
}

/** User text replayed by the agent (e.g. when loading a session). */
function appendUserText(state: SessionViewState, id: string, text: string): SessionViewState {
  const index = findLastIndex(state.items, (item) => item.kind === 'user' && item.id === id);
  const existing = state.items[index];
  if (existing?.kind === 'user') {
    const last = existing.blocks.at(-1);
    const blocks: PromptBlock[] =
      last?.type === 'text'
        ? [...existing.blocks.slice(0, -1), { type: 'text', text: last.text + text }]
        : [...existing.blocks, { type: 'text', text }];
    return replaceAt(state, index, { ...existing, blocks });
  }
  return {
    ...state,
    items: [...state.items, { kind: 'user', id, blocks: [{ type: 'text', text }], at: 0 }],
  };
}

function upsertTool(
  state: SessionViewState,
  id: string,
  merge: (existing: ToolCall) => ToolCall,
): SessionViewState {
  const index = findLastIndex(state.items, (item) => item.kind === 'tool' && item.call.id === id);
  const existing = state.items[index];
  if (existing?.kind === 'tool')
    return replaceAt(state, index, { kind: 'tool', call: merge(existing.call) });
  // An update for a call we never saw: start from neutral defaults.
  const call = merge({ id, title: 'Tool call', kind: 'other', status: 'pending' });
  return { ...state, items: [...state.items, { kind: 'tool', call }] };
}

/** One plan per turn: later updates replace the plan shown since the last user message. */
function upsertPlan(state: SessionViewState, entries: PlanEntry[]): SessionViewState {
  const lastUser = findLastIndex(state.items, (item) => item.kind === 'user');
  const index = findLastIndex(state.items, (item) => item.kind === 'plan');
  if (index > lastUser) return replaceAt(state, index, { kind: 'plan', entries });
  return { ...state, items: [...state.items, { kind: 'plan', entries }] };
}

function pushNotice(
  state: SessionViewState,
  level: 'info' | 'warning' | 'error',
  notice: Notice,
): SessionViewState {
  // Items only ever grow, so the position is a stable, deterministic id.
  const item: TranscriptItem = {
    kind: 'notice',
    id: `notice-${state.items.length}`,
    level,
    notice,
  };
  return { ...state, items: [...state.items, item] };
}

const USAGE_KEYS = [
  'inputTokens',
  'outputTokens',
  'cachedInputTokens',
  'costUsd',
  'contextUsed',
  'contextSize',
] as const satisfies readonly (keyof Usage)[];

/** Later reports only override the fields they actually carry. */
function mergeUsage(previous: Usage | undefined, next: Usage): Usage {
  const merged: Usage = { ...previous };
  for (const key of USAGE_KEYS) {
    const value = next[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}
