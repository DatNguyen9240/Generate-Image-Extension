import { AdapterFactory } from '@/adapters/sites';
import {
  activateSubmitControl,
  editorValue,
  findSubmitControl,
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

const downloadAndConvertToBase64 = async (url: string, promptText: string): Promise<string> => {
  try {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url);
    const blob = await response.blob();

    // 1. Trigger browser download
    const filename = `${promptText.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    // 2. Convert to base64 Data URL
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
  }
  return false;
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
            await adapter.insertPrompt(prompt);
            await delay(400);
            const editor = adapter.findEditor();
            if (!editor || editorValue(editor).trim() !== prompt.trim())
              throw new Error('Prompt could not be inserted into the editor');

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
              throw new Error('Prompt was inserted, but Grok did not accept the send action');

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
