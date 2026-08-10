import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClipboard, FiLoader, FiUploadCloud } from 'react-icons/fi';
import { open } from '@tauri-apps/plugin-dialog';
import './URLInput.css';

interface URLInputProps {
  onUrlSubmit: (url: string) => void;
  onFileSelected: (path: string) => void;
  isLoading: boolean;
}

export const URLInput: React.FC<URLInputProps> = ({ onUrlSubmit, onFileSelected, isLoading }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);

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

  const handleBrowse = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Media Files',
          extensions: ['mp4', 'mov', 'mkv', 'mp3', 'wav', 'm4a', 'flac', 'opus', 'webm']
        }]
      });
      if (selected && typeof selected === 'string') {
        onFileSelected(selected);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
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
    
    // Tauri handles file drop at window level natively, but we can also capture it here in web context
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Note: In standard browser sandbox, file.path is empty.
      // But in Tauri, custom drag-drop handler is needed or we can read file name.
      // Tauri emits a native `tauri://drag-drop` event which is handled globally in App.tsx
    }
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
        <button className="btn-secondary browse-btn" onClick={handleBrowse} disabled={isLoading}>
          <FiUploadCloud /> {t('urlInput.browse', 'Browse Files')}
        </button>
      </div>

      <form className="url-paste-form" onSubmit={handleUrlSubmitClick}>
        <div className="url-input-wrapper">
          <input
            type="text"
            className="input-field url-field"
            placeholder={t('urlInput.placeholder', 'Or paste YouTube, Facebook, TikTok link...')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
          />
          <button 
            type="button" 
            className="btn-ghost paste-btn" 
            onClick={handlePaste}
            title={t('urlInput.paste', 'Paste link')}
            disabled={isLoading}
          >
            <FiClipboard />
          </button>
        </div>
        <button 
          type="submit" 
          className="btn-primary submit-url-btn" 
          disabled={!isValidUrl || !url || isLoading}
          style={{ width: 'auto', padding: '0 20px', minWidth: '90px' }}
        >
          {isLoading ? <FiLoader className="spin" /> : t('common.extract', 'Extract')}
        </button>
      </form>
    </div>
  );
};
