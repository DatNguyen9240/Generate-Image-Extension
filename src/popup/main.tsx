import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Boxes, FolderKanban, ListTodo } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import '@/styles.css';

function Popup() {
  const { queue, projects, load } = useAppStore();
  useEffect(() => { void load(); }, [load]);
  const activeJobs = queue.filter((job) => job.status === 'waiting' || job.status === 'running').length;

  return <div className="w-[360px] bg-[#0c0e12] p-4">
    <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent"><Boxes size={18}/></div><div><h1 className="text-sm font-semibold">Workflow Studio</h1><p className="text-[10px] uppercase tracking-[.15em] text-muted">Batch image prompts</p></div></div>
    <div className="mt-4 grid grid-cols-2 gap-3"><Card className="p-3"><p className="flex items-center gap-1.5 text-xs text-muted"><FolderKanban size={13}/> Projects</p><p className="mt-1 text-xl font-semibold">{projects.length}</p></Card><Card className="p-3"><p className="flex items-center gap-1.5 text-xs text-muted"><ListTodo size={13}/> Active jobs</p><p className="mt-1 text-xl font-semibold">{activeJobs}</p></Card></div>
    <Button className="mt-4 w-full" variant="primary" onClick={() => chrome.runtime.openOptionsPage()}><FolderKanban size={15}/> Open projects</Button>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Popup/></StrictMode>);
