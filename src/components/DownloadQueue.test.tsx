import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DownloadQueue } from './DownloadQueue';
import { useDownloadStore } from '../store/downloadStore';

const cancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../platform', () => ({
  backend: {
    kind: 'web',
    cancelDownload: (...args: unknown[]) => cancelMock(...args),
  },
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
    cancelMock.mockClear();
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
    // backend.cancelDownload(taskId) must actually fire.
    expect(cancelMock).toHaveBeenCalledWith('task-1');
  });
});
