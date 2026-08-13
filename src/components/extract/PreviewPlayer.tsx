import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiFolder,
  FiPause,
  FiPlay,
  FiRepeat,
  FiVolume2,
  FiVolumeX,
} from 'react-icons/fi';
import { Button, Card, CardBody, Range, Select } from '../ui';
import { formatDuration } from '../../utils/formatUtils';
import './PreviewPlayer.css';

interface PreviewPlayerProps {
  src: string;
  title: string;
  onOpenFolder?: () => void;
}

const SPEEDS = ['0.5', '0.75', '1', '1.25', '1.5', '2'];

/**
 * Preview of the file that was just produced.
 *
 * Rewritten from the old player, which rendered Skip-back / Skip-forward /
 * overflow buttons wired to nothing and showed elapsed time as static text
 * with no way to seek. Here the transport is the seek bar, and every control
 * present does something.
 */
export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  src,
  title,
  onOpenFolder,
}) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState('1');

  // A new source means a fresh track: reset transport state so the previous
  // file's position isn't shown against the new one.
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch((err) => console.error('Preview playback failed:', err));
    } else {
      audio.pause();
    }
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrent(seconds);
  };

  const applyVolume = (next: number) => {
    const audio = audioRef.current;
    setVolume(next);
    if (!audio) return;
    audio.volume = next;
    // Dragging the slider off zero should un-mute; dragging to zero mutes.
    const nextMuted = next === 0;
    audio.muted = nextMuted;
    setMuted(nextMuted);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
  };

  const progressMax = duration || 0;

  return (
    <Card className="player">
      <CardBody>
        <audio ref={audioRef} src={src} loop={loop} preload="metadata" />

        <div className="player__top">
          <div className="player__labels">
            <p className="player__eyebrow">{t('player.title', 'Preview')}</p>
            <p className="player__name truncate selectable" title={title}>
              {title}
            </p>
          </div>

          {onOpenFolder && (
            <Button variant="secondary" size="sm" onClick={onOpenFolder}>
              <FiFolder />
              {t('history.openFolder', 'Open folder')}
            </Button>
          )}
        </div>

        <div className="player__transport">
          <Button
            variant="primary"
            iconOnly
            className="player__play"
            onClick={togglePlay}
            aria-label={playing ? t('player.pause', 'Pause') : t('player.play', 'Play')}
          >
            {playing ? <FiPause /> : <FiPlay />}
          </Button>

          <span className="player__time tabular">{formatDuration(current)}</span>

          <Range
            className="player__seek"
            min={0}
            max={progressMax || 1}
            step={0.1}
            value={current}
            disabled={progressMax === 0}
            aria-label={t('player.seek', 'Seek')}
            aria-valuetext={`${formatDuration(current)} / ${formatDuration(progressMax)}`}
            onChange={(e) => seek(Number(e.target.value))}
          />

          <span className="player__time player__time--muted tabular">
            {formatDuration(progressMax)}
          </span>
        </div>

        <div className="player__controls">
          <div className="player__volume">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={toggleMute}
              aria-label={muted ? t('player.unmute', 'Unmute') : t('player.mute', 'Mute')}
            >
              {muted ? <FiVolumeX /> : <FiVolume2 />}
            </Button>
            <Range
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label={t('player.volume', 'Volume')}
              onChange={(e) => applyVolume(Number(e.target.value))}
            />
          </div>

          <div className="player__right">
            <Button
              variant={loop ? 'secondary' : 'ghost'}
              size="sm"
              iconOnly
              aria-pressed={loop}
              onClick={() => setLoop(!loop)}
              aria-label={t('player.loop', 'Loop')}
              title={t('player.loop', 'Loop')}
            >
              <FiRepeat />
            </Button>

            <Select
              className="player__speed"
              value={speed}
              aria-label={t('player.speed', 'Playback speed')}
              onChange={(e) => {
                setSpeed(e.target.value);
                if (audioRef.current) {
                  audioRef.current.playbackRate = parseFloat(e.target.value);
                }
              }}
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </Select>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
