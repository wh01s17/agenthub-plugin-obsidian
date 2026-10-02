// ACP `session/update` → domain events (plan §5.1). Tolerant by design: agents send extra kinds and
// fields (S2), so input is treated as untrusted JSON and unknown shapes become `debug` events.

import type {
  AgentEvent,
  ConfigOption,
  PermissionOptionKind,
  PermissionRequest,
  PlanEntry,
  SlashCommand,
  ToolCall,
  ToolContent,
  ToolKind,
  ToolStatus,
} from '../../core/types';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Type guard for a string literal union, without type assertions. */
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.some((candidate) => candidate === value);

const isToolKind = oneOf<ToolKind>([
  'read',
  'edit',
  'delete',
  'move',
  'search',
  'execute',
  'think',
  'fetch',
  'other',
]);
const isToolStatus = oneOf<ToolStatus>(['pending', 'in_progress', 'completed', 'failed']);
const isPermissionKind = oneOf<PermissionOptionKind>([
  'allow_once',
  'allow_always',
  'reject_once',
  'reject_always',
]);

/** Known kinds pass through, unknown strings become `other`, anything else is `undefined`. */
const toolKind = (value: unknown): ToolKind | undefined =>
  isToolKind(value) ? value : typeof value === 'string' ? 'other' : undefined;
const toolStatus = (value: unknown): ToolStatus | undefined =>
  isToolStatus(value) ? value : undefined;

/** Text of an ACP content block; non-text blocks become a short placeholder. */
export function contentText(block: unknown): string {
  if (!isObject(block)) return '';
  if (block.type === 'text') return str(block.text) ?? '';
  if (block.type === 'resource_link') return `[${str(block.name) ?? str(block.uri) ?? 'link'}]`;
  return `[${str(block.type) ?? 'content'}]`;
}

export function mapConfigOptions(raw: unknown): ConfigOption[] {
  return arr(raw).flatMap((item): ConfigOption[] => {
    if (!isObject(item) || item.type !== 'select') return [];
    const id = str(item.id);
    const currentValue = str(item.currentValue);
    if (!id || currentValue === undefined) return [];
    // Options may come flat or grouped (`{ group, options: [...] }`).
    const options = arr(item.options)
      .flatMap((option) =>
        isObject(option) && Array.isArray(option.options) ? arr(option.options) : [option],
      )
      .flatMap((option) => {
        if (!isObject(option)) return [];
        const value = str(option.value);
        if (value === undefined) return [];
        return [{ value, name: str(option.name) ?? value, description: str(option.description) }];
      });
    return [
      {
        id,
        name: str(item.name) ?? id,
        description: str(item.description),
        category: str(item.category),
        currentValue,
        options,
      },
    ];
  });
}

/** Older agents (including Gemini 0.62) announce modes/models outside configOptions. */
export function mapLegacyConfigOptions(raw: unknown): ConfigOption[] {
  if (!isObject(raw)) return [];
  return (['mode', 'model'] as const).flatMap((category): ConfigOption[] => {
    const state = raw[`${category}s`];
    if (!isObject(state)) return [];
    const currentValue = str(state[category === 'mode' ? 'currentModeId' : 'currentModelId']);
    const options = arr(state[category === 'mode' ? 'availableModes' : 'availableModels']).flatMap(
      (item) => {
        if (!isObject(item)) return [];
        const value = str(item[category === 'mode' ? 'id' : 'modelId']);
        return value
          ? [{ value, name: str(item.name) ?? value, description: str(item.description) }]
          : [];
      },
    );
    if (currentValue === undefined || options.length === 0) return [];
    return [
      {
        id: category,
        category,
        name: category === 'mode' ? 'Mode' : 'Model',
        currentValue,
        options,
      },
    ];
  });
}

export function mapPermissionRequest(params: unknown, id: string): PermissionRequest {
  const p = isObject(params) ? params : {};
  const toolCall = isObject(p.toolCall) ? p.toolCall : {};
  return {
    id,
    toolCall: {
      id: str(toolCall.toolCallId) ?? id,
      title: str(toolCall.title) ?? 'Tool call',
      kind: toolKind(toolCall.kind) ?? 'other',
      rawInput: toolCall.rawInput,
      locations: mapLocations(toolCall.locations),
    },
    options: arr(p.options).flatMap((option) => {
      if (!isObject(option)) return [];
      const optionId = str(option.optionId);
      const kind = option.kind;
      if (!optionId || !isPermissionKind(kind)) return [];
      return [{ id: optionId, label: str(option.name) ?? optionId, kind }];
    }),
  };
}

function mapLocations(raw: unknown): ToolCall['locations'] {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((location) => {
    if (!isObject(location)) return [];
    const path = str(location.path);
    return path ? [{ path, line: num(location.line) }] : [];
  });
}

interface TerminalState {
  output: string;
  exitCode?: number;
}

/** Stateful mapper for one session: tracks the open message and terminal output per tool call. */
export class AcpUpdateMapper {
  private openMessage: { id: string; thought: boolean } | null = null;
  private readonly terminals = new Map<string, TerminalState>();
  private generated = 0;

