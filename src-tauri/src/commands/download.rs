use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::utils::progress_parser::{parse_progress_line, DownloadProgress};
use crate::utils::path_resolver::get_ffmpeg_path;
use crate::utils::process_events::{drain_command_events, CommandLine};

#[derive(Default)]
pub struct AppState {
    pub downloads: Arc<Mutex<HashMap<String, CommandChild>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadFinishedEvent {
    pub task_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size: Option<u64>,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadErrorEvent {
    pub task_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub task_id: String,
    pub progress: DownloadProgress,
}

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

/// The kind of yt-dlp output line a destination path was parsed from.
/// `Merger` always outranks the others: `-f bestvideo+bestaudio` produces a
/// `[download] Destination:` line for the video-only fragment, another for
/// the audio-only fragment, and only then a `[Merger] Merging formats into
/// "…"` line once both are muxed — after which yt-dlp deletes the fragment
/// files the `[download]` lines pointed at.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DestinationKind {
    ExtractAudio,
    Download,
    Merger,
}

/// Parses a single line of yt-dlp output for a destination-path
/// announcement, returning the path and which kind of line produced it.
/// Pure and unit-testable in isolation from the streaming event loop.
pub fn parse_output_destination(line: &str) -> Option<(DestinationKind, String)> {
    const MERGER_MARKER: &str = "[Merger] Merging formats into \"";
    const EXTRACT_AUDIO_MARKER: &str = "[ExtractAudio] Destination: ";
    const DOWNLOAD_MARKER: &str = "[download] Destination: ";

    if let Some(idx) = line.find(MERGER_MARKER) {
        let rest = &line[idx + MERGER_MARKER.len()..];
        let end = rest.find('"')?;
        let path = rest[..end].to_string();
        return if path.is_empty() { None } else { Some((DestinationKind::Merger, path)) };
    }

    if line.contains(EXTRACT_AUDIO_MARKER) {
        let path = line.split(EXTRACT_AUDIO_MARKER).nth(1).unwrap_or("").trim().to_string();
        return if path.is_empty() { None } else { Some((DestinationKind::ExtractAudio, path)) };
    }

    if line.contains(DOWNLOAD_MARKER) {
        let path = line.split(DOWNLOAD_MARKER).nth(1).unwrap_or("").trim().to_string();
        return if path.is_empty() { None } else { Some((DestinationKind::Download, path)) };
    }

    None
}

/// Tracks the "final" output path across a stream of yt-dlp lines, applying
/// the priority a `[Merger] Merging formats into "…"` line takes over
/// `[download]`/`[ExtractAudio] Destination:` lines once seen (see
/// `DestinationKind`). Once a merger line has been observed, later
/// `[download] Destination:` lines (there normally aren't any, but the
/// guard is cheap) no longer overwrite it.
#[derive(Default)]
pub struct OutputPathTracker {
    path: Option<String>,
    has_merger: bool,
}

impl OutputPathTracker {
    pub fn observe_line(&mut self, line: &str) {
        if let Some((kind, path)) = parse_output_destination(line) {
            if kind == DestinationKind::Merger {
                self.path = Some(path);
                self.has_merger = true;
            } else if !self.has_merger {
                self.path = Some(path);
            }
        }
    }

    pub fn into_path(self) -> Option<String> {
        self.path
    }
}

/// Builds the yt-dlp argument list for the requested `mode`, dispatching to
/// `build_video_args`/`build_audio_args`. Pure and unit-testable in
/// isolation from `download_media`'s Tauri/process-spawning plumbing.
/// Any `mode` other than the two known values is a caller bug (e.g. a stale
/// frontend build sending an old value) and must fail loudly rather than
/// silently falling back to audio.
pub fn build_args_for_mode(
    mode: &str,
    format: Option<String>,
    quality: Option<String>,
    ffmpeg_path: &str,
    output_dir: &str,
    url: &str,
) -> Result<Vec<String>, String> {
    if mode == "video" {
        Ok(build_video_args(ffmpeg_path, output_dir, url))
    } else if mode == "audio" {
        let format = format.ok_or("format is required for audio mode")?;
        let quality = quality.ok_or("quality is required for audio mode")?;
        Ok(build_audio_args(&format, &quality, ffmpeg_path, output_dir, url))
    } else {
        Err(format!("unknown mode: {}", mode))
    }
}

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

    let args = build_args_for_mode(&mode, format, quality, &ffmpeg_path, &output_dir, &url)?;

    let cmd = app.shell().command(yt_dlp_path).args(args);
    let (rx, child) = cmd.spawn().map_err(|e| e.to_string())?;

    {
        let mut downloads = state.downloads.lock().await;
        downloads.insert(task_id.clone(), child);
    }

    let app_clone = app.clone();
    let task_id_clone = task_id.clone();
    let downloads_arc = state.downloads.clone();

