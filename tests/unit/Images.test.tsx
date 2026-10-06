import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { Notice } from '../__mocks__/obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toContentBlocks } from '../../src/adapters/acp/promptBlocks';
import { ChatSession } from '../../src/core/ChatSession';
import {
  fitWithin,
  imageDataUrl,
  isSupportedImage,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  needsResize,
  type ImageBlock,
} from '../../src/core/images';
import { buildPrompt } from '../../src/core/PromptBuilder';
import { createInitialState } from '../../src/core/reducer';
import type { TranscriptItem } from '../../src/core/types';
import { sessionToMarkdown } from '../../src/storage/exportToNote';
import { transcriptRecordSchema } from '../../src/storage/sessionSchema';
import { Composer } from '../../src/ui/components/Composer';
import { MessageList } from '../../src/ui/components/MessageList';
import { pastedImages, readImage } from '../../src/ui/imageFiles';
import { StubAdapter, hostServices } from '../helpers/stubAgent';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const png = (name = 'shot.png') => new File([PNG_BYTES], name, { type: 'image/png' });
const image: ImageBlock = { type: 'image', mimeType: 'image/png', data: 'iVBORw==' };

/** What the clipboard holds after a screenshot (or after copying cells, with `text`). */
const clipboard = (files: File[], text?: string) => ({
  types: [...(files.length > 0 ? ['Files'] : []), ...(text !== undefined ? ['text/plain'] : [])],
  files,
  getData: () => text ?? '',
});

beforeEach(() => {
  Notice.shown.length = 0;
});

