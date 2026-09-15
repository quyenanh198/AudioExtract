import { DownloadAudioParams, DownloadProgress, TrimAudioParams, VideoInfo } from '../types';
import { Backend, BackendEvents, DownloadFinished, LocalFile } from './types';

// Tauri modules are loaded lazily so the web bundle never evaluates them.
const core = () => import('@tauri-apps/api/core');
const event = () => import('@tauri-apps/api/event');
const dialog = () => import('@tauri-apps/plugin-dialog');

export const tauriBackend: Backend = {
  kind: 'tauri',

  fetchVideoInfo: async (url) => (await core()).invoke<VideoInfo[]>('fetch_video_info', { url }),

  startDownload: async (params: DownloadAudioParams) =>
    (await core()).invoke('download_audio', {
      taskId: params.taskId,
      url: params.url,
      format: params.format,
      quality: params.quality,
      outputDir: params.outputDir,
    }),

  cancelDownload: async (taskId) => (await core()).invoke('cancel_download', { taskId }),

  trimAudio: async (params: TrimAudioParams) => {
    await (await core()).invoke('trim_audio', {
      inputPath: params.inputPath,
      outputPath: params.outputPath,
      startTime: params.startTime,
      endTime: params.endTime,
    });
    return { outputPath: params.outputPath, fileSize: 0 };
  },

  subscribe: (handlers: BackendEvents) => {
    const unlisteners: Array<Promise<() => void>> = [];
    void event().then(({ listen }) => {
      unlisteners.push(
        listen<{ taskId: string; progress: DownloadProgress }>('download-progress', (e) =>
          handlers.onProgress(e.payload.taskId, e.payload.progress),
        ),
        listen<DownloadFinished>('download-finished', (e) => handlers.onFinished(e.payload)),
        listen<{ taskId: string; error: string }>('download-error', (e) =>
          handlers.onError(e.payload.taskId, e.payload.error),
        ),
      );
    });
    return () => {
      unlisteners.forEach((p) => p.then((f) => f()));
    };
  },

  pickLocalFile: async (): Promise<LocalFile | null> => {
    const selected = await (await dialog()).open({
      multiple: false,
      filters: [{ name: 'Media Files', extensions: ['mp4', 'mov', 'mkv', 'mp3', 'wav', 'm4a', 'flac', 'opus', 'webm'] }],
    });
    if (!selected || typeof selected !== 'string') return null;
    return { path: selected, name: selected.split(/[\\/]/).pop() || selected };
  },

  importFile: async () => {
    throw new Error('Use pickLocalFile on desktop');
  },

  pickOutputDir: async () => {
    const selected = await (await dialog()).open({ directory: true, multiple: false, title: 'Select Output Directory' });
    return selected && typeof selected === 'string' ? selected : null;
  },

  getDefaultOutputDir: async () => (await core()).invoke<string>('get_default_output_dir'),

  // convertFileSrc is sync in the API, but we only have the module lazily; the
  // URL scheme is stable so build it the same way convertFileSrc does.
  fileUrl: (path) => {
    const encoded = encodeURIComponent(path);
    return navigator.userAgent.includes('Windows') ? `http://asset.localhost/${encoded}` : `asset://localhost/${encoded}`;
  },

  downloadUrl: () => null,

  revealFile: async (path) => (await core()).invoke('open_file_in_explorer', { path }),

  deleteFile: async () => {
    /* desktop keeps files where the user put them */
  },
};
