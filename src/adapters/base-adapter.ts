import type {
  AutomationCapabilities,
  BrowserAutomationAdapter,
  ResultMetadata,
} from './browser-automation-adapter';
import type { Website } from '@/types/domain';
import { DOMCache, retry, setNativeValue } from '@/automation/dom';
const isValidContentImage = (img: HTMLImageElement) => {
  if (!img.complete) return true;
  if (img.naturalWidth > 0 && img.naturalWidth <= 120) return false;
  if (img.naturalHeight > 0 && img.naturalHeight <= 120) return false;
  const src = img.src || img.currentSrc || '';
  if (/avatar|icon|logo|spinner|loading/i.test(src)) return false;
  return true;
};

export abstract class BaseAdapter implements BrowserAutomationAdapter {
  protected cache = new DOMCache();
  protected started = 0;
  protected generationTimeoutMs = 120_000;
  private previousResultSignature = '';
  private previousUrls = new Set<string>();
  private disposers: (() => void)[] = [];
  abstract readonly website: Website;
  abstract hosts: string[];
  abstract editorSelectors: string[];
  abstract resultSelectors: string[];

  async initialize() {
    if (!this.detectPage()) throw new Error(`This page is not supported by ${this.website}`);
    this.started = Date.now();
  }

  detectPage() {
    return this.hosts.includes(location.hostname);
  }
  detectCapabilities(): AutomationCapabilities {
    return {
      text: true,
      image: true,
      video: this.website === 'grok' || this.website === 'gemini',
      fileUpload: true,
    };
  }
  dismissPopups() {
    const dialogSelectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      'dialog',
      '.modal',
      '.dialog',
      '.popup',
      '#modal',
      '#dialog',
    ];
    const closeSelectors = [
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      '[data-testid*="close" i]',
      '[data-testid*="dismiss" i]',
      'button.absolute.top-4.right-4',
      'button.absolute.top-5.right-5',
    ];

    for (const dialog of dialogSelectors) {
      const dialogEl = document.querySelector(dialog);
      if (dialogEl) {
        for (const close of closeSelectors) {
          const btn = dialogEl.querySelector<HTMLElement>(close);
          if (btn && btn.isConnected) {
            try {
              btn.click();
              return;
            } catch (e) {
              console.warn('Failed to click modal close button:', e);
            }
          }
        }
      }
    }

    const absoluteCloseSelectors = [
      '.absolute.top-4.right-4 button',
      '.absolute.top-5.right-5 button',
      'button.absolute.top-4.right-4',
      'button.absolute.top-5.right-5',
    ];
    for (const selector of absoluteCloseSelectors) {
      const btn = document.querySelector<HTMLElement>(selector);
      if (btn && btn.isConnected) {
        try {
          btn.click();
          return;
        } catch (e) {
          console.warn('Failed to click absolute close button:', e);
        }
      }
    }
  }

  protected acceptsEditor(editor: HTMLElement) {
    if (editor.getAttribute('aria-hidden') === 'true') return false;
    if (
      (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) &&
      (editor.disabled || editor.readOnly)
    )
      return false;
    const rect = editor.getBoundingClientRect();
    const style = window.getComputedStyle(editor);
    return (
      rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    );
  }

  findEditor() {
    return this.cache.get<HTMLElement>(this.editorSelectors, (editor) =>
      this.acceptsEditor(editor),
    );
  }

  private resultSignature() {
    return this.resultSelectors
      .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
      .flatMap((node) => [
        node,
        ...node.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video'),
      ])
      .map((node) => {
        if (node instanceof HTMLImageElement && !isValidContentImage(node)) return '';
        const media =
          node instanceof HTMLImageElement || node instanceof HTMLVideoElement
            ? node.currentSrc || node.src
            : '';
        return `${media}|${node.textContent?.length ?? 0}`;
      })
      .join('||');
  }

  private resultUrls() {
    return this.resultSelectors
      .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
      .flatMap((node) => [
        node,
        ...node.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video'),
      ])
      .map((node) => {
        if (node instanceof HTMLImageElement && !isValidContentImage(node)) return '';
        return node instanceof HTMLImageElement || node instanceof HTMLVideoElement
          ? node.currentSrc || node.src
          : '';
      })
      .filter(Boolean);
  }

  async insertPrompt(prompt: string) {
    this.started = Date.now();
    this.previousResultSignature = this.resultSignature();
    this.previousUrls = new Set(this.resultUrls());
    this.dismissPopups();
    const editor = await retry(() => this.findEditor(), Boolean);
    setNativeValue(editor!, prompt);
  }

  async waitForGeneration(signal?: AbortSignal) {
    if (this.detectCompletion() && this.resultSignature() !== this.previousResultSignature) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timed out waiting for a new result'));
      }, this.generationTimeoutMs);
      const observer = new MutationObserver(() => {
        if (this.detectCompletion() && this.resultSignature() !== this.previousResultSignature) {
          clearTimeout(timeout);
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout);
          observer.disconnect();
          reject(new DOMException('Cancelled', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  detectCompletion() {
    return this.resultSelectors.some((selector) => document.querySelector(selector));
  }

  async collectResultMetadata(): Promise<ResultMetadata> {
    const nodes = this.resultSelectors.flatMap((selector) => [
      ...document.querySelectorAll<HTMLElement>(selector),
    ]);
    const mediaNodes = nodes.flatMap((node) => [
      node,
      ...node.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video'),
    ]);
    const allUrls = mediaNodes
      .map((node) => {
        if (node instanceof HTMLImageElement) {
          if (!isValidContentImage(node)) return '';
          return node.currentSrc || node.src;
        }
        if (node instanceof HTMLVideoElement) return node.currentSrc || node.src;
        return '';
      })
      .filter(Boolean);
    const urls = [...new Set(allUrls.filter((url) => !this.previousUrls.has(url)))];
    return {
      urls,
      text: nodes
        .map((node) => node.innerText)
        .filter(Boolean)
        .join('\n'),
      mimeTypes: urls.map((url) => (url.match(/\.mp4/i) ? 'video/mp4' : 'image/*')),
      durationMs: Date.now() - this.started,
    };
  }

  observeDOM(onChange: () => void) {
    const mutation = new MutationObserver(onChange);
    mutation.observe(document.body, { subtree: true, childList: true, attributes: true });
    const resize = new ResizeObserver(onChange);
    resize.observe(document.body);
    const intersection = new IntersectionObserver(onChange);
    const editor = this.findEditor();
    if (editor) intersection.observe(editor);
    const handler = () => onChange();
    document.addEventListener('input', handler, true);
    const dispose = () => {
      mutation.disconnect();
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener('input', handler, true);
    };
    this.disposers.push(dispose);
    return dispose;
  }

  cleanup() {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.cache.clear();
  }
}
