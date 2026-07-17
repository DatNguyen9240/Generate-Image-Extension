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

  /**
   * Click the "Tạo" / "Generate" / confirm button inside the Flow agent
   * confirmation dialog that appears when the agent is configured to ask for
   * confirmation before every generation ("Xác nhận trước khi tạo: Luôn luôn").
   * Returns true if a button was found and clicked.
   */
  private static dismissAgentConfirmation(): boolean {
    // The dialog has role="dialog" or is a <dialog> element. Look for a
    // prominent action button whose label suggests "confirm / create / generate".
    const confirmPatterns = /tạo|create|generate|confirm|xác nhận|ok|yes|proceed|tiếp tục/i;

    const containers = [
      ...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], dialog'),
    ];

    // Also scan the entire body if no dialog container is found (Flow sometimes
    // renders confirmation inside a bottom sheet that lacks role="dialog").
    if (containers.length === 0) containers.push(document.body);

    for (const container of containers) {
      const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
      for (const btn of buttons) {
        const label = (
          btn.textContent?.trim() +
          ' ' +
          (btn.getAttribute('aria-label') ?? '')
        ).trim();
        if (confirmPatterns.test(label) && btn.isConnected && !btn.disabled) {
          try {
            btn.click();
            return true;
          } catch {
            // ignore
          }
        }
      }
    }
    return false;
  }

  override async waitForGeneration(signal?: AbortSignal) {
    // Poll for and auto-dismiss agent confirmation dialogs while waiting for
    // the generation to complete.  The base implementation uses a
    // MutationObserver; we wrap it with a polling interval that keeps
    // clicking the confirmation button until it disappears.
    const confirmationInterval = window.setInterval(() => {
      GoogleFlowAdapter.dismissAgentConfirmation();
    }, 600);

    try {
      await super.waitForGeneration(signal);
    } finally {
      clearInterval(confirmationInterval);
    }
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
