use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub duration: f64,
    pub thumbnail_url: Option<String>,
    pub uploader: String,
    pub platform: String,
}

#[tauri::command]
pub async fn fetch_video_info(app: AppHandle, url: String) -> Result<VideoInfo, String> {
    let output = app
        .shell()
        .sidecar("binaries/yt-dlp")
        .map_err(|e| e.to_string())?
        .args(["-j", "--no-playlist", &url])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
        
        // Take the first JSON object (first line)
        let json_str = stdout.lines().next().unwrap_or("{}");
        let parsed: serde_json::Value = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
        
        let id = parsed["id"].as_str().unwrap_or("").to_string();
        let title = parsed["title"].as_str().unwrap_or("Unknown").to_string();
        let duration = parsed["duration"].as_f64().unwrap_or(0.0);
        let thumbnail_url = parsed["thumbnail"].as_str().map(|s| s.to_string());
        let uploader = parsed["uploader"].as_str().unwrap_or("Unknown").to_string();
        let platform = parsed["extractor"].as_str().unwrap_or("Unknown").to_string();
        
        Ok(VideoInfo {
            id,
            title,
            duration,
            thumbnail_url,
            uploader,
            platform,
        })
    } else {
        let stderr = String::from_utf8(output.stderr).unwrap_or_default();
        Err(format!("yt-dlp failed: {}", stderr))
    }
}
