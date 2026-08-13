import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiClock, FiMoon, FiSettings, FiSun, FiZap } from 'react-icons/fi';
import { Button } from '../ui';
import './AppHeader.css';

export type PageId = 'home' | 'history' | 'settings';

interface AppHeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  theme: 'dark' | 'light' | 'system';
  onToggleTheme: () => void;
  /** Count of queued + in-flight jobs, surfaced on the Extract tab. */
  activeJobs: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentPage,
  onNavigate,
  theme,
  onToggleTheme,
  activeJobs,
}) => {
  const { t } = useTranslation();

  const tabs: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t('nav.home', 'Extract'), icon: <FiZap aria-hidden /> },
    { id: 'history', label: t('nav.history', 'Library'), icon: <FiClock aria-hidden /> },
    { id: 'settings', label: t('nav.settings', 'Settings'), icon: <FiSettings aria-hidden /> },
  ];

  const isDark = theme !== 'light';

  return (
    <header className="app-header" data-tauri-drag-region>
      <div className="app-header__brand">
        <span className="app-header__mark" aria-hidden>
          <FiZap />
        </span>
        <span className="app-header__name">{t('header.title', 'AudioExtract')}</span>
      </div>

      <nav className="app-header__nav" aria-label={t('nav.label', 'Main')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="app-header__tab"
            aria-current={currentPage === tab.id ? 'page' : undefined}
            onClick={() => onNavigate(tab.id)}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'home' && activeJobs > 0 && (
              <span className="app-header__count" aria-hidden>
                {activeJobs}
              </span>
            )}
            {tab.id === 'home' && activeJobs > 0 && (
              <span className="visually-hidden">
                {t('nav.activeJobs', '{{count}} active jobs', { count: activeJobs })}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="app-header__actions">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onToggleTheme}
          aria-label={
            isDark ? t('theme.toLight', 'Switch to light theme') : t('theme.toDark', 'Switch to dark theme')
          }
          title={
            isDark ? t('theme.toLight', 'Switch to light theme') : t('theme.toDark', 'Switch to dark theme')
          }
        >
          {isDark ? <FiSun /> : <FiMoon />}
        </Button>
      </div>
    </header>
  );
};
