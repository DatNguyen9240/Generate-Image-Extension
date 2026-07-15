import { repositories } from '@/repositories/repositories';
import type { Prompt } from '@/types/domain';
import { sanitizeText } from '@/utils';

export type ImportedPrompt = Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>;

export class DataService {
  parsePrompts(text: string, extension: string): ImportedPrompt[] {
    if (extension === 'json') {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed.prompts;
      if (!Array.isArray(rows)) throw new Error('JSON must contain a prompt array');
      return rows.map((row: unknown, index: number) => this.normalizePrompt(row, index));
    }

    if (extension === 'csv') {
      const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
      if (!header) return [];
      const keys = header.split(',').map((value) => value.trim().toLowerCase());
      return lines.map((line, index) => {
        const cells = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
        return this.normalizePrompt(Object.fromEntries(keys.map((key, cellIndex) => [key, cells[cellIndex]])), index);
      });
    }

    return text
      .split(/\r?\n\s*\r?\n/)
      .map((body) => body.trim())
      .filter(Boolean)
      .map((body, index) => this.normalizePrompt({ title: `Prompt ${index + 1}`, body }, index));
  }

  private normalizePrompt(raw: unknown, index: number): ImportedPrompt {
    const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const body = sanitizeText(row.body ?? row.prompt ?? row.content);
    if (!body) throw new Error(`Prompt ${index + 1} is empty`);
    return {
      title: sanitizeText(row.title || `Prompt ${index + 1}`, 200),
      body,
      negativePrompt: sanitizeText(row.negativePrompt),
      notes: sanitizeText(row.notes),
      folder: sanitizeText(row.folder || 'Imported', 100),
      category: sanitizeText(row.category || 'General', 100),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : String(row.tags || '').split(/[;|]/).filter(Boolean),
    };
  }

  async removeLegacyMockData() {
    const projects = await repositories.projects.all();
    await Promise.all(projects.filter((project) => project.name === 'Launch campaign').map((project) => repositories.projects.delete(project.id)));
    const prompts = await repositories.prompts.all();
    await Promise.all(prompts.filter((prompt) => prompt.title === 'Cinematic product scene').map((prompt) => repositories.prompts.delete(prompt.id)));
    const jobs = await repositories.queue.all();
    await Promise.all(jobs.filter((job) => job.prompt.includes('cinematic {{style}} product scene')).map((job) => repositories.queue.delete(job.id)));
  }
}

export const dataService = new DataService();
