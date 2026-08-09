import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDownloadStore } from '../../store/downloadStore';
import './Sidebar.css';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useTranslation();
  const queuedTasks = useDownloadStore(state => state.getQueuedTasks());
  const activeTasks = useDownloadStore(state => state.getActiveTasks());
  
  const totalProcessing = queuedTasks.length + activeTasks.length;

  const navItems = [
    { id: 'home', icon: '🎧', label: t('header.title') },
    { id: 'history', icon: '⏱️', label: t('history.title') },
    { id: 'settings', icon: '⚙️', label: t('settings.title') },
  ];

  return (
    <nav className="app-sidebar glass-panel">
      <div className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.id === 'home' && totalProcessing > 0 && (
              <span className="badge counter-badge">{totalProcessing}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};
