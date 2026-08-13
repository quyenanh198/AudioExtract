# Video Download Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a video-download mode to AudioExtract (always highest resolution, muxed to MP4), alongside the existing audio-extraction mode, and change audio mode's default quality to the highest tier for the selected format (still user-adjustable).

**Architecture:** Generalize the existing `download_audio` Tauri command into `download_media`, taking a `mode: "audio" | "video"` parameter. Argument construction is split into two small, independently-testable pure functions (`build_audio_args`, `build_video_args`); everything else (spawn, event draining via the existing `process_events::drain_command_events`, task tracking, event emission) is shared and unchanged. On the frontend, a mode toggle next to the format/quality controls switches which params get sent and hides the format/quality UI entirely for video.

**Tech Stack:** Tauri 2 (Rust backend), React 19 + TypeScript, Zustand (state), Vitest (frontend tests), `cargo test` (backend tests, no new dependency).

## Global Constraints

- Video mode never accepts a quality/resolution parameter from the frontend — always `bestvideo+bestaudio/best`, muxed to MP4 via the existing `--ffmpeg-location` binary (spec: "no override").
- Audio mode's quality control must be hidden when the selected format is FLAC or WAV (lossless — no bitrate concept applies).
- No changes to `AudioTrimmer`/video trimming — out of scope per spec.
- Follow the existing repo convention: `cargo test` unit tests via pure functions (see `path_resolver.rs`'s `pick_binary_name`), Vitest for frontend behavior (see `DownloadQueue.test.tsx`).
- Every new/changed test must be run and confirmed to fail for the expected reason before the implementation step, then confirmed to pass after.

---

### Task 1: Extract `build_audio_args` as a testable pure function

**Files:**
- Modify: `src-tauri/src/commands/download.rs:44-76` (the `download_audio` command's argument-building code)
- Test: `src-tauri/src/commands/download.rs` (new `#[cfg(test)] mod tests` block in the same file)

**Interfaces:**
- Produces: `pub fn build_audio_args(format: &str, quality: &str, ffmpeg_path: &str, output_dir: &str, url: &str) -> Vec<String>` — used by Task 3.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `src-tauri/src/commands/download.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_audio_args_includes_quality_flag_for_lossy_format() {
        let args = build_audio_args("mp3", "320", "/path/to/ffmpeg", "/out", "https://example.com/v");

        assert_eq!(
            args,
            vec![
                "--newline".to_string(),
                "--extract-audio".to_string(),
                "--audio-format".to_string(),
                "mp3".to_string(),
                "--audio-quality".to_string(),
                "320".to_string(),
                "--ffmpeg-location".to_string(),
                "/path/to/ffmpeg".to_string(),
                "-o".to_string(),
                "/out/%(title)s.%(ext)s".to_string(),
                "https://example.com/v".to_string(),
            ]
        );
    }

    #[test]
    fn build_audio_args_omits_quality_flag_for_lossless_format() {
        let flac_args = build_audio_args("flac", "320", "/path/to/ffmpeg", "/out", "https://example.com/v");
        assert!(!flac_args.contains(&"--audio-quality".to_string()));

        let wav_args = build_audio_args("wav", "320", "/path/to/ffmpeg", "/out", "https://example.com/v");
        assert!(!wav_args.contains(&"--audio-quality".to_string()));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib build_audio_args`
Expected: FAIL to compile with `cannot find function 'build_audio_args' in this scope` (the function doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Add this function above `download_audio` in `src-tauri/src/commands/download.rs` (do not remove `download_audio` yet — Task 3 rewires it):

```rust
pub fn build_audio_args(format: &str, quality: &str, ffmpeg_path: &str, output_dir: &str, url: &str) -> Vec<String> {
    let mut args = vec![
        "--newline".to_string(),
        "--extract-audio".to_string(),
        "--audio-format".to_string(),
        format.to_string(),
    ];

    let is_lossless = format.eq_ignore_ascii_case("flac") || format.eq_ignore_ascii_case("wav");
    if !is_lossless {
        args.push("--audio-quality".to_string());
        args.push(quality.to_string());
    }

    args.push("--ffmpeg-location".to_string());
    args.push(ffmpeg_path.to_string());
    args.push("-o".to_string());
    args.push(format!("{}/%(title)s.%(ext)s", output_dir));
    args.push(url.to_string());

    args
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test --lib build_audio_args`
Expected: PASS (2 tests: `build_audio_args_includes_quality_flag_for_lossy_format`, `build_audio_args_omits_quality_flag_for_lossless_format`)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/download.rs
git commit -m "test: extract build_audio_args as a testable pure function"
```

---

### Task 2: Add `build_video_args`

**Files:**
- Modify: `src-tauri/src/commands/download.rs` (add alongside `build_audio_args`)
- Test: same file's `#[cfg(test)] mod tests` block

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `pub fn build_video_args(ffmpeg_path: &str, output_dir: &str, url: &str) -> Vec<String>` — used by Task 3.

- [ ] **Step 1: Write the failing test**

Add to the `tests` module in `src-tauri/src/commands/download.rs`:

```rust
    #[test]
    fn build_video_args_requests_best_streams_muxed_to_mp4() {
        let args = build_video_args("/path/to/ffmpeg", "/out", "https://example.com/v");

        assert_eq!(
            args,
            vec![
                "--newline".to_string(),
                "-f".to_string(),
                "bestvideo+bestaudio/best".to_string(),
                "--merge-output-format".to_string(),
                "mp4".to_string(),
                "--ffmpeg-location".to_string(),
                "/path/to/ffmpeg".to_string(),
                "-o".to_string(),
                "/out/%(title)s.%(ext)s".to_string(),
                "https://example.com/v".to_string(),
            ]
        );
    }

    #[test]
    fn build_video_args_never_contains_a_quality_flag() {
        let args = build_video_args("/path/to/ffmpeg", "/out", "https://example.com/v");
        assert!(!args.contains(&"--audio-quality".to_string()));
        assert!(!args.iter().any(|a| a.starts_with("--format-sort")));
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib build_video_args`
Expected: FAIL to compile with `cannot find function 'build_video_args' in this scope`.

- [ ] **Step 3: Write minimal implementation**

Add above or below `build_audio_args`:

```rust
pub fn build_video_args(ffmpeg_path: &str, output_dir: &str, url: &str) -> Vec<String> {
    vec![
        "--newline".to_string(),
        "-f".to_string(),
        "bestvideo+bestaudio/best".to_string(),
        "--merge-output-format".to_string(),
        "mp4".to_string(),
        "--ffmpeg-location".to_string(),
        ffmpeg_path.to_string(),
        "-o".to_string(),
        format!("{}/%(title)s.%(ext)s", output_dir),
        url.to_string(),
    ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test --lib build_video_args`
Expected: PASS (2 tests: `build_video_args_requests_best_streams_muxed_to_mp4`, `build_video_args_never_contains_a_quality_flag`)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/download.rs
git commit -m "feat: add build_video_args for highest-resolution video downloads"
```

---

### Task 3: Unify `download_audio` into `download_media`

**Files:**
- Modify: `src-tauri/src/commands/download.rs:44-76` (the command itself)
- Modify: `src-tauri/src/lib.rs:15` (command registration)

**Interfaces:**
- Consumes: `build_audio_args` (Task 1), `build_video_args` (Task 2), existing `drain_command_events`/`CommandLine` from `utils::process_events` (unchanged).
- Produces: `#[tauri::command] pub async fn download_media(app, state, task_id, url, mode, format: Option<String>, quality: Option<String>, output_dir) -> Result<(), String>` — used by Task 5 (frontend hook).

This task has no new automated test of its own — the argument-building logic it depends on is already covered by Tasks 1-2, and the command wrapper itself (spawn/event-loop/state-map plumbing) is unchanged from what already works in production. Verify manually after this task: `npm run tauri dev`, paste a URL, confirm an audio download still completes successfully (mode defaults through the UI to "audio" until Task 6 adds the toggle).

- [ ] **Step 1: Replace the command signature and argument construction**

In `src-tauri/src/commands/download.rs`, replace the `download_audio` function (the one starting `#[tauri::command] pub async fn download_audio(...)`) with:

```rust
#[tauri::command]
pub async fn download_media(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    task_id: String,
    url: String,
    mode: String,
    format: Option<String>,
    quality: Option<String>,
    output_dir: String,
) -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    let yt_dlp_path = crate::utils::path_resolver::resolve_binary_path("yt-dlp")?;

    let args = if mode == "video" {
        build_video_args(&ffmpeg_path, &output_dir, &url)
    } else {
        let format = format.ok_or("format is required for audio mode")?;
        let quality = quality.ok_or("quality is required for audio mode")?;
        build_audio_args(&format, &quality, &ffmpeg_path, &output_dir, &url)
    };

    let cmd = app.shell().command(yt_dlp_path).args(args);
    let (rx, child) = cmd.spawn().map_err(|e| e.to_string())?;
```

Everything after this point (`{ let mut downloads = state.downloads.lock().await; ... }` through the end of the function) is unchanged — keep it exactly as it is today, just under the new function name/signature.

- [ ] **Step 2: Update the Tauri command registration**

In `src-tauri/src/lib.rs`, change:

```rust
            commands::download::download_audio,
```

to:

```rust
            commands::download::download_media,
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -30`
Expected: compiles with no errors (there will be a frontend TypeScript error until Task 5 updates the caller — that's expected and fixed there, not here).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/download.rs src-tauri/src/lib.rs
git commit -m "refactor: unify download_audio into mode-aware download_media"
```

---

### Task 4: Update frontend types

**Files:**
- Modify: `src/types/index.ts:48-54` (the `DownloadAudioParams` interface)
- Modify: `src/types/index.ts:1-11` (the `DownloadTask` interface)

**Interfaces:**
- Produces: `DownloadMediaParams` (replaces `DownloadAudioParams`), `DownloadTask.mode` field — used by Tasks 5, 6, 7, 8.

No test for this task — it's a type-only change with no runtime behavior; the next task's test will fail to compile if these types are wrong, which is the actual verification.

- [ ] **Step 1: Replace `DownloadAudioParams`**

In `src/types/index.ts`, replace:

```typescript
export interface DownloadAudioParams {
  taskId: string;
  url: string;
  format: string;
  quality: string;
  outputDir: string;
}
```

with:

```typescript
export interface DownloadMediaParams {
  taskId: string;
  url: string;
  mode: 'audio' | 'video';
  format?: string;
  quality?: string;
  outputDir: string;
}
```

- [ ] **Step 2: Add `mode` to `DownloadTask`**

In `src/types/index.ts`, change:

```typescript
export interface DownloadTask {
  id: string;
  url: string;
  title?: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
```

to:

```typescript
export interface DownloadTask {
  id: string;
  url: string;
  title?: string;
  mode: 'audio' | 'video';
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: add mode field to DownloadTask, replace DownloadAudioParams with DownloadMediaParams"
```

(TypeScript will now show errors at every `DownloadAudioParams`/task-creation call site until Tasks 5-8 fix them — expected, matches Task 3's backend-first sequencing.)

---

### Task 5: Update `useDownload` hook to call `download_media`

**Files:**
- Modify: `src/hooks/useDownload.ts:9-17`

**Interfaces:**
- Consumes: `DownloadMediaParams` (Task 4).
- Produces: `startDownload(params: DownloadMediaParams): Promise<void>` — used by Task 6.

- [ ] **Step 1: Update the hook**

In `src/hooks/useDownload.ts`, replace:

```typescript
  const startDownload = async (params: DownloadAudioParams): Promise<void> => {
    return invoke('download_audio', {
      taskId: params.taskId,
      url: params.url,
      format: params.format,
      quality: params.quality,
      outputDir: params.outputDir
    });
  };
```

with:

```typescript
  const startDownload = async (params: DownloadMediaParams): Promise<void> => {
    return invoke('download_media', {
      taskId: params.taskId,
      url: params.url,
      mode: params.mode,
      format: params.format,
      quality: params.quality,
      outputDir: params.outputDir
    });
  };
```

Also update the import at the top of the file: change `DownloadAudioParams` to `DownloadMediaParams` in the `import { ... } from '../types';` line.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep useDownload`
Expected: no output (no errors referencing `useDownload.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDownload.ts
git commit -m "refactor: useDownload.startDownload takes DownloadMediaParams, calls download_media"
```

---

### Task 6: Add the Audio/Video mode toggle to the download setup UI

**Files:**
- Modify: `src/App.tsx` (state, `handleExtractAudio`, and the "Extraction Options" panel)
- Test: `src/App.test.tsx` (new file)

**Interfaces:**
- Consumes: `startDownload` (Task 5), `DownloadMediaParams`/`DownloadTask.mode` (Task 4).
- Produces: `selectedMode` state (`'audio' | 'video'`) — used by Task 7 (quality-hiding logic reads the same format/mode state).

- [ ] **Step 1: Write the failing test**

Create `src/App.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const invokeMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => path,
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => 'div' }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

import App from './App';

describe('Audio/Video mode toggle', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    // fetch_video_info is called on URL submit; stub a minimal successful response.
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'fetch_video_info') {
        return Promise.resolve([
          { id: '1', title: 'Test Video', duration: 100, uploader: 'u', platform: 'youtube', originalUrl: 'https://youtube.com/watch?v=1' },
        ]);
      }
      return Promise.resolve(undefined);
    });
  });

  it('hides format/quality controls and sends mode: "video" when Video is selected', async () => {
    render(<App />);

    const urlInput = screen.getByPlaceholderText(/url/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=1' } });
    fireEvent.submit(urlInput.closest('form')!);

    await waitFor(() => expect(screen.getByText('Test Video')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /video/i }));

    expect(screen.queryByText('Format')).not.toBeInTheDocument();
    expect(screen.queryByText('Quality')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /extract|download/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('download_media', expect.objectContaining({
        mode: 'video',
        format: undefined,
        quality: undefined,
      }));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no "Video" button exists yet (the toggle hasn't been added), so `screen.getByRole('button', { name: /video/i })` throws.

- [ ] **Step 3: Add the mode toggle and wire it through**

In `src/App.tsx`, add mode state near the existing `selectedFormat`/`selectedQuality` state (around line 39-40):

```typescript
  const [selectedMode, setSelectedMode] = useState<'audio' | 'video'>('audio');
```

In the "Extraction Options" panel (`src/App.tsx`, right before the `<div className="form-group" ...>Format</div>` block at line 589), add the toggle:

```tsx
                <div className="form-group" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn-ghost ${selectedMode === 'audio' ? 'selected' : ''}`}
                      onClick={() => setSelectedMode('audio')}
                    >
                      {t('mode.audio', 'Audio')}
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost ${selectedMode === 'video' ? 'selected' : ''}`}
                      onClick={() => setSelectedMode('video')}
                    >
                      {t('mode.video', 'Video')}
                    </button>
                  </div>
                </div>
```

Wrap the existing Format `<div className="form-group">...</div>` (lines 589-602) and Quality `<div className="form-group">...</div>` (lines 604-627) in a single conditional:

```tsx
                {selectedMode === 'audio' && (
                  <>
                    {/* existing Format form-group div goes here, unchanged */}
                    {/* existing Quality form-group div goes here, unchanged */}
                  </>
                )}
```

In `handleExtractAudio` (`src/App.tsx:220`), replace the two `startDownload({...})` call sites (lines 243-249 and 277-283) — both currently pass `format, quality, outputDir` — with a shared params object built once at the top of the function, right after the existing `const format = selectedFormat.toLowerCase();` / `const qualityStr = ...;` lines:

```typescript
    const mediaModeParams = selectedMode === 'video'
      ? { mode: 'video' as const }
      : { mode: 'audio' as const, format, quality: qualityStr };
```

Then change each `startDownload({...})` call from listing `format, quality` individually to spreading `...mediaModeParams` instead, e.g. the playlist branch call becomes:

```typescript
                await startDownload({
                  taskId: tId,
                  url: item.originalUrl || currentUrl,
                  ...mediaModeParams,
                  outputDir: settings.outputDir
                });
```

(apply the same `...mediaModeParams` replacement to the single-URL download call a few lines below it).

Also update every `addTask({...})` call in `handleExtractAudio` to include the new required `mode` field, e.g.:

```typescript
              addTask({
                id: tId,
                url: item.originalUrl || currentUrl,
                title: item.title,
                mode: selectedMode,
                status: 'queued',
                createdAt: Date.now()
              });
```

(apply to all three `addTask` call sites in `handleExtractAudio` — playlist branch, single-URL branch, and local-file branch; local-file branch should hardcode `mode: 'audio'` since local-file trimming only ever produces audio).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add Audio/Video mode toggle, wire mode through download flow"
```

---

### Task 7: Default audio quality to the highest tier, hide quality control for lossless formats

**Files:**
- Modify: `src/App.tsx:589-627` (the Format/Quality controls added in Task 6's conditional block)
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `selectedFormat`/`selectedQuality` state (existing), `selectedMode` (Task 6).

- [ ] **Step 1: Write the failing test**

Add to `src/App.test.tsx`, inside a new `describe` block:

```typescript
describe('Audio quality defaults', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'fetch_video_info') {
        return Promise.resolve([
          { id: '1', title: 'Test Video', duration: 100, uploader: 'u', platform: 'youtube', originalUrl: 'https://youtube.com/watch?v=1' },
        ]);
      }
      return Promise.resolve(undefined);
    });
  });

  it('hides the quality control when a lossless format is selected', async () => {
    render(<App />);

    const urlInput = screen.getByPlaceholderText(/url/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=1' } });
    fireEvent.submit(urlInput.closest('form')!);
    await waitFor(() => expect(screen.getByText('Test Video')).toBeInTheDocument());

    expect(screen.getByText('Quality')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('MP3'), { target: { value: 'FLAC' } });

    expect(screen.queryByText('Quality')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — the Quality control is currently always shown for audio mode regardless of format (Task 6 only conditioned it on `selectedMode`, not on format losslessness).

- [ ] **Step 3: Hide quality for lossless formats, confirm default resolves to highest tier**

In `src/App.tsx`, inside the `selectedMode === 'audio'` block added in Task 6, wrap only the Quality `form-group` div (not the Format one) in an additional condition:

```tsx
                    {!['FLAC', 'WAV'].includes(selectedFormat) && (
                      <div className="form-group" style={{ marginBottom: 'var(--spacing-md)' }}>
                        {/* existing Quality slider content, unchanged */}
                      </div>
                    )}
```

The default value is already `'320'` (the top of the 64/128/192/320 scale — see `src/App.tsx:40`), so no change is needed there; this step is purely about not showing an inapplicable control for lossless formats. Leaving `selectedQuality` set even when hidden is harmless — Task 6's `mediaModeParams` only reads `quality` when `mode === 'audio'`, and `build_audio_args` (Task 1) already ignores the quality value entirely for `flac`/`wav`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (both `App.test.tsx` describe blocks green)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "fix: hide quality control for lossless audio formats"
```

---

### Task 8: Show a mode indicator in the download queue/history

**Files:**
- Modify: `src/components/DownloadProgress.tsx:1-21`
- Test: `src/components/DownloadProgress.test.tsx` (new file)

**Interfaces:**
- Consumes: `DownloadTask.mode` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `src/components/DownloadProgress.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { DownloadProgress } from './DownloadProgress';
import { DownloadTask } from '../types';

const baseTask: DownloadTask = {
  id: '1',
  url: 'https://youtube.com/watch?v=1',
  title: 'Test Video',
  mode: 'video',
  status: 'downloading',
  createdAt: Date.now(),
};

describe('DownloadProgress mode indicator', () => {
  it('shows a Video badge for video-mode tasks', () => {
    render(<DownloadProgress task={baseTask} onCancel={() => {}} />);
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('shows an Audio badge for audio-mode tasks', () => {
    render(<DownloadProgress task={{ ...baseTask, mode: 'audio' }} onCancel={() => {}} />);
    expect(screen.getByText('Audio')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DownloadProgress.test.tsx`
Expected: FAIL — no "Video"/"Audio" text is rendered anywhere yet.

- [ ] **Step 3: Add the mode badge**

In `src/components/DownloadProgress.tsx`, inside the `task-info` div (right after the closing `</div>` of `platform-icon-small`, before the `<h4 className="task-title">` element), add:

```tsx
          <span className="mode-badge">{task.mode === 'video' ? t('mode.video', 'Video') : t('mode.audio', 'Audio')}</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DownloadProgress.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run && cd src-tauri && cargo test`
Expected: all frontend and backend tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/DownloadProgress.tsx src/components/DownloadProgress.test.tsx
git commit -m "feat: show Audio/Video mode badge on download queue/history items"
```
