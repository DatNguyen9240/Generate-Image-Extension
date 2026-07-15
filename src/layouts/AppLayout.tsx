import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Boxes, ChevronLeft, ChevronRight, FolderKanban, History, ListTodo, Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { cn } from '@/utils';

const nav = [
  { to: '/', label: 'Projects', icon: FolderKanban },
  { to: '/queue', label: 'Queue', icon: ListTodo },
  { to: '/history', label: 'History', icon: History },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggle = useAppStore((state) => state.toggleSidebar);
  const commandOpen = useAppStore((state) => state.commandOpen);
  const setCommandOpen = useAppStore((state) => state.setCommandOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const commands = useMemo(() => nav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandOpen]);

  return <div className="flex min-h-screen">
    <aside className={cn('sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-[#0c0e12]/90 py-4 transition-all', collapsed ? 'w-[76px] px-3' : 'w-64 px-3')}>
      <div className={cn('mb-7 flex items-center gap-3 px-2', collapsed && 'justify-center')}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-glow"><Boxes size={20}/></div>
        {!collapsed && <div><div className="text-sm font-semibold">Workflow Studio</div><div className="text-[10px] uppercase tracking-[.18em] text-muted">Batch image prompts</div></div>}
      </div>
      <nav className="space-y-1">{nav.map((item) => <NavItem key={item.to} {...item} collapsed={collapsed}/>)}</nav>
      <div className="mt-auto"><Button variant="ghost" size="icon" className="w-full" onClick={toggle} aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</Button></div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-line bg-[#090a0d]/80 px-8 backdrop-blur-xl">
        <button onClick={() => setCommandOpen(true)} className="focus-ring flex h-9 w-72 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-left text-sm text-muted hover:border-accent/50"><Search size={15}/><span>Go to page…</span><kbd className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px]">Ctrl K</kbd></button>
      </header>
      <div className="mx-auto max-w-[1500px] p-8">{children}</div>
    </main>
    {commandOpen && <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"><div className="glass w-[560px] overflow-hidden rounded-2xl shadow-2xl"><div className="flex items-center gap-3 border-b border-line px-4"><Search size={17} className="text-muted"/><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Projects, Queue, History…" className="border-0 bg-transparent px-0"/><kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd></div><div className="max-h-80 overflow-auto p-2">{commands.map((item) => <button key={item.to} onClick={() => { navigate(item.to); setCommandOpen(false); setQuery(''); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-accent/15"><item.icon size={16} className="text-muted"/>{item.label}<span className="ml-auto text-xs text-muted">Open</span></button>)}</div></div></div>}
  </div>;
}

function NavItem({ to, label, icon: Icon, collapsed }: { to: string; label: string; icon: typeof FolderKanban; collapsed: boolean }) {
  return <NavLink to={to} className={({ isActive }) => cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition', isActive ? 'bg-accent/15 text-violet-100' : 'text-muted hover:bg-[#191c23] hover:text-white', collapsed && 'justify-center px-0')} title={collapsed ? label : undefined}><Icon size={17} className="shrink-0"/><span className={cn(collapsed && 'hidden')}>{label}</span></NavLink>;
}
