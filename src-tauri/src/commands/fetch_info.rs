use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use tokio::process::Command;
use crate::utils::path_resolver::resolve_binary_path;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub duration: f64,
    pub thumbnail_url: Option<String>,
    pub uploader: String,
    pub platform: String,
    pub original_url: Option<String>,
}

#[tauri::command]
pub async fn fetch_video_info(_app: AppHandle, url: String) -> Result<Vec<VideoInfo>, String> {
    let yt_dlp_path = resolve_binary_path("yt-dlp")?;
    
    let mut cmd = Command::new(yt_dlp_path);
    cmd.args(["-j", "--flat-playlist", &url]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    
    let output = cmd.output()
        .await
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8(output.stdout).map_err(|e| format!("Failed to read stdout: {}", e))?;
        
        let mut videos = Vec::new();
        for line in stdout.lines() {
            let line = line.trim();
            if line.starts_with('{') {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(line) {
                    let id = parsed["id"].as_str().unwrap_or("").to_string();
                    let title = parsed["title"].as_str().unwrap_or("Unknown").to_string();
                    let duration = parsed["duration"].as_f64().unwrap_or(0.0);
                    let thumbnail_url = parsed["thumbnail"].as_str().map(|s| s.to_string());
                    let uploader = parsed["uploader"].as_str().unwrap_or("Unknown").to_string();
                    let platform = parsed["extractor"].as_str().unwrap_or("Unknown").to_string();
                    let original_url = parsed["webpage_url"].as_str().or(parsed["url"].as_str()).map(|s| s.to_string());
                    
                    videos.push(VideoInfo {
                        id,
                        title,
                        duration,
                        thumbnail_url,
                        uploader,
                        platform,
                        original_url,
                    });
                }
            }
        }
        
        if videos.is_empty() {
            return Err(format!("Could not find valid JSON in output. Stdout: {}", stdout));
        }
        
        Ok(videos)
    } else {
        let stderr = String::from_utf8(output.stderr).unwrap_or_default();
        Err(format!("yt-dlp failed: {}", stderr))
    }
}
