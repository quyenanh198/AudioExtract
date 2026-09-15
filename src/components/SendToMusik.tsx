import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiMusic, FiCheck, FiLoader } from 'react-icons/fi';
import { backend } from '../platform';
import { webExtras, MusikPlaylist } from '../platform/webExtras';

// Shared across instances (history rows render many) so the server is asked once.
let playlistsPromise: Promise<MusikPlaylist[]> | null = null;
let statusPromise: Promise<boolean> | null = null;
const loadPlaylists = () => (playlistsPromise ??= webExtras.musikPlaylists().catch(() => (playlistsPromise = null, [] as MusikPlaylist[])));
const loadAvailable = () => (statusPromise ??= webExtras.status().then((s) => s.musik).catch(() => (statusPromise = null, false)));

/** "Add to Musik" control: optional playlist picker + button. Web build only, hidden when Musik isn't configured. */
export const SendToMusik: React.FC<{ outputPath: string; compact?: boolean }> = ({ outputPath, compact }) => {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(false);
  const [playlists, setPlaylists] = useState<MusikPlaylist[]>([]);
  const [playlistId, setPlaylistId] = useState<string>('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (backend.kind !== 'web') return;
    void loadAvailable().then(setAvailable);
  }, []);

  useEffect(() => {
    if (!available) return;
    void loadPlaylists().then(setPlaylists);
  }, [available]);

  if (backend.kind !== 'web' || !available) return null;

  const send = async () => {
    setState('sending');
    try {
      const result = await webExtras.importToMusik(outputPath, playlistId ? Number(playlistId) : undefined);
      playlistsPromise = null; // track counts changed
      setState('done');
      setMessage(result.playlist ? t('musik.addedTo', { name: result.playlist.name, defaultValue: 'Added to {{name}}' }) : t('musik.added', 'Added to Musik'));
    } catch (e) {
      setState('error');
      setMessage((e as Error).message);
    }
  };

  return (
    <span className="send-to-musik" title={t('musik.hint', 'Copy this file into your Musik library')}>
      {playlists.length > 0 && state !== 'done' && (
        <select className="input-field select-field send-to-musik__select" value={playlistId} onChange={(e) => setPlaylistId(e.target.value)} aria-label="Musik playlist">
          <option value="">{t('musik.libraryOnly', 'Musik: library')}</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
      <button
        className={compact ? 'btn-secondary' : 'btn-secondary'}
        onClick={send}
        disabled={state === 'sending' || state === 'done'}
        title={state === 'error' ? message : t('musik.send', 'Add to Musik')}
      >
        {state === 'sending' ? <FiLoader className="spin" /> : state === 'done' ? <FiCheck /> : <FiMusic />}
        {!compact && <> {state === 'done' ? message : state === 'sending' ? t('musik.sending', 'Sending…') : t('musik.send', 'Add to Musik')}</>}
      </button>
      {state === 'error' && <span className="send-to-musik__error">{message}</span>}
    </span>
  );
};
