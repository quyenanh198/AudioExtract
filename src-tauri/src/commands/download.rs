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

#[tauri::command]
pub async fn download_audio(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    task_id: String,
    url: String,
    format: String,
    quality: String,
    output_dir: String,
) -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;

    let mut args = vec![
        "--newline".to_string(),
        "--extract-audio".to_string(),
        "--audio-format".to_string(),
        format,
        "--audio-quality".to_string(),
        quality,
        "--ffmpeg-location".to_string(),
        ffmpeg_path,
        "-o".to_string(),
        format!("{}/%(title)s.%(ext)s", output_dir),
    ];

    args.push(url.clone());

    let yt_dlp_path = crate::utils::path_resolver::resolve_binary_path("yt-dlp")?;
    let cmd = app
        .shell()
        .command(yt_dlp_path)
        .args(args);

    let (rx, child) = cmd.spawn().map_err(|e| e.to_string())?;

    {
        let mut downloads = state.downloads.lock().await;
        downloads.insert(task_id.clone(), child);
    }

    let app_clone = app.clone();
    let task_id_clone = task_id.clone();
    let downloads_arc = state.downloads.clone();

    tauri::async_runtime::spawn(async move {
        let mut final_output_path = None;
        let mut error_msg = String::new();

        let exit_code = drain_command_events(rx, |line| match line {
            CommandLine::Stdout(line) => {
                if let Some(prog) = parse_progress_line(&line) {
                    let _ = app_clone.emit("download-progress", DownloadProgressEvent {
                        task_id: task_id_clone.clone(),
                        progress: prog,
                    });
                }

                if line.contains("[ExtractAudio] Destination: ") {
                    let path = line.split("[ExtractAudio] Destination: ").nth(1).unwrap_or("").trim().to_string();
                    if !path.is_empty() { final_output_path = Some(path); }
                } else if line.contains("[download] Destination: ") {
                    let path = line.split("[download] Destination: ").nth(1).unwrap_or("").trim().to_string();
                    if !path.is_empty() { final_output_path = Some(path); }
                }
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
}
