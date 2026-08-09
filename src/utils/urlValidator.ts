export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    // Add basic checks for common video platforms
    const validDomains = ['youtube.com', 'youtu.be', 'soundcloud.com', 'vimeo.com', 'tiktok.com'];
    return validDomains.some(domain => url.toLowerCase().includes(domain));
  } catch {
    return false;
  }
};

export const detectPlatform = (url: string): string => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'YouTube';
  if (lowerUrl.includes('soundcloud.com')) return 'SoundCloud';
  if (lowerUrl.includes('vimeo.com')) return 'Vimeo';
  if (lowerUrl.includes('tiktok.com')) return 'TikTok';
  return 'Unknown';
};
