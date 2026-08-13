import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { FiFolder, FiInbox, FiSearch, FiTrash2 } from 'react-icons/fi';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
} from './ui';
import { useDownloadStore } from '../store/downloadStore';
import { formatFileSize } from '../utils/formatUtils';
import './DownloadHistory.css';

export const DownloadHistory: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { history, removeFromHistory, clearHistory } = useDownloadStore();
  const [query, setQuery] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return history;
    return history.filter((item) => item.title.toLowerCase().includes(needle));
  }, [history, query]);

  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat(i18n?.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));

  const openFolder = async (path: string) => {
    try {
      await invoke('open_file_in_explorer', { path });
    } catch (error) {
      console.error('Could not open folder:', error);
    }
  };

  return (
    <Card className="history">
      <CardHeader
        title={t('history.title', 'Library')}
        actions={
          history.length > 0 && (
            <div className="history__actions">
              <div className="history__search">
                <FiSearch aria-hidden />
                <Input
                  type="search"
                  value={query}
                  aria-label={t('common.search', 'Search')}
                  placeholder={t('common.search', 'Search')}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Inline confirm rather than window.confirm(): a native modal
                  in a Tauri webview blocks the whole window and can't be
                  styled or reliably dismissed with Escape across platforms. */}
              {confirmingClear ? (
                <div className="history__confirm">
                  <span>{t('history.clearConfirm', 'Clear everything?')}</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      clearHistory();
                      setConfirmingClear(false);
                    }}
                  >
                    {t('common.confirm', 'Clear')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(false)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(true)}>
                  <FiTrash2 />
                  {t('history.clear', 'Clear all')}
                </Button>
              )}
            </div>
          )
        }
      />

      <CardBody tight>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FiInbox />}
            title={
              history.length === 0
                ? t('history.empty', 'Nothing here yet')
                : t('history.noMatches', 'No matches')
            }
            description={
              history.length === 0
                ? t('history.emptyHint', 'Files you extract will be listed here.')
                : t('history.noMatchesHint', 'Try a different search term.')
            }
          />
        ) : (
          <ul className="history__list">
            {filtered.map((item) => (
              <li className="history-item" key={item.id}>
                <div className="history-item__text">
                  <p className="history-item__title truncate selectable" title={item.title}>
                    {item.title}
                  </p>
                  <div className="history-item__meta">
                    <Badge tone={item.mode === 'video' ? 'neutral' : 'accent'}>
                      {item.mode === 'video'
                        ? t('mode.video', 'Video')
                        : t('mode.audio', 'Audio')}
                    </Badge>
                    {item.fileSize > 0 && <span>{formatFileSize(item.fileSize)}</span>}
                    <span>{formatDate(item.completedAt)}</span>
                  </div>
                </div>

                <div className="history-item__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => openFolder(item.outputPath)}
                    aria-label={t('history.openFolder', 'Open folder')}
                    title={t('history.openFolder', 'Open folder')}
                  >
                    <FiFolder />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    className="history-item__delete"
                    onClick={() => removeFromHistory(item.id)}
                    aria-label={t('history.delete', 'Remove from library')}
                    title={t('history.delete', 'Remove from library')}
                  >
                    <FiTrash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
};
