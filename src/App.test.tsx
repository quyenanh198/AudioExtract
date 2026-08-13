import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const invokeMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => path,
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => 'div' }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

import App from './App';

describe('Audio/Video mode toggle', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    // fetch_video_info is called on URL submit; stub a minimal successful response.
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'fetch_video_info') {
        return Promise.resolve([
          { id: '1', title: 'Test Video', duration: 100, uploader: 'u', platform: 'youtube', originalUrl: 'https://youtube.com/watch?v=1' },
        ]);
      }
      return Promise.resolve(undefined);
    });
  });

  it('hides format/quality controls and sends mode: "video" when Video is selected', async () => {
    render(<App />);

    // Note: URLInput's actual placeholder is "Or paste YouTube, Facebook, TikTok
    // link..." (no literal "url" substring), so the brief's /url/i regex never
    // matches. Use /paste/i, which still uniquely selects the same URL field.
    const urlInput = screen.getByPlaceholderText(/paste/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=1' } });
    fireEvent.submit(urlInput.closest('form')!);

    await waitFor(() => expect(screen.getByText('Test Video')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /video/i }));

    expect(screen.queryByText('Format')).not.toBeInTheDocument();
    expect(screen.queryByText('Quality')).not.toBeInTheDocument();

    // Note: the brief's /extract|download/i regex also matches the "Extract"
    // nav tab, causing a "multiple elements found" error. Narrow to the
    // primary submit button's full label, "Extract Audio".
    fireEvent.click(screen.getByRole('button', { name: /extract audio/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('download_media', expect.objectContaining({
        mode: 'video',
        format: undefined,
        quality: undefined,
      }));
    });
  });
});
