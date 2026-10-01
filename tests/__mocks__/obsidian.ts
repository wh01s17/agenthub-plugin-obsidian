// Minimal stand-in for the `obsidian` module so code can be tested outside the app.
// Extend it only as far as the code under test needs.

// Obsidian augments HTMLElement with helpers; replicate the ones the code uses.
declare global {
  interface HTMLElement {
    addClass(...classes: string[]): void;
    empty(): void;
  }
}
HTMLElement.prototype.addClass = function (this: HTMLElement, ...classes: string[]) {
  this.classList.add(...classes);
};
HTMLElement.prototype.empty = function (this: HTMLElement) {
  this.replaceChildren();
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

// Like real Obsidian 1.13, `Setting` and every `BaseComponent` have a fluent `then()`, which makes
// them thenables: returning one from a promise callback makes the promise adopt it in an endless
// microtask loop. The counter turns that loop into a test failure instead of a hung runner.
let thenCalls = 0;
export function __thenCalls(): number {
  return thenCalls;
}
export function __resetThenCalls(): void {
  thenCalls = 0;
}

class FluentThenable {
  then(cb: (self: this) => unknown): this {
    if (++thenCalls > 1000)
      throw new Error('A Setting/component was adopted as a promise (thenable loop)');
    cb(this);
    return this;
  }
}

export class BaseComponent extends FluentThenable {
  disabled = false;
  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    return this;
  }
}

class ValueComponent<T> extends BaseComponent {
  value: T | undefined;
  changeHandler: ((value: T) => unknown) | undefined;
  setValue(value: T): this {
    this.value = value;
    return this;
  }
  onChange(handler: (value: T) => unknown): this {
    this.changeHandler = handler;
    return this;
  }
}

export class ToggleComponent extends ValueComponent<boolean> {}
export class TextComponent extends ValueComponent<string> {
  inputEl = document.createElement('input');
}
export class TextAreaComponent extends ValueComponent<string> {
  inputEl = document.createElement('textarea');
}
export class DropdownComponent extends ValueComponent<string> {
  options: Record<string, string> = {};
  addOption(value: string, display: string): this {
    this.options[value] = display;
    return this;
  }
}
export class ButtonComponent extends BaseComponent {
  clickHandler: (() => unknown) | undefined;
  setButtonText(_text: string): this {
    return this;
  }
  onClick(handler: () => unknown): this {
    this.clickHandler = handler;
    return this;
  }
}
export class ExtraButtonComponent extends ButtonComponent {
  setIcon(_icon: string): this {
    return this;
  }
  setTooltip(_tooltip: string): this {
    return this;
  }
}

export class Setting extends FluentThenable {
  settingEl = document.createElement('div');
  nameEl = document.createElement('div');
  descEl = document.createElement('div');
  constructor(public containerEl: HTMLElement) {
    super();
    this.settingEl.append(this.nameEl, this.descEl);
    containerEl.append(this.settingEl);
  }
  setName(name: string): this {
    this.nameEl.textContent = name;
    return this;
  }
  setDesc(desc: string): this {
    this.descEl.textContent = desc;
    return this;
  }
  setHeading(): this {
    return this;
  }
  addToggle(cb: (component: ToggleComponent) => unknown): this {
    cb(new ToggleComponent());
    return this;
  }
  addDropdown(cb: (component: DropdownComponent) => unknown): this {
    cb(new DropdownComponent());
    return this;
  }
  addButton(cb: (component: ButtonComponent) => unknown): this {
    cb(new ButtonComponent());
    return this;
  }
  addExtraButton(cb: (component: ExtraButtonComponent) => unknown): this {
    cb(new ExtraButtonComponent());
    return this;
  }
  addText(cb: (component: TextComponent) => unknown): this {
    cb(new TextComponent());
    return this;
  }
  addTextArea(cb: (component: TextAreaComponent) => unknown): this {
    cb(new TextAreaComponent());
    return this;
  }
}

export function setIcon(parent: HTMLElement, iconId: string): void {
  parent.dataset.icon = iconId;
}

/** Renders Markdown as plain text, enough to assert on content. */
export const MarkdownRenderer = {
  render(_app: unknown, markdown: string, el: HTMLElement): Promise<void> {
    el.textContent = markdown;
    return Promise.resolve();
  },
};

export class MarkdownView {}
export class FileSystemAdapter {}
export const normalizePath = (path: string): string => path;
