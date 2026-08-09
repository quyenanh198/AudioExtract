import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { FiFolder, FiSave, FiCheck } from 'react-icons/fi';
import './SettingsPanel.css';

const SUPPORTED_FORMATS = ['MP3', 'FLAC', 'WAV', 'M4A', 'Opus', 'AAC'];
const QUALITY_PRESETS = ['Best', 'High', 'Standard', 'Low'];

export const SettingsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings, selectOutputDir } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleBrowse = async () => {
    try {
      await selectOutputDir();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="settings-panel glass-panel">
      <h3>{t('settings.title', 'Settings')}</h3>
      
      <div className="settings-form">
        <div className="form-group">
          <label>{t('settings.outputDir', 'Output Directory')}</label>
          <div className="input-with-button">
            <input 
              type="text" 
              className="input-field" 
              value={localSettings.outputDir}
              onChange={(e) => setLocalSettings({...localSettings, outputDir: e.target.value})}
            />
            <button className="btn-secondary" onClick={handleBrowse}>
              <FiFolder /> {t('settings.browse', 'Browse')}
            </button>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('settings.defaultFormat', 'Default Format')}</label>
            <select 
              className="input-field select-field"
              value={localSettings.defaultFormat}
              onChange={(e) => setLocalSettings({...localSettings, defaultFormat: e.target.value})}
            >
              {SUPPORTED_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>{t('settings.defaultQuality', 'Default Quality')}</label>
            <select 
              className="input-field select-field"
              value={localSettings.defaultQuality}
              onChange={(e) => setLocalSettings({...localSettings, defaultQuality: e.target.value})}
            >
              {QUALITY_PRESETS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('settings.theme', 'Theme')}</label>
            <div className="segmented-control">
              {['dark', 'light', 'system'].map(theme => (
                <div 
                  key={theme}
                  className={`segment ${localSettings.theme === theme ? 'active' : ''}`}
                  onClick={() => setLocalSettings({...localSettings, theme: theme as any})}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>{t('settings.language', 'Language')}</label>
            <div className="segmented-control">
              <div 
                className={`segment ${localSettings.language === 'en' ? 'active' : ''}`}
                onClick={() => setLocalSettings({...localSettings, language: 'en'})}
              >
                🇬🇧 EN
              </div>
              <div 
                className={`segment ${localSettings.language === 'vi' ? 'active' : ''}`}
                onClick={() => setLocalSettings({...localSettings, language: 'vi'})}
              >
                🇻🇳 VI
              </div>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="toggle-label">
              <span>{t('settings.autoUpdate', 'Auto-update yt-dlp')}</span>
              <input 
                type="checkbox" 
                className="toggle-switch"
                checked={localSettings.autoUpdate}
                onChange={(e) => setLocalSettings({...localSettings, autoUpdate: e.target.checked})}
              />
            </label>
          </div>

          <div className="form-group">
            <label>{t('settings.concurrent', 'Concurrent Downloads')}</label>
            <input 
              type="number" 
              className="input-field" 
              min="1" 
              max="5"
              value={localSettings.concurrentDownloads}
              onChange={(e) => setLocalSettings({...localSettings, concurrentDownloads: parseInt(e.target.value) || 1})}
            />
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave}>
            {isSaved ? <FiCheck /> : <FiSave />} 
            {isSaved ? t('common.saved', 'Saved!') : t('common.save', 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
};
