// Domain prompt blocks → ACP content blocks (plan §4.8).

import type { ContentBlock } from '@agentclientprotocol/sdk';
import { pathToFileURL } from 'node:url';
import type { PromptBlock } from '../../core/types';

export interface PromptCapabilities {
  embeddedContext: boolean;
  images: boolean;
}

export function toContentBlocks(blocks: PromptBlock[], caps: PromptCapabilities): ContentBlock[] {
  return blocks.flatMap((block): ContentBlock[] => {
    switch (block.type) {
      case 'text':
        return [{ type: 'text', text: block.text }];
      case 'file': {
        const uri = pathToFileURL(block.absPath).href;
        if (caps.embeddedContext && block.text !== undefined) {
          return [
            { type: 'resource', resource: { uri, mimeType: 'text/markdown', text: block.text } },
          ];
        }
        return [{ type: 'resource_link', uri, name: block.path }];
      }
      case 'selection': {
        const label = `${block.path} (lines ${block.fromLine}–${block.toLine})`;
        return [{ type: 'text', text: `Selection from ${label}:\n\`\`\`\n${block.text}\n\`\`\`` }];
      }
      case 'image':
        return caps.images ? [{ type: 'image', mimeType: block.mimeType, data: block.data }] : [];
    }
  });
}
