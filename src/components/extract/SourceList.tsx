import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiHardDrive, FiMusic, FiX } from 'react-icons/fi';
import { SiFacebook, SiTiktok, SiYoutube } from 'react-icons/si';
import { Badge, Button, Card, CardBody, CardHeader } from '../ui';
import { VideoInfo } from '../../types';
import { formatDuration } from '../../utils/formatUtils';
import './SourceList.css';

interface SourceListProps {
  items: VideoInfo[];
  isPlaylist: boolean;
  onClear: () => void;
  /** Disabled while a job is running, so the source can't change mid-extract. */
  busy?: boolean;
}

/** Platforms spell themselves a particular way; `text-transform: capitalize`
 *  turns "youtube" into "Youtube". Look the label up instead. */
const PLATFORMS: Record<string, { label: string; icon: React.ReactNode }> = {
  youtube: { label: 'YouTube', icon: <SiYoutube aria-hidden /> },
  facebook: { label: 'Facebook', icon: <SiFacebook aria-hidden /> },
  tiktok: { label: 'TikTok', icon: <SiTiktok aria-hidden /> },
  local: { label: '', icon: <FiHardDrive aria-hidden /> },
};

const describePlatform = (platform: string) => {
  const key = Object.keys(PLATFORMS).find((k) => platform.toLowerCase().includes(k));
  if (key) return PLATFORMS[key];
  return { label: platform, icon: <FiMusic aria-hidden /> };
};

export const SourceList: React.FC<SourceListProps> = ({
  items,
  isPlaylist,
  onClear,
  busy,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="source-list">
      <CardHeader
        title={isPlaylist ? t('source.playlistTitle', 'Playlist') : t('source.sourceTitle', 'Source')}
        icon={<FiMusic aria-hidden />}
        actions={
          <div className="source-list__header-actions">
            {isPlaylist && (
              <Badge tone="accent">
                {t('source.itemCount', '{{count}} items', { count: items.length })}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onClear}
              disabled={busy}
              aria-label={t('source.clear', 'Remove source')}
              title={t('source.clear', 'Remove source')}
            >
              <FiX />
            </Button>
          </div>
        }
      />

      <CardBody tight>
        <ul className="source-list__items">
          {items.map((item, index) => (
            <li className="source-item" key={`${item.id}-${index}`}>
              <div className="source-item__thumb">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <span className="source-item__thumb-fallback" aria-hidden>
                    <FiMusic />
                  </span>
                )}
                {item.duration > 0 && (
                  <span className="source-item__duration tabular">
                    {formatDuration(item.duration)}
                  </span>
                )}
              </div>

              <div className="source-item__text">
                <p className="source-item__title truncate selectable" title={item.title}>
                  {item.title}
                </p>
                <p className="source-item__meta truncate">
                  <span className="source-item__platform">
                    {describePlatform(item.platform).icon}
                    {describePlatform(item.platform).label ||
                      t('source.localFile', 'This computer')}
                  </span>
                  {item.uploader && <span aria-hidden>·</span>}
                  {item.uploader && <span>{item.uploader}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
};
