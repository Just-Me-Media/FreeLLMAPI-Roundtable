use tauri::Manager;

/// A plain file name only: no folders, no "..", no drive letters, no control characters.
fn safe_file_name(name: &str) -> Result<&str, String> {
  let n = name.trim();
  let bad = n.is_empty()
    || n.len() > 120
    || n == "."
    || n == ".."
    || n.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control());
  if bad { Err("Invalid file name".to_string()) } else { Ok(n) }
}

/// Save artifact content.
///
/// `folder` (optional): the directory returned by the native Save-As dialog.
/// When provided, the file is written there (the folder is trusted — the user
/// chose it). When omitted, the file falls back to Documents/Roundtable.
/// In both cases the *file name* itself is sanitized against path traversal.
#[tauri::command]
fn save_artifact_file(app: tauri::AppHandle, name: String, content: String, folder: Option<String>) -> Result<String, String> {
  let name = safe_file_name(&name)?;
  let dir: std::path::PathBuf = if let Some(folder) = folder {
    // User-chosen folder — trust it, but normalize and validate it exists.
    let f = std::path::PathBuf::from(&folder);
    if !f.is_dir() {
      return Err(format!("Chosen folder does not exist or is not a directory: {}", folder));
    }
    f
  } else {
    app.path().document_dir().map_err(|e| e.to_string())?
      .join("Roundtable")
  };
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join(name);
  std::fs::write(&path, content).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![save_artifact_file])
    .setup(|app| {
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
#[cfg(test)]
mod tests {
  use super::safe_file_name;
  #[test]
  fn accepts_plain_names() { assert_eq!(safe_file_name(" notes v2.md ").unwrap(), "notes v2.md"); }
  #[test]
  fn rejects_paths_and_tricks() {
    for bad in ["", "..", ".", "../x", "a/b", "a\\b", "C:\\x", "/etc/passwd", "a\0b", "x|y"] {
      assert!(safe_file_name(bad).is_err(), "{bad:?} should be rejected");
    }
  }
}
