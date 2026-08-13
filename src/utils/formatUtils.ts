export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/** Human-readable duration: `m:ss`, or `h:mm:ss` past an hour. */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Fixed-width timecode for editable inputs — always `mm:ss`, or `h:mm:ss`
 * once the source is an hour or longer. Unlike formatDuration this never
 * drops the leading zero on minutes, so the field doesn't change width while
 * the user types.
 */
export const formatTimecode = (seconds: number, showHours = false): string => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (showHours || h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Parse a user-typed timecode into seconds.
 *
 * Accepts `ss`, `mm:ss` and `h:mm:ss`, tolerating stray spaces and
 * over-range parts (`1:75` -> 135s) so a half-finished edit never throws.
 * Returns null when the text can't be read as a time at all, which the
 * caller surfaces as a field-level error instead of silently coercing — the
 * old raw-seconds number input turned a typed "1:30" into 0 with no warning.
 */
export const parseTimecode = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  if (parts.length > 3) return null;

  const numbers: number[] = [];
  for (const part of parts) {
    const piece = part.trim();
    if (!/^\d*\.?\d*$/.test(piece) || piece === '' || piece === '.') return null;
    const n = parseFloat(piece);
    if (Number.isNaN(n)) return null;
    numbers.push(n);
  }

  const seconds = numbers.reduce((total, n) => total * 60 + n, 0);
  return Number.isFinite(seconds) ? seconds : null;
};

export const formatRelativeTime = (timestamp: number, locale?: string): string => {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date(timestamp)) - startOfDay(new Date())) / 86_400_000,
  );

  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(timestamp));
};
