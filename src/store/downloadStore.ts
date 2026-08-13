import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DownloadTask, DownloadHistoryItem, DownloadProgress } from '../types';

interface DownloadStore {
  tasks: DownloadTask[];
  history: DownloadHistoryItem[];
  addTask: (task: DownloadTask) => void;
  removeTask: (taskId: string) => void;
  updateTask: (taskId: string, updates: Partial<DownloadTask>) => void;
  updateTaskProgress: (progress: DownloadProgress & { id: string }) => void;
  completeTask: (taskId: string, outputPath: string, fileSize: number) => void;
  failTask: (taskId: string, error: string) => void;
  cancelTask: (taskId: string) => void;
  getActiveTasks: () => DownloadTask[];
  getQueuedTasks: () => DownloadTask[];
  addToHistory: (item: DownloadHistoryItem) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
}

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      history: [],
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      removeTask: (taskId) => set((state) => ({ tasks: state.tasks.filter(t => t.id !== taskId) })),
      updateTask: (taskId, updates) => set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      })),
      updateTaskProgress: ({ id, ...progress }) => set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, progress } : t)
      })),
      completeTask: (taskId, outputPath, fileSize) => set((state) => {
        const task = state.tasks.find(t => t.id === taskId);
        // A task the user already cancelled locally shouldn't be resurrected as
        // completed by a late backend event racing the kill.
        if (task && task.status !== 'cancelled') {
          const historyItem: DownloadHistoryItem = {
            id: task.id,
            title: task.title || 'Unknown Title',
            url: task.url,
            outputPath,
            fileSize,
            completedAt: Date.now()
          };
          return {
            tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'completed', outputPath, fileSize } : t),
            history: [historyItem, ...state.history]
          };
        }
        return state;
      }),
      failTask: (taskId, error) => set((state) => ({
        // Same race as above: a cancelled task's process still emits a
        // failure event once killed (non-zero exit code) — don't let that
        // overwrite the "cancelled" status with "failed".
        tasks: state.tasks.map(t => t.id === taskId && t.status !== 'cancelled' ? { ...t, status: 'failed', error } : t)
      })),
      cancelTask: (taskId) => set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'cancelled' } : t)
      })),
      getActiveTasks: () => get().tasks.filter(t => ['downloading', 'processing'].includes(t.status)),
      getQueuedTasks: () => get().tasks.filter(t => t.status === 'queued'),
      addToHistory: (item) => set((state) => ({ history: [item, ...state.history] })),
      removeFromHistory: (id) => set((state) => ({ history: state.history.filter(h => h.id !== id) })),
      clearHistory: () => set({ history: [] })
    }),
    {
      name: 'audioextract-download-store',
      partialize: (state) => ({ history: state.history }), // Only persist history
    }
  )
);
