# AudioExtract

A desktop app for extracting audio from YouTube, Facebook, and TikTok videos — paste a
URL, pick a format and quality, trim if needed, and get a clean audio file. Built with
[Tauri](https://tauri.app/) (Rust backend) and React/TypeScript, using
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/) as bundled
sidecar binaries.

## Features

- Paste a video URL (YouTube, Facebook, TikTok) and fetch title/duration/thumbnail before downloading
- Playlist support — pick which videos to pull from a playlist URL
- Choose audio format and quality, with a live download queue and progress
- Trim the extracted audio (start/end time) before saving
- Download history, with quick access to the output folder
- Vietnamese and English UI (i18next)

## Development

```bash
npm install
npm run tauri dev
```

Requires the Rust toolchain and Tauri's platform prerequisites — see the
[Tauri prerequisites guide](https://tauri.app/start/prerequisites/). The `yt-dlp` and
`ffmpeg` sidecar binaries are expected under `binaries/` at the repo root in dev, and
next to the built executable in production (see `src-tauri/src/utils/path_resolver.rs`
for the exact lookup order).

## Building

```bash
npm run build
npm run tauri build
```

## Testing

- **Frontend** (Vitest): `npm test`
- **Backend** (Rust, built-in `cargo test`, no extra dependency): `cd src-tauri && cargo test`

## Project structure

```
src/                    React frontend
  components/           UI components (URL input, download queue, trimmer, settings, ...)
  hooks/                Tauri command wrappers (useDownload, useSettings)
  store/                Zustand stores (download queue/history, settings)
  i18n/                 vi/en translations
src-tauri/               Rust backend (Tauri commands)
  src/commands/          fetch_info, download, trim, update — the actual yt-dlp/ffmpeg calls
  src/utils/             path resolution, progress parsing, shared subprocess-event draining
  capabilities/          Tauri permission manifest — keep this as tightly scoped as possible
```

## License

MIT — see [LICENSE](LICENSE).
