mod commands;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(commands::download::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_info::fetch_video_info,
            commands::download::download_media,
            commands::download::cancel_download,
            commands::trim::trim_audio,
            commands::update::check_ytdlp_update,
            commands::update::update_ytdlp,
            utils::path_resolver::get_default_output_dir,
            utils::path_resolver::open_file_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
