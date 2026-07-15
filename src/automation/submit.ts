const primarySelectors = [
  'button[type="submit"]',
  '[data-testid*="send" i]',
  '[data-testid*="submit" i]',
  '[aria-label*="send" i]',
  '[aria-label*="submit" i]',
  '[title*="send" i]',
  '[title*="submit" i]',
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

export const activateSubmitControl = (control: HTMLElement) => {
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
};

export const editorValue = (editor: HTMLElement | null) => {
  if (!editor) return '';
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement)
    return editor.value;
  return editor.innerText || editor.textContent || '';
};

export const submissionAccepted = (
  editor: HTMLElement | null,
  prompt: string,
  control?: HTMLElement | null,
) => {
  if (!editor?.isConnected) return true;
  if (control && (!control.isConnected || !isUsableControl(control))) return true;
  return editorValue(editor).trim() !== prompt.trim();
};
