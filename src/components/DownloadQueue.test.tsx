import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DownloadQueue } from './DownloadQueue';
import { useDownloadStore } from '../store/downloadStore';

const invokeMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => 'div' }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe('DownloadQueue cancel button', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    useDownloadStore.setState({
      tasks: [
        {
          id: 'task-1',
          url: 'https://youtube.com/watch?v=abc',
          status: 'downloading',
          createdAt: Date.now(),
        },
      ],
      history: [],
    });
  });

  it('actually cancels the backend download, not just removes it from the UI', () => {
    render(<DownloadQueue />);

    const cancelButton = screen.getByTitle('Cancel');
    fireEvent.click(cancelButton);

    // The bug: onCancel only called the local store's removeTask, so the
    // backend yt-dlp/ffmpeg process was never told to stop. Fixing it means
    // cancelDownload() -> invoke('cancel_download', ...) must actually fire.
    expect(invokeMock).toHaveBeenCalledWith('cancel_download', { taskId: 'task-1' });
  });
});
