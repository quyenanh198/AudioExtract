import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { FiPlay, FiPause, FiMaximize } from 'react-icons/fi';
import './AudioTrimmer.css';

interface AudioTrimmerProps {
  audioUrl: string | null;
  duration: number;
  onTrimChange: (start: number | undefined, end: number | undefined) => void;
  onDurationLoaded?: (duration: number) => void;
}

export const AudioTrimmer: React.FC<AudioTrimmerProps> = ({ audioUrl, duration, onTrimChange, onDurationLoaded }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [useFullTrack, setUseFullTrack] = useState(true);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255, 255, 255, 0.4)',
      progressColor: 'var(--color-accent)',
      cursorColor: 'var(--color-accent)',
      height: 100,
      normalize: true,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());

    wavesurferRef.current = ws;
    regionsRef.current = regions;

    ws.load(audioUrl);

    ws.on('ready', () => {
      const dur = ws.getDuration();
      if (onDurationLoaded) {
        onDurationLoaded(dur);
      }
      if (!useFullTrack) {
        regions.addRegion({
          start: startTime,
          end: endTime,
          color: 'rgba(var(--color-accent-rgb), 0.3)',
          drag: true,
          resize: true,
        });
      }
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    regions.on('region-updated', (region) => {
      setStartTime(region.start);
      setEndTime(region.end);
      onTrimChange(region.start, region.end);
    });

    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(zoom * 50);
    }
  }, [zoom]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleUseFullTrackToggle = () => {
    const newValue = !useFullTrack;
    setUseFullTrack(newValue);
    
    if (newValue) {
      regionsRef.current?.clearRegions();
      onTrimChange(undefined, undefined);
    } else {
      regionsRef.current?.addRegion({
        start: 0,
        end: duration > 30 ? 30 : duration,
        color: 'rgba(255, 100, 100, 0.3)',
        drag: true,
        resize: true,
      });
      setStartTime(0);
      setEndTime(duration > 30 ? 30 : duration);
      onTrimChange(0, duration > 30 ? 30 : duration);
    }
  };

  return (
    <div className="audio-trimmer-container glass-panel">
      <div className="trimmer-header">
        <h4>{t('trimmer.title', 'Audio Trimmer')}</h4>
        <div className="full-track-toggle">
          <label>
            <input 
              type="checkbox" 
              checked={useFullTrack} 
              onChange={handleUseFullTrackToggle} 
            />
            {t('trimmer.useFullTrack', 'Use Full Track')}
          </label>
        </div>
      </div>

      <div className={`waveform-container ${useFullTrack ? 'disabled' : ''}`}>
        <div ref={containerRef} className="waveform" />
      </div>

      <div className="trimmer-controls">
        <button className="btn-primary play-btn" onClick={togglePlay} disabled={!audioUrl}>
          {isPlaying ? <FiPause /> : <FiPlay />}
        </button>

        <div className="time-inputs">
          <div className="time-input-group">
            <label>{t('trimmer.start', 'Start')}</label>
            <input 
              type="number" 
              className="input-field" 
              value={startTime.toFixed(2)} 
              disabled={useFullTrack}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) setStartTime(val);
              }}
            />
          </div>
          <div className="time-input-group">
            <label>{t('trimmer.end', 'End')}</label>
            <input 
              type="number" 
              className="input-field" 
              value={endTime.toFixed(2)} 
              disabled={useFullTrack}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) setEndTime(val);
              }}
            />
          </div>
        </div>

        <div className="zoom-control">
          <FiMaximize />
          <input 
            type="range" 
            min="1" 
            max="10" 
            value={zoom} 
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
};
