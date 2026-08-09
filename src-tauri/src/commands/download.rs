use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::utils::progress_parser::{parse_progress_line, DownloadProgress};
use crate::utils::path_resolver::get_ffmpeg_path;

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

#[tauri::command]
pub async fn download_audio(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    url: String,
    format: String,
    quality: String,
    output_dir: String,
) -> Result<String, String> {
    let task_id = Uuid::new_v4().to_string();
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

    let cmd = app
        .shell()
        .sidecar("binaries/yt-dlp")
        .map_err(|e| e.to_string())?
        .args(args);

    let (mut rx, child) = cmd.spawn().map_err(|e| e.to_string())?;

    {
        let mut downloads = state.downloads.lock().await;
        downloads.insert(task_id.clone(), child);
    }

    let app_clone = app.clone();
    let task_id_clone = task_id.clone();
    let downloads_arc = state.downloads.clone();

    tauri::async_runtime::spawn(async move {
        let mut final_output_path = None;
        let mut has_error = false;
        let mut error_msg = String::new();

        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes).to_string();
                    
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
                tauri_plugin_shell::process::CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes).to_string();
                    if line.to_lowercase().contains("error") {
                        error_msg.push_str(&line);
                        error_msg.push('\n');
                    }
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    has_error = payload.code != Some(0);
                    break;
                }
                _ => {}
            }
        }

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

    Ok(task_id)
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
