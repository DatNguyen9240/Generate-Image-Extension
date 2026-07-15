import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from '@/layouts/AppLayout';
import { useAppStore } from '@/state/app-store';
import { ProjectFlow } from '@/pages/project-flow';
import { History, Queue } from '@/pages/focused-operations';

export function App() {
  const load = useAppStore((state) => state.load);
  useEffect(() => { void load(); }, [load]);
  const basename = window.location.pathname.endsWith('/options.html') ? '/options.html' : undefined;

  return <BrowserRouter basename={basename}>
    <AppLayout>
      <Routes>
        <Route path="/" element={<ProjectFlow/>}/>
        <Route path="/projects" element={<Navigate to="/" replace/>}/>
        <Route path="/prompts" element={<Navigate to="/" replace/>}/>
        <Route path="/queue" element={<Queue/>}/>
        <Route path="/history" element={<History/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </AppLayout>
    <Toaster position="bottom-right" toastOptions={{ style: { background: '#171a22', color: '#fff', border: '1px solid #303440' } }}/>
  </BrowserRouter>;
}
