import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';
import { resolveMessages } from '../../src/i18n';

describe('resolveMessages', () => {
  it('picks the base language of a regional code', () => {
    expect(resolveMessages('es')).toBe(es);
    expect(resolveMessages('ES-mx')).toBe(es);
  });

  it('falls back to English for unknown languages', () => {
    expect(resolveMessages('ja')).toBe(en);
    expect(resolveMessages('')).toBe(en);
  });

  it('has the same keys in every locale', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });
});
