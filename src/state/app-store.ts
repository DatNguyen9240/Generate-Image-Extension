import { create } from 'zustand';
import type { HistoryItem, Project, Prompt, QueueJob } from '@/types/domain';
import { repositories } from '@/repositories/repositories';
import { dataService } from '@/services/data-service';

interface AppState {
  projects: Project[];
  prompts: Prompt[];
  queue: QueueJob[];
  history: HistoryItem[];
  loading: boolean;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  load(): Promise<void>;
  refresh(): Promise<void>;
  toggleSidebar(): void;
  setCommandOpen(open: boolean): void;
}

const loadRecords = async () => {
  await dataService.removeLegacyMockData();
  const [projects, prompts, queue, history] = await Promise.all([
    repositories.projects.all(),
    repositories.prompts.all(),
    repositories.queue.all(),
    repositories.history.all(),
  ]);
  return { projects, prompts, queue, history };
};

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  prompts: [],
  queue: [],
  history: [],
  loading: true,
  sidebarCollapsed: false,
  commandOpen: false,
  load: async () => {
    set({ loading: true });
    set({ ...(await loadRecords()), loading: false });
  },
  refresh: async () => set(await loadRecords()),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandOpen: (open) => set({ commandOpen: open }),
}));
