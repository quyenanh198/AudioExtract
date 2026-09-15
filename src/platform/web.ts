import { DownloadAudioParams, TrimAudioParams, VideoInfo } from '../types';
import { Backend, BackendEvents, DownloadFinished, LocalFile } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch {
      /* not json */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

// One SSE connection shared by UI subscribers and by startDownload, which
// (like the Tauri command) resolves only once the download has finished.
const subscribers = new Set<BackendEvents>();
const waiters = new Map<string, (event: DownloadFinished) => void>();
let source: EventSource | null = null;

const settle = (event: DownloadFinished) => {
  const resolve = waiters.get(event.taskId);
  if (resolve) {
    waiters.delete(event.taskId);
    resolve(event);
  }
};

const ensureSource = () => {
  if (source) return source;
  source = new EventSource('/api/events');
  source.addEventListener('download-progress', (e) => {
    const { taskId, progress } = JSON.parse((e as MessageEvent).data);
    subscribers.forEach((h) => h.onProgress(taskId, progress));
  });
  source.addEventListener('download-finished', (e) => {
    const event: DownloadFinished = JSON.parse((e as MessageEvent).data);
    subscribers.forEach((h) => h.onFinished(event));
    settle(event);
  });
  source.addEventListener('download-error', (e) => {
    const { taskId, error } = JSON.parse((e as MessageEvent).data);
    subscribers.forEach((h) => h.onError(taskId, error));
  });
  return source;
};

/** Backup for a dropped SSE stream: ask the server directly until the task is done. */
const pollUntilFinished = (taskId: string, signal: { done: boolean }) => {
  const tick = async () => {
    if (signal.done) return;
    try {
      const task = await request<{ status: string; event?: DownloadFinished }>(`/api/tasks/${encodeURIComponent(taskId)}`);
      if (task.status === 'finished' && task.event) {
        subscribers.forEach((h) => h.onFinished(task.event as DownloadFinished));
        settle(task.event);
        return;
      }
      if (task.status === 'unknown') {
        settle({ taskId, success: false, error: 'Task vanished on the server' });
        return;
      }
    } catch {
      /* server unreachable right now; keep trying */
    }
    if (!signal.done) setTimeout(tick, 10_000);
  };
  setTimeout(tick, 10_000);
};

export const webBackend: Backend = {
  kind: 'web',

  fetchVideoInfo: (url) => request<VideoInfo[]>(`/api/info?url=${encodeURIComponent(url)}`),

  startDownload: async (params: DownloadAudioParams) => {
    ensureSource();
    const finished = new Promise<DownloadFinished>((resolve) => waiters.set(params.taskId, resolve));
    try {
      await request<void>('/api/download', json('POST', params));
    } catch (err) {
      waiters.delete(params.taskId);
      throw err;
    }
    const signal = { done: false };
    pollUntilFinished(params.taskId, signal);
    const event = await finished;
    signal.done = true;
    if (!event.success) throw new Error(event.error || 'Download failed');
  },

  cancelDownload: async (taskId) => {
    await request<void>('/api/cancel', json('POST', { taskId }));
    settle({ taskId, success: false, error: 'Cancelled' });
  },

  trimAudio: (params: TrimAudioParams) =>
    request<{ outputPath: string; fileSize: number }>('/api/trim', json('POST', params)),

  subscribe: (handlers: BackendEvents) => {
    ensureSource();
    subscribers.add(handlers);
    return () => {
      subscribers.delete(handlers);
    };
  },

  pickLocalFile: async () => null,

  importFile: async (file: File): Promise<LocalFile> => {
    const form = new FormData();
    form.append('file', file, file.name);
    return request<LocalFile>('/api/upload', { method: 'POST', body: form });
  },

  pickOutputDir: async () => null,

  getDefaultOutputDir: async () => 'server',

  fileUrl: (path) => `/api/files/${encodePath(path)}`,

  downloadUrl: (path) => `/api/files/${encodePath(path)}?download=1`,

  revealFile: async (path) => {
    const a = document.createElement('a');
    a.href = `/api/files/${encodePath(path)}?download=1`;
    a.download = path.split('/').pop() || 'audio';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  deleteFile: (path) => request<void>(`/api/files/${encodePath(path)}`, { method: 'DELETE' }),
};
