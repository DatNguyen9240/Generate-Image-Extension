import Dexie, { type EntityTable } from 'dexie';
import type { HistoryItem, Project, Prompt, QueueJob } from '@/types/domain';

export class StudioDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>; prompts!: EntityTable<Prompt, 'id'>; history!: EntityTable<HistoryItem, 'id'>;
  queue!: EntityTable<QueueJob, 'id'>;
  constructor() {
    super('AIWorkflowStudio');
    this.version(1).stores({
      projects: 'id, name, *tags, favorite, archived, updatedAt', prompts: 'id, title, folder, category, *tags, updatedAt',
      history: 'id, projectId, website, status, createdAt', queue: 'id, status, priority, website, createdAt',
      downloads: 'id, filename, website, projectId, createdAt', logs: 'id, level, scope, createdAt', settings: 'id', statistics: 'id, key, date',
    });
    this.version(2).stores({
      projects: 'id, name, *tags, favorite, archived, updatedAt',
      prompts: 'id, projectId, title, *tags, updatedAt',
      history: 'id, projectId, website, status, createdAt',
      queue: 'id, projectId, status, priority, website, createdAt',
      downloads: null,
      logs: null,
      settings: null,
      statistics: null,
    });
  }
}
export const db = new StudioDatabase();
