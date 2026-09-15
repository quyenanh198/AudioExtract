import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useDownloadStore } from '../store/downloadStore';
import { backend } from '../platform';
import { FiFolder, FiPlay, FiTrash2, FiSearch, FiDownload } from 'react-icons/fi';
import './DownloadHistory.css';

export const DownloadHistory: React.FC = () => {
  const { t } = useTranslation();
  const { history, removeFromHistory, clearHistory } = useDownloadStore();
  const [searchQuery, setSearchQuery] = useState('');

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredHistory = history.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isWeb = backend.kind === 'web';

  // Web: play in a new tab. Desktop: nothing yet (files open from the folder).
  const handleOpenFile = async (path: string) => {
    if (isWeb) window.open(backend.fileUrl(path), '_blank', 'noopener');
  };

  // Web: browser download. Desktop: reveal in Finder/Explorer.
  const handleOpenFolder = async (path: string) => {
    try {
      await backend.revealFile(path);
    } catch (e) {
      console.error('Failed to open folder:', e);
    }
  };

  // Removing a history row on the web also frees the file on the server.
  const handleRemove = async (id: string, path: string) => {
    removeFromHistory(id);
    if (isWeb && path) backend.deleteFile(path).catch((e) => console.error('Failed to delete file:', e));
  };

  return (
    <div className="history-container glass-panel">
      <div className="history-header">
        <h3>{t('history.title', 'Download History')}</h3>
        <div className="history-actions">
          <div className="search-bar">
            <FiSearch />
            <input 
              type="text" 
              placeholder={t('common.search', 'Search...')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
            />
          </div>
          {history.length > 0 && (
            <button 
              className="btn-danger" 
              onClick={() => {
                if(window.confirm(t('history.clearConfirm', 'Are you sure you want to clear all history?'))) {
                  clearHistory();
                }
              }}
            >
              {t('history.clear', 'Clear All')}
            </button>
          )}
        </div>
      </div>

      <div className="history-list">
        <AnimatePresence>
          {filteredHistory.length === 0 ? (
            <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p>{t('history.empty', 'No history found.')}</p>
            </motion.div>
          ) : (
            filteredHistory.map(item => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="history-item card"
              >
                <div className="history-item-info">
                  <h4>{item.title}</h4>
                  <div className="history-meta">
                    <span className="badge">{formatBytes(item.fileSize)}</span>
                    <span>{formatDate(item.completedAt)}</span>
                  </div>
                </div>
                
                <div className="history-item-actions">
                  <button className="btn-secondary" onClick={() => handleOpenFile(item.outputPath)} title={t('history.openFile', 'Open File')}>
                    <FiPlay />
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => handleOpenFolder(item.outputPath)}
                    title={isWeb ? t('history.download', 'Download') : t('history.openFolder', 'Open Folder')}
                  >
                    {isWeb ? <FiDownload /> : <FiFolder />}
                  </button>
                  <button className="btn-ghost text-danger" onClick={() => handleRemove(item.id, item.outputPath)} title={t('history.delete', 'Delete')}>
                    <FiTrash2 />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
