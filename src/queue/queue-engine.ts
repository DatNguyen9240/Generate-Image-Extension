import { repositories } from '@/repositories/repositories';
import type { QueueJob } from '@/types/domain';

const siteHost: Record<QueueJob['website'], string> = {
  grok: 'grok.com',
  chatgpt: 'chatgpt.com',
  gemini: 'gemini.google.com',
  claude: 'claude.ai',
  'google-flow': 'labs.google/fx',
};

const waitForTab = (tabId: number, timeoutMs = 20_000) =>
  new Promise<void>((resolve) => {
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

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).toLowerCase();

const isMissingReceiver = (message: string) =>
  message.includes('receiving end') || message.includes('could not establish connection');

const isClosedMessageChannel = (message: string) =>
  message.includes('message channel closed') ||
  message.includes('asynchronous response') ||
  message.includes('port closed');

const submitAutomation = async (
  tabId: number,
  payload: { prompt: string; website: QueueJob['website'] },
) => {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'AUTOMATION_INSERT', payload });
  } catch (error) {
    const message = errorMessage(error);
    // Flow can navigate to a project/session URL immediately after submit,
    // destroying the old content-script context before it can acknowledge.
    // Do not resubmit the prompt in that case or the job may be duplicated.
    if (isClosedMessageChannel(message)) return { ok: true, data: { submitted: true } };
    if (!isMissingReceiver(message)) throw error;
    await chrome.tabs.reload(tabId);
    await waitForTab(tabId);
    try {
      return await chrome.tabs.sendMessage(tabId, { type: 'AUTOMATION_INSERT', payload });
    } catch (retryError) {
      if (isClosedMessageChannel(errorMessage(retryError)))
        return { ok: true, data: { submitted: true } };
      throw retryError;
    }
  }
};

const waitForAutomationResult = async (
  tabId: number,
  payload: { prompt: string; website: QueueJob['website'] },
) => {
  const deadline = Date.now() + (payload.website === 'google-flow' ? 660_000 : 180_000);
  while (Date.now() < deadline) {
    try {
      return await chrome.tabs.sendMessage(tabId, {
        type: 'AUTOMATION_WAIT_RESULT',
        payload,
      });
    } catch (error) {
      const message = errorMessage(error);
      if (!isMissingReceiver(message) && !isClosedMessageChannel(message)) throw error;
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'loading') await waitForTab(tabId, 20_000);
      await delay(750);
    }
  }
  throw new Error('Timed out reconnecting to the page while waiting for a new result');
};

export class QueueEngine {
  private active = false;

  async recover() {
    const jobs = await repositories.queue.byStatus('running');
    await Promise.all(
      jobs.map((job) =>
        repositories.queue.update(job.id, {
          status: 'waiting',
          progress: 0,
          error: 'Recovered after extension restart',
        }),
      ),
    );
  }

  async enqueue(
    data: Omit<QueueJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'progress' | 'attempts'>,
  ) {
    if (data.promptId) {
      const existing = await repositories.queue.byPromptId(data.promptId);
      if (existing) {
        await repositories.queue.update(existing.id, {
          status: 'waiting',
          progress: 0,
          attempts: 0,
          error: undefined,
          website: data.website,
          prompt: data.prompt,
        });
        void this.run();
        return existing;
      }
    }
    const job = await repositories.queue.create({
      ...data,
      status: 'waiting',
      progress: 0,
      attempts: 0,
    });
    void this.run();
    return job;
  }

  async run() {
    if (this.active) return;
    this.active = true;
    try {
      while (true) {
        const jobs = (await repositories.queue.byStatus('waiting')).sort(
          (a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt),
        );
        if (!jobs[0]) break;
        await this.execute(jobs[0]);
      }
    } finally {
      this.active = false;
    }
  }

  private async execute(job: QueueJob) {
    const startedAt = new Date().toISOString();
    await repositories.queue.update(job.id, {
      status: 'running',
      startedAt,
      progress: 5,
      attempts: job.attempts + 1,
      error: undefined,
    });
    try {
      const [tab] = await chrome.tabs.query({ url: `https://${siteHost[job.website]}/*` });
      if (!tab?.id) throw new Error(`Open ${job.website} in a tab before running this job`);
      const payload = { prompt: job.prompt, website: job.website };
      const submitted = await submitAutomation(tab.id, payload);
      if (!submitted?.ok)
        throw new Error(submitted?.error || 'The automation adapter failed to submit the prompt');
      await repositories.queue.update(job.id, { progress: 25 });
      const response = await waitForAutomationResult(tab.id, payload);
      if (!response?.ok) throw new Error(response?.error || 'The automation adapter failed');
      const project = job.projectId ? await repositories.projects.get(job.projectId) : undefined;
      const outputFiles = (response.data as { urls?: string[] } | undefined)?.urls ?? [];
      await repositories.queue.update(job.id, {
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
      });
      await repositories.history.create({
        projectId: job.projectId,
        promptId: job.promptId,
        projectName: project?.name ?? '',
        prompt: job.prompt,
        website: job.website,
        durationMs: Date.now() - new Date(startedAt).getTime(),
        status: 'completed',
        outputFiles,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await repositories.queue.update(job.id, {
        status: 'failed',
        error: message,
        completedAt: new Date().toISOString(),
      });
      const project = job.projectId ? await repositories.projects.get(job.projectId) : undefined;
      await repositories.history.create({
        projectId: job.projectId,
        promptId: job.promptId,
        projectName: project?.name ?? '',
        prompt: job.prompt,
        website: job.website,
        durationMs: Date.now() - new Date(startedAt).getTime(),
        status: 'failed',
        outputFiles: [],
      });
      console.error('[queue]', message);
    }
  }
}

export const queueEngine = new QueueEngine();
