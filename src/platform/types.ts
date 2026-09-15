import { DownloadAudioParams, DownloadProgress, TrimAudioParams, VideoInfo } from '../types';

/** A media file the backend can read: a filesystem path on desktop, an upload id on the web. */
export interface LocalFile {
  path: string;
  name: string;
  size?: number;
}

export interface DownloadFinished {
  taskId: string;
  outputPath?: string;
  fileSize?: number;
  success: boolean;
  error?: string;
}

export interface BackendEvents {
  onProgress: (taskId: string, progress: DownloadProgress) => void;
  onFinished: (event: DownloadFinished) => void;
  onError: (taskId: string, error: string) => void;
}

/**
 * Everything the UI needs from "the machine that runs yt-dlp/ffmpeg".
 * Desktop builds talk to the Tauri/Rust backend; the web build talks to the
 * Node server over HTTP + SSE. Components only ever import `backend`.
 */
export interface Backend {
  readonly kind: 'tauri' | 'web';
  fetchVideoInfo: (url: string) => Promise<VideoInfo[]>;
  startDownload: (params: DownloadAudioParams) => Promise<void>;
  cancelDownload: (taskId: string) => Promise<void>;
  /** Returns where the trimmed/converted file ended up. */
  trimAudio: (params: TrimAudioParams) => Promise<{ outputPath: string; fileSize: number }>;
  subscribe: (handlers: BackendEvents) => () => void;
  /** Native file picker (desktop). Web returns null — use importFile with a browser File. */
  pickLocalFile: () => Promise<LocalFile | null>;
  /** Upload a browser File so the backend can process it. */
  importFile: (file: File) => Promise<LocalFile>;
  pickOutputDir: () => Promise<string | null>;
  getDefaultOutputDir: () => Promise<string>;
  /** URL an <audio> element can play. */
  fileUrl: (path: string) => string;
  /** URL that downloads the file to the user's device; null when it's already local. */
  downloadUrl: (path: string) => string | null;
  /** Desktop: reveal in Finder/Explorer. Web: trigger a browser download. */
  revealFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
}
