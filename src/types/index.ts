export interface DownloadTask {
  id: string;
  url: string;
  title?: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: DownloadProgress;
  outputPath?: string;
  fileSize?: number;
  error?: string;
  createdAt: number;
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

export interface DownloadHistoryItem {
  id: string;
  title: string;
  url: string;
  outputPath: string;
  fileSize: number;
  completedAt: number;
}

export interface AppSettings {
  outputDir: string;
  defaultFormat: string;
  defaultQuality: string;
  theme: 'dark' | 'light' | 'system';
  language: 'vi' | 'en';
  autoUpdate: boolean;
  concurrentDownloads: number;
}

export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  uploader: string;
  platform: string;
  thumbnailUrl?: string;
}

export interface DownloadAudioParams {
  url: string;
  format: string;
  quality: string;
  outputDir: string;
}

export interface TrimAudioParams {
  inputPath: string;
  startTime: number;
  endTime: number;
  outputPath: string;
}
