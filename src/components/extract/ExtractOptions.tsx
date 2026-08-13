import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiDownload, FiFilm, FiMusic, FiScissors, FiSliders } from 'react-icons/fi';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Range,
  SegmentedControl,
  Select,
} from '../ui';
import { TimecodeInput } from '../ui/TimecodeInput';
import { formatDuration, formatFileSize } from '../../utils/formatUtils';
import './ExtractOptions.css';

export type MediaMode = 'audio' | 'video';

/** Formats whose bitrate is not user-selectable. */
const LOSSLESS_FORMATS = ['FLAC', 'WAV'];
const AUDIO_FORMATS = ['MP3', 'FLAC', 'WAV', 'M4A', 'Opus'];

/** Slider stops, ordered — index is the slider value. */
const QUALITY_STEPS = ['64', '128', '192', '320'] as const;

export interface ExtractOptionsProps {
  mode: MediaMode;
  onModeChange: (mode: MediaMode) => void;
  /** Mode is only meaningful for remote URLs; local files are always audio. */
  modeAvailable: boolean;

  format: string;
  onFormatChange: (format: string) => void;
  quality: string;
  onQualityChange: (quality: string) => void;

  trimEnabled: boolean;
  onTrimEnabledChange: (enabled: boolean) => void;
  /** Trimming only runs for local files — see ExtractPage. */
  trimAvailable: boolean;
  startTime: number;
  endTime: number;
  onStartTimeChange: (seconds: number) => void;
  onEndTimeChange: (seconds: number) => void;
  duration: number;

  /** No source loaded yet — the whole panel is inert. */
  disabled: boolean;
  /** A job is in flight. */
  busy: boolean;
  onSubmit: () => void;
}

