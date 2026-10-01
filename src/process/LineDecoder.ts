// Splits a byte stream into text lines (JSONL), safe across chunk boundaries and UTF-8 sequences.

import { StringDecoder } from 'node:string_decoder';

export interface LineDecoderOptions {
  /** Lines longer than this are truncated (the rest is dropped up to the next newline). */
  maxLineLength?: number;
}

export class LineDecoder {
  private readonly decoder = new StringDecoder('utf8');
  private readonly maxLineLength: number;
  private buffer = '';
  private overflowing = false;

  constructor({ maxLineLength = 10 * 1024 * 1024 }: LineDecoderOptions = {}) {
    this.maxLineLength = maxLineLength;
  }

  /** Feeds a chunk and returns the complete lines it finished (without `\n` or `\r`). */
  push(chunk: Uint8Array | string): string[] {
    const text = typeof chunk === 'string' ? chunk : this.decoder.write(Buffer.from(chunk));
    return this.consume(text);
  }

  /** Returns the last unterminated line, if any. Call when the stream ends. */
  flush(): string[] {
    const lines = this.consume(this.decoder.end());
    const rest = this.buffer;
    this.buffer = '';
    this.overflowing = false;
    return rest.length > 0 ? [...lines, stripCr(rest)] : lines;
  }

  private consume(text: string): string[] {
    const lines: string[] = [];
    let start = 0;
    for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', start)) {
      this.append(text.slice(start, index));
      lines.push(stripCr(this.buffer));
      this.buffer = '';
      this.overflowing = false;
      start = index + 1;
    }
    this.append(text.slice(start));
    return lines;
  }

  private append(text: string): void {
    if (this.overflowing) return;
    this.buffer += text;
    if (this.buffer.length > this.maxLineLength) {
      this.buffer = this.buffer.slice(0, this.maxLineLength);
      this.overflowing = true;
    }
  }
}

const stripCr = (line: string) => (line.endsWith('\r') ? line.slice(0, -1) : line);

/** Keeps the last `capacity` items (e.g. stderr lines for error reports). */
export class RingBuffer<T> {
  private readonly items: T[] = [];

  constructor(private readonly capacity: number) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }

  toArray(): T[] {
    return [...this.items];
  }
}
