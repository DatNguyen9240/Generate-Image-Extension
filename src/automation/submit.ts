const primarySelectors = [
  'button[data-testid="grok-send-button"]',
  'button[type="submit"]',
  '[data-testid*="send" i]',
  '[data-testid*="submit" i]',
  '[aria-label*="send" i]',
  'button[aria-label="Ask Grok" i]',
  'button[aria-label="Grok" i]',
  '[aria-label*="submit" i]',
  '[title*="send" i]',
  '[title*="submit" i]',
  '[data-testid*="generate" i]',
  '[aria-label*="generate" i]',
  '[title*="generate" i]',
  '[data-testid*="create" i]',
  '[aria-label*="create" i]',
  '[title*="create" i]',
];

const excludedControl = /(attach|upload|microphone|voice|record|add file|menu)/i;

const controlName = (element: HTMLElement) =>
  [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-testid'),
    element.textContent,
  ]
    .filter(Boolean)
    .join(' ');

export const isUsableControl = (element: HTMLElement) => {
  if (element instanceof HTMLButtonElement && element.disabled) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

export const findSubmitControl = (editor: HTMLElement): HTMLElement | null => {
  const scopes: ParentNode[] = [];
  const form = editor.closest('form');
  if (form) scopes.push(form);
  let ancestor = editor.parentElement;
  for (let depth = 0; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement)
    scopes.push(ancestor);
  scopes.push(document);

  for (const scope of scopes) {
    for (const selector of primarySelectors) {
      const candidate = scope.querySelector<HTMLElement>(selector);
      if (candidate && isUsableControl(candidate)) return candidate;
    }
  }

  let anchor: HTMLElement | null = editor;
  let editorRect = anchor.getBoundingClientRect();
  const localContainer = editor.closest('form') ?? editor.parentElement?.parentElement;
  const localControls = localContainer
    ? [...localContainer.querySelectorAll<HTMLElement>('button, [role="button"]')]
        .filter(isUsableControl)
        .filter((control) => !excludedControl.test(controlName(control)))
    : [];

  // A few canvas-style composers use a zero-sized textarea as a state mirror.
  // In that case geometry-based matching cannot work, so use the right-most
  // visible control in the composer container (the Flow arrow is last).
  if (editorRect.width < 40 || editorRect.height < 20) {
    localControls.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return rightRect.right - leftRect.right || rightRect.bottom - leftRect.bottom;
    });
    if (localControls[0]) return localControls[0];
  }

  while (anchor.parentElement && (editorRect.width < 40 || editorRect.height < 20)) {
    anchor = anchor.parentElement;
    editorRect = anchor.getBoundingClientRect();
  }
  if (editorRect.width < 40 || editorRect.height < 20) return null;

  const nearby = [...document.querySelectorAll<HTMLElement>('button, [role="button"]')]
    .filter(isUsableControl)
    .filter((control) => !excludedControl.test(controlName(control)))
    .filter((control) => {
      const rect = control.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return (
        centerX >= editorRect.left + editorRect.width * 0.55 &&
        centerX <= editorRect.right + 120 &&
        centerY >= editorRect.top - 60 &&
        centerY <= editorRect.bottom + 100
      );
    });

  nearby.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return rightRect.right - leftRect.right || rightRect.bottom - leftRect.bottom;
  });
  return nearby[0] ?? null;
};

export const findFlowSubmitControl = (editor: HTMLElement): HTMLElement | null => {
  let host = editor.parentElement;
  let hostRect = editor.getBoundingClientRect();
  for (let depth = 0; host && depth < 8; depth += 1, host = host.parentElement) {
    const rect = host.getBoundingClientRect();
    if (rect.width >= 300 && rect.height >= 60 && rect.bottom >= window.innerHeight * 0.55) {
      hostRect = rect;
      break;
    }
  }

  const candidates = [...document.querySelectorAll<HTMLElement>('button, [role="button"]')]
    .filter(isUsableControl)
    .filter((control) => !excludedControl.test(controlName(control)))
    .filter((control) => {
      const rect = control.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return (
        centerX >= hostRect.left + hostRect.width * 0.55 &&
        centerX <= hostRect.right + 24 &&
        centerY >= hostRect.top + hostRect.height * 0.45 &&
        centerY <= hostRect.bottom + 24
      );
    });

  candidates.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return rightRect.right - leftRect.right || rightRect.bottom - leftRect.bottom;
  });
  return candidates[0] ?? findSubmitControl(editor);
};

export const activateSubmitControl = (control: HTMLElement) => {
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const mouse = { bubbles: true, cancelable: true, view: window, button: 0 };
  if (typeof PointerEvent !== 'undefined') {
    control.dispatchEvent(
      new PointerEvent('pointerdown', {
        ...mouse,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }),
    );
    control.dispatchEvent(
      new PointerEvent('pointerup', {
        ...mouse,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }),
    );
  }
  control.dispatchEvent(new MouseEvent('mousedown', mouse));
  control.dispatchEvent(new MouseEvent('mouseup', mouse));
  control.click();

  // Some Flow controls are custom elements whose handler is wired to the
  // keyboard activation path rather than HTMLElement.click().
  const keyboard = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };
  control.dispatchEvent(new KeyboardEvent('keydown', keyboard));
  control.dispatchEvent(new KeyboardEvent('keyup', keyboard));
};

export const editorValue = (editor: HTMLElement | null) => {
  if (!editor) return '';
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement)
    return editor.value;
  return editor.innerText || editor.textContent || '';
};

export const normalizeEditorText = (value: string) =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .trim();

export const submissionAccepted = (
  editor: HTMLElement | null,
  prompt: string,
  control?: HTMLElement | null,
) => {
  if (!editor?.isConnected) return true;
  if (control && (!control.isConnected || !isUsableControl(control))) return true;
  return normalizeEditorText(editorValue(editor)) !== normalizeEditorText(prompt);
};
