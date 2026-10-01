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

export function t(key: MessageKey): string {
  current ??= resolveMessages(getLanguage());
  return current[key];
}
