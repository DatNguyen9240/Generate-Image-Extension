import { queueEngine } from '@/queue/queue-engine';
import type { StudioRequest, StudioResponse } from '@/types/messages';
import type { Website } from '@/types/domain';

const siteUrl: Record<Website, string> = {
  grok: 'https://grok.com/',
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/',
  claude: 'https://claude.ai/',
};

const waitForTab = (tabId: number, timeoutMs = 20_000) => new Promise<void>((resolve) => {
  if (!chrome.tabs.onUpdated) return resolve();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    chrome.tabs.onUpdated.removeListener(listener);
    resolve();
  };
  const timeout = setTimeout(finish, timeoutMs);
  const listener = (updatedId: number, change: { status?: string }) => {
    if (updatedId === tabId && change.status === 'complete') finish();
  };
  chrome.tabs.onUpdated.addListener(listener);
});

const getOrOpenSiteTab = async (website: Website) => {
  const [existing] = await chrome.tabs.query({ url: `${siteUrl[website]}*` });
  const tab = existing ?? await chrome.tabs.create({ url: siteUrl[website], active: true });
  if (!tab.id) throw new Error(`Could not open ${website}`);
  if (tab.status !== 'complete') await waitForTab(tab.id);
  return tab;
};

void queueEngine.recover();
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('queue-tick', { periodInMinutes: 1 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'queue-tick') void queueEngine.run();
});
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-studio') void chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message: StudioRequest, _sender, sendResponse: (response: StudioResponse) => void) => {
  void (async () => {
    try {
      if (message.type === 'PING') return sendResponse({ ok: true, data: { version: chrome.runtime.getManifest().version } });
      if (message.type === 'OPEN_STUDIO') {
        await chrome.runtime.openOptionsPage();
        return sendResponse({ ok: true });
      }
      if (message.type === 'RUN_PROMPT') {
        await getOrOpenSiteTab(message.payload.website);
        const job = await queueEngine.enqueue({ ...message.payload, priority: 3, estimatedSeconds: 60 });
        return sendResponse({ ok: true, data: job });
      }
      if (message.type === 'RUN_PROMPT_BATCH') {
        await getOrOpenSiteTab(message.payload.website);
        const jobs = await Promise.all(message.payload.items.map((item, index) => queueEngine.enqueue({
          projectId: message.payload.projectId,
          promptId: item.promptId,
          prompt: item.prompt,
          website: message.payload.website,
          priority: message.payload.items.length - index,
          estimatedSeconds: 60,
        })));
        return sendResponse({ ok: true, data: jobs });
      }
      sendResponse({ ok: false, error: `Unknown message: ${message.type}` });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});
