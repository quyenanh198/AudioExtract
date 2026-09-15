import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiDownload, FiAlertCircle, FiVolume2, FiVolumeX, FiSkipBack, FiSkipForward, FiRepeat, FiMoreVertical, FiPlay, FiPause, FiCheck, FiX, FiSave, FiEdit2 } from 'react-icons/fi';
import { backend, LocalFile } from './platform';
import { SendToMusik } from './components/SendToMusik';
import { webExtras } from './platform/webExtras';

import { URLInput } from './components/URLInput';
import { DownloadHistory } from './components/DownloadHistory';
import { SettingsPanel } from './components/SettingsPanel';

import { useSettings } from './hooks/useSettings';
import { useDownload } from './hooks/useDownload';
import { useDownloadStore } from './store/downloadStore';
import { VideoInfo as VideoInfoType, DownloadProgress, DownloadTask } from './types';
import { formatDuration, formatFileSize } from './utils/formatUtils';
import { DEFAULT_SETTINGS } from './utils/constants';
import './index.css';
import './App.css';

type PageState = 'home' | 'history' | 'settings';

export default function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<PageState>('home');
  const { settings, updateSettings, initSettings } = useSettings();
  const { fetchVideoInfo, startDownload, trimAudio } = useDownload();
  const { addTask, updateTask, completeTask, failTask, updateHistoryItem } = useDownloadStore();

  const [videoInfo, setVideoInfo] = useState<VideoInfoType | null>(null);
  const [playlistItems, setPlaylistItems] = useState<VideoInfoType[] | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Input states
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);

  // Extraction options
  const [selectedFormat, setSelectedFormat] = useState('MP3');
  const [selectedQuality, setSelectedQuality] = useState('320');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Trimmer config
  const [useFullTrack, setUseFullTrack] = useState(true);

  // Active task state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<DownloadTask | null>(null);
  // Task ids for an in-flight playlist download, index-aligned with playlistItems
  const [batchTaskIds, setBatchTaskIds] = useState<string[] | null>(null);
  // 0 = first pass; n = nth retry pass over items that did not complete
  const [retryRound, setRetryRound] = useState(0);

  // Player preview states
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewVolume, setPreviewVolume] = useState(0.8);
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const [previewLoop, setPreviewLoop] = useState(false);
  const [previewSpeed, setPreviewSpeed] = useState('1.0');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync settings defaults
  useEffect(() => {
    initSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setSelectedFormat(settings.defaultFormat.toUpperCase());
      const q = settings.defaultQuality.toLowerCase();
      if (q.includes('320') || q.includes('best') || q === '0') {
        setSelectedQuality('320');
      } else if (q.includes('256')) {
        setSelectedQuality('320'); // Map to best/high
      } else if (q.includes('192') || q.includes('high') || q === '2') {
        setSelectedQuality('192');
      } else if (q.includes('128') || q.includes('standard') || q === '5') {
        setSelectedQuality('128');
      } else if (q.includes('64') || q.includes('low') || q === '8') {
        setSelectedQuality('64');
      } else {
        setSelectedQuality('320');
      }
    }
  }, [settings]);

  // Sync active task state
  const storeTasks = useDownloadStore((state) => state.tasks);
  useEffect(() => {
    if (activeTaskId) {
      const task = storeTasks.find(t => t.id === activeTaskId);
      if (task) {
        setCurrentTask(task);
        if (task.status === 'completed' && task.outputPath) {
          setPreviewAudioUrl(backend.fileUrl(task.outputPath));
          setPreviewDownloadUrl(backend.downloadUrl(task.outputPath));
        }
      }
    } else {
      setCurrentTask(null);
    }
  }, [storeTasks, activeTaskId]);

  const batchTasks = batchTaskIds?.map(id => storeTasks.find(t => t.id === id));
  const batchDone = batchTasks?.filter(t => t && (t.status === 'completed' || t.status === 'failed')).length ?? 0;

  // Sync Audio player timeline
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setPreviewCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPreviewPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [previewAudioUrl]);

  // Theme initializer
  useEffect(() => {
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  }, [settings.theme]);

  // Backend progress/finish events (Tauri events on desktop, SSE on the web)
  useEffect(() => {
    return backend.subscribe({
      onProgress: (taskId, progress: DownloadProgress) => {
        updateTask(taskId, { status: 'downloading', progress });
      },
      onFinished: (event) => {
        if (event.success) {
          completeTask(event.taskId, event.outputPath || "", event.fileSize || 0);
        } else {
          failTask(event.taskId, event.error || "Unknown error");
        }
      },
      onError: (taskId, error) => {
        failTask(taskId, error || "Error");
      },
    });
  }, [activeTaskId]);

  const handleUrlSubmit = async (url: string) => {
    setCurrentUrl(url);
    setLocalFilePath(null);
    setPreviewAudioUrl(null);
    setIsLoadingInfo(true);
    setVideoInfo(null);
    setErrorMsg(null);
    
    try {
      const infoList = await fetchVideoInfo(url);
      if (infoList.length > 1) {
        setPlaylistItems(infoList);
      } else {
        setPlaylistItems(null);
      }
      setVideoInfo(infoList[0]);
      setDuration(infoList[0].duration);
      setEndTime(infoList[0].duration);
      setStartTime(0);
      setUseFullTrack(true);
    } catch (error) {
      console.error("Failed to fetch info", error);
      setErrorMsg(`Không thể lấy thông tin. Lỗi: ${error}`);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleFileSelected = async (file: LocalFile) => {
    setLocalFilePath(file.path);
    setCurrentUrl('');
    setPreviewAudioUrl(null);
    setPreviewDownloadUrl(null);
    setVideoInfo(null);

    const name = file.name;
    
    // Create temporary videoInfo for local file preview
    setVideoInfo({
      id: file.path,
      title: name,
      duration: 0, 
      uploader: 'Local File',
      platform: 'local',
      thumbnailUrl: undefined
    });
  };


  const handleReset = () => {
    setVideoInfo(null);
    setCurrentUrl('');
    setLocalFilePath(null);
    setPreviewAudioUrl(null);
    setPreviewDownloadUrl(null);
    setActiveTaskId(null);
    setBatchTaskIds(null);
    setRetryRound(0);
    setStartTime(0);
    setEndTime(0);
    setDuration(0);
  };

  const handleExtractAudio = async () => {
    if (!videoInfo || (!currentUrl && !localFilePath)) return;

    const format = selectedFormat.toLowerCase();
    const qualityStr = selectedQuality === '320' ? '0' : selectedQuality === '192' ? '2' : '5';

    // 1. Process URL downloads
    if (currentUrl) {
      if (playlistItems && playlistItems.length > 1) {
        const taskIds = playlistItems.map(() => Math.random().toString(36).substring(7));
        playlistItems.forEach((item, i) => addTask({
          id: taskIds[i],
          url: item.originalUrl || currentUrl,
          title: item.title,
          status: 'queued',
          createdAt: Date.now()
        }));
        setBatchTaskIds(taskIds);

        // Bounded worker pool: each worker pulls the next index until none remain.
        // startDownload resolves only when yt-dlp exits, so at most
        // `concurrency` processes run at once.
        const runPass = async (indices: number[]) => {
          let next = 0;
          const worker = async () => {
            while (next < indices.length) {
              const i = indices[next++];
              updateTask(taskIds[i], { status: 'downloading' });
              try {
                await startDownload({
                  taskId: taskIds[i],
                  url: playlistItems[i].originalUrl || currentUrl,
                  format,
                  quality: qualityStr,
                  outputDir: settings.outputDir
                });
              } catch (err) {
                failTask(taskIds[i], String(err));
              }
            }
          };
          const concurrency = Math.min(Math.max(1, settings.concurrentDownloads || 1), indices.length);
          await Promise.all(Array.from({ length: concurrency }, worker));
        };

        // Items that did not complete are retried after the rest of the
        // playlist has been attempted, up to maxRetries extra passes.
        const maxRetries = settings.maxRetries ?? DEFAULT_SETTINGS.maxRetries;
        let pending = playlistItems.map((_, i) => i);
        for (let attempt = 0; attempt <= maxRetries && pending.length > 0; attempt++) {
          if (attempt > 0) {
            setRetryRound(attempt);
            pending.forEach(i => updateTask(taskIds[i], { status: 'queued', progress: undefined, error: undefined }));
          }
          await runPass(pending);
          const tasks = useDownloadStore.getState().tasks;
          pending = pending.filter(i => tasks.find(t => t.id === taskIds[i])?.status !== 'completed');
        }

        // Keep the list on screen when something failed so the errors stay visible.
        if (pending.length === 0) setTimeout(() => handleReset(), 2000);
        return;
      }

      const singleTaskId = Math.random().toString(36).substring(7);
      setActiveTaskId(singleTaskId);
      addTask({
        id: singleTaskId,
        url: currentUrl,
        title: videoInfo.title,
        status: 'queued',
        createdAt: Date.now()
      });

      try {
        updateTask(singleTaskId, { status: 'downloading' });
        await startDownload({
          taskId: singleTaskId,
          url: currentUrl,
          format,
          quality: qualityStr,
          outputDir: settings.outputDir
        });
        // Stay on this task: the progress card turns into the result (preview + download).
      } catch (err) {
        failTask(singleTaskId, err as string);
        setActiveTaskId(null);
      }
    } 
    // 2. Process Local File conversion/trimming
    else if (localFilePath) {
      const singleTaskId = Math.random().toString(36).substring(7);
      setActiveTaskId(singleTaskId);
      addTask({
        id: singleTaskId,
        url: localFilePath,
        title: videoInfo.title,
        status: 'queued',
        createdAt: Date.now()
      });

      try {
        updateTask(singleTaskId, { status: 'processing' });
        const name = videoInfo.title.substring(0, videoInfo.title.lastIndexOf('.')) || videoInfo.title;
        const outFileName = `${name}_extracted.${format}`;
        const finalOutPath = `${settings.outputDir}/${outFileName}`;

        const result = await trimAudio({
          inputPath: localFilePath,
          outputPath: finalOutPath,
          startTime: useFullTrack ? 0 : startTime,
          endTime: useFullTrack ? duration : endTime
        });

        // Local extraction completes immediately
        completeTask(singleTaskId, result.outputPath, result.fileSize || 1024 * 1024 * 15);
        setPreviewAudioUrl(backend.fileUrl(result.outputPath));
        setPreviewDownloadUrl(backend.downloadUrl(result.outputPath));
      } catch (err) {
        failTask(singleTaskId, err as string);
        setActiveTaskId(null);
      }
    }
  };

  // Web: rename the finished file (server + task + history row).
  const handleRenameResult = async (task: DownloadTask) => {
    if (!task.outputPath) return;
    const current = task.outputPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? task.title ?? '';
    const name = window.prompt(t('history.renamePrompt', 'New name'), current)?.trim();
    if (!name || name === current) return;
    try {
      const renamed = await webExtras.renameFile(task.outputPath, name);
      const title = renamed.name.replace(/\.[^.]+$/, '');
      updateTask(task.id, { outputPath: renamed.path, title });
      updateHistoryItem(task.id, { outputPath: renamed.path, title });
      setPreviewAudioUrl(backend.fileUrl(renamed.path));
      setPreviewDownloadUrl(backend.downloadUrl(renamed.path));
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  // Estimate file size: (bitrate * duration) / 8
  const getEstimatedSize = () => {
    const activeDuration = useFullTrack ? duration : (endTime - startTime);
    const kbps = parseInt(selectedQuality) || 192;
    const sizeInBytes = (kbps * 1000 * activeDuration) / 8;
    return formatFileSize(sizeInBytes);
  };

  // Preview Player actions
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().catch(e => console.error(e));
      setIsPreviewPlaying(true);
    }
  };

  const handleMuteVolume = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isPreviewMuted;
    setIsPreviewMuted(!isPreviewMuted);
  };

  const handleVolumeChange = (val: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = val;
    setPreviewVolume(val);
    if (val === 0) {
      setIsPreviewMuted(true);
    } else {
      setIsPreviewMuted(false);
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPreviewSpeed(val);
    if (audioRef.current) {
      audioRef.current.playbackRate = parseFloat(val);
    }
  };

  return (
    <div className="app-layout">
      {/* Top Navigation Header matching design screenshot */}
      <header className="app-header">
        <div className="logo-section">
          <div className="avatar" style={{ borderRadius: '8px' }}>🎙️</div>
          <span className="text-gradient">AudioExtract <span className="logo-pro">Pro</span></span>
        </div>
        
        <nav className="nav-tabs">
          <button className={`nav-tab ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setCurrentPage('home')}>
            {t('nav.home', 'Extract')}
          </button>
          <button className={`nav-tab ${currentPage === 'history' ? 'active' : ''}`} onClick={() => setCurrentPage('history')}>
            {t('nav.history', 'Library')}
          </button>
          <button className={`nav-tab ${currentPage === 'settings' ? 'active' : ''}`} onClick={() => setCurrentPage('settings')}>
            {t('nav.settings', 'Settings')}
          </button>
        </nav>

        <div className="header-right">
          <button 
            className="btn-ghost theme-toggle" 
            title="Toggle Theme"
            onClick={() => {
              const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
              updateSettings({ theme: newTheme });
              document.documentElement.setAttribute('data-theme', newTheme);
            }}
          >
            {settings.theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Page Body Router */}
      <div className="app-body">
        <AnimatePresence mode="wait">
          {currentPage === 'home' && (
            <motion.div 
              key="extract"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="extract-grid"
            >
              {/* Left Main column */}
              <div className="left-panel">
                
                {/* 1. If nothing loaded, show URL Dropzone */}
                {!videoInfo && (
                  <>
                    <URLInput 
                      onUrlSubmit={handleUrlSubmit} 
                      onFileSelected={handleFileSelected} 
                      isLoading={isLoadingInfo} 
                    />
                    {errorMsg && (
                      <div className="error-message glass-panel" style={{ color: 'var(--color-error)', padding: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(244, 63, 94, 0.2)', background: 'rgba(244, 63, 94, 0.05)', marginTop: '8px' }}>
                        <FiAlertCircle /> {errorMsg}
                      </div>
                    )}
                  </>
                )}

                {/* 2. Queue List View */}
                {videoInfo && (
                  <div className="imported-file-card glass-panel" style={{ padding: 'var(--spacing-md)', flex: 1, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                      <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                        Items in Queue ({(playlistItems || [videoInfo]).length})
                      </span>
                    </div>

                    <div className="queue-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(playlistItems || [videoInfo]).map((item, idx) => (
                        <div key={idx} style={{ 
                          padding: '12px', 
                          background: 'rgba(255,255,255,0.03)', 
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="thumbnail" style={{ width: '60px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} />
                          ) : (
                            <div style={{ width: '60px', height: '45px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               🎵
                            </div>
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontWeight: '500', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                              {formatDuration(item.duration)} • {item.platform} • {item.uploader}
                            </div>
                          </div>
                          {batchTasks?.[idx] && (
                            <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', color: batchTasks[idx]!.status === 'failed' ? 'var(--color-error)' : 'var(--color-accent)' }}>
                              {batchTasks[idx]!.status === 'queued' && 'Queued'}
                              {batchTasks[idx]!.status === 'downloading' && `${batchTasks[idx]!.progress?.percent ?? 0}%`}
                              {batchTasks[idx]!.status === 'completed' && <><FiCheck /> Done</>}
                              {batchTasks[idx]!.status === 'failed' && <><FiX /> Failed</>}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3a. Playlist progress panel */}
                {batchTasks && (
                  <div className="extraction-progress-card glass-panel" style={{ padding: 'var(--spacing-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                      <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiDownload /> Playlist Progress
                      </span>
                      <span style={{ color: 'var(--color-accent)' }}>
                        {retryRound > 0 && `Retry ${retryRound}/${settings.maxRetries ?? DEFAULT_SETTINGS.maxRetries} • `}
                        {batchDone} / {batchTasks.length}
                      </span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '12px 0' }}>
                      <div
                        style={{
                          width: `${(batchDone / batchTasks.length) * 100}%`,
                          background: 'linear-gradient(90deg, #059669, #10b981)',
                          height: '100%',
                          transition: 'width 0.2s'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {batchDone < batchTasks.length
                          ? `Downloading: ${batchTasks.filter(t => t?.status === 'downloading').map(t => t!.title).join(', ')}`
                          : 'Done!'}
                      </span>
                      {batchDone === batchTasks.length && (
                        <button className="btn-ghost" onClick={handleReset}>Clear</button>
                      )}
                    </div>
                  </div>
                )}

                {/* 3b. Single item progress panel */}
                {currentTask && (
                  <div className="extraction-progress-card glass-panel" style={{ padding: 'var(--spacing-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                      <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {currentTask.status === 'downloading' ? <FiDownload /> : <FiAlertCircle />} Extraction Progress
                      </span>
                      <span style={{ color: 'var(--color-accent)' }}>
                        {currentTask.status === 'queued' && 'Queued...'}
                        {currentTask.status === 'downloading' && `Processing... ${currentTask.progress?.percent || 0}%`}
                        {currentTask.status === 'processing' && 'Extracting Audio...'}
                        {currentTask.status === 'completed' && 'Done!'}
                        {currentTask.status === 'failed' && 'Error!'}
                      </span>
                    </div>

                    {/* Progress Slider */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '12px 0' }}>
                      <div 
                        style={{ 
                          width: `${currentTask.progress?.percent || (currentTask.status === 'completed' ? 100 : 0)}%`, 
                          background: 'linear-gradient(90deg, #059669, #10b981)', 
                          height: '100%', 
                          transition: 'width 0.2s' 
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      <span>{currentTask.status === 'completed' && currentTask.outputPath ? currentTask.outputPath.split('/').pop() : `Extracting: ${videoInfo?.title}`}</span>
                      <span>Format: {selectedFormat} • Quality: {selectedQuality} kbps • Channels: Stereo</span>
                    </div>
                    {currentTask.status === 'failed' && currentTask.error && (
                      <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--color-error)', whiteSpace: 'pre-wrap' }}>{currentTask.error}</div>
                    )}
                    {(currentTask.status === 'completed' || currentTask.status === 'failed') && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                        {currentTask.status === 'completed' && currentTask.outputPath && backend.kind === 'web' && (
                          <>
                            <button className="btn-secondary" onClick={() => void handleRenameResult(currentTask)} title={t('history.rename', 'Rename')}>
                              <FiEdit2 /> {t('history.rename', 'Rename')}
                            </button>
                            <SendToMusik key={currentTask.outputPath} outputPath={currentTask.outputPath} />
                          </>
                        )}
                        {currentTask.status === 'completed' && currentTask.outputPath && backend.downloadUrl(currentTask.outputPath) && (
                          <a className="btn-primary" href={backend.downloadUrl(currentTask.outputPath) ?? undefined} download style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', width: 'auto', padding: '0 16px' }}>
                            <FiSave /> {t('history.download', 'Download')}
                          </a>
                        )}
                        <button className="btn-secondary" onClick={handleReset}>{t('common.newExtraction', 'New extraction')}</button>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Audio Preview Player at the bottom */}
                {previewAudioUrl && (
                  <div className="preview-player-card glass-panel" style={{ padding: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <audio ref={audioRef} src={previewAudioUrl} loop={previewLoop} />
                    
                    <div className="avatar" style={{ background: 'var(--color-accent-light)' }}>
                      <span style={{ color: '#34d399' }}>🎵</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Preview: Extracted Audio</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {formatDuration(previewCurrentTime)} / {formatDuration(useFullTrack ? duration : (endTime - startTime))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button className="btn-ghost" title="Prev"><FiSkipBack /></button>
                      <button className="btn-primary" style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }} onClick={handlePlayPause}>
                        {isPreviewPlaying ? <FiPause /> : <FiPlay />}
                      </button>
                      <button className="btn-ghost" title="Next"><FiSkipForward /></button>
                    </div>

                    {/* Volume control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                      <button className="btn-ghost" onClick={handleMuteVolume}>
                        {isPreviewMuted ? <FiVolumeX /> : <FiVolume2 />}
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05"
                        value={previewVolume} 
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        style={{ width: '60px', height: '4px', accentColor: 'var(--color-accent)' }}
                      />
                    </div>

                    {previewDownloadUrl && (
                      <a className="btn-secondary" href={previewDownloadUrl} download title="Download" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                        <FiSave /> {t('history.download', 'Download')}
                      </a>
                    )}
                    <button 
                      className={`btn-ghost ${previewLoop ? 'active-loop' : ''}`} 
                      onClick={() => setPreviewLoop(!previewLoop)}
                      style={{ color: previewLoop ? 'var(--color-accent)' : 'inherit' }}
                    >
                      <FiRepeat />
                    </button>

                    <select 
                      value={previewSpeed} 
                      onChange={handleSpeedChange}
                      className="input-field" 
                      style={{ width: '70px', padding: '4px', fontSize: '0.8rem' }}
                    >
                      <option value="0.5">0.5x</option>
                      <option value="1.0">1.0x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2.0">2.0x</option>
                    </select>

                    <button className="btn-ghost"><FiMoreVertical /></button>
                  </div>
                )}

              </div>

              {/* Right Options panel matching the design options sidebar */}
              <div className="right-panel">
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)', fontSize: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
                  ⚙️ Extraction Options
                </h4>

                <div className="form-group" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>Format</label>
                  <select 
                    value={selectedFormat} 
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="input-field"
                  >
                    <option value="MP3">MP3</option>
                    <option value="FLAC">FLAC</option>
                    <option value="WAV">WAV</option>
                    <option value="M4A">M4A</option>
                    <option value="Opus">Opus</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Quality</span>
                    <span style={{ fontWeight: '600', color: 'var(--color-accent)' }}>{selectedQuality} kbps</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="4" 
                    step="1"
                    value={selectedQuality === '64' ? 1 : selectedQuality === '128' ? 2 : selectedQuality === '192' ? 3 : 4}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSelectedQuality(val === 1 ? '64' : val === 2 ? '128' : val === 3 ? '192' : '320');
                    }}
                    style={{ width: '100%', accentColor: 'var(--color-accent)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    <span>64</span>
                    <span>128</span>
                    <span>192</span>
                    <span>320</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Trim Audio</label>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', color: useFullTrack ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                        <input 
                          type="checkbox" 
                          checked={useFullTrack}
                          onChange={(e) => setUseFullTrack(e.target.checked)}
                          style={{ accentColor: 'var(--color-accent)' }}
                        />
                        Use full track
                     </label>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Start (seconds)</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={startTime} 
                        disabled={useFullTrack}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setStartTime(val);
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>End (seconds)</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={endTime} 
                        disabled={useFullTrack}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setEndTime(val);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>End Time</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formatDuration(endTime) + '.000'} 
                    disabled
                  />
                </div>

                <button 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                  onClick={handleExtractAudio}
                  disabled={!videoInfo || !!activeTaskId || !!batchTaskIds}
                >
                  <FiDownload /> Extract Audio
                </button>

                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                  Estimated size: {getEstimatedSize()}
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="page-content-scroll"
            >
              <DownloadHistory />
            </motion.div>
          )}

          {currentPage === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="page-content-scroll"
            >
              <SettingsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
