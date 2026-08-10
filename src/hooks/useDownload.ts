import { invoke } from '@tauri-apps/api/core';
import { VideoInfo, DownloadAudioParams, TrimAudioParams } from '../types';

export const useDownload = () => {
  const fetchVideoInfo = async (url: string): Promise<VideoInfo[]> => {
    return invoke('fetch_video_info', { url });
  };

  const startDownload = async (params: DownloadAudioParams): Promise<void> => {
    return invoke('download_audio', {
      taskId: params.taskId,
      url: params.url,
      format: params.format,
      quality: params.quality,
      outputDir: params.outputDir
    });
  };

  const cancelDownload = async (taskId: string): Promise<void> => {
    return invoke('cancel_download', { taskId });
  };

  const trimAudio = async (params: TrimAudioParams): Promise<string> => {
    return invoke('trim_audio', {
      inputPath: params.inputPath,
      outputPath: params.outputPath,
      startTime: params.startTime,
      endTime: params.endTime
    });
  };

  return {
    fetchVideoInfo,
    startDownload,
    cancelDownload,
    trimAudio
  };
};