describe('image limits', () => {
  it('accepts the formats every agent takes', () => {
    expect(['image/png', 'image/JPEG', 'image/gif', 'image/webp'].every(isSupportedImage)).toBe(
      true,
    );
    expect(isSupportedImage('image/bmp')).toBe(false);
    expect(isSupportedImage('image/svg+xml')).toBe(false);
  });

  it('resizes only what is too heavy or too long, keeping the aspect ratio', () => {
    expect(needsResize(MAX_IMAGE_BYTES, 1920, 1080)).toBe(false);
    expect(needsResize(MAX_IMAGE_BYTES + 1, 1920, 1080)).toBe(true);
    expect(needsResize(1000, 1400, 12_000)).toBe(true);
    expect(fitWithin(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('only renders data URLs for image formats', () => {
    expect(imageDataUrl(image)).toBe('data:image/png;base64,iVBORw==');
    expect(imageDataUrl({ ...image, mimeType: 'text/html' })).toBeNull();
  });
});

describe('reading files', () => {
  it('reads a small image as base64', async () => {
    expect(await readImage(png())).toEqual({
      ok: true,
      image: {
        type: 'image',
        mimeType: 'image/png',
        data: btoa(String.fromCharCode(...PNG_BYTES)),
      },
    });
  });

  it('rejects files that are not images, and images it cannot redraw', async () => {
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    expect(await readImage(pdf)).toEqual({ ok: false, reason: 'type', name: 'doc.pdf' });
    // Without a decoder (jsdom), an unsupported format cannot be converted.
    const bmp = new File(['BM'], 'a.bmp', { type: 'image/bmp' });
    expect(await readImage(bmp)).toEqual({ ok: false, reason: 'type', name: 'a.bmp' });
  });

  it('takes images from a paste unless it also carries text', () => {
    const data = (files: File[], text?: string) =>
      clipboard(files, text) as unknown as DataTransfer;
    expect(pastedImages(data([png()]))).toHaveLength(1);
    expect(pastedImages(data([png()], 'A1\tB1'))).toEqual([]);
    expect(pastedImages(data([new File(['x'], 'a.txt', { type: 'text/plain' })]))).toEqual([]);
    expect(pastedImages(null)).toEqual([]);
  });
});

describe('prompt', () => {
  it('sends images after the text, and no empty text block for an image-only message', () => {
    expect(buildPrompt({ text: 'What is this?', images: [image] })).toEqual([
      { type: 'text', text: 'What is this?' },
      image,
    ]);
    expect(buildPrompt({ text: '', images: [image] })).toEqual([image]);
    expect(buildPrompt({ text: '' })).toEqual([{ type: 'text', text: '' }]);
  });

  it('maps images to ACP image blocks when the agent takes them', () => {
    const caps = { embeddedContext: true, images: true };
    expect(toContentBlocks([image], caps)).toEqual([
      { type: 'image', mimeType: 'image/png', data: 'iVBORw==' },
    ]);
    expect(toContentBlocks([image], { ...caps, images: false })).toEqual([]);
  });

  it('drops images for an agent that does not take them and says so', async () => {
    const adapter = new StubAdapter(() => 'end_turn');
    adapter.images = false;
    const session = new ChatSession({
      localId: 'l1',
      adapter,
      host: hostServices,
      options: { cwd: '/vault' },
    });
    await session.send([{ type: 'text', text: 'Look' }, image]);
    expect(adapter.sessions[0]?.prompts).toEqual([[{ type: 'text', text: 'Look' }]]);
    const items = session.getState().items;
    // The conversation keeps what the user attached, followed by the warning.
    expect(items[0]).toMatchObject({ kind: 'user', blocks: [{ type: 'text' }, image] });
    expect(items[1]).toMatchObject({ kind: 'notice', notice: { key: 'imagesNotSent' } });

    // An image-only message has nothing left to send.
    await session.send([image]);
    expect(adapter.sessions[0]?.prompts).toHaveLength(1);
    expect(session.busy).toBe(false);
  });

  it('passes images through to agents that take them', async () => {
    const adapter = new StubAdapter(() => 'end_turn');
    const session = new ChatSession({
      localId: 'l1',
      adapter,
      host: hostServices,
      options: { cwd: '/vault' },
    });
    await session.send([image]);
    expect(adapter.sessions[0]?.prompts).toEqual([[image]]);
  });
});

describe('history and export', () => {
  const item: TranscriptItem = {
    kind: 'user',
    id: 'u1',
    blocks: [{ type: 'text', text: 'Look' }, image],
    at: 1,
  };

  it('keeps images in the saved transcript', () => {
    const parsed = transcriptRecordSchema.parse({ v: 1, t: 1, item });
    expect(parsed.item).toEqual(item);
    const notice = { kind: 'notice', id: 'n', level: 'warning', notice: { key: 'imagesNotSent' } };
    expect(transcriptRecordSchema.safeParse({ v: 1, t: 1, item: notice }).success).toBe(true);
  });

  it('lists images in an exported note without embedding them', () => {
    const markdown = sessionToMarkdown(
      createInitialState({
        localId: 'l1',
        agentId: 'claude-acp',
        cwd: '/v',
        title: 'Shot',
        items: [item],
      }),
      {
        agent: 'Claude Code',
        you: 'You',
        thinking: 'Reasoning',
        plan: 'Plan',
        permission: 'Permission requested',
        image: 'Image',
        notice: () => '',
      },
      new Date(0),
    );
    expect(markdown).toContain('Look\n\n- Image (image/png)');
    expect(markdown).not.toContain('iVBORw==');
  });
});

describe('UI', () => {
  function renderComposer(props: { busy?: boolean } = {}) {
    const onSend = vi.fn();
    render(
      <Composer
        agentLabel="Claude Code"
        busy={props.busy ?? false}
        disabled={false}
        sendWith="enter"
        notes={() => []}
        commands={[]}
        onSend={onSend}
        onStop={vi.fn()}
      />,
    );
    const input = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Message to the agent',
    });
    return { input, onSend };
  }

  it('attaches a pasted screenshot and sends it without text', async () => {
    const { input, onSend } = renderComposer();
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toHaveProperty('disabled', true);

    fireEvent.paste(input, { clipboardData: clipboard([png()]) });
    expect(await screen.findByRole('img', { name: 'Image 1' })).toBeTruthy();
    expect(send).toHaveProperty('disabled', false);

    fireEvent.click(send);
    const [text, images] = onSend.mock.calls[0] as [string, ImageBlock[]];
    expect(text).toBe('');
    expect(images).toEqual([(await readImage(png())) as { image: ImageBlock }].map((r) => r.image));
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('leaves text pastes to the text box', () => {
    const { input } = renderComposer();
    const event = fireEvent.paste(input, { clipboardData: clipboard([png()], 'A1') });
    expect(event).toBe(true); // not prevented
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('attaches dropped images, reports other files and removes on demand', async () => {
    renderComposer();
    const box = screen
      .getByRole('textbox', { name: 'Message to the agent' })
      .closest('.agenthub-composer')!;
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.drop(box, { dataTransfer: clipboard([png('a.png'), pdf, png('b.png')]) });
    expect(await screen.findByRole('img', { name: 'Image 2' })).toBeTruthy();
    expect(Notice.shown).toEqual(['Cannot attach "doc.pdf": use a PNG, JPEG, GIF or WebP image.']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }));
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it(`stops at ${MAX_IMAGES_PER_MESSAGE} images per message`, async () => {
    const { input } = renderComposer();
    const many = Array.from({ length: MAX_IMAGES_PER_MESSAGE + 2 }, (_, i) => png(`${i}.png`));
    fireEvent.drop(input, { dataTransfer: clipboard(many) });
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(MAX_IMAGES_PER_MESSAGE));
    expect(Notice.shown).toEqual([
      `You can attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.`,
    ]);
  });

  it('shows sent images in the conversation and enlarges them on click', () => {
    render(
      <MessageList
        app={{} as never}
        items={[{ kind: 'user', id: 'u1', blocks: [image], at: 1 }]}
        showThoughts={false}
        onPermission={vi.fn()}
        onOpenPath={() => false}
      />,
    );
    const shown = screen.getByRole<HTMLImageElement>('img', { name: 'Image 1' });
    expect(shown.src).toBe('data:image/png;base64,iVBORw==');
    const toggle = screen.getByRole('button', { name: 'Image 1' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});
