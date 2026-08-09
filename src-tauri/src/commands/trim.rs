use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn trim_audio(
    app: AppHandle,
    input_path: String,
    output_path: String,
    start_time: f64,
    end_time: f64,
) -> Result<(), String> {
    let cmd = app
        .shell()
        .sidecar("binaries/ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-i",
            &input_path,
            "-ss",
            &start_time.to_string(),
            "-to",
            &end_time.to_string(),
            "-c",
            "copy", // fast copy mode
            &output_path,
        ]);

    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8(output.stderr).unwrap_or_default();
        Err(format!("ffmpeg trim failed: {}", stderr))
    }
}
