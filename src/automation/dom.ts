export class DOMCache {
  private cache = new Map<string, Element>();
  get<T extends Element>(
    selectors: string[],
    accept: (element: T) => boolean = () => true,
  ): T | null {
    for (const selector of selectors) {
      const cached = this.cache.get(selector);
      if (cached?.isConnected && accept(cached as T)) return cached as T;
      const found = [...document.querySelectorAll<T>(selector)].find(accept);
      if (found) {
        this.cache.set(selector, found);
        return found;
      }
    }
    return null;
  }
  clear() {
    this.cache.clear();
  }
}
export const retry = async <T>(
  operation: () => T | Promise<T>,
  validate: (value: T) => boolean,
  attempts = 20,
  interval = 500,
): Promise<T> => {
  let last: T | undefined;
  for (let i = 0; i < attempts; i += 1) {
    last = await operation();
    if (validate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, interval * Math.min(i + 1, 4)));
  }
  throw new Error(`Timed out locating required element: ${String(last)}`);
};
export const setNativeValue = (element: HTMLElement, value: string) => {
  element.focus();
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value',
    )?.set;
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    let success = false;
    try {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      success = document.execCommand('insertText', false, value);
    } catch (err) {
      console.warn('execCommand selection/insert failed:', err);
    }
    if (!success) {
      element.textContent = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
};
