import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoInfo as VideoInfoType } from '../types';
import { SiYoutube, SiFacebook, SiTiktok } from 'react-icons/si';
import { FiClock, FiUser } from 'react-icons/fi';
import './VideoInfo.css';

interface VideoInfoProps {
  videoInfo: VideoInfoType | null;
  isLoading: boolean;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const VideoInfo: React.FC<VideoInfoProps> = ({ videoInfo, isLoading }) => {
  useTranslation();

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'youtube': return <SiYoutube color="#ff0000" />;
      case 'facebook': return <SiFacebook color="#1877f2" />;
      case 'tiktok': return <SiTiktok color="var(--color-text-primary)" />;
      default: return null;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div 
          key="skeleton"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="video-info-container card skeleton-card"
        >
          <div className="skeleton-thumbnail" />
          <div className="skeleton-details">
            <div className="skeleton-line title" />
            <div className="skeleton-line short" />
            <div className="skeleton-line short" />
          </div>
        </motion.div>
      ) : videoInfo ? (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="video-info-container card"
        >
          <div className="video-thumbnail-wrapper">
            <img src={videoInfo.thumbnailUrl} alt={videoInfo.title} className="video-thumbnail" />
            <div className="platform-badge">
              {getPlatformIcon(videoInfo.platform)}
              <span>{videoInfo.platform}</span>
            </div>
          </div>
          
          <div className="video-details">
            <h3 className="video-title text-gradient">{videoInfo.title}</h3>
            
            <div className="video-meta">
              <div className="meta-item badge">
                <FiUser />
                <span>{videoInfo.uploader}</span>
              </div>
              <div className="meta-item badge">
                <FiClock />
                <span>{formatDuration(videoInfo.duration)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
