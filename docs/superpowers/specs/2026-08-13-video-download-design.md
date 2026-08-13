# Video download feature — design

## Purpose

AudioExtract currently only extracts audio. This adds a second mode — downloading the
actual video, muxed to MP4, always at the highest resolution available. Audio mode is
unchanged in behavior except its quality preset now defaults to the highest tier
available for the selected format, while remaining user-adjustable as before.

A web-app deployment direction was explored and explicitly dropped (self-hosting
yt-dlp/ffmpeg as a public or even personal server service was judged not worth the
added complexity and legal-exposure surface compared to shipping this as a desktop
feature — see conversation history for the full reasoning). This spec is desktop-only,
built on the existing Tauri architecture.

## Architecture

### Backend: unify `download_audio` into `download_media`

`src-tauri/src/commands/download.rs`'s `download_audio` command is generalized into
`download_media`, taking a new `mode: "audio" | "video"` parameter instead of adding a
second, near-duplicate command. The two modes share everything except yt-dlp argument
construction and the shape of the output-detection logic:

- **Shared** (unchanged from today): spawn via `app.shell().command(yt_dlp_path)`,
  drain events via the existing `utils::process_events::drain_command_events` helper,
  `AppState.downloads` task tracking for cancellation, `download-progress` /
  `download-error` / `download-finished` event emission, output file size lookup.
- **Audio-specific args** (unchanged): `--extract-audio --audio-format {format}
  --audio-quality {quality} --ffmpeg-location {ffmpeg_path}`.
- **Video-specific args** (new): `-f "bestvideo+bestaudio/best" --merge-output-format
  mp4 --ffmpeg-location {ffmpeg_path}`. No quality/resolution parameter is accepted
  from the frontend for video — yt-dlp's own best-stream selection is trusted, and
  `--ffmpeg-location` (already required for audio extraction) is reused for the
  video+audio mux, since many sources only expose separate video-only and audio-only
  streams above certain resolutions.

Argument construction is split into a small, pure function per mode
(`build_audio_args(format, quality, ffmpeg_path, output_dir) -> Vec<String>` /
`build_video_args(ffmpeg_path, output_dir) -> Vec<String>`) so each is unit-testable
without spawning a real process — mirroring the `pick_binary_name` extraction pattern
already used in `path_resolver.rs`.

Output-destination line parsing (`[ExtractAudio] Destination: ` / `[download]
Destination: `) already handles both cases today (the second pattern is exactly what
yt-dlp emits for a plain video download) — no change needed there.

### Frontend

- **Mode toggle**: added next to `FormatPicker`, in `App.tsx`'s download-setup UI —
  `Audio` / `Video` selection. Selecting Video hides the format/quality controls
  entirely (nothing to choose); selecting Audio shows them as today.
- **Audio defaults**: `selectedFormat`/`selectedQuality` initial state and the
  reset-on-new-format logic change to resolve to the highest quality tier for
  whichever format is selected (e.g. MP3 → 320kbps) rather than a fixed default that
  happens to coincide with the top tier today. When the format is FLAC or WAV
  (lossless — no bitrate concept), the quality control is hidden/disabled rather than
  showing an inapplicable bitrate choice.
- **Types**: `DownloadAudioParams` becomes `DownloadMediaParams` with a `mode: 'audio'
  | 'video'` field; `format`/`quality` become optional, present only for `mode:
  'audio'`. `DownloadTask` gains the same `mode` field so the queue/history UI can show
  a distinguishing icon/label per task.
- **Reused as-is**: `DownloadQueue`, `DownloadProgress`, `downloadStore`,
  `DownloadHistory` — no structural change, just rendering the new `mode` field.
- **`useDownload` hook**: `startDownload` takes the unified `DownloadMediaParams` and
  invokes `download_media` (renamed from `download_audio`) with the `mode` field passed
  through.

## Explicitly out of scope

- Video trimming (`AudioTrimmer`) does not extend to video in this pass — trimming
  video requires re-encoding rather than the current fast stream-copy trim, which is a
  meaningfully different problem. Left for a future iteration if wanted.
- No resolution/quality choice for video — always highest, no override, per the
  decision made during design.
- No changes to the download queue/progress/history UI structure beyond surfacing the
  new `mode` field.

## Error handling

Unchanged from the existing audio flow: yt-dlp/ffmpeg failures surface through the same
`download-error`/`download-finished(success: false)` events already wired up, with the
same cancellation-race guards (`completeTask`/`failTask` refusing to overwrite an
already-`cancelled` task) that were added during the prior review-and-test pass. Video
mode introduces no new failure modes beyond what audio already handles — same process,
same event stream, different arguments.

## Testing

Following the same pattern established in the last review-and-test pass on this repo
(write the test first, confirm it fails for the right reason, then implement):

- **Rust (`cargo test`, no new dependency)**: unit tests for `build_audio_args` and
  `build_video_args` — assert the exact argument list for representative inputs,
  including the audio lossless-format case (no `--audio-quality` flag when the format
  is FLAC/WAV, since bitrate doesn't apply) and the video case (confirm
  `--merge-output-format mp4` and the `bestvideo+bestaudio/best` selector are present,
  and that no per-request quality/resolution flag leaks in since the frontend sends
  none for video).
- **Frontend (`vitest`)**: mode-toggle test — selecting "Video" hides the format/quality
  controls and calls `invoke('download_media', { mode: 'video', ... })` with no
  format/quality fields; selecting "Audio" (default) preserves today's behavior and
  defaults `selectedQuality` to the highest tier for the selected format.
