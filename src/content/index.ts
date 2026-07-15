import { AdapterFactory } from '@/adapters/sites';
import { activateSubmitControl, editorValue, findSubmitControl, submissionAccepted } from '@/automation/submit';

const adapter = AdapterFactory.current();
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const safeSendMessage = (message: unknown) => {
  try {
    const pending = chrome.runtime.sendMessage(message);
    pending?.catch(() => undefined);
  } catch {
    // An old tab can outlive an extension reload.
  }
};

const pressEnter = (editor: HTMLElement) => {
  const event = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  editor.dispatchEvent(new KeyboardEvent('keydown', event));
  editor.dispatchEvent(new KeyboardEvent('keypress', event));
  editor.dispatchEvent(new KeyboardEvent('keyup', event));
};

const waitForSubmission = async (prompt: string, control?: HTMLElement | null) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(250);
    if (submissionAccepted(adapter?.findEditor() ?? null, prompt, control)) return true;
  }
  return false;
};

if (adapter) {
  void adapter.initialize();
  adapter.observeDOM(() => safeSendMessage({
    type: 'PAGE_STATE',
    payload: { website: adapter.website, capabilities: adapter.detectCapabilities(), ready: Boolean(adapter.findEditor()) },
  }));

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      void (async () => {
        try {
          if (message.type === 'AUTOMATION_STATUS') {
            return sendResponse({ ok: true, data: { website: adapter.website, ready: Boolean(adapter.findEditor()), capabilities: adapter.detectCapabilities() } });
          }
          if (message.type === 'AUTOMATION_INSERT') {
            const prompt = String(message.payload.prompt ?? '');
            await adapter.insertPrompt(prompt);
            await delay(400);
            const editor = adapter.findEditor();
            if (!editor || editorValue(editor).trim() !== prompt.trim()) throw new Error('Prompt could not be inserted into the editor');

            const submit = findSubmitControl(editor);
            if (submit) activateSubmitControl(submit);
            else {
              const form = editor.closest('form');
              if (form instanceof HTMLFormElement) form.requestSubmit();
              else pressEnter(editor);
            }

            let accepted = await waitForSubmission(prompt, submit);
            if (!accepted) {
              const form = editor.closest('form');
              if (form instanceof HTMLFormElement) {
                form.requestSubmit();
                accepted = await waitForSubmission(prompt, submit);
              }
            }
            if (!accepted) throw new Error('Prompt was inserted, but Grok did not accept the send action');

            await adapter.waitForGeneration();
            return sendResponse({ ok: true, data: await adapter.collectResultMetadata() });
          }
          sendResponse({ ok: false, error: `Unsupported content message: ${message.type}` });
        } catch (error) {
          sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return true;
    });
  } catch {
    // Extension was reloaded while this tab was alive.
  }
  addEventListener('pagehide', () => adapter.cleanup(), { once: true });
}
