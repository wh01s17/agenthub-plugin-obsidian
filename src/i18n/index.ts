import { getLanguage } from 'obsidian';
import { en, type Messages } from './en';
import { es } from './es';

export type MessageKey = keyof Messages;

const locales: Record<string, Messages> = { en, es };

/** Resolves the dictionary for an Obsidian language code such as `es` or `pt-BR`. */
export function resolveMessages(language: string): Messages {
  const base = language.toLowerCase().split('-')[0] ?? 'en';
  return locales[base] ?? en;
}

let current: Messages | null = null;

/** Localized text; `{name}` placeholders are filled from `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  current ??= resolveMessages(getLanguage());
  return format(current[key], vars);
}

export function format(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
