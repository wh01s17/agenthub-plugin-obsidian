// Pasted, dropped or picked files → image prompt blocks (ADR-035). Images within the limits travel
// as they are; larger ones, or formats the agents do not take (BMP…), are redrawn on a canvas.

import {
  fitWithin,
  isSupportedImage,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  needsResize,
  RESIZED_EDGE,
  type ImageBlock,
} from '../core/images';

export type ImageResult =
  { ok: true; image: ImageBlock } | { ok: false; reason: 'type' | 'size' | 'read'; name: string };

/**
 * Images in a paste. A paste that also carries text is left to the text box: spreadsheets and
 * some editors copy a picture of the text along with it.
 */
export function pastedImages(data: DataTransfer | null): File[] {
  if (!data || data.types.includes('text/plain')) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith('image/'));
}

/** Whether a drag carries files from outside Obsidian (as opposed to text or a vault link). */
export function draggingFiles(data: DataTransfer | null): boolean {
  return data?.types.includes('Files') ?? false;
}

export async function readImage(file: File): Promise<ImageResult> {
  const name = file.name || file.type;
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'type', name };
  try {
    return await convert(file, name);
  } catch {
    return { ok: false, reason: 'read', name };
  }
}

async function convert(file: File, name: string): Promise<ImageResult> {
  const supported = isSupportedImage(file.type);
  const bitmap = await decode(file);
  try {
    const tooBig = bitmap
      ? needsResize(file.size, bitmap.width, bitmap.height)
      : file.size > MAX_IMAGE_BYTES;
    if (supported && !tooBig) {
      return { ok: true, image: { type: 'image', mimeType: file.type, data: await base64(file) } };
    }
    if (!bitmap) return { ok: false, reason: supported ? 'size' : 'type', name };
    const redrawn = await redraw(
      bitmap,
      file.size > MAX_IMAGE_BYTES ? RESIZED_EDGE : MAX_IMAGE_EDGE,
    );
    if (!redrawn) return { ok: false, reason: 'size', name };
    return {
      ok: true,
      image: { type: 'image', mimeType: redrawn.type, data: await base64(redrawn) },
    };
  } finally {
    bitmap?.close();
  }
}

async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/** PNG if it fits, otherwise JPEG on white (JPEG has no transparency); `null` if neither fits. */
async function redraw(bitmap: ImageBitmap, maxEdge: number): Promise<Blob | null> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = createEl('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  const png = await toBlob(canvas, 'image/png');
  if (png && png.size <= MAX_IMAGE_BYTES) return png;
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
  return jpeg && jpeg.size <= MAX_IMAGE_BYTES ? jpeg : null;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}
