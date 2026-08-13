import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { ActiveJobCard } from './ActiveJobCard';
import { DownloadTask } from '../../types';

const baseTask: DownloadTask = {
  id: '1',
  url: 'https://youtube.com/watch?v=1',
  title: 'Test Video',
  mode: 'video',
  status: 'downloading',
  createdAt: 0,
};

describe('ActiveJobCard mode indicator', () => {
  it('shows a Video badge for video-mode tasks', () => {
    render(<ActiveJobCard task={baseTask} />);
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('shows an Audio badge for audio-mode tasks', () => {
    render(<ActiveJobCard task={{ ...baseTask, mode: 'audio' }} />);
    expect(screen.getByText('Audio')).toBeInTheDocument();
  });
});

describe('ActiveJobCard cancel affordance', () => {
  it('offers cancel while the task is still running', () => {
    const onCancel = vi.fn();
    render(<ActiveJobCard task={baseTask} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('hides cancel once the task has finished', () => {
    render(
      <ActiveJobCard task={{ ...baseTask, status: 'completed' }} onCancel={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
