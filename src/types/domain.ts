export type ID = string;
export type Website = 'grok' | 'chatgpt' | 'gemini' | 'claude';
export type JobStatus = 'waiting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface BaseRecord { id: ID; createdAt: string; updatedAt: string }
export interface Project extends BaseRecord {
  name: string; notes: string; tags: string[]; thumbnail?: string; archived: boolean; favorite: boolean;
}
export interface Prompt extends BaseRecord {
  projectId: ID; title: string; body: string; negativePrompt: string; notes: string; folder: string; category: string; tags: string[];
}
export interface QueueJob extends BaseRecord {
  projectId?: ID; promptId?: ID; prompt: string; website: Website; status: JobStatus; priority: number; progress: number;
  estimatedSeconds: number; startedAt?: string; completedAt?: string; error?: string; attempts: number;
}
export interface HistoryItem extends BaseRecord {
  projectId?: ID; projectName: string; prompt: string; website: Website; durationMs: number; status: 'completed' | 'failed'; outputFiles: string[];
}
