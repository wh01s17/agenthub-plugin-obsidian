// Prompts sent in this run of Obsidian, recalled with the arrow keys in the composer. Kept in memory
// only: it starts empty every time the plugin loads.

const MAX_ENTRIES = 100;

export class PromptHistory {
  private readonly items: string[] = [];

  /** Oldest first. */
  entries(): readonly string[] {
    return this.items;
  }

  add(text: string): void {
    const prompt = text.trim();
    if (!prompt || this.items[this.items.length - 1] === prompt) return;
    this.items.push(prompt);
    if (this.items.length > MAX_ENTRIES) this.items.shift();
  }
}
