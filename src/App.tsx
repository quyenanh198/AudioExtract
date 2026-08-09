import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiHome, FiClock, FiSettings, FiDownload } from 'react-icons/fi';
import { URLInput } from './components/URLInput';
import { VideoInfo } from './components/VideoInfo';
import { FormatPicker } from './components/FormatPicker';
import { AudioTrimmer } from './components/AudioTrimmer';
import { DownloadQueue } from './components/DownloadQueue';
import { DownloadHistory } from './components/DownloadHistory';
import { SettingsPanel } from './components/SettingsPanel';
import { useSettings } from './hooks/useSettings';
import { useDownload } from './hooks/useDownload';
import { useTauriEvents } from './hooks/useTauriEvents';
import { VideoInfo as VideoInfoType } from './types';
import './index.css';
import './App.css';

type PageState = 'home' | 'history' | 'settings';

export default function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<PageState>('home');
  const { settings } = useSettings();
  const { fetchVideoInfo, startDownload } = useDownload();
  
  // Initialize events
  useTauriEvents();

  const [videoInfo, setVideoInfo] = useState<VideoInfoType | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  
  const [selectedFormat, setSelectedFormat] = useState(settings?.defaultFormat || 'MP3');
  const [selectedQuality, setSelectedQuality] = useState(settings?.defaultQuality || 'Best');
  
  const [_trimStart, setTrimStart] = useState<number | undefined>();
  const [_trimEnd, setTrimEnd] = useState<number | undefined>();

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setSelectedFormat(settings.defaultFormat);
      setSelectedQuality(settings.defaultQuality);
    }
  }, [settings]);

  const onUrlSubmit = async (url: string) => {
    setCurrentUrl(url);
    setIsLoadingInfo(true);
    setVideoInfo(null);
    try {
      const info = await fetchVideoInfo(url);
      setVideoInfo(info);
    } catch (error) {
      console.error("Failed to fetch info", error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const executeDownload = () => {
    if (!videoInfo || !currentUrl) return;
    startDownload({
      url: currentUrl,
      format: selectedFormat,
      quality: selectedQuality,
      outputDir: settings.outputDir,
    });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="page-content home-page"
          >
            <URLInput onUrlSubmit={onUrlSubmit} isLoading={isLoadingInfo} />
            
            {(videoInfo || isLoadingInfo) && (
              <VideoInfo videoInfo={videoInfo} isLoading={isLoadingInfo} />
            )}
            
            {videoInfo && (
              <>
                <FormatPicker 
                  selectedFormat={selectedFormat}
                  selectedQuality={selectedQuality}
                  onFormatChange={setSelectedFormat}
                  onQualityChange={setSelectedQuality}
                  duration={videoInfo.duration}
                />
                
                <AudioTrimmer 
                  audioUrl={null}
                  duration={videoInfo.duration}
                  onTrimChange={(start, end) => {
                    setTrimStart(start);
                    setTrimEnd(end);
                  }}
                />
                
                <button 
                  className="btn-primary start-download-btn full-width"
                  onClick={executeDownload}
                >
                  <FiDownload /> {t('common.startDownload', 'Start Download')}
                </button>
              </>
            )}
            
            <DownloadQueue />
          </motion.div>
        );
      case 'history':
        return (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="page-content"
          >
            <DownloadHistory />
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="page-content"
          >
            <SettingsPanel />
          </motion.div>
        );
    }
  };

  return (
    <div className="app-layout">
      <aside className="sidebar glass-panel">
        <div className="logo-container">
          <h2 className="text-gradient">AudioExtract</h2>
        </div>
        <nav className="nav-menu">
          <button 
            className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentPage('home')}
          >
            <FiHome /> <span>{t('nav.home', 'Home')}</span>
          </button>
          <button 
            className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentPage('history')}
          >
            <FiClock /> <span>{t('nav.history', 'History')}</span>
          </button>
          <button 
            className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
          >
            <FiSettings /> <span>{t('nav.settings', 'Settings')}</span>
          </button>
        </nav>
      </aside>
      
      <main className="main-content">
        <header className="top-header">
          <h1>
            {currentPage === 'home' && t('nav.home', 'Home')}
            {currentPage === 'history' && t('nav.history', 'History')}
            {currentPage === 'settings' && t('nav.settings', 'Settings')}
          </h1>
        </header>
        <div className="content-scroll-area">
          <AnimatePresence mode="wait">
            {renderPage()}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
