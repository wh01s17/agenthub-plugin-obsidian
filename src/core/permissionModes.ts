import type { ConfigOption } from './types';

const UNRESTRICTED_MODES = new Set([
  'bypassPermissions',
  'danger-full-access',
  'agent-full-access',
  'yolo',
]);

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

export function isDangerousMode(value: string): boolean {
  return UNRESTRICTED_MODES.has(value);
}

export function dangerousModeOptions(options: readonly ConfigOption[]): ConfigOption[] {
  return options.filter((option) => isDangerousMode(option.currentValue));
}

/** Explicit settings win; Codex's upstream Auto review default is never our implicit default. */
export function initialSessionConfig(
  agentId: string,
  config: Record<string, string> = {},
): Record<string, string> {
  return agentId === 'codex-acp' ? { mode: 'read-only', ...config } : { ...config };
}
