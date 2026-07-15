import type { Website } from './domain';

export type StudioRequest =
  | { type: 'PING' }
  | { type: 'OPEN_STUDIO' }
  | { type: 'RUN_PROMPT'; payload: { promptId: string; prompt: string; website: Website; projectId?: string } }
  | { type: 'RUN_PROMPT_BATCH'; payload: { projectId: string; website: Website; items: Array<{ promptId: string; prompt: string }> } }
  | { type: 'AUTOMATION_INSERT'; payload: { prompt: string; website: Website } }
  | { type: 'AUTOMATION_STATUS' };
export interface StudioResponse<T = unknown> { ok: boolean; data?: T; error?: string }
export const sendMessage = <T>(message: StudioRequest) => chrome.runtime.sendMessage(message) as Promise<StudioResponse<T>>;
