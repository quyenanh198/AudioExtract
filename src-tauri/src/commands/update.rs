use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use crate::utils::process_events::{drain_command_events, CommandLine};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFinished {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn check_ytdlp_update(app: AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .sidecar("binaries/yt-dlp")
        .map_err(|e| e.to_string())?
        .args(["--update-to", "nightly", "--simulate"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8(output.stdout).unwrap_or_default();
    let stderr = String::from_utf8(output.stderr).unwrap_or_default();
    
    let combined = format!("{}\n{}", stdout, stderr);
    Ok(combined.trim().to_string())
}

#[tauri::command]
pub async fn update_ytdlp(app: AppHandle) -> Result<(), String> {
    let cmd = app
        .shell()
        .sidecar("binaries/yt-dlp")
        .map_err(|e| e.to_string())?
        .args(["--update"]);

    let (rx, _child) = cmd.spawn().map_err(|e| e.to_string())?;

    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut final_msg = String::new();

        let exit_code = drain_command_events(rx, |line| {
            let text = match line {
                CommandLine::Stdout(l) | CommandLine::Stderr(l) => l,
            };
            final_msg.push_str(&text);
            final_msg.push('\n');
            let _ = app_clone.emit("ytdlp-update-progress", UpdateProgress {
                message: text,
            });
        })
        .await;
        let success = exit_code == Some(0);

        let _ = app_clone.emit("ytdlp-update-finished", UpdateFinished {
            success,
            message: final_msg.trim().to_string(),
        });
    });

    Ok(())
}
