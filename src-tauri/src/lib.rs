use tauri::Manager;

/// Save artifact content to the user's Documents/Roundtable folder.
#[tauri::command]
fn save_artifact_file(app: tauri::AppHandle, name: String, content: String) -> Result<String, String> {
  let docs = app.path().document_dir().map_err(|e| e.to_string())?
    .join("Roundtable");
  std::fs::create_dir_all(&docs).map_err(|e| e.to_string())?;
  let path = docs.join(&name);
  std::fs::write(&path, content).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  use tauri::Manager;
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![save_artifact_file])
    .setup(|app| {
      // Start the local proxy server (server.js) so the webview can reach
      // FreeLLMAPI on localhost:5173 (same-origin). Without this, the
      // webview's browser fetch is blocked by FreeLLMAPI's
      // Cross-Origin-Resource-Policy: same-origin header.
      if !cfg!(debug_assertions) {
        let app_handle = app.handle().clone();
        let resource_dir = app_handle.path().resource_dir().ok();
        let resource_dir_up = resource_dir.clone();
        let current_dir = std::env::current_dir().unwrap_or_default();

        // Look for server.js in: resource dir (+ _up_ subdir), current dir, or project root
        let candidates = [
          resource_dir.map(|p| p.join("server.js")),
          resource_dir_up.map(|p| p.join("_up_/server.js")),
          Some(current_dir.join("server.js")),
          // Tauri sets CWD to the .app/Contents/MacOS dir; go up 3 levels
          Some(current_dir.join("../../server.js")),
        ];

        // If a proxy is already answering on 5173 (stale process from a
        // previous launch), don't spawn another — it would fail with
        // EADDRINUSE and exit, leaving no working proxy.
        let port_alive = std::net::TcpStream::connect_timeout(
          &"127.0.0.1:5173".parse().unwrap(),
          std::time::Duration::from_millis(300),
        ).is_ok();

        if !port_alive {
          for candidate in candidates.iter().flatten() {
            if candidate.exists() {
              let mut cmd = std::process::Command::new("node");
              cmd.arg(&candidate).arg("--tauri");
              if let Ok(mut child) = cmd.spawn() {
                // Detach so it lives as long as the app does
                let _ = child;
                println!("[tauri] Started local proxy: {:?}", candidate);
              }
              break;
            }
          }
        } else {
          println!("[tauri] Proxy already running on 5173, reusing");
        }
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}