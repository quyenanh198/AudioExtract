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

/// Picks a binary filename out of a directory listing for `name`, preferring
/// an exact match ("{name}.exe" or bare "{name}") over the sidecar-style
/// "{name}-<target-triple>.exe" pattern. When only prefixed variants are
/// present, picks the lexicographically first one so the result doesn't
/// depend on directory read order (which the OS doesn't guarantee).
fn pick_binary_name(names: &[String], name: &str) -> Option<String> {
    let exe_name = format!("{}.exe", name);
    if names.iter().any(|n| n == &exe_name) {
        return Some(exe_name);
    }
    if names.iter().any(|n| n == name) {
        return Some(name.to_string());
    }

    let prefix = format!("{}-", name);
    let mut prefixed: Vec<&String> = names
        .iter()
        .filter(|n| n.starts_with(&prefix) && n.ends_with(".exe"))
        .collect();
    prefixed.sort();
    prefixed.into_iter().next().cloned()
}

fn find_binary_in_dir(dir: &std::path::Path, name: &str) -> Option<String> {
    let entries = std::fs::read_dir(dir).ok()?;
    let names: Vec<String> = entries
        .flatten()
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    pick_binary_name(&names, name).map(|fname| dir.join(fname).to_string_lossy().to_string())
}

pub fn resolve_binary_path(name: &str) -> Result<String, String> {
    if let Ok(mut exe_path) = std::env::current_exe() {
        exe_path.pop(); // remove executable name, goes to dir

        // Check next to exe (production layout)
        if let Some(found) = find_binary_in_dir(&exe_path, name) {
            return Ok(found);
        }

        // Check dev path (src-tauri/target/debug/../../binaries)
        let dev_binaries = exe_path.join("../../binaries");
        if let Some(found) = find_binary_in_dir(&dev_binaries, name) {
            return Ok(found);
        }
    }

    // Fallback
    Ok(name.to_string())
}

pub fn get_ffmpeg_path(_app: &AppHandle) -> Result<String, String> {
    resolve_binary_path("ffmpeg")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_same_binary_regardless_of_directory_read_order() {
        let names_a = vec![
            "yt-dlp-aarch64-apple-darwin.exe".to_string(),
            "yt-dlp-x86_64-pc-windows-msvc.exe".to_string(),
        ];
        let names_b = vec![
            "yt-dlp-x86_64-pc-windows-msvc.exe".to_string(),
            "yt-dlp-aarch64-apple-darwin.exe".to_string(),
        ];

        let result_a = pick_binary_name(&names_a, "yt-dlp");
        let result_b = pick_binary_name(&names_b, "yt-dlp");

        assert_eq!(
            result_a, result_b,
            "binary selection must not depend on directory read order"
        );
    }

    #[test]
    fn prefers_exact_match_over_prefixed_variant() {
        let names = vec![
            "yt-dlp-x86_64-pc-windows-msvc.exe".to_string(),
            "yt-dlp.exe".to_string(),
        ];
        assert_eq!(
            pick_binary_name(&names, "yt-dlp"),
            Some("yt-dlp.exe".to_string())
        );
    }

    #[test]
    fn returns_none_when_nothing_matches() {
        let names = vec!["ffmpeg.exe".to_string(), "readme.txt".to_string()];
        assert_eq!(pick_binary_name(&names, "yt-dlp"), None);
    }
}
