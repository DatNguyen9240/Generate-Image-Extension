import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Play, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Progress, SectionTitle } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { repositories } from '@/repositories/repositories';
import { formatDate } from '@/utils';
import type { JobStatus } from '@/types/domain';

const statuses: Array<'all' | JobStatus> = ['all', 'waiting', 'running', 'completed', 'failed'];

export function Queue() {
  const { queue, refresh } = useAppStore();
  const [filter, setFilter] = useState<'all' | JobStatus>('all');
  const visible = filter === 'all' ? queue : queue.filter((job) => job.status === filter);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const regenerate = async (job: (typeof queue)[number]) => {
    const response = await chrome.runtime.sendMessage({ type: 'RUN_PROMPT', payload: {
      projectId: job.projectId,
      promptId: job.promptId,
      prompt: job.prompt,
      website: job.website,
    } });
    if (!response?.ok) toast.error(response?.error || 'Could not regenerate');
    else toast.success('Added to queue');
  };

  return <>
    <SectionTitle title="Queue" description="Every selected prompt runs one by one on the chosen website." />
    <div className="mb-4 flex gap-2">{statuses.map((status) => <Button key={status} size="sm" variant={filter === status ? 'primary' : 'ghost'} onClick={() => setFilter(status)}>{status}</Button>)}</div>
    <Card className="overflow-hidden">{visible.length ? visible.map((job) => <div key={job.id} className="grid grid-cols-[1.6fr_90px_110px_1fr_100px] items-center gap-4 border-b border-line px-5 py-4 last:border-0"><div className="min-w-0"><p className="truncate text-sm">{job.prompt}</p><p className="mt-1 text-xs text-muted">{job.website} · {formatDate(job.createdAt)}</p></div><Badge tone="purple">{job.website}</Badge><Badge tone={job.status === 'completed' ? 'green' : job.status === 'failed' ? 'red' : job.status === 'running' ? 'blue' : 'yellow'}>{job.status}</Badge><div><div className={job.status === 'running' ? 'animate-pulse' : ''}><Progress value={job.status === 'completed' || job.status === 'running' ? 100 : 0} tone={job.status === 'completed' ? 'green' : 'purple'}/></div><p className="mt-1 text-[10px] text-muted">{job.status === 'running' ? `Generating on ${job.website}…` : job.status === 'waiting' ? 'Waiting in queue' : job.status === 'completed' ? 'Completed' : job.error || 'Failed'}</p></div><div className="flex justify-end gap-1">{(job.status === 'failed' || job.status === 'completed') && <Button size="icon" variant="ghost" aria-label="Regenerate" title="Regenerate" onClick={() => void regenerate(job)}><RefreshCw size={14}/></Button>}<Button size="icon" variant="ghost" aria-label="Delete" onClick={async () => { await repositories.queue.delete(job.id); await refresh(); }}><Trash2 size={14}/></Button></div></div>) : <EmptyState icon={<Clock3/>} title="Queue is empty" description="Open a project and generate one or more selected prompts."/>}</Card>
  </>;
}

export function History() {
  const { history } = useAppStore();
  return <><SectionTitle title="History" description="Completed and failed generations from your projects."/><Card className="overflow-hidden">{history.length ? history.slice().reverse().map((item) => <div key={item.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0"><CheckCircle2 size={16} className={item.status === 'completed' ? 'text-emerald-300' : 'text-red-300'}/><div className="min-w-0 flex-1"><p className="truncate text-sm">{item.prompt}</p><p className="mt-1 text-xs text-muted">{item.projectName || 'Project'} · {item.website} · {formatDate(item.createdAt)}</p></div><Badge tone={item.status === 'completed' ? 'green' : 'red'}>{item.status}</Badge></div>) : <EmptyState icon={<Activity/>} title="No history yet" description="Run a generation from a project to see it here."/>}</Card></>;
}
