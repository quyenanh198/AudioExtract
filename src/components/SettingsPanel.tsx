import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheck, FiFolder, FiSave } from 'react-icons/fi';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  SegmentedControl,
  Select,
  Toggle,
} from './ui';
import { useSettings } from '../hooks/useSettings';
import { AppSettings } from '../types';
import './SettingsPanel.css';

const FORMATS = ['MP3', 'FLAC', 'WAV', 'M4A', 'Opus'];
const QUALITY_PRESETS = [
  { value: '320k', labelKey: 'quality.best', fallback: 'Best — 320 kbps' },
  { value: '192k', labelKey: 'quality.high', fallback: 'High — 192 kbps' },
  { value: '128k', labelKey: 'quality.standard', fallback: 'Standard — 128 kbps' },
  { value: '64k', labelKey: 'quality.low', fallback: 'Low — 64 kbps' },
];

export const SettingsPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings, selectOutputDir } = useSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const patch = (updates: Partial<AppSettings>) =>
    setDraft((current) => ({ ...current, ...updates }));

  const handleSave = () => {
    updateSettings(draft);
    // Language is applied here as well as stored. Previously the picker only
    // wrote to the store and nothing ever fed it back into i18next, so
    // switching language changed nothing — not even after a restart.
    if (draft.language && i18n?.language !== draft.language) {
      void i18n?.changeLanguage?.(draft.language);
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="settings">
      <CardHeader title={t('settings.title', 'Settings')} />

      <CardBody className="settings__body">
        <Field
          label={t('settings.outputDir', 'Output folder')}
          hint={t('settings.outputDirHint', 'Where finished files are saved.')}
        >
          {(id) => (
            <div className="ui-input-group">
              <Input
                id={id}
                value={draft.outputDir}
                spellCheck={false}
                onChange={(e) => patch({ outputDir: e.target.value })}
              />
              <Button variant="secondary" onClick={selectOutputDir}>
                <FiFolder />
                {t('settings.browse', 'Browse')}
              </Button>
            </div>
          )}
        </Field>

        <div className="settings__row">
          <Field label={t('settings.defaultFormat', 'Default format')}>
            {(id) => (
              <Select
                id={id}
                value={draft.defaultFormat.toUpperCase()}
                onChange={(e) => patch({ defaultFormat: e.target.value.toLowerCase() })}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t('settings.defaultQuality', 'Default quality')}>
            {(id) => (
              <Select
                id={id}
                value={draft.defaultQuality}
                onChange={(e) => patch({ defaultQuality: e.target.value })}
              >
                {QUALITY_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {t(preset.labelKey, preset.fallback)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="settings__row">
          <Field label={t('settings.theme', 'Theme')} as="group">
            {() => (
              <SegmentedControl<'dark' | 'light' | 'system'>
                block
                aria-label={t('settings.theme', 'Theme')}
                value={draft.theme}
                onChange={(theme) => patch({ theme })}
                options={[
                  { value: 'dark', label: t('theme.dark', 'Dark') },
                  { value: 'light', label: t('theme.light', 'Light') },
                  { value: 'system', label: t('theme.system', 'System') },
                ]}
              />
            )}
          </Field>

          <Field label={t('settings.language', 'Language')} as="group">
            {() => (
              <SegmentedControl<'vi' | 'en'>
                block
                aria-label={t('settings.language', 'Language')}
                value={draft.language}
                onChange={(language) => patch({ language })}
                options={[
                  { value: 'vi', label: 'Tiếng Việt' },
                  { value: 'en', label: 'English' },
                ]}
              />
            )}
          </Field>
        </div>

        <div className="settings__row">
          <Field
            label={t('settings.concurrent', 'Concurrent downloads')}
            hint={t('settings.concurrentHint', 'How many playlist items run at once.')}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={5}
                value={draft.concurrentDownloads}
                onChange={(e) =>
                  patch({
                    concurrentDownloads: Math.min(
                      5,
                      Math.max(1, parseInt(e.target.value, 10) || 1),
                    ),
                  })
                }
              />
            )}
          </Field>

          <div className="settings__toggle">
            <Toggle
              label={t('settings.autoUpdate', 'Auto-update yt-dlp')}
              checked={draft.autoUpdate}
              onChange={(autoUpdate) => patch({ autoUpdate })}
            />
            <p className="settings__hint">
              {t('settings.autoUpdateHint', 'Keeps downloads working when sites change.')}
            </p>
          </div>
        </div>
      </CardBody>

      <div className="settings__footer">
        <span className="settings__status" role="status">
          {saved
            ? t('common.saved', 'Saved')
            : dirty
              ? t('settings.unsaved', 'Unsaved changes')
              : ''}
        </span>
        <Button variant="primary" onClick={handleSave} disabled={!dirty}>
          {saved ? <FiCheck /> : <FiSave />}
          {t('common.save', 'Save changes')}
        </Button>
      </div>
    </Card>
  );
};
