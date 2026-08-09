import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
// Assume SUPPORTED_FORMATS and QUALITY_PRESETS are exported from types
// If not available, use fallbacks
import './FormatPicker.css';

interface FormatPickerProps {
  selectedFormat: string;
  selectedQuality: string;
  onFormatChange: (format: string) => void;
  onQualityChange: (quality: string) => void;
  duration?: number;
}

const SUPPORTED_FORMATS = ['MP3', 'FLAC', 'WAV', 'M4A', 'Opus', 'AAC'];
const QUALITY_PRESETS = ['Best', 'High', 'Standard', 'Low'];

export const FormatPicker: React.FC<FormatPickerProps> = ({
  selectedFormat,
  selectedQuality,
  onFormatChange,
  onQualityChange,
  duration: _duration
}) => {
  const { t } = useTranslation();

  return (
    <div className="format-picker-container glass-panel">
      <div className="section-title">
        <h4>{t('formatPicker.format', 'Audio Format')}</h4>
      </div>
      <div className="format-grid">
        {SUPPORTED_FORMATS.map((format) => {
          const isSelected = selectedFormat === format;
          return (
            <motion.div
              key={format}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`format-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onFormatChange(format)}
            >
              <span className="format-name">{format}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="section-title quality-title">
        <h4>{t('formatPicker.quality', 'Audio Quality')}</h4>
      </div>
      <div className="quality-segmented-control">
        {QUALITY_PRESETS.map((quality) => {
          const isSelected = selectedQuality === quality;
          return (
            <div
              key={quality}
              className={`quality-option ${isSelected ? 'selected' : ''}`}
              onClick={() => onQualityChange(quality)}
            >
              {quality}
            </div>
          );
        })}
      </div>
    </div>
  );
};
