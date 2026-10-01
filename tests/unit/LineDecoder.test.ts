import { describe, expect, it } from 'vitest';
import { LineDecoder, RingBuffer } from '../../src/process/LineDecoder';

describe('LineDecoder', () => {
  it('joins lines split across chunks and strips CRLF', () => {
    const decoder = new LineDecoder();
    expect(decoder.push('{"a":')).toEqual([]);
    expect(decoder.push('1}\r\n{"b"')).toEqual(['{"a":1}']);
    expect(decoder.push(':2}\n\n')).toEqual(['{"b":2}', '']);
  });

  it('does not break multibyte UTF-8 characters split between chunks', () => {
    const bytes = Buffer.from('añadió ✓\n', 'utf8');
    const decoder = new LineDecoder();
    const lines = [...bytes].flatMap((byte) => decoder.push(Uint8Array.of(byte)));
    expect(lines).toEqual(['añadió ✓']);
  });

  it('returns the unterminated tail on flush', () => {
    const decoder = new LineDecoder();
    decoder.push('partial');
    expect(decoder.flush()).toEqual(['partial']);
    expect(decoder.flush()).toEqual([]);
  });

  it('truncates overlong lines and recovers on the next newline', () => {
    const decoder = new LineDecoder({ maxLineLength: 5 });
    expect(decoder.push('0123')).toEqual([]);
    expect(decoder.push('456789\nok\n')).toEqual(['01234', 'ok']);
  });
});

describe('RingBuffer', () => {
  it('keeps only the most recent items', () => {
    const ring = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => ring.push(n));
    expect(ring.toArray()).toEqual([3, 4, 5]);
  });
});
