import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import './Header.css';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();

  const toggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <header className="app-header glass-panel">
      <div className="header-logo-container">
        <div className="logo-icon animate-pulse"></div>
        <div>
          <h1 className="header-title text-gradient">{t('header.title')}</h1>
          <p className="header-subtitle">{t('header.subtitle')}</p>
        </div>
      </div>
      <div className="header-actions">
        <button className="theme-toggle btn-ghost" onClick={toggleTheme} aria-label="Toggle theme">
          {settings.theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
};
