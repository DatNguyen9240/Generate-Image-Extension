import { db } from '@/storage/database';
import type { BaseRecord, HistoryItem, Project, Prompt, QueueJob } from '@/types/domain';
import { now, uid } from '@/utils';

export class Repository<T extends BaseRecord> {
  constructor(protected readonly table: any) {}
  all(): Promise<T[]> {
    return this.table.toArray();
  }
  get(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }
  async create(data: Omit<T, keyof BaseRecord>): Promise<T> {
    const stamp = now();
    const value = { ...data, id: uid(), createdAt: stamp, updatedAt: stamp } as T;
    await this.table.add(value);
    return value;
  }
  async update(id: string, patch: Partial<T>) {
    await this.table.update(id, { ...patch, updatedAt: now() } as any);
    return this.get(id);
  }
  delete(id: string) {
    return this.table.delete(id);
  }
  clear() {
    return this.table.clear();
  }
}
export class ProjectRepository extends Repository<Project> {
  async duplicate(id: string) {
    const source = await this.get(id);
    if (!source) throw new Error('Project not found');
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = source;
    return this.create({ ...data, name: `${data.name} copy` });
  }
}
export class PromptRepository extends Repository<Prompt> {
  async duplicate(id: string) {
    const source = await this.get(id);
    if (!source) throw new Error('Prompt not found');
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = source;
    return this.create({ ...data, title: `${data.title} copy` });
  }
}
export class QueueRepository extends Repository<QueueJob> {
  async byStatus(status: QueueJob['status']): Promise<QueueJob[]> {
    return this.table.where('status').equals(status).sortBy('priority');
  }
  async byPromptId(promptId: string): Promise<QueueJob | undefined> {
    const list: QueueJob[] = await this.table.toArray();
    return list.find((job) => job.promptId === promptId);
  }
}
export const repositories = {
  projects: new ProjectRepository(db.projects),
  prompts: new PromptRepository(db.prompts),
  queue: new QueueRepository(db.queue),
  history: new Repository<HistoryItem>(db.history),
};
