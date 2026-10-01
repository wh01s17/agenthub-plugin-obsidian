// Composition layer: turns agent settings into adapters and caches their detection (plan §4.2).
// Lives outside `core/` because it wires concrete adapters (ACP today, direct mode in Fase 5).

import { AcpAdapter } from '../adapters/acp/AcpAdapter';
import type { AgentAdapter, DetectionResult } from '../core/AgentAdapter';
import type { ResolvedCommand } from '../process/BinaryResolver';
import type { ProcessRegistry } from '../process/ProcessRunner';
import type { AgentConfig } from '../settings/settings';

export interface AgentHints {
  /** e.g. "Install it with: npm i -g …" */
  install(command: string): string;
  /** e.g. "Log in by running `codex login` in a terminal." */
  login(command: string): string;
  /** For transports that are not implemented yet. */
  unsupported(transport: string): string;
  /** For agents without a command. */
  noCommand(): string;
}

export interface AgentRegistryDeps {
  resolveCommand: (command: string) => Promise<ResolvedCommand | null>;
  processes: ProcessRegistry;
  hints: AgentHints;
}

export class AgentRegistry {
  private configs: AgentConfig[] = [];
  private adapters = new Map<string, AgentAdapter>();
  private detections = new Map<string, Promise<DetectionResult>>();

  constructor(private readonly deps: AgentRegistryDeps) {}

  /** Replaces the agent list (called on load and whenever settings change). */
  setAgents(configs: readonly AgentConfig[]): void {
    this.configs = configs.map((config) => ({ ...config }));
    this.adapters = new Map(
      this.configs.flatMap((config) => {
        const adapter = this.build(config);
        return adapter ? [[config.id, adapter] as const] : [];
      }),
    );
    this.detections.clear();
  }

  /** Enabled agents, in settings order. */
  enabled(): AgentConfig[] {
    return this.configs.filter((config) => config.enabled);
  }

  config(id: string): AgentConfig | undefined {
    return this.configs.find((config) => config.id === id);
  }

  /** Adapter for an enabled, supported agent. */
  get(id: string): AgentAdapter | undefined {
    return this.config(id)?.enabled ? this.adapters.get(id) : undefined;
  }

  /** Cached until `invalidate()` or `setAgents()`. */
  detect(id: string): Promise<DetectionResult> {
    let detection = this.detections.get(id);
    if (!detection) {
      detection = this.runDetection(id);
      this.detections.set(id, detection);
    }
    return detection;
  }

  invalidate(): void {
    this.detections.clear();
  }

  private runDetection(id: string): Promise<DetectionResult> {
    const config = this.config(id);
    if (!config) return Promise.resolve({ status: 'error', message: `Unknown agent: ${id}` });
    if (config.transport !== 'acp') {
      return Promise.resolve({
        status: 'error',
        message: this.deps.hints.unsupported(config.transport),
      });
    }
    const adapter = this.adapters.get(id);
    if (!adapter)
      return Promise.resolve({ status: 'missing', message: this.deps.hints.noCommand() });
    return adapter.detect();
  }

  private build(config: AgentConfig): AgentAdapter | undefined {
    if (config.transport !== 'acp' || !config.command.trim()) return undefined;
    const { hints } = this.deps;
    return new AcpAdapter(
      {
        id: config.id,
        label: config.label,
        command: config.command.trim(),
        args: config.args,
        env: config.env,
        installHint: config.installCommand ? hints.install(config.installCommand) : undefined,
        loginHint: config.loginCommand ? hints.login(config.loginCommand) : undefined,
      },
      { resolveCommand: this.deps.resolveCommand, registry: this.deps.processes },
    );
  }
}