export const ExtractOptions: React.FC<ExtractOptionsProps> = ({
  mode,
  onModeChange,
  modeAvailable,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  trimEnabled,
  onTrimEnabledChange,
  trimAvailable,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  duration,
  disabled,
  busy,
  onSubmit,
}) => {
  const { t } = useTranslation();
  // Kept separate rather than one shared error: each TimecodeInput reports
  // its own validity on every commit (including a plain re-commit of an
  // already-valid draft), so a single shared setter let the valid field's
  // "I'm fine" clobber the invalid field's still-active error.
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const timeError = startTimeError || endTimeError;

  const isAudio = mode === 'audio';
  const isLossless = LOSSLESS_FORMATS.includes(format);
  const showQuality = isAudio && !isLossless;

  /** Trim range is only invalid once the user has actually enabled trimming. */
  const rangeInvalid = trimEnabled && endTime <= startTime;

  const effectiveDuration = trimEnabled ? Math.max(0, endTime - startTime) : duration;

  const estimatedSize = useMemo(() => {
    if (!isAudio || isLossless || effectiveDuration <= 0) return null;
    const kbps = parseInt(quality, 10) || 192;
    return formatFileSize((kbps * 1000 * effectiveDuration) / 8);
  }, [isAudio, isLossless, quality, effectiveDuration]);

  const canSubmit = !disabled && !busy && !rangeInvalid && !timeError;

  return (
    <aside className="options" aria-label={t('options.title', 'Output options')}>
      <header className="options__header">
        <FiSliders aria-hidden />
        <h3>{t('options.title', 'Output options')}</h3>
      </header>

      <div className="options__scroll">
        {modeAvailable && (
          <Field label={t('options.mode', 'Mode')} as="group" disabled={disabled}>
            {() => (
              <SegmentedControl<MediaMode>
                block
                aria-label={t('options.mode', 'Mode')}
                value={mode}
                onChange={onModeChange}
                options={[
                  {
                    value: 'audio',
                    label: t('mode.audio', 'Audio'),
                    icon: <FiMusic aria-hidden />,
                    disabled,
                  },
                  {
                    value: 'video',
                    label: t('mode.video', 'Video'),
                    icon: <FiFilm aria-hidden />,
                    disabled,
                  },
                ]}
              />
            )}
          </Field>
        )}

        {isAudio && (
          <Field label={t('formatPicker.format', 'Format')} disabled={disabled}>
            {(id) => (
              <Select
                id={id}
                value={format}
                disabled={disabled}
                onChange={(e) => onFormatChange(e.target.value)}
              >
                {AUDIO_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {isAudio && isLossless && (
          <p className="options__note">
            {t('options.losslessNote', 'Lossless format — bitrate is fixed by the source.')}
          </p>
        )}

        {showQuality && (
          <Field
            label={t('formatPicker.quality', 'Quality')}
            value={`${quality} kbps`}
            as="group"
            disabled={disabled}
          >
            {() => (
              <>
                <Range
                  min={0}
                  max={QUALITY_STEPS.length - 1}
                  step={1}
                  disabled={disabled}
                  aria-label={t('formatPicker.quality', 'Quality')}
                  aria-valuetext={`${quality} kbps`}
                  value={Math.max(0, QUALITY_STEPS.indexOf(quality as never))}
                  onChange={(e) => onQualityChange(QUALITY_STEPS[Number(e.target.value)])}
                />
                <div className="ui-range__scale" aria-hidden>
                  {QUALITY_STEPS.map((step) => (
                    <span key={step}>{step}</span>
                  ))}
                </div>
              </>
            )}
          </Field>
        )}

        <div className="options__section">
          <div className="options__section-head">
            <span className="options__section-title">
              <FiScissors aria-hidden />
              {t('trimmer.title', 'Trim')}
            </span>
            <Checkbox
              checked={trimEnabled}
              disabled={disabled || !trimAvailable}
              onChange={(checked) => {
                onTrimEnabledChange(checked);
                if (checked && endTime <= startTime && duration > 0) onEndTimeChange(duration);
              }}
            >
              {t('trimmer.enable', 'Trim range')}
            </Checkbox>
          </div>

          {!trimAvailable && (
            <p className="options__note">
              {t(
                'trimmer.localOnly',
                'Trimming applies to local files. Downloads are saved in full.',
              )}
            </p>
          )}

          {/* Rendered only when trimming can actually run — a pair of
              permanently greyed-out time fields is noise, not information. */}
          {trimAvailable && duration > 0 && (
            <p className="options__note">
              {t('trimmer.sourceLength', 'Source length')}: {formatDuration(duration)}
            </p>
          )}

          {trimAvailable && (
          <div className="options__trim-grid">
            <Field
              label={t('trimmer.start', 'Start')}
              disabled={!trimEnabled || disabled}
            >
              {(id) => (
                <TimecodeInput
                  id={id}
                  value={startTime}
                  max={duration || undefined}
                  disabled={!trimEnabled || disabled}
                  onChange={onStartTimeChange}
                  onValidityChange={setStartTimeError}
                  invalidMessage={t('trimmer.invalid', 'Use mm:ss')}
                  aria-label={t('trimmer.start', 'Start')}
                />
              )}
            </Field>

            <Field label={t('trimmer.end', 'End')} disabled={!trimEnabled || disabled}>
              {(id) => (
                <TimecodeInput
                  id={id}
                  value={endTime}
                  max={duration || undefined}
                  disabled={!trimEnabled || disabled}
                  onChange={onEndTimeChange}
                  onValidityChange={setEndTimeError}
                  invalidMessage={t('trimmer.invalid', 'Use mm:ss')}
                  aria-label={t('trimmer.end', 'End')}
                />
              )}
            </Field>
          </div>
          )}

          {rangeInvalid && (
            <Alert tone="danger">
              {t('trimmer.rangeError', 'End time must come after start time.')}
            </Alert>
          )}
        </div>
      </div>

      <footer className="options__footer">
        {estimatedSize && (
          <dl className="options__summary">
            <div>
              <dt>{t('options.length', 'Length')}</dt>
              <dd className="tabular">{formatDuration(effectiveDuration)}</dd>
            </div>
            <div>
              <dt>{t('options.estimatedSize', 'Est. size')}</dt>
              <dd className="tabular">{estimatedSize}</dd>
            </div>
          </dl>
        )}

        <Button
          variant="primary"
          size="lg"
          block
          data-testid="submit-media-btn"
          loading={busy}
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          <FiDownload />
          {mode === 'video'
            ? t('extract.videoButton', 'Download Video')
            : t('extract.audioButton', 'Extract Audio')}
        </Button>
      </footer>
    </aside>
  );
};
