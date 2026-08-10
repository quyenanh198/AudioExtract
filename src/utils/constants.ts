export const SUPPORTED_FORMATS = ['mp3', 'm4a', 'wav', 'flac', 'ogg'];
export const QUALITY_PRESETS = ['320k', '256k', '192k', '128k', '96k', '64k'];

export const THEME_OPTIONS = ['dark', 'light', 'system'];
export const LANG_OPTIONS = ['vi', 'en'];

export const DEFAULT_SETTINGS = {
  outputDir: '',
  defaultFormat: 'mp3',
  defaultQuality: '320k',
  theme: 'dark',
  language: 'vi',
  autoUpdate: true,
  concurrentDownloads: 5
};

export const PLATFORM_INFO: Record<string, { name: string, color: string }> = {
  youtube: { name: 'YouTube', color: '#ff0000' },
  soundcloud: { name: 'SoundCloud', color: '#ff7700' },
  tiktok: { name: 'TikTok', color: '#000000' },
  facebook: { name: 'Facebook', color: '#1877f2' },
  instagram: { name: 'Instagram', color: '#e4405f' },
  twitter: { name: 'Twitter', color: '#1da1f2' },
  other: { name: 'Other', color: '#888888' }
};
