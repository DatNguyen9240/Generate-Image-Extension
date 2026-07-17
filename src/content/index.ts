import { AdapterFactory } from '@/adapters/sites';
import {
  activateSubmitControl,
  editorValue,
  findFlowSubmitControl,
  findSubmitControl,
  normalizeEditorText,
  submissionAccepted,
} from '@/automation/submit';

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
  const event = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };
  editor.dispatchEvent(new KeyboardEvent('keydown', event));
  editor.dispatchEvent(new KeyboardEvent('keypress', event));
  editor.dispatchEvent(new KeyboardEvent('keyup', event));
};

const downloadAndConvertToBase64 = async (url: string, _promptText: string): Promise<string> => {
  try {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url);
    const blob = await response.blob();

    // Convert to base64 Data URL
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to download and convert image:', error);
    return url;
  }
};

const waitForSubmission = async (prompt: string, control?: HTMLElement | null) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(250);
    if (submissionAccepted(adapter?.findEditor() ?? null, prompt, control)) return true;
    // Grok swaps the send button for a stop/cancel control while a request is
    // being accepted. The editor can briefly retain its value during that
    // transition, so treat the in-flight control as acknowledgement too.
    if (
      document.querySelector(
        '[data-testid*="stop" i], [data-testid*="cancel" i], button[aria-label*="stop" i], button[aria-label*="cancel" i], [aria-busy="true"]',
      )
    )
      return true;
  }
  return false;
};

const waitForSubmitControl = async (editor: HTMLElement) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const control =
      adapter?.website === 'google-flow'
        ? findFlowSubmitControl(editor)
        : findSubmitControl(editor);
    if (control) return control;
    await delay(250);
  }
  return null;
};

const flowComposerContains = (prompt: string) => {
  const expected = normalizeEditorText(prompt);
  return [
    ...document.querySelectorAll<HTMLElement>(
      'textarea, [contenteditable="true"], [role="textbox"]',
    ),
  ].some((candidate) => normalizeEditorText(editorValue(candidate)) === expected);
};

const insertAndFindEditor = async (prompt: string) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt === 0 || attempt === 3 || attempt === 6) await adapter?.insertPrompt(prompt);
    await delay(300);
    const editor = adapter?.findEditor() ?? null;
    const editorMatches =
      editor && normalizeEditorText(editorValue(editor)) === normalizeEditorText(prompt);
    const flowMirrorMatches = adapter?.website === 'google-flow' && flowComposerContains(prompt);
    if (editor && (editorMatches || flowMirrorMatches))
      return editor;
  }
  return null;
};

if (adapter) {
  void adapter.initialize();
  adapter.observeDOM(() =>
    safeSendMessage({
      type: 'PAGE_STATE',
      payload: {
        website: adapter.website,
        capabilities: adapter.detectCapabilities(),
        ready: Boolean(adapter.findEditor()),
      },
    }),
  );

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      void (async () => {
        try {
          if (message.type === 'AUTOMATION_STATUS') {
            return sendResponse({
              ok: true,
              data: {
                website: adapter.website,
                ready: Boolean(adapter.findEditor()),
                capabilities: adapter.detectCapabilities(),
              },
            });
          }
          if (message.type === 'AUTOMATION_INSERT') {
            const prompt = String(message.payload.prompt ?? '');
            const editor = await insertAndFindEditor(prompt);
            if (!editor) throw new Error('Prompt could not be inserted into the visible editor');

            const submit = await waitForSubmitControl(editor);
            if (submit) activateSubmitControl(submit);
            else {
              const form = editor.closest('form');
              if (form instanceof HTMLFormElement) form.requestSubmit();
              else pressEnter(editor);
            }

            // Flow keeps the prompt text in its composer while the generation
            // request is being queued, so an unchanged editor is not a send
            // failure there. Its result observer below is the source of truth.
            // Flow may keep both the prompt and an enabled Generate button
            // while it queues the request. Once the correct control has been
            // activated, result observation is the authoritative confirmation.
            let accepted =
              adapter.website === 'google-flow'
                ? Boolean(submit)
                : submit
                  ? await waitForSubmission(prompt, submit)
                  : false;
            if (!accepted) {
              const form = editor.closest('form');
              if (form instanceof HTMLFormElement) {
                form.requestSubmit();
                accepted = await waitForSubmission(prompt, submit);
              }
            }
            if (!accepted) {
              pressEnter(editor);
              accepted = await waitForSubmission(prompt, submit);
            }
            if (!accepted && submit) {
              submit.removeAttribute('disabled');
              submit.setAttribute('aria-disabled', 'false');
              activateSubmitControl(submit);
              accepted = await waitForSubmission(prompt, submit);
            }
            if (!accepted)
              throw new Error(
                `Prompt was inserted, but ${adapter.website} did not accept the send action`,
              );

            return sendResponse({ ok: true, data: { submitted: true } });
          }
          if (message.type === 'AUTOMATION_WAIT_RESULT') {
            const prompt = String(message.payload.prompt ?? '');

            await adapter.waitForGeneration();
            const metadata = await adapter.collectResultMetadata();

            // Download images and convert to base64 for persistent storage in app
            if (metadata.urls && metadata.urls.length > 0) {
              const processedUrls = await Promise.all(
                metadata.urls.map((url) => downloadAndConvertToBase64(url, prompt)),
              );
              metadata.urls = processedUrls;
            }

            return sendResponse({ ok: true, data: metadata });
          }
          sendResponse({ ok: false, error: `Unsupported content message: ${message.type}` });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    });
  } catch {
    // Extension was reloaded while this tab was alive.
  }
  addEventListener('pagehide', () => adapter.cleanup(), { once: true });
}