    tauri::async_runtime::spawn(async move {
        let mut output_tracker = OutputPathTracker::default();
        let mut error_msg = String::new();

        let exit_code = drain_command_events(rx, |line| match line {
            CommandLine::Stdout(line) => {
                if let Some(prog) = parse_progress_line(&line) {
                    let _ = app_clone.emit("download-progress", DownloadProgressEvent {
                        task_id: task_id_clone.clone(),
                        progress: prog,
                    });
                }

                output_tracker.observe_line(&line);
            }
            CommandLine::Stderr(line) => {
                if line.to_lowercase().contains("error") {
                    error_msg.push_str(&line);
                    error_msg.push('\n');
                }
            }
        })
        .await;
        let has_error = exit_code != Some(0);

        {
            let mut downloads = downloads_arc.lock().await;
            downloads.remove(&task_id_clone);
        }

        if has_error {
            let _ = app_clone.emit("download-error", DownloadErrorEvent {
                task_id: task_id_clone.clone(),
                error: error_msg.clone(),
            });
            let _ = app_clone.emit("download-finished", DownloadFinishedEvent {
                task_id: task_id_clone,
                output_path: None,
                file_size: None,
                success: false,
                error: Some(error_msg),
            });
        } else {
            let final_output_path = output_tracker.into_path();
            let mut size = None;
            if let Some(ref path) = final_output_path {
                if let Ok(metadata) = std::fs::metadata(path) {
                    size = Some(metadata.len());
                }
            }
            let _ = app_clone.emit("download-finished", DownloadFinishedEvent {
                task_id: task_id_clone,
                output_path: final_output_path,
                file_size: size,
                success: true,
                error: None,
            });
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    state: tauri::State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    let mut downloads = state.downloads.lock().await;
    if let Some(child) = downloads.remove(&task_id) {
        let _ = child.kill();
        Ok(())
    } else {
        Err("Task not found".to_string())
    }
}

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

    #[test]
    fn build_args_for_mode_dispatches_to_video_args() {
        let args = build_args_for_mode("video", None, None, "/path/to/ffmpeg", "/out", "https://example.com/v").unwrap();
        assert_eq!(args, build_video_args("/path/to/ffmpeg", "/out", "https://example.com/v"));
    }

    #[test]
    fn build_args_for_mode_dispatches_to_audio_args() {
        let args = build_args_for_mode(
            "audio",
            Some("mp3".to_string()),
            Some("320".to_string()),
            "/path/to/ffmpeg",
            "/out",
            "https://example.com/v",
        )
        .unwrap();
        assert_eq!(args, build_audio_args("mp3", "320", "/path/to/ffmpeg", "/out", "https://example.com/v"));
    }

    #[test]
    fn build_args_for_mode_rejects_unknown_mode_instead_of_defaulting_to_audio() {
        let result = build_args_for_mode("bogus", None, None, "/path/to/ffmpeg", "/out", "https://example.com/v");
        assert_eq!(result, Err("unknown mode: bogus".to_string()));
    }

    #[test]
    fn parse_output_destination_handles_extract_audio_line() {
        let result = parse_output_destination("[ExtractAudio] Destination: /out/Song.mp3");
        assert_eq!(result, Some((DestinationKind::ExtractAudio, "/out/Song.mp3".to_string())));
    }

    #[test]
    fn parse_output_destination_handles_plain_download_line() {
        let result = parse_output_destination("[download] Destination: /out/Video.mp4");
        assert_eq!(result, Some((DestinationKind::Download, "/out/Video.mp4".to_string())));
    }

    #[test]
    fn parse_output_destination_handles_merger_line_and_strips_quotes() {
        let result = parse_output_destination("[Merger] Merging formats into \"/out/Title.mp4\"");
        assert_eq!(result, Some((DestinationKind::Merger, "/out/Title.mp4".to_string())));
    }

    #[test]
    fn parse_output_destination_returns_none_for_unrelated_line() {
        assert_eq!(parse_output_destination("[youtube] Extracting URL"), None);
    }

    #[test]
    fn output_path_tracker_prefers_a_plain_extract_audio_destination() {
        let mut tracker = OutputPathTracker::default();
        tracker.observe_line("[ExtractAudio] Destination: /out/Song.mp3");
        assert_eq!(tracker.into_path(), Some("/out/Song.mp3".to_string()));
    }

    #[test]
    fn output_path_tracker_handles_single_stream_download_destination() {
        let mut tracker = OutputPathTracker::default();
        tracker.observe_line("[download] Destination: /out/Video.mp4");
        assert_eq!(tracker.into_path(), Some("/out/Video.mp4".to_string()));
    }

    #[test]
    fn output_path_tracker_prefers_merger_line_over_fragment_download_lines() {
        // Reproduces the `-f bestvideo+bestaudio` sequence: a download
        // destination for the video-only fragment, then one for the
        // audio-only fragment, then the merger announcing the final muxed
        // file — whose path is the only one still on disk once yt-dlp
        // deletes the intermediate fragments.
        let mut tracker = OutputPathTracker::default();
        tracker.observe_line("[download] Destination: /out/Title.f299.mp4");
        tracker.observe_line("[download] Destination: /out/Title.f140.m4a");
        tracker.observe_line("[Merger] Merging formats into \"/out/Title.mp4\"");

        assert_eq!(tracker.into_path(), Some("/out/Title.mp4".to_string()));
    }

    #[test]
    fn output_path_tracker_ignores_download_lines_that_arrive_after_the_merger_line() {
        let mut tracker = OutputPathTracker::default();
        tracker.observe_line("[Merger] Merging formats into \"/out/Title.mp4\"");
        tracker.observe_line("[download] Destination: /out/Title.f299.mp4");

        assert_eq!(tracker.into_path(), Some("/out/Title.mp4".to_string()));
    }
}
