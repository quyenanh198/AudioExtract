import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { v4 as uuid } from 'uuid';
import { FiAlertCircle } from 'react-icons/fi';

import { Alert } from '../ui';
import { SourceDropzone } from './SourceDropzone';
import { SourceList } from './SourceList';
import { ExtractOptions, MediaMode } from './ExtractOptions';
import { ActiveJobCard } from './ActiveJobCard';
import { PreviewPlayer } from './PreviewPlayer';

import { useDownload } from '../../hooks/useDownload';
import { useDownloadStore } from '../../store/downloadStore';
import { AppSettings, DownloadProgress, VideoInfo } from '../../types';
import './ExtractPage.css';

interface ExtractPageProps {
  settings: AppSettings;
}

/** Backend quality scale for yt-dlp: 0 = best, 9 = worst. */
const QUALITY_TO_YTDLP: Record<string, string> = {
  '320': '0',
  '192': '2',
  '128': '5',
  '64': '8',
};

/** Map a persisted settings value onto one of the slider's stops. */
const normalizeQuality = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (value.includes('64') || value.includes('low') || value === '8') return '64';
  if (value.includes('128') || value.includes('standard') || value === '5') return '128';
  if (value.includes('192') || value.includes('high') || value === '2') return '192';
  return '320';
};

const ACTIVE_STATUSES = ['queued', 'downloading', 'processing'];

