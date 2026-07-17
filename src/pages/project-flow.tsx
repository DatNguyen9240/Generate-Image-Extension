import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  FileUp,
  FolderKanban,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  SectionTitle,
  Textarea,
} from '@/components/ui';
import { repositories } from '@/repositories/repositories';
import { dataService } from '@/services/data-service';
import { useAppStore } from '@/state/app-store';
import type { Prompt, QueueJob, Website } from '@/types/domain';
import { formatDate } from '@/utils';

const copyImageToClipboard = async (url: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    let pngBlob = blob;
    if (blob.type !== 'image/png') {
      pngBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((resultBlob) => {
            if (resultBlob) {
              resolve(resultBlob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          }, 'image/png');
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      });
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
      }),
    ]);
    toast.success('Copied image to clipboard');
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error);
    toast.error('Could not copy image to clipboard');
  }
};

const sites: Array<{ value: Website; label: string }> = [
  { value: 'grok', label: 'Grok' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'google-flow', label: 'Google Flow' },
];

export function ProjectFlow() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('id');
  return projectId ? (
    <ProjectWorkspace projectId={projectId} onBack={() => setParams({})} />
  ) : (
    <ProjectList onOpen={(id) => setParams({ id })} />
  );
}

function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const { projects, refresh } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', notes: '' });

  const createProject = async () => {
    if (!form.name.trim()) {
      toast.error('Enter a project name');
      return;
    }
    const project = await repositories.projects.create({
      name: form.name.trim(),
      notes: form.notes.trim(),
      tags: [],
      archived: false,
      favorite: false,
    });
    await refresh();
    setForm({ name: '', notes: '' });
    setModalOpen(false);
    onOpen(project.id);
  };

  return (
    <>
      <SectionTitle
        title="Projects"
        description="A project owns its prompts, generations and history."
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> New project
          </Button>
        }
      />
      {projects.length ? (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onOpen(project.id)}
              className="glass group rounded-2xl p-5 text-left transition hover:border-accent/60 hover:bg-[#151821]"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <FolderKanban size={19} />
                </div>
                <span className="text-xs text-muted">{formatDate(project.updatedAt)}</span>
              </div>
              <h2 className="mt-5 font-semibold">{project.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted">
                {project.notes || 'Open project workspace'}
              </p>
              <div className="mt-4 text-xs text-violet-300">Open workspace →</div>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<FolderKanban />}
            title="No projects yet"
            description="Create a project before importing prompts."
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                <Plus size={15} /> Create project
              </Button>
            }
          />
        </Card>
      )}
      {modalOpen && (
        <Modal title="Create project" onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            <label className="block text-sm">
              Project name
              <Input
                autoFocus
                className="mt-1.5"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="block text-sm">
              Notes
              <Textarea
                className="mt-1.5"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void createProject()}>
                Create project
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProjectWorkspace({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { projects, prompts, queue, history, refresh } = useAppStore();
  const project = projects.find((item) => item.id === projectId);
  const projectPrompts = prompts.filter((prompt) => prompt.projectId === projectId);
  const projectJobs = queue.filter((job) => job.projectId === projectId);
  const projectHistory = history.filter((item) => item.projectId === projectId);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; title: string; body: string } | null>(null);
  const [website, setWebsite] = useState<Website>('grok');
  const [batchOpen, setBatchOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!project)
    return (
      <EmptyState
        icon={<FolderKanban />}
        title="Project not found"
        description="This project may have been deleted."
        action={<Button onClick={onBack}>Back to projects</Button>}
      />
    );

  const filtered = projectPrompts.filter((prompt) =>
    `${prompt.title} ${prompt.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selectedPrompts = projectPrompts.filter((prompt) => selected.includes(prompt.id));
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((prompt) => selected.includes(prompt.id));

  const togglePrompt = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const toggleAll = () =>
    setSelected((current) =>
      allFilteredSelected
        ? current.filter((id) => !filtered.some((prompt) => prompt.id === id))
        : [...new Set([...current, ...filtered.map((prompt) => prompt.id)])],
    );

  const importPrompts = async (file: File) => {
    setImporting(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
      const rows = dataService.parsePrompts(await file.text(), extension);
      await Promise.all(rows.map((row) => repositories.prompts.create({ ...row, projectId })));
      await refresh();
      toast.success(`Imported ${rows.length} prompt(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import prompts');
    } finally {
      setImporting(false);
    }
  };

  const openBatch = (ids: string[]) => {
    setSelected(ids);
    setBatchOpen(true);
  };

  const startBatch = async () => {
    if (!selectedPrompts.length) {
      toast.error('Select at least one prompt');
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RUN_PROMPT_BATCH',
        payload: {
          projectId,
          website,
          items: selectedPrompts.map((prompt) => ({ promptId: prompt.id, prompt: prompt.body })),
        },
      });
      if (!response?.ok) throw new Error(response?.error || 'Could not start batch');
      toast.success(`${selectedPrompts.length} prompt(s) added to queue`);
      setSelected([]);
      setBatchOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Extension connection failed');
    }
  };

  const regenerate = async (job: QueueJob) => {
    const response = await chrome.runtime.sendMessage({
      type: 'RUN_PROMPT',
      payload: { projectId, promptId: job.promptId, prompt: job.prompt, website: job.website },
    });
    if (!response?.ok) toast.error(response?.error || 'Could not regenerate');
    else toast.success('Regeneration added to queue');
  };

  const savePrompt = async () => {
    if (!editing?.body.trim()) {
      toast.error('Prompt cannot be empty');
      return;
    }
    await repositories.prompts.update(editing.id, {
      title: editing.title.trim() || 'Untitled prompt',
      body: editing.body.trim(),
    });
    await refresh();
    setEditing(null);
    toast.success('Prompt updated');
  };

  const deletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    await repositories.prompts.delete(id);
    setSelected((current) => current.filter((item) => item !== id));
    await refresh();
    toast.success('Prompt deleted');
  };

  const filePicker = (
    <label className="focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel px-4 text-sm font-medium hover:bg-[#191c25]">
      <input
        type="file"
        accept=".txt,.csv,.json"
        className="hidden"
        disabled={importing}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void importPrompts(file);
        }}
      />
      <Upload size={15} /> {importing ? 'Importing…' : 'Import prompts'}
    </label>
  );

  return (
    <>
      <div className="mb-5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={15} /> All projects
        </Button>
      </div>
      <SectionTitle
        title={project.name}
        description={
          project.notes || 'Import prompts, select the ones you want, then generate them in order.'
        }
        actions={
          <>
            <span>{filePicker}</span>
            <Button
              variant="primary"
              disabled={!selected.length}
              onClick={() => setBatchOpen(true)}
            >
              <Play size={15} /> Generate selected ({selected.length})
            </Button>
          </>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search size={15} className="absolute left-3 top-3 text-muted" />
          <Input
            className="pl-9"
            placeholder="Search project prompts…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        {filtered.length ? (
          <>
            <div className="flex items-center gap-4 border-b border-line bg-[#161920]/45 px-5 py-3 text-xs font-semibold text-muted">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAll}
                aria-label="Select all prompts"
                className="h-4 w-4 accent-accent flex-shrink-0 cursor-pointer"
              />
              <span className="text-slate-300">
                Select all ({selected.length} / {filtered.length} selected)
              </span>
            </div>
            {filtered.map((prompt) => {
              const promptImages = projectHistory
                .filter((item) => item.promptId === prompt.id)
                .flatMap((item) => item.outputFiles || []);
              return (
                <div key={prompt.id} className="border-b border-line px-5 py-4 last:border-0">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selected.includes(prompt.id)}
                      onChange={() => togglePrompt(prompt.id)}
                      aria-label={`Select ${prompt.title}`}
                      className="mt-1.5 h-4 w-4 accent-accent flex-shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-100">{prompt.title}</p>
                          <p className="mt-1 text-xs text-muted leading-relaxed">{prompt.body}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditing({ id: prompt.id, title: prompt.title, body: prompt.body })
                            }
                          >
                            <Pencil size={14} /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openBatch([prompt.id])}
                          >
                            <Play size={14} /> Generate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => void deletePrompt(prompt.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                      {promptImages.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {promptImages.map((url, imgIndex) => (
                            <div
                              key={imgIndex}
                              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-line bg-[#0d0f14] hover:border-accent/40"
                            >
                              <img src={url} alt="" className="h-full w-full object-cover" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/75 opacity-0 group-hover:opacity-100 transition p-1">
                                <button
                                  type="button"
                                  onClick={() => void copyImageToClipboard(url)}
                                  className="text-[10px] font-semibold text-white hover:underline"
                                >
                                  Copy
                                </button>
                                <a
                                  href={url}
                                  download={`generation_${prompt.title.replace(/[^a-z0-9]/gi, '_')}_${imgIndex}.png`}
                                  className="text-[10px] font-semibold text-muted hover:text-white hover:underline"
                                >
                                  Save
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <EmptyState
            icon={<FileUp />}
            title="No prompts in this project"
            description="Import a TXT, CSV or JSON prompt file to begin."
            action={filePicker}
          />
        )}
      </Card>
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Recent generations</h2>
          <p className="mt-1 text-xs text-muted">
            Regenerate a completed or failed image without importing the prompt again.
          </p>
        </div>
        {projectJobs.length ? (
          projectJobs
            .slice(-8)
            .reverse()
            .map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{job.prompt}</p>
                  <p className="mt-1 text-xs text-muted">
                    {job.website} · {job.status} · {formatDate(job.createdAt)}
                  </p>
                </div>
                <Badge
                  tone={
                    job.status === 'completed'
                      ? 'green'
                      : job.status === 'failed'
                        ? 'red'
                        : 'yellow'
                  }
                >
                  {job.status}
                </Badge>
                {(job.status === 'completed' || job.status === 'failed') && (
                  <Button size="sm" variant="secondary" onClick={() => void regenerate(job)}>
                    <RefreshCw size={14} /> Regenerate
                  </Button>
                )}
              </div>
            ))
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted">No generations yet.</p>
        )}
      </Card>
      {projectHistory.some((item) => item.outputFiles && item.outputFiles.length > 0) && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">Generated Images</h2>
            <p className="mt-1 text-xs text-muted">
              All images generated in this project. Hover to view prompt or download.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
            {projectHistory
              .flatMap((item) =>
                (item.outputFiles || []).map((url) => ({ url, prompt: item.prompt, id: item.id })),
              )
              .map((img, index) => (
                <div
                  key={`${img.id}-${index}`}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-[#0d0f14] hover:border-accent/40"
                >
                  <img src={img.url} alt={img.prompt} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex flex-col justify-end bg-black/75 opacity-0 transition group-hover:opacity-100 p-3">
                    <p className="line-clamp-3 text-[11px] text-slate-200">{img.prompt}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void copyImageToClipboard(img.url)}
                        className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-semibold text-white hover:bg-accent-hover transition"
                      >
                        Copy
                      </button>
                      <a
                        href={img.url}
                        download={`generation_${index}.png`}
                        className="flex-1 text-center rounded-lg border border-line bg-panel py-1.5 text-xs font-semibold text-white hover:bg-[#191c25] transition"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
      {editing && (
        <Modal title="Edit prompt" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <label className="block text-sm">
              Title
              <Input
                className="mt-1.5"
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
              />
            </label>
            <label className="block text-sm">
              Prompt text
              <Textarea
                className="mt-1.5 min-h-52"
                value={editing.body}
                onChange={(event) => setEditing({ ...editing, body: event.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                <X size={15} /> Cancel
              </Button>
              <Button variant="primary" onClick={() => void savePrompt()}>
                <Save size={15} /> Save changes
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {batchOpen && (
        <Modal
          title={`Generate ${selectedPrompts.length} prompt(s)`}
          onClose={() => setBatchOpen(false)}
        >
          <div className="space-y-4">
            <label className="block text-sm">
              Website
              <select
                value={website}
                onChange={(event) => setWebsite(event.target.value as Website)}
                className="mt-1.5 h-10 w-full rounded-lg border border-line bg-[#0e1015] px-3 text-sm"
              >
                {sites.map((site) => (
                  <option key={site.value} value={site.value}>
                    {site.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-line bg-[#0d0f14] p-3 text-sm text-muted">
              The imported prompts will be sent exactly as written. {selectedPrompts.length}{' '}
              prompt(s) will run sequentially.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBatchOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void startBatch()}>
                <Play size={15} /> Start generation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
