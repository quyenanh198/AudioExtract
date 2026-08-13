import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { DownloadProgress } from './DownloadProgress';
import { DownloadTask } from '../types';

const baseTask: DownloadTask = {
  id: '1',
  url: 'https://youtube.com/watch?v=1',
  title: 'Test Video',
  mode: 'video',
  status: 'downloading',
  createdAt: Date.now(),
};

describe('DownloadProgress mode indicator', () => {
  it('shows a Video badge for video-mode tasks', () => {
    render(<DownloadProgress task={baseTask} onCancel={() => {}} />);
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('shows an Audio badge for audio-mode tasks', () => {
    render(<DownloadProgress task={{ ...baseTask, mode: 'audio' }} onCancel={() => {}} />);
    expect(screen.getByText('Audio')).toBeInTheDocument();
  });
});
