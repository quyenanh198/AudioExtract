import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore } from '../store/downloadStore';
import { DownloadProgress } from '../types';

export const useTauriEvents = () => {
  const { updateTaskProgress, completeTask, failTask } = useDownloadStore();

  useEffect(() => {
    const unlistenProgress = listen<DownloadProgress & { id: string }>('download-progress', (event) => {
      updateTaskProgress(event.payload);
    });

    const unlistenComplete = listen<{ id: string, outputPath: string, fileSize: number }>('download-finished', (event) => {
      completeTask(event.payload.id, event.payload.outputPath, event.payload.fileSize);
    });

    const unlistenError = listen<{ id: string, error: string }>('download-error', (event) => {
      failTask(event.payload.id, event.payload.error);
    });

    return () => {
      unlistenProgress.then(f => f());
      unlistenComplete.then(f => f());
      unlistenError.then(f => f());
    };
  }, [updateTaskProgress, completeTask, failTask]);
};
