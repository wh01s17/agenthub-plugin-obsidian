// Images pasted or dropped into the message box (ADR-035). Pure limits and checks; reading files
// and resizing happen in the UI (`src/ui/imageFiles.ts`).

import type { PromptBlock } from './types';

export type ImageBlock = Extract<PromptBlock, { type: 'image' }>;

/** Formats every bundled agent accepts (Claude, Codex, Gemini, OpenCode). */
export const IMAGE_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

/** Largest file sent as is: its base64 stays under the 5 MB per image the model APIs accept. */
export const MAX_IMAGE_BYTES = 3.75 * 1024 * 1024;

/** Longest side of an image that had to be shrunk to fit `MAX_IMAGE_BYTES`. */
export const RESIZED_EDGE = 2048;

/** Longest side the model APIs accept; larger images are shrunk even if the file is small. */
export const MAX_IMAGE_EDGE = 8000;

/** Images per message: keeps prompts and the saved history at a sensible size. */
export const MAX_IMAGES_PER_MESSAGE = 10;

export function isSupportedImage(mimeType: string): boolean {
  return IMAGE_TYPES.includes(mimeType.toLowerCase());
}

/** Whether an image of this size and dimensions must be shrunk before sending. */
export function needsResize(bytes: number, width: number, height: number): boolean {
  return bytes > MAX_IMAGE_BYTES || Math.max(width, height) > MAX_IMAGE_EDGE;
}

/** Scales `width × height` down (never up) so the longest side is at most `maxEdge`. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** `data:` URL to show an image block; `null` for formats we never render. */
export function imageDataUrl(block: ImageBlock): string | null {
  return isSupportedImage(block.mimeType) ? `data:${block.mimeType};base64,${block.data}` : null;
}
