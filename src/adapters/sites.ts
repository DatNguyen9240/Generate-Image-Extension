import { BaseAdapter } from './base-adapter';
import type { Website } from '@/types/domain';
class SiteAdapter extends BaseAdapter {
  constructor(
    public readonly website: Website,
    public hosts: string[],
    public editorSelectors: string[],
    public resultSelectors: string[],
  ) {
    super();
  }
}
export const adapters = {
  grok: new SiteAdapter(
    'grok',
    ['grok.com'],
    ['textarea', '[contenteditable="true"]'],
    [
      'div[id^="response-"]',
      '[data-testid="grok-response"]',
      '[data-testid*="grok-response" i]',
      'div[data-testid="message"]',
      '[data-role="assistant"]',
      'img[alt*="generated" i]',
      'img[src*="generated" i]',
      'img[src*="imgen" i]',
      'video[src]',
      '[data-testid*="result" i] img',
      '[data-testid*="post" i] img',
      '[data-testid="grokImage"]',
      '[data-testid*="grok-image" i]',
      'img',
      'video',
      '[data-testid*="message" i]',
      '[data-testid*="response" i]',
    ],
  ),
  chatgpt: new SiteAdapter(
    'chatgpt',
    ['chatgpt.com'],
    ['#prompt-textarea', 'div[contenteditable="true"]'],
    ['article img', '[data-message-author-role="assistant"]'],
  ),
  gemini: new SiteAdapter(
    'gemini',
    ['gemini.google.com'],
    ['rich-textarea div[contenteditable="true"]', 'textarea'],
    ['model-response img', 'model-response .markdown-main-panel'],
  ),
  claude: new SiteAdapter(
    'claude',
    ['claude.ai'],
    ['div[contenteditable="true"]', 'textarea'],
    ['[data-is-streaming="false"]', '.font-claude-response'],
  ),
};
export const AdapterFactory = {
  current() {
    return Object.values(adapters).find((adapter) => adapter.detectPage()) ?? null;
  },
  for(website: Website) {
    return adapters[website];
  },
};
