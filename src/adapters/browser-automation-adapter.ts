import type { Website } from '@/types/domain';

export interface AutomationCapabilities { text: boolean; image: boolean; video: boolean; fileUpload: boolean }
export interface ResultMetadata { urls: string[]; text?: string; mimeTypes: string[]; durationMs: number }
export interface BrowserAutomationAdapter {
  readonly website: Website;
  initialize(): Promise<void>;
  detectPage(): boolean;
  detectCapabilities(): AutomationCapabilities;
  findEditor(): HTMLElement | null;
  insertPrompt(prompt: string): Promise<void>;
  waitForGeneration(signal?: AbortSignal): Promise<void>;
  detectCompletion(): boolean;
  collectResultMetadata(): Promise<ResultMetadata>;
  observeDOM(onChange: () => void): () => void;
  cleanup(): void;
}
