import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { AppHeader, PageId } from './components/layout/AppHeader';
import { ExtractPage } from './components/extract/ExtractPage';
import { DownloadHistory } from './components/DownloadHistory';
import { SettingsPanel } from './components/SettingsPanel';

import { useSettings } from './hooks/useSettings';
import { useDownloadStore } from './store/downloadStore';

import './styles/tokens.css';
import './styles/base.css';
import './App.css';

const ACTIVE_STATUSES = ['queued', 'downloading', 'processing'];

/**
 * Resolve the stored preference — including 'system' — to the concrete theme
 * the document should carry.
 *
 * The previous version wrote settings.theme straight onto data-theme, so
 * picking "System" in Settings produced `data-theme="system"`, which matches
 * no rule and silently fell back to dark regardless of the OS setting.
 */
const resolveTheme = (preference: 'dark' | 'light' | 'system'): 'dark' | 'light' => {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export default function App() {
  const [page, setPage] = useState<PageId>('home');
  const { settings, updateSettings, initSettings } = useSettings();
  const tasks = useDownloadStore((state) => state.tasks);

  const activeJobs = tasks.filter((task) => ACTIVE_STATUSES.includes(task.status)).length;

  useEffect(() => {
    initSettings();
    // Settings load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the theme, and keep following the OS while the preference is
  // 'system' rather than sampling it once at startup.
  useEffect(() => {
    const preference = settings.theme ?? 'dark';
    const apply = () =>
      document.documentElement.setAttribute('data-theme', resolveTheme(preference));

    apply();

    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: light)');
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [settings.theme]);

  const toggleTheme = () => {
    const next = resolveTheme(settings.theme ?? 'dark') === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: next });
  };

  return (
    <div className="app">
      <AppHeader
        currentPage={page}
        onNavigate={setPage}
        theme={settings.theme ?? 'dark'}
        onToggleTheme={toggleTheme}
        activeJobs={activeJobs}
      />

      <main className="app__body">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            className="app__page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            {page === 'home' && <ExtractPage settings={settings} />}
            {page === 'history' && (
              <div className="app__scroll">
                <DownloadHistory />
              </div>
            )}
            {page === 'settings' && (
              <div className="app__scroll">
                <SettingsPanel />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
