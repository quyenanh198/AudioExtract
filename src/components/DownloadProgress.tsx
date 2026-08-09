import React from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadTask } from '../types';
import { SiYoutube, SiFacebook, SiTiktok } from 'react-icons/si';
import { FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import './DownloadProgress.css';

interface DownloadProgressProps {
  task: DownloadTask;
  onCancel: (taskId: string) => void;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({ task, onCancel }) => {
  const { t } = useTranslation();

  const getPlatformIcon = (url: string) => {
    if (url.includes('youtube') || url.includes('youtu.be')) return <SiYoutube color="#ff0000" />;
    if (url.includes('facebook') || url.includes('fb.watch')) return <SiFacebook color="#1877f2" />;
    if (url.includes('tiktok')) return <SiTiktok color="var(--color-text-primary)" />;
    return null;
  };

  const percent = task.progress?.percent || 0;
  const speed = task.progress?.speed || '0 KB/s';
  const eta = task.progress?.eta || '--:--';

  const getStatusText = () => {
    switch (task.status) {
      case 'queued': return t('download.queue', 'Queued');
      case 'downloading': return t('download.progress', 'Downloading');
      case 'processing': return t('download.converting', 'Converting');
      case 'completed': return t('download.completed', 'Completed');
      case 'failed': return t('download.error', 'Error');
      case 'cancelled': return t('download.cancel', 'Cancelled');
      default: return task.status;
    }
  };

  return (
    <div className={`download-progress-card glass-panel status-${task.status}`}>
      <div className="task-header">
        <div className="task-info">
          <div className="platform-icon-small">
            {getPlatformIcon(task.url)}
          </div>
          <h4 className="task-title" title={task.title || task.url}>
            {task.title || task.url}
          </h4>
        </div>
        
        {['queued', 'downloading', 'processing'].includes(task.status) && (
          <button className="btn-ghost cancel-btn" onClick={() => onCancel(task.id)} title={t('common.cancel', 'Cancel')}>
            <FiX />
          </button>
        )}
      </div>

      <div className="task-body">
        {task.status === 'completed' ? (
          <div className="status-message success">
            <FiCheckCircle />
            <span>{t('download.completed', 'Download Completed Successfully')}</span>
          </div>
        ) : task.status === 'failed' ? (
          <div className="status-message error">
            <FiAlertCircle />
            <span>{task.error || t('download.error', 'Download Failed')}</span>
          </div>
        ) : (
          <>
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="progress-percent">{percent.toFixed(1)}%</span>
            </div>

            <div className="task-meta">
              <span className="status-badge">{getStatusText()}</span>
              {task.status === 'downloading' && (
                <div className="speed-eta">
                  <span>{speed}</span>
                  <span>•</span>
                  <span>ETA: {eta}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
