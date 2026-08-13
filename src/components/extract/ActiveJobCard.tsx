import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertCircle, FiCheckCircle, FiDownload, FiX } from 'react-icons/fi';
import { Alert, Badge, Button, Card, CardBody, ProgressBar } from '../ui';
import { DownloadTask } from '../../types';
import './ActiveJobCard.css';

interface ActiveJobCardProps {
  task: DownloadTask;
  /** Omitted when the task can no longer be cancelled. */
  onCancel?: (taskId: string) => void;
}

const ACTIVE_STATUSES = ['queued', 'downloading', 'processing'];

/**
 * Status for the job the user just started.
 *
 * Adds the cancel affordance the previous inline progress block was missing
 * entirely: `cancel_download` existed in the backend and in useDownload, but
 * the extract screen never exposed a way to call it, so a wrong 2-hour
 * playlist could only be stopped by quitting the app.
 */
export const ActiveJobCard: React.FC<ActiveJobCardProps> = ({ task, onCancel }) => {
  const { t } = useTranslation();

  const isActive = ACTIVE_STATUSES.includes(task.status);
  const percent = task.progress?.percent;

  const statusLabel = () => {
    switch (task.status) {
      case 'queued':
        return t('download.queued', 'Queued');
      case 'downloading':
        return t('download.downloading', 'Downloading');
      case 'processing':
        return t('download.converting', 'Converting');
      case 'completed':
        return t('download.completed', 'Completed');
      case 'failed':
        return t('download.error', 'Failed');
      case 'cancelled':
        return t('download.cancelled', 'Cancelled');
      default:
        return task.status;
    }
  };

  const tone =
    task.status === 'failed' ? 'danger' : task.status === 'completed' ? 'success' : 'accent';

  return (
    <Card className={`job job--${task.status}`}>
      <CardBody>
        <div className="job__head">
          <div className="job__identity">
            <Badge tone={tone}>
              {task.mode === 'video' ? t('mode.video', 'Video') : t('mode.audio', 'Audio')}
            </Badge>
            <p className="job__title truncate selectable" title={task.title || task.url}>
              {task.title || task.url}
            </p>
          </div>

          {isActive && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => onCancel(task.id)}
              aria-label={t('common.cancel', 'Cancel')}
              title={t('common.cancel', 'Cancel')}
            >
              <FiX />
            </Button>
          )}
        </div>

        {task.status === 'completed' ? (
          <Alert tone="success" icon={<FiCheckCircle aria-hidden />}>
            {t('download.completedMessage', 'Saved to your output folder.')}
          </Alert>
        ) : task.status === 'failed' ? (
          <Alert tone="danger" icon={<FiAlertCircle aria-hidden />}>
            {task.error || t('download.error', 'Failed')}
          </Alert>
        ) : task.status === 'cancelled' ? (
          <Alert tone="info">{t('download.cancelledMessage', 'Cancelled.')}</Alert>
        ) : (
          <ProgressBar
            // `processing` (ffmpeg remux) emits no percent — an indeterminate
            // sweep is honest about that, a frozen 0% bar is not.
            percent={task.status === 'processing' ? undefined : (percent ?? 0)}
            label={statusLabel()}
            left={
              <span className="job__status">
                <FiDownload aria-hidden /> {statusLabel()}
              </span>
            }
            right={
              task.status === 'downloading' && task.progress ? (
                <>
                  {(percent ?? 0).toFixed(0)}% · {task.progress.speed} ·{' '}
                  {t('download.eta', 'ETA')} {task.progress.eta}
                </>
              ) : null
            }
          />
        )}
      </CardBody>
    </Card>
  );
};
