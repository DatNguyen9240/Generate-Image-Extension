import { BaseAdapter } from './base-adapter';
import type { Website } from '@/types/domain';
class SiteAdapter extends BaseAdapter {
  constructor(
    public readonly website: Website,
    public hosts: string[],
    public editorSelectors: string[],
    public resultSelectors: string[],
    generationTimeoutMs?: number,
  ) {
    super();
    if (generationTimeoutMs !== undefined) this.generationTimeoutMs = generationTimeoutMs;
  }
}

class GoogleFlowAdapter extends SiteAdapter {
  protected override acceptsEditor(editor: HTMLElement) {
    const name = [
      editor.getAttribute('placeholder'),
      editor.getAttribute('data-placeholder'),
      editor.getAttribute('aria-label'),
    ]
      .filter(Boolean)
      .join(' ');
    if (/search|tìm kiếm/i.test(name)) return false;
    if (super.acceptsEditor(editor)) return true;
    if (editor.getAttribute('aria-hidden') === 'true') return false;
    if (
      (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) &&
      (editor.disabled || editor.readOnly)
    )
      return false;

    // Flow can render a zero-sized editing surface inside its visible composer.
    let host = editor.parentElement;
    for (let depth = 0; host && depth < 6; depth += 1, host = host.parentElement) {
      const rect = host.getBoundingClientRect();
      const style = window.getComputedStyle(host);
      if (
        rect.width >= 200 &&
        rect.height >= 40 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      )
        return true;
    }
    return false;
  }
}

export const adapters = {
  grok: new SiteAdapter(
    'grok',
    ['grok.com'],
    [
      'textarea[data-testid="grok-input"]',
      'textarea[placeholder*="Grok" i]',
      'textarea[aria-label*="Grok" i]',
      'textarea',
      '[contenteditable="true"]',
    ],
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
  'google-flow': new GoogleFlowAdapter(
    'google-flow',
    ['labs.google'],
    [
      'textarea[placeholder*="Bạn muốn" i]',
      'textarea[placeholder*="tạo" i]',
      'textarea[aria-label*="Bạn muốn" i]',
      'textarea[aria-label*="tạo" i]',
      '[contenteditable="true"][data-placeholder*="Bạn muốn" i]',
      '[contenteditable="true"][data-placeholder*="tạo" i]',
      '[contenteditable="true"][aria-label*="Bạn muốn" i]',
      '[contenteditable="true"][aria-label*="tạo" i]',
      '[role="textbox"][aria-label*="Bạn muốn" i]',
      '[role="textbox"][aria-label*="tạo" i]',
      // Flow's composer is localized, so keep the generic fallbacks after the
      // placeholder-specific selectors.
      'textarea[placeholder*="create" i]',
      '[contenteditable="true"][data-placeholder*="create" i]',
      '[contenteditable="true"][aria-label*="create" i]',
      '[role="textbox"][aria-label*="create" i]',
      '[contenteditable="true"].ProseMirror',
      '[contenteditable="true"][data-slate-editor="true"]',
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
    ],
    [
      '[data-testid*="generated" i]',
      '[data-testid*="asset" i]',
      '[data-testid*="result" i]',
      '[aria-label*="generated" i]',
      '[aria-label*="asset" i]',
      'img[alt*="generated" i]',
      'img[alt*="asset" i]',
      'img[alt*="scene" i]',
      'img[alt*="clip" i]',
      'img[alt*="image" i]',
      'img[src^="blob:"]',
      'img[src*="googleusercontent" i]',
      'img[src*="storage.googleapis.com" i]',
      'video',
    ],
    600_000,
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
