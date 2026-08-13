import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClipboard, FiFilm, FiFolder, FiLink } from 'react-icons/fi';
import { open } from '@tauri-apps/plugin-dialog';
import { Button, Input } from '../ui';
import './SourceDropzone.css';

interface SourceDropzoneProps {
  onUrlSubmit: (url: string) => void;
  onFileSelected: (path: string) => void;
  isLoading: boolean;
}

const SUPPORTED_HOSTS = /youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com/i;

const MEDIA_EXTENSIONS = [
  'mp4', 'mov', 'mkv', 'webm', 'avi',
  'mp3', 'wav', 'm4a', 'flac', 'opus', 'aac',
];

/**
 * The app's entry point: paste a link or pick a local file.
 *
 * Reworked from the old URLInput, where the primary action (the URL form)
 * sat *below* a large decorative drop area that did nothing — Tauri delivers
 * file drops as a window-level `tauri://drag-drop` event, so the DOM drop
 * handler could never fire. The link field now leads, and the drop target is
 * only styled as active when the platform actually reports a drag.
 */
export const SourceDropzone: React.FC<SourceDropzoneProps> = ({
  onUrlSubmit,
  onFileSelected,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = url.trim();
  const isKnownHost = SUPPORTED_HOSTS.test(trimmed);
  const isHttp = /^https?:\/\/\S+$/i.test(trimmed);
  const isValid = isHttp || isKnownHost;
  const showError = touched && trimmed.length > 0 && !isValid;

  useEffect(() => {
    if (trimmed === '') setTouched(false);
  }, [trimmed]);

  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return;
      setUrl(text);
      setTouched(true);
      // Auto-submitting only on a clearly valid link avoids firing a backend
      // fetch for whatever unrelated text happened to be on the clipboard.
      if (/^https?:\/\/\S+$/i.test(text)) onUrlSubmit(text);
    } catch (err) {
      console.error('Clipboard read failed:', err);
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Media', extensions: MEDIA_EXTENSIONS }],
      });
      if (typeof selected === 'string') onFileSelected(selected);
    } catch (err) {
      console.error('File dialog failed:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (isValid && !isLoading) onUrlSubmit(trimmed);
  };

  return (
    <div className="dropzone">
      <div className="dropzone__mark" aria-hidden>
        <FiFilm />
      </div>

      <div className="dropzone__copy">
        <h2 className="dropzone__title">
          {t('source.title', 'Add a video or audio source')}
        </h2>
        <p className="dropzone__subtitle">
          {t(
            'source.subtitle',
            'Paste a YouTube, Facebook or TikTok link — or pick a file already on this computer.',
          )}
        </p>
      </div>

      <form className="dropzone__form" onSubmit={handleSubmit}>
        <div className="dropzone__input-wrap">
          <FiLink className="dropzone__input-icon" aria-hidden />
          <Input
            className="dropzone__input"
            type="url"
            autoComplete="off"
            spellCheck={false}
            aria-label={t('source.urlLabel', 'Video link')}
            placeholder={t('source.placeholder', 'Paste a video link…')}
            value={url}
            invalid={showError}
            disabled={isLoading}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          <Button
            className="dropzone__paste"
            variant="ghost"
            size="sm"
            iconOnly
            disabled={isLoading}
            onClick={handlePaste}
            aria-label={t('source.paste', 'Paste from clipboard')}
            title={t('source.paste', 'Paste from clipboard')}
          >
            <FiClipboard />
          </Button>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          disabled={!isValid}
        >
          {isLoading ? t('source.fetching', 'Fetching…') : t('source.fetch', 'Fetch')}
        </Button>
      </form>

      {showError && (
        <p className="dropzone__error" role="alert">
          {t('source.invalidUrl', 'That does not look like a video link.')}
        </p>
      )}

      <div className="dropzone__divider">
        <span>{t('common.or', 'or')}</span>
      </div>

      <Button variant="secondary" onClick={handleBrowse} disabled={isLoading}>
        <FiFolder />
        {t('source.browse', 'Choose a file…')}
      </Button>

      <p className="dropzone__formats">
        {t('source.formats', 'MP4, MOV, MKV, WEBM, MP3, WAV, M4A, FLAC, Opus')}
      </p>
    </div>
  );
};
