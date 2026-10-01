// Minimal stand-in for the `obsidian` module so code can be tested outside the app.
// Extend it only as far as the code under test needs.

// Obsidian augments HTMLElement with helpers; replicate the ones the code uses.
declare global {
  interface HTMLElement {
    addClass(...classes: string[]): void;
  }
}
HTMLElement.prototype.addClass = function (this: HTMLElement, ...classes: string[]) {
  this.classList.add(...classes);
};

let language = 'en';

export function __setLanguage(value: string): void {
  language = value;
}

export function getLanguage(): string {
  return language;
}

export interface ViewStateResult {
  history: boolean;
}

export class WorkspaceLeaf {}

export class Component {
  load(): void {}
  unload(): void {}
}

export class ItemView extends Component {
  contentEl: HTMLElement = document.createElement('div');
  constructor(public leaf: WorkspaceLeaf) {
    super();
  }
  getState(): Record<string, unknown> {
    return {};
  }
  async setState(_state: unknown, _result: ViewStateResult): Promise<void> {}
}

export class Plugin extends Component {}

export class Notice {
  constructor(public message: string) {}
}

export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement('div');
  constructor(
    public app: unknown,
    public plugin: unknown,
  ) {}
  display(): void {}
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}
}
