import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiUploadCloud, FiTrash2, FiLoader } from 'react-icons/fi';
import { webExtras, CookiesStatus } from '../platform/webExtras';

/** Upload/remove the Netscape cookies.txt yt-dlp uses for logged-in sites. Web build only. */
export const CookiesSettings: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CookiesStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    webExtras.cookiesStatus().then(setStatus).catch(() => setStatus({ present: false }));
  }, []);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await webExtras.uploadCookies(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!window.confirm(t('cookies.removeConfirm', 'Remove the cookies file?'))) return;
    setBusy(true);
    try {
      await webExtras.deleteCookies();
      setStatus({ present: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-group">
      <label>{t('cookies.title', 'yt-dlp cookies (YouTube login)')}</label>
      <p className="settings-hint">
        {t('cookies.hint', 'When YouTube asks to "confirm you\'re not a bot", export cookies.txt (Netscape format) from a logged-in browser with an extension such as "Get cookies.txt LOCALLY" and upload it here. Use a throwaway account.')}
      </p>
      <div className="input-with-button" style={{ alignItems: 'center' }}>
        <span className="settings-hint" style={{ flex: 1 }}>
          {status === null
            ? '…'
            : status.present
              ? t('cookies.present', { size: Math.round((status.size || 0) / 1024), date: new Date(status.updatedAt || 0).toLocaleString(), defaultValue: 'Uploaded {{date}} ({{size}} KB)' })
              : t('cookies.absent', 'No cookies file — downloads run anonymously.')}
        </span>
        <input ref={inputRef} type="file" accept=".txt,text/plain" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <button className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <FiLoader className="spin" /> : <FiUploadCloud />} {status?.present ? t('cookies.replace', 'Replace') : t('cookies.upload', 'Upload cookies.txt')}
        </button>
        {status?.present && (
          <button className="btn-danger" onClick={() => void remove()} disabled={busy} title={t('cookies.remove', 'Remove')}>
            <FiTrash2 />
          </button>
        )}
      </div>
      {error && <p className="settings-hint" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  );
};
