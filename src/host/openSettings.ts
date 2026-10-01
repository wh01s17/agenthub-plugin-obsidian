import type { App } from 'obsidian';

/**
 * Opens this plugin's settings tab. Obsidian has no public API for it, so this uses the widely used
 * private `app.setting` object, checked at runtime. Returns `false` if it is not available.
 */
export function openPluginSettings(app: App, pluginId: string): boolean {
  const setting: unknown = Reflect.get(app, 'setting');
  if (typeof setting !== 'object' || setting === null) return false;
  const open: unknown = Reflect.get(setting, 'open');
  const openTab: unknown = Reflect.get(setting, 'openTabById');
  if (typeof open !== 'function' || typeof openTab !== 'function') return false;
  Reflect.apply(open, setting, []);
  Reflect.apply(openTab, setting, [pluginId]);
  return true;
}
