import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClipboard, FiLoader, FiUploadCloud } from 'react-icons/fi';
import { backend, LocalFile } from '../platform';
import './URLInput.css';

interface URLInputProps {
  onUrlSubmit: (url: string) => void;
  onFileSelected: (file: LocalFile) => void;
  isLoading: boolean;
}

export const URLInput: React.FC<URLInputProps> = ({ onUrlSubmit, onFileSelected, isLoading }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = isLoading || isUploading;

  // Validate URL on change
  useEffect(() => {
    if (!url) {
      setIsValidUrl(null);
      return;
    }
    const mediaRegex = /youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com/;
    setIsValidUrl(mediaRegex.test(url) || url.startsWith('http'));
  }, [url]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      if (text.startsWith('http')) {
        onUrlSubmit(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  };

  // Desktop: native picker. Web: hidden <input type=file>, then upload to the server.
  const handleBrowse = async () => {
    if (backend.kind === 'web') {
      fileInputRef.current?.click();
      return;
    }
    try {
      const selected = await backend.pickLocalFile();
      if (selected) onFileSelected(selected);
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  const importBrowserFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      onFileSelected(await backend.importFile(file));
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError((err as Error).message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // In the browser the dropped File can be uploaded straight away. Tauri
    // handles drops natively at the window level, so nothing to do there.
    const file = e.dataTransfer.files?.[0];
    if (file && backend.kind === 'web') void importBrowserFile(file);
  };

  const handleUrlSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && isValidUrl) {
      onUrlSubmit(url);
    }
  };

  return (
    <div 
      className={`drop-area-container glass-panel ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="waveform-decor">
        <span className="bar bar-1"></span>
        <span className="bar bar-2"></span>
        <span className="bar bar-3"></span>
        <span className="bar bar-4"></span>
        <span className="bar bar-5"></span>
        <span className="bar bar-6"></span>
        <span className="bar bar-7"></span>
      </div>

      <h3 className="drop-title">{t('urlInput.dropTitle', 'Drop video or audio file here')}</h3>
      <p className="drop-subtitle">{t('urlInput.dropSubtitle', 'Supports MP4, MOV, MKV, MP3, WAV, and more.')}</p>

      <div className="drop-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,.mp4,.mov,.mkv,.mp3,.wav,.m4a,.flac,.opus,.webm"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importBrowserFile(file);
          }}
        />
        <button className="btn-secondary browse-btn" onClick={handleBrowse} disabled={busy}>
          {isUploading ? <FiLoader className="spin" /> : <FiUploadCloud />}{' '}
          {isUploading ? t('urlInput.uploading', 'Uploading...') : t('urlInput.browse', 'Browse Files')}
        </button>
      </div>
      {uploadError && <p className="drop-subtitle" style={{ color: 'var(--color-error)' }}>{uploadError}</p>}

      <form className="url-paste-form" onSubmit={handleUrlSubmitClick}>
        <div className="url-input-wrapper">
          <input
            type="text"
            className="input-field url-field"
            placeholder={t('urlInput.placeholder', 'Or paste YouTube, Facebook, TikTok link...')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
          <button 
            type="button" 
            className="btn-ghost paste-btn" 
            onClick={handlePaste}
            title={t('urlInput.paste', 'Paste link')}
            disabled={busy}
          >
            <FiClipboard />
          </button>
        </div>
        <button 
          type="submit" 
          className="btn-primary submit-url-btn" 
          disabled={!isValidUrl || !url || busy}
          style={{ width: 'auto', padding: '0 20px', minWidth: '90px' }}
        >
          {isLoading ? <FiLoader className="spin" /> : t('common.extract', 'Extract')}
        </button>
      </form>
    </div>
  );
};
