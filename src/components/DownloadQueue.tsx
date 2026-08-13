import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useDownloadStore } from '../store/downloadStore';
import { useDownload } from '../hooks/useDownload';
import { DownloadProgress } from './DownloadProgress';
import { FiInbox } from 'react-icons/fi';
import './DownloadQueue.css';

export const DownloadQueue: React.FC = () => {
  const { t } = useTranslation();
  const { tasks, cancelTask } = useDownloadStore();
  const { cancelDownload } = useDownload();

  const activeAndQueuedTasks = Object.values(tasks).filter(
    task => ['queued', 'downloading', 'processing'].includes(task.status)
  );

  const handleCancel = async (id: string) => {
    // Update local state first so the UI reflects the cancellation
    // immediately, then kill the actual backend process. Order matters:
    // if the kill's completion event arrives before this, the store guards
    // in completeTask/failTask already protect a 'cancelled' task from
    // being overwritten, so doing this first vs. after doesn't change
    // correctness — but doing it first gives instant UI feedback.
    cancelTask(id);
    try {
      await cancelDownload(id);
    } catch (err) {
      console.error('Failed to cancel download on backend', err);
    }
  };

  return (
    <div className="download-queue-container">
      <h3>{t('download.queue', 'Download Queue')}</h3>
      
      <div className="queue-list">
        <AnimatePresence mode="popLayout">
          {activeAndQueuedTasks.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="empty-state"
            >
              <FiInbox className="empty-icon" />
              <p>{t('history.empty', 'No active downloads')}</p>
            </motion.div>
          ) : (
            activeAndQueuedTasks.map(task => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <DownloadProgress
                  task={task}
                  onCancel={handleCancel}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
