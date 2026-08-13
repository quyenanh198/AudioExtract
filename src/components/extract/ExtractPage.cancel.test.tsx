import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => path,
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { ExtractPage } from './ExtractPage';
import { useDownloadStore } from '../../store/downloadStore';
import { AppSettings } from '../../types';

const settings: AppSettings = {
  outputDir: '/out',
  defaultFormat: 'mp3',
  defaultQuality: '320k',
  theme: 'dark',
  language: 'en',
  autoUpdate: true,
  concurrentDownloads: 1,
};

/**
 * Regression guard carried over from the deleted DownloadQueue test: pressing
 * cancel must actually kill the backend process, not just drop the task from
 * the local store. It is asserted through the real extract flow now, because
 * the extract screen previously had no cancel control at all — the store-only
 * bug and the missing-button bug are the same class of failure.
 */
describe('cancelling a running job', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'fetch_video_info') {
        return Promise.resolve([
          {
            id: '1',
            title: 'Test Video',
            duration: 100,
            uploader: 'u',
            platform: 'youtube',
            originalUrl: 'https://youtube.com/watch?v=1',
          },
        ]);
      }
      // download_media never resolves on its own: the real backend reports
      // completion via events, so the task stays in-flight and cancellable.
      if (cmd === 'download_media') return new Promise(() => {});
      return Promise.resolve(undefined);
    });

    useDownloadStore.setState({ tasks: [], history: [] });
  });

  it('invokes cancel_download on the backend', async () => {
    render(<ExtractPage settings={settings} />);

    const urlInput = screen.getByPlaceholderText(/paste/i);
    fireEvent.change(urlInput, {
      target: { value: 'https://youtube.com/watch?v=1' },
    });
    fireEvent.submit(urlInput.closest('form')!);

    await waitFor(() => expect(screen.getByText('Test Video')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('submit-media-btn'));

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        'cancel_download',
        expect.objectContaining({ taskId: expect.any(String) }),
      ),
    );

    const task = useDownloadStore.getState().tasks[0];
    expect(task.status).toBe('cancelled');
  });
});
