#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use qabim_application::Application;
use tauri::Manager;
#[tauri::command]
async fn geometry_read(
    state: tauri::State<'_, Application>,
    asset_id: String,
) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(
        state.geometry_bytes(&asset_id).await?,
    ))
}
#[tauri::command]
async fn application_call(
    state: tauri::State<'_, Application>,
    operation: String,
    input: serde_json::Value,
) -> Result<serde_json::Value, String> {
    state.call(&operation, input).await
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Application::default())
        .setup(|app| {
            // One owner: native commands, browser preview and MCP share this state.
            // Fail rather than silently attaching MCP to a different project process.
            let listener = std::net::TcpListener::bind("127.0.0.1:4318")?;
            listener.set_nonblocking(true)?;
            let state = app.state::<Application>().inner().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = qabim_host::serve_std(listener, state).await {
                    eprintln!("Local development bridge stopped: {error}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![application_call, geometry_read])
        .run(tauri::generate_context!())
        .expect("desktop startup failed");
}
