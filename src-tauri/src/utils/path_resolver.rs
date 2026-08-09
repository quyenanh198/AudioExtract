use std::process::Command;
use tauri::AppHandle;

#[tauri::command]
pub fn get_default_output_dir() -> Result<String, String> {
    let download_dir = dirs::download_dir().ok_or("Could not find downloads directory")?;
    let target = download_dir.join("AudioExtract");
    if !target.exists() {
        std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    }
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_file_in_explorer(path: String) -> Result<(), String> {
    Command::new("explorer")
        .args(["/select,", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_ffmpeg_path(_app: &AppHandle) -> Result<String, String> {
    // Find the ffmpeg sidecar binary path safely to pass it via --ffmpeg-location
    if let Ok(mut exe_path) = std::env::current_exe() {
        exe_path.pop(); // remove executable name, goes to dir
        
        // Check next to exe (production layout)
        if let Ok(entries) = std::fs::read_dir(&exe_path) {
            for entry in entries.flatten() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if fname.starts_with("ffmpeg-") && fname.ends_with(".exe") {
                    return Ok(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Check dev path (src-tauri/target/debug/../../binaries)
        let dev_binaries = exe_path.join("../../binaries");
        if let Ok(entries) = std::fs::read_dir(&dev_binaries) {
            for entry in entries.flatten() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if fname.starts_with("ffmpeg-") && fname.ends_with(".exe") {
                    return Ok(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    
    // Fallback if we cannot locate it dynamically
    Ok("ffmpeg".to_string())
}
