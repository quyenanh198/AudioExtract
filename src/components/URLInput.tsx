import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClipboard, FiLoader, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { SiYoutube, SiFacebook, SiTiktok } from 'react-icons/si';
import './URLInput.css';

interface URLInputProps {
  onUrlSubmit: (url: string) => void;
  isLoading: boolean;
}

export const URLInput: React.FC<URLInputProps> = ({ onUrlSubmit, isLoading }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setIsValid(null);
      setPlatform(null);
      return;
    }
    
    const ytRegex = /youtube\.com|youtu\.be/;
    const fbRegex = /facebook\.com|fb\.watch/;
    const ttRegex = /tiktok\.com/;

    let isMatch = false;
    if (ytRegex.test(url)) {
      setPlatform('youtube');
      isMatch = true;
    } else if (fbRegex.test(url)) {
      setPlatform('facebook');
      isMatch = true;
    } else if (ttRegex.test(url)) {
      setPlatform('tiktok');
      isMatch = true;
    } else if (url.startsWith('http')) {
      setPlatform('unknown');
      isMatch = true;
    } else {
      setPlatform(null);
    }

    setIsValid(isMatch);
  }, [url]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && url) {
      onUrlSubmit(url);
    }
  };

  return (
    <form className="url-input-container glass-panel" onSubmit={handleSubmit}>
      <div className={`input-wrapper ${isValid === true ? 'valid' : isValid === false ? 'invalid' : ''}`}>
        <div className="platform-icon">
          {platform === 'youtube' && <SiYoutube color="#ff0000" />}
          {platform === 'facebook' && <SiFacebook color="#1877f2" />}
          {platform === 'tiktok' && <SiTiktok color="var(--color-text-primary)" />}
        </div>
        <input
          type="text"
          className="input-field url-field"
          placeholder={t('urlInput.placeholder', 'Paste YouTube, Facebook, or TikTok URL here...')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
        />
        <div className="input-actions">
          {isValid === true && <FiCheckCircle className="status-icon valid" />}
          {isValid === false && <FiXCircle className="status-icon invalid" />}
          
          <button 
            type="button" 
            className="btn-ghost paste-btn" 
            onClick={handlePaste}
            title={t('urlInput.paste', 'Paste from Clipboard')}
          >
            <FiClipboard />
          </button>
        </div>
      </div>
      <button 
        type="submit" 
        className="btn-primary submit-btn"
        disabled={!isValid || isLoading || !url}
      >
        {isLoading ? <FiLoader className="spin" /> : t('common.start', 'Extract')}
      </button>
    </form>
  );
};