export const ExtractPage: React.FC<ExtractPageProps> = ({ settings }) => {
  const { t } = useTranslation();
  const { fetchVideoInfo, startDownload, cancelDownload, trimAudio } = useDownload();
  const { addTask, updateTask, completeTask, failTask, cancelTask } = useDownloadStore();
  const tasks = useDownloadStore((state) => state.tasks);

  /* ---------------------------------------------------------- source -- */
  const [items, setItems] = useState<VideoInfo[] | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* --------------------------------------------------------- options -- */
  const [mode, setMode] = useState<MediaMode>('audio');
  const [format, setFormat] = useState('MP3');
  const [quality, setQuality] = useState('320');
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  /* ------------------------------------------------------------ jobs -- */
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const primary = items?.[0] ?? null;
  const isPlaylist = (items?.length ?? 0) > 1;

  /* For a playlist every item gets downloaded, so the length that drives the
     size estimate is the sum — not the first track's, which is what the old
     estimate used and why a 40-item playlist reported ~8 MB. */
  const duration = (items ?? []).reduce((total, item) => total + (item.duration || 0), 0);

  /* Trimming runs through ffmpeg on a file that already exists locally.
     Remote downloads go straight from yt-dlp to disk without a trim pass, so
     offering the control there would be a promise the pipeline doesn't keep. */
  const trimAvailable = localFilePath !== null;

  const jobs = useMemo(
    () => jobIds.map((id) => tasks.find((task) => task.id === id)).filter(Boolean),
    [jobIds, tasks],
  );
  const busy = jobs.some((job) => job && ACTIVE_STATUSES.includes(job.status));

  /* ------------------------------------------------- settings defaults -- */
  useEffect(() => {
    if (settings.defaultFormat) setFormat(settings.defaultFormat.toUpperCase());
    setQuality(normalizeQuality(settings.defaultQuality));
  }, [settings.defaultFormat, settings.defaultQuality]);

  /* --------------------------------------------------- backend events -- */
  useEffect(() => {
    const unlistenProgress = listen<{ taskId: string; progress: DownloadProgress }>(
      'download-progress',
      (event) => {
        updateTask(event.payload.taskId, {
          status: 'downloading',
          progress: event.payload.progress,
        });
      },
    );

    const unlistenFinished = listen<{
      taskId: string;
      outputPath?: string;
      fileSize?: number;
      success: boolean;
      error?: string;
    }>('download-finished', (event) => {
      const { taskId, outputPath, fileSize, success, error } = event.payload;
      if (success) {
        completeTask(taskId, outputPath || '', fileSize || 0);
        if (outputPath) setPreviewPath(outputPath);
      } else {
        failTask(taskId, error || t('download.error', 'Failed'));
      }
    });

    const unlistenError = listen<{ taskId: string; error: string }>(
      'download-error',
      (event) => {
        failTask(event.payload.taskId, event.payload.error || t('download.error', 'Failed'));
      },
    );

    return () => {
      void unlistenProgress.then((off) => off());
      void unlistenFinished.then((off) => off());
      void unlistenError.then((off) => off());
    };
    // Handlers only close over stable store actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------- actions -- */
  const resetSource = useCallback(() => {
    setItems(null);
    setSourceUrl('');
    setLocalFilePath(null);
    setPreviewPath(null);
    setJobIds([]);
    setFetchError(null);
    setTrimEnabled(false);
    setStartTime(0);
    setEndTime(0);
  }, []);

  const handleUrlSubmit = async (url: string) => {
    setIsFetching(true);
    setFetchError(null);
    setItems(null);
    setPreviewPath(null);
    setJobIds([]);
    setLocalFilePath(null);
    setSourceUrl(url);

    try {
      const info = await fetchVideoInfo(url);
      if (!info?.length) throw new Error('empty response');
      setItems(info);
      setStartTime(0);
      setEndTime(info[0].duration);
      setTrimEnabled(false);
    } catch (error) {
      setItems(null);
      setSourceUrl('');
      setFetchError(
        t('source.fetchFailed', 'Could not read that link. {{error}}', {
          error: String(error),
        }),
      );
    } finally {
      setIsFetching(false);
    }
  };

  const handleFileSelected = (path: string) => {
    const name = path.split(/[\\/]/).pop() || path;
    setSourceUrl('');
    setPreviewPath(null);
    setJobIds([]);
    setFetchError(null);
    setLocalFilePath(path);
    // Video mode is meaningless for a local file: the local path always goes
    // through trim_audio, which only ever emits audio.
    setMode('audio');
    setItems([
      {
        id: path,
        title: name,
        duration: 0,
        uploader: '',
        platform: 'local',
      },
    ]);
    setStartTime(0);
    setEndTime(0);
    setTrimEnabled(false);
  };

  const handleCancel = async (taskId: string) => {
    cancelTask(taskId);
    try {
      await cancelDownload(taskId);
    } catch (error) {
      console.error('Backend cancel failed:', error);
    }
  };

  const handleOpenFolder = async () => {
    if (!previewPath) return;
    try {
      await invoke('open_file_in_explorer', { path: previewPath });
    } catch (error) {
      console.error('Could not open output folder:', error);
    }
  };

  const runRemoteDownloads = async () => {
    const targets = items ?? [];
    const params =
      mode === 'video'
        ? { mode: 'video' as const }
        : {
            mode: 'audio' as const,
            format: format.toLowerCase(),
            quality: QUALITY_TO_YTDLP[quality] ?? '0',
          };

    const ids = targets.map(() => uuid());
    setJobIds(ids);

    await Promise.all(
      targets.map(async (item, index) => {
        const taskId = ids[index];
        const url = item.originalUrl || sourceUrl;

        addTask({
          id: taskId,
          url,
          title: item.title,
          mode,
          status: 'queued',
          createdAt: Date.now(),
        });

        try {
          updateTask(taskId, { status: 'downloading' });
          await startDownload({
            taskId,
            url,
            ...params,
            outputDir: settings.outputDir,
          });
        } catch (error) {
          failTask(taskId, String(error));
        }
      }),
    );
  };

  const runLocalExtract = async () => {
    if (!localFilePath || !primary) return;

    const taskId = uuid();
    setJobIds([taskId]);

    addTask({
      id: taskId,
      url: localFilePath,
      title: primary.title,
      mode: 'audio',
      status: 'queued',
      createdAt: Date.now(),
    });

    try {
      updateTask(taskId, { status: 'processing' });

      const dotIndex = primary.title.lastIndexOf('.');
      const stem = dotIndex > 0 ? primary.title.slice(0, dotIndex) : primary.title;
      const outputPath = `${settings.outputDir}/${stem}_extracted.${format.toLowerCase()}`;

      await trimAudio({
        inputPath: localFilePath,
        outputPath,
        startTime: trimEnabled ? startTime : 0,
        // 0 means "to the end" for the ffmpeg wrapper.
        endTime: trimEnabled ? endTime : 0,
      });

      completeTask(taskId, outputPath, 0);
      setPreviewPath(outputPath);
    } catch (error) {
      failTask(taskId, String(error));
    }
  };

  const handleSubmit = async () => {
    if (!items?.length) return;
    if (localFilePath) {
      await runLocalExtract();
    } else {
      await runRemoteDownloads();
    }
  };

  /* ------------------------------------------------------------ render -- */
  const hasSource = Boolean(items?.length);

  return (
    <div className={`extract ${hasSource ? '' : 'extract--empty'}`}>
      <div className="extract__main">
        {!hasSource ? (
          <>
            <SourceDropzone
              onUrlSubmit={handleUrlSubmit}
              onFileSelected={handleFileSelected}
              isLoading={isFetching}
            />
            {fetchError && (
              <Alert tone="danger" icon={<FiAlertCircle aria-hidden />}>
                {fetchError}
              </Alert>
            )}
          </>
        ) : (
          <>
            <SourceList
              items={items!}
              isPlaylist={isPlaylist}
              onClear={resetSource}
              busy={busy}
            />

            {jobs.map(
              (job) =>
                job && (
                  <ActiveJobCard
                    key={job.id}
                    task={job}
                    onCancel={localFilePath ? undefined : handleCancel}
                  />
                ),
            )}

            {previewPath && (
              <PreviewPlayer
                src={convertFileSrc(previewPath)}
                title={previewPath.split(/[\\/]/).pop() || previewPath}
                onOpenFolder={handleOpenFolder}
              />
            )}
          </>
        )}
      </div>

      {/* The options panel has nothing to act on until a source is loaded.
          Rendering it disabled just puts a column of dead controls on screen,
          so it appears with the source instead. */}
      {hasSource && (
      <ExtractOptions
        mode={mode}
        onModeChange={setMode}
        modeAvailable={Boolean(sourceUrl)}
        format={format}
        onFormatChange={setFormat}
        quality={quality}
        onQualityChange={setQuality}
        trimEnabled={trimAvailable && trimEnabled}
        onTrimEnabledChange={setTrimEnabled}
        trimAvailable={trimAvailable}
        startTime={startTime}
        endTime={endTime}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        duration={duration}
        disabled={!hasSource}
        busy={busy}
        onSubmit={handleSubmit}
      />
      )}
    </div>
  );
};
