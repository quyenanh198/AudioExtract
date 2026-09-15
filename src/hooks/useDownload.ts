import { backend } from '../platform';

export const useDownload = () => ({
  fetchVideoInfo: backend.fetchVideoInfo,
  startDownload: backend.startDownload,
  cancelDownload: backend.cancelDownload,
  trimAudio: backend.trimAudio,
});
