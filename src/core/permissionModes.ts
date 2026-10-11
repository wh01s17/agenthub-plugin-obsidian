import type { ConfigOption } from './types';

const UNRESTRICTED_MODES = new Set([
  'bypassPermissions',
  'danger-full-access',
  'agent-full-access',
  'yolo',
  // GitHub Copilot CLI 1.0.95 (`copilot --acp`): runs until done with every tool allowed.
  'https://agentclientprotocol.com/protocol/session-modes#autopilot',
]);

/** Options whose "on" value allows every tool, e.g. Copilot's `allow_all` switch. */
const UNRESTRICTED_SWITCHES: Record<string, string> = { allow_all: 'on' };

export interface DangerousModeRequest {
  agentId: string;
  optionId: string;
  value: string;
  /** Title of the session asking, so the dialog says which tab it comes from. */
  sessionTitle?: string;
}
export type ConfirmDangerousMode = (
  request: DangerousModeRequest,
  signal: AbortSignal,
) => Promise<boolean>;

/** Whether choosing `value` (for option `optionId`, when known) lifts the permission prompts. */
export function isDangerousMode(value: string, optionId?: string): boolean {
  return (
    UNRESTRICTED_MODES.has(value) ||
    (optionId !== undefined && UNRESTRICTED_SWITCHES[optionId] === value)
  );
}

export function dangerousModeOptions(options: readonly ConfigOption[]): ConfigOption[] {
  return options.filter((option) => isDangerousMode(option.currentValue, option.id));
}

/** Explicit settings win; Codex's upstream Auto review default is never our implicit default. */
export function initialSessionConfig(
  agentId: string,
  config: Record<string, string> = {},
): Record<string, string> {
  return agentId === 'codex-acp' ? { mode: 'read-only', ...config } : { ...config };
}