  map(update: unknown): AgentEvent[] {
    if (!isObject(update)) return [];
    const kind = str(update.sessionUpdate);
    switch (kind) {
      case 'agent_message_chunk':
      case 'agent_thought_chunk':
        return this.chunk(update, kind === 'agent_thought_chunk');
      case 'user_message_chunk': {
        const messageId = str(update.messageId) ?? this.newId('user');
        const text = contentText(update.content);
        return [...this.closeMessage(), { type: 'message.chunk', role: 'user', messageId, text }];
      }
      case 'tool_call':
        return [...this.closeMessage(), { type: 'tool.call', call: this.toolCall(update) }];
      case 'tool_call_update': {
        const id = str(update.toolCallId);
        return id ? [{ type: 'tool.update', id, patch: this.toolPatch(id, update) }] : [];
      }
      case 'plan':
        return [{ type: 'plan', entries: mapPlan(update.entries) }];
      case 'available_commands_update':
        return [{ type: 'commands', commands: mapCommands(update.availableCommands) }];
      case 'current_mode_update': {
        const currentModeId = str(update.currentModeId);
        return currentModeId ? [{ type: 'mode', currentModeId }] : [];
      }
      case 'config_option_update':
        return [{ type: 'config', configOptions: mapConfigOptions(update.configOptions) }];
      case 'usage_update':
        return [{ type: 'usage', usage: mapUsage(update) }];
      default:
        return [{ type: 'debug', source: 'rpc', line: JSON.stringify(update) }];
    }
  }

  /** Closes whatever message is still open; call when the turn ends. */
  endTurn(): AgentEvent[] {
    return this.closeMessage();
  }

  private chunk(update: Json, thought: boolean): AgentEvent[] {
    const open = this.openMessage;
    const messageId =
      str(update.messageId) ??
      (open && open.thought === thought ? open.id : this.newId(thought ? 'thought' : 'msg'));
    const events: AgentEvent[] = [];
    if (open && (open.id !== messageId || open.thought !== thought)) {
      events.push(...this.closeMessage());
    }
    this.openMessage = { id: messageId, thought };
    const text = contentText(update.content);
    events.push(
      thought
        ? { type: 'thought.chunk', messageId, text }
        : { type: 'message.chunk', role: 'assistant', messageId, text },
    );
    return events;
  }

  private closeMessage(): AgentEvent[] {
    const open = this.openMessage;
    this.openMessage = null;
    return open ? [{ type: 'message.end', messageId: open.id }] : [];
  }

  private toolCall(update: Json): ToolCall {
    const id = str(update.toolCallId) ?? this.newId('call');
    return {
      id,
      title: str(update.title) ?? 'Tool call',
      kind: toolKind(update.kind) ?? 'other',
      status: toolStatus(update.status) ?? 'pending',
      ...this.toolPatch(id, update),
    };
  }

  private toolPatch(id: string, update: Json): Partial<Omit<ToolCall, 'id'>> {
    const patch: Partial<Omit<ToolCall, 'id'>> = {};
    const title = str(update.title);
    if (title) patch.title = title;
    const kind = toolKind(update.kind);
    if (kind) patch.kind = kind;
    const status = toolStatus(update.status);
    if (status) patch.status = status;
    if ('rawInput' in update) patch.rawInput = update.rawInput;
    if ('rawOutput' in update) patch.rawOutput = update.rawOutput;
    const locations = mapLocations(update.locations);
    if (locations) patch.locations = locations;

    // Codex streams terminal output in `_meta` even without the terminal capability (S2).
    const terminalChanged = this.absorbTerminalMeta(id, update._meta);
    if (Array.isArray(update.content)) {
      patch.content = update.content.flatMap((item) => this.toolContent(id, item));
    } else if (terminalChanged) {
      patch.content = [this.terminalContent(id)];
    }
    return patch;
  }

  private toolContent(toolCallId: string, item: unknown): ToolContent[] {
    if (!isObject(item)) return [];
    switch (item.type) {
      case 'content':
        return [{ type: 'text', text: contentText(item.content) }];
      case 'diff': {
        const path = str(item.path);
        const newText = str(item.newText);
        if (!path || newText === undefined) return [];
        return [{ type: 'diff', path, oldText: str(item.oldText) ?? null, newText }];
      }
      case 'terminal':
        return [this.terminalContent(toolCallId)];
      default:
        return [];
    }
  }

  private absorbTerminalMeta(id: string, meta: unknown): boolean {
    if (!isObject(meta)) return false;
    const delta = isObject(meta.terminal_output_delta)
      ? str(meta.terminal_output_delta.data)
      : undefined;
    const exit = isObject(meta.terminal_exit) ? num(meta.terminal_exit.exit_code) : undefined;
    if (delta === undefined && exit === undefined) return false;
    const terminal = this.terminals.get(id) ?? { output: '' };
    if (delta !== undefined) terminal.output += delta;
    if (exit !== undefined) terminal.exitCode = exit;
    this.terminals.set(id, terminal);
    return true;
  }

  private terminalContent(id: string): ToolContent {
    const terminal = this.terminals.get(id) ?? { output: '' };
    return { type: 'terminal', output: terminal.output, exitCode: terminal.exitCode };
  }

  private newId(prefix: string): string {
    return `${prefix}-${++this.generated}`;
  }
}

function mapPlan(raw: unknown): PlanEntry[] {
  return arr(raw).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const content = str(entry.content);
    const status = str(entry.status);
    if (!content || (status !== 'pending' && status !== 'in_progress' && status !== 'completed')) {
      return [];
    }
    const priority = str(entry.priority);
    return [
      {
        content,
        status,
        priority:
          priority === 'high' || priority === 'medium' || priority === 'low' ? priority : undefined,
      },
    ];
  });
}

function mapCommands(raw: unknown): SlashCommand[] {
  return arr(raw).flatMap((command) => {
    if (!isObject(command)) return [];
    const name = str(command.name);
    if (!name) return [];
    const input = isObject(command.input) ? str(command.input.hint) : undefined;
    return [{ name, description: str(command.description), inputHint: input }];
  });
}

function mapUsage(update: Json): { contextUsed?: number; contextSize?: number; costUsd?: number } {
  const cost =
    isObject(update.cost) && update.cost.currency === 'USD' ? num(update.cost.amount) : undefined;
  return { contextUsed: num(update.used), contextSize: num(update.size), costUsd: cost };
}
