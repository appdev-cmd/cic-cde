mod documents;
mod issues;
pub mod projects;
pub mod security;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    sync::Arc,
};
static JOB_SEQUENCE: AtomicU64 = AtomicU64::new(1);
struct ImportJob {
    status: Value,
    abort: Option<tokio::task::AbortHandle>,
}

struct TemporaryUpload(PathBuf);

impl TemporaryUpload {
    fn from_input(input: &Value, base: &std::path::Path) -> Option<Self> {
        if input["temporaryUpload"] != true {
            return None;
        }
        let path = PathBuf::from(input["path"].as_str()?);
        let stem = path.file_stem()?.to_str()?;
        if path.parent()? != base.join(".local/uploads")
            || path.extension()?.to_str()? != "ifc"
            || stem.len() != 36
            || !stem.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')
        {
            return None;
        }
        Some(Self(path))
    }
}

impl Drop for TemporaryUpload {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}
use tokio::{process::Command, sync::Mutex};

pub fn root() -> PathBuf {
    if let Some(path) = std::env::var_os("QABIM_ROOT") {
        return PathBuf::from(path);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("workspace root")
}

fn workspace_database_at(base: &std::path::Path) -> Result<rusqlite::Connection, String> {
    let dir = base.join(".local");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let connection =
        rusqlite::Connection::open(dir.join("workspace.sqlite")).map_err(|e| e.to_string())?;
    connection
        .busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    connection
        .execute_batch(include_str!("../migrations/001_initial.sql"))
        .map_err(|e| e.to_string())?;
    connection
        .execute_batch(include_str!("../migrations/002_cde.sql"))
        .map_err(|e| e.to_string())?;
    connection
        .execute_batch(include_str!("../migrations/003_documents.sql"))
        .map_err(|e| e.to_string())?;
    connection
        .execute_batch(include_str!("../migrations/004_security.sql"))
        .map_err(|e| e.to_string())?;
    Ok(connection)
}

fn database() -> Result<rusqlite::Connection, String> {
    let mut connection = workspace_database_at(&root())?;
    connection.execute_batch("CREATE TABLE IF NOT EXISTS cic_migrations (name TEXT PRIMARY KEY);")
        .map_err(|e| e.to_string())?;
    for (name, sql) in [
        ("005_projects", include_str!("../migrations/005_projects.sql")),
        ("006_project_iso19650_roles", include_str!("../migrations/006_project_iso19650_roles.sql")),
        ("007_delete_projects", include_str!("../migrations/007_delete_projects.sql")),
        ("008_project_party_roles", include_str!("../migrations/008_project_party_roles.sql")),
        ("009_project_account_scope", include_str!("../migrations/009_project_account_scope.sql")),
    ] {
        let installed = |conn: &rusqlite::Connection| {
            conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM cic_migrations WHERE name=?1)",
                [name],
                |row| row.get::<_, bool>(0),
            ).map_err(|e| e.to_string())
        };
        if !installed(&connection)? {
            let tx = connection
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .map_err(|e| e.to_string())?;
            if !installed(&tx)? {
                tx.execute_batch(sql).map_err(|e| e.to_string())?;
            }
            tx.commit().map_err(|e| e.to_string())?;
        }
    }
    Ok(connection)
}

fn persist_import(base: &std::path::Path, model: &Value, operation: &str) -> Result<(), String> {
    let mut connection = workspace_database_at(base)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    transaction
        .execute(
            "INSERT OR IGNORE INTO model_versions(id,source_hash,metadata_json) VALUES (?1,?2,?3) ON CONFLICT(id) DO UPDATE SET metadata_json=excluded.metadata_json",
            rusqlite::params![
                model["id"].as_str(),
                model["hash"].as_str(),
                model.to_string()
            ],
        )
        .map_err(|e| e.to_string())?;
    transaction
        .execute(
            "INSERT INTO audit_entries(operation,subject_id) VALUES (?1,?2)",
            rusqlite::params![operation, model["id"].as_str()],
        )
        .map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())
}

#[derive(Clone)]
pub struct Application {
    workspace_root: PathBuf,
    project_sessions: Arc<Mutex<std::collections::HashMap<String, Application>>>,
    state: Arc<Mutex<Value>>,
    import_lock: Arc<Mutex<()>>,
    security_lock: Arc<Mutex<()>>,
    jobs: Arc<Mutex<HashMap<String, ImportJob>>>,
}

impl Default for Application {
    fn default() -> Self {
        Self::at(root())
    }
}

impl Application {
    fn at(base: PathBuf) -> Self {
        let mut data: Value = std::fs::read(root().join("apps/desktop/public/demo.json"))
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or(json!({"models":[],"elements":[],"findings":[]}));
        if base != root() {
            data = json!({"models":[],"elements":[],"findings":[],"synthetic":false});
        }
        if let Ok(connection) = workspace_database_at(&base) {
            if let Ok(mut statement) =
                connection.prepare("SELECT source_hash, metadata_json FROM model_versions")
            {
                if let Ok(rows) = statement
                    .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
                {
                    for (digest, metadata) in rows.flatten() {
                        let imported = std::fs::read(
                            base.join(".local/models").join(digest).join("preview.json"),
                        )
                        .ok()
                        .and_then(|b| serde_json::from_slice::<Value>(&b).ok());
                        if let Some(mut imported) = imported {
                            if let Ok(saved) = serde_json::from_str::<Value>(&metadata) {
                                imported["model"]["name"] = saved["name"].clone();
                                if saved["transform"].is_object() {
                                    imported["model"]["transform"] = saved["transform"].clone();
                                }
                            }
                            if let Some(models) = data["models"].as_array_mut() {
                                models.push(imported["model"].clone());
                            }
                            if let (Some(elements), Some(items)) = (
                                data["elements"].as_array_mut(),
                                imported["elements"].as_array(),
                            ) {
                                elements.extend(items.clone());
                            }
                        }
                    }
                }
            }
        }
        Self {
            workspace_root: base,
            project_sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
            state: Arc::new(Mutex::new(data)),
            import_lock: Arc::new(Mutex::new(())),
            security_lock: Arc::new(Mutex::new(())),
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Application {
    pub async fn for_project(&self, id: &str) -> Result<Self, String> {
        if id == "demo-project" {
            return Ok(self.clone());
        }
        uuid::Uuid::parse_str(id).map_err(|_| "INVALID_PROJECT")?;
        let mut sessions = self.project_sessions.lock().await;
        if let Some(app) = sessions.get(id) {
            return Ok(app.clone());
        }
        let base = root().join(".local/projects").join(id);
        let mut app = tokio::task::spawn_blocking(move || Self::at(base))
            .await
            .map_err(|e| e.to_string())?;
        app.import_lock = self.import_lock.clone();
        sessions.insert(id.into(), app.clone());
        Ok(app)
    }
    pub fn workspace_root(&self) -> &std::path::Path {
        &self.workspace_root
    }
    pub async fn geometry_bytes(&self, asset_id: &str) -> Result<Vec<u8>, String> {
        let state = self.state.lock().await;
        let mut path = None;
        for model in state["models"].as_array().into_iter().flatten() {
            for asset in model["geometryAssets"].as_array().into_iter().flatten() {
                if asset["id"] != asset_id {
                    continue;
                }
                let file = asset["file"].as_str().ok_or("INVALID_ASSET")?;
                if !file.ends_with(".qmesh")
                    || file.contains('/')
                    || file.contains('\\')
                    || file.contains("..")
                {
                    return Err("INVALID_ASSET".into());
                }
                path = Some(if model["synthetic"].as_bool().unwrap_or(false) {
                    root().join("apps/desktop/public/geometry").join(file)
                } else {
                    let digest = model["hash"].as_str().ok_or("INVALID_SNAPSHOT")?;
                    if digest.len() != 64 || !digest.chars().all(|c| c.is_ascii_hexdigit()) {
                        return Err("INVALID_SNAPSHOT".into());
                    }
                    self.workspace_root
                        .join(".local/models")
                        .join(digest)
                        .join(file)
                });
                break;
            }
        }
        drop(state);
        let path = path.ok_or("ASSET_NOT_REGISTERED")?;
        let metadata = tokio::fs::metadata(&path)
            .await
            .map_err(|e| e.to_string())?;
        if metadata.len() > 32 * 1024 * 1024 {
            return Err("ASSET_TOO_LARGE".into());
        }
        tokio::fs::read(path).await.map_err(|e| e.to_string())
    }
    pub async fn call(&self, operation: &str, input: Value) -> Result<Value, String> {
        match operation {
            "model.import.start" => {
                let upload = TemporaryUpload::from_input(&input, &self.workspace_root);
                let id = format!(
                    "import-{}-{}",
                    JOB_SEQUENCE.fetch_add(1, Ordering::Relaxed),
                    uuid::Uuid::new_v4().simple()
                );
                let mut jobs = self.jobs.lock().await;
                if jobs
                    .values()
                    .any(|j| j.status["cancellable"] == true || j.status["phase"] == "committing")
                {
                    return Err("IMPORT_ALREADY_RUNNING".into());
                }
                if jobs.len() >= 16 {
                    if let Some(oldest) = jobs
                        .keys()
                        .min_by_key(|id| {
                            id.split('-')
                                .nth(1)
                                .and_then(|n| n.parse::<u64>().ok())
                                .unwrap_or(0)
                        })
                        .cloned()
                    {
                        jobs.remove(&oldest);
                    }
                }
                jobs.insert(
                    id.clone(),
                    ImportJob {
                        status: json!({"id":id,"phase":"queued","cancellable":true}),
                        abort: None,
                    },
                );
                let app = self.clone();
                let task_id = id.clone();
                let mut input = input;
                input["jobId"] = json!(id);
                let handle = tokio::spawn(async move {
                    let _upload = upload;
                    let result = app.import_model(input).await;
                    let mut jobs = app.jobs.lock().await;
                    if let Some(job) = jobs.get_mut(&task_id) {
                        job.status = match result {
                            Ok(value) => {
                                json!({"id":task_id,"phase":"completed","cancellable":false,"result":value})
                            }
                            Err(error) => {
                                json!({"id":task_id,"phase":"failed","cancellable":false,"error":error})
                            }
                        };
                        job.abort = None;
                    }
                });
                jobs.get_mut(&id).unwrap().abort = Some(handle.abort_handle());
                Ok(json!({"jobId":id}))
            }
            "jobs.get" => {
                let jobs = self.jobs.lock().await;
                Ok(jobs
                    .get(input["jobId"].as_str().unwrap_or(""))
                    .ok_or("JOB_NOT_FOUND")?
                    .status
                    .clone())
            }
            "jobs.cancel" => {
                let mut jobs = self.jobs.lock().await;
                let job = jobs
                    .get_mut(input["jobId"].as_str().unwrap_or(""))
                    .ok_or("JOB_NOT_FOUND")?;
                if job.status["cancellable"] == true {
                    if let Some(abort) = job.abort.take() {
                        abort.abort();
                    }
                    job.status["phase"] = json!("cancelled");
                    job.status["cancellable"] = json!(false);
                }
                Ok(job.status.clone())
            }

            "documents.list" | "documents.register" | "documents.transition" => {
                let operation = operation.to_owned();
                {
                    let base = self.workspace_root.clone();
                    tokio::task::spawn_blocking(move || {
                        documents::execute(&base, &operation, input)
                    })
                }
                .await
                .map_err(|e| e.to_string())?
            }
            "issues.list" | "issues.create" | "issues.comment" | "issues.update" => {
                let operation = operation.to_owned();
                {
                    let base = self.workspace_root.clone();
                    tokio::task::spawn_blocking(move || issues::execute(&base, &operation, input))
                }
                .await
                .map_err(|e| e.to_string())?
            }
            "health" => Ok(
                json!({"status":"ready","core":"rust","protocolVersion":1,"ai":"mock","mcp":"local"}),
            ),
            "project.get" => Ok(
                json!({"id":"demo-project","name":"Riverside Tower","phase":"Design coordination","demo":true}),
            ),
            "models.list" => Ok(self.state.lock().await["models"].clone()),
            "workspace.get" => Ok(self.state.lock().await.clone()),
            "elements.search" => {
                let state = self.state.lock().await;
                let q = input["query"].as_str().unwrap_or("").to_lowercase();
                let limit = input["limit"].as_u64().unwrap_or(100).min(500) as usize;
                let all: Vec<_> = state["elements"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|e| {
                        ["name", "ifcClass", "globalId", "storey"]
                            .iter()
                            .any(|field| {
                                e[*field].as_str().unwrap_or("").to_lowercase().contains(&q)
                            })
                    })
                    .map(|e| {
                        let mut item = e.clone();
                        if let Some(object) = item.as_object_mut() {
                            object.remove("vertices");
                            object.remove("indices");
                        }
                        item
                    })
                    .collect();
                Ok(
                    json!({"total":all.len(),"items":all.iter().take(limit).collect::<Vec<_>>(),"truncated":all.len()>limit}),
                )
            }
            "tools.list" => Ok(json!([
                {"operation":"project.get","effect":"read"},
                {"operation":"models.list","effect":"read"},
                {"operation":"elements.search","effect":"read"},
                {"operation":"worker.hello","effect":"read"}
            ])),
            "assistant.command" => {
                let prompt = input["prompt"].as_str().unwrap_or("").to_lowercase();
                let state = self.state.lock().await;
                let mut actions = vec![];
                let reply = if prompt.contains("hvac") {
                    let hidden: Vec<_> = state["models"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter(|m| m["discipline"] != "HVAC")
                        .map(|m| m["id"].clone())
                        .collect();
                    actions.push(json!({"operation":"view.isolate","hiddenModelIds":hidden}));
                    "Đã cô lập HVAC theo bộ lệnh mock của Rust core.".to_string()
                } else if prompt.contains("tầng 5") || prompt.contains("l05") {
                    actions.push(json!({"operation":"view.floor","floor":"L05"}));
                    "Đã lọc tầng L05 theo bộ lệnh mock của Rust core.".to_string()
                } else if prompt.contains("dầm") {
                    let count = state["elements"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter(|e| e["ifcClass"] == "IfcBeam")
                        .count();
                    actions.push(json!({"operation":"elements.filter","query":"IfcBeam"}));
                    format!("Có {count} dầm trong dữ liệu hiện tại. Đã lọc theo IfcBeam.")
                } else if prompt.contains("tổng quan") {
                    format!("Workspace có {} mô hình và {} cấu kiện. Số liệu lấy từ dữ liệu đang tải; kết quả kiểm tra cần tham chiếu runId.",state["models"].as_array().map_or(0,Vec::len),state["elements"].as_array().map_or(0,Vec::len))
                } else {
                    "Bộ lệnh mock hỗ trợ: hiện riêng HVAC, tìm dầm, hiện tầng 5, tổng quan mô hình. Chưa kết nối AI provider.".to_string()
                };
                Ok(json!({"provider":"mock","reply":reply,"actions":actions}))
            }
            "worker.hello" => self.worker("worker.hello", json!({})).await,
            "models.transform" => {
                let _guard = self.import_lock.lock().await;
                let id = input["modelId"].as_str().ok_or("MODEL_REQUIRED")?;
                let offset = input["translation"].as_array().ok_or("INVALID_TRANSFORM")?;
                let angle = input["rotationZDegrees"]
                    .as_f64()
                    .ok_or("INVALID_TRANSFORM")?;
                if offset.len() != 3
                    || offset
                        .iter()
                        .any(|v| v.as_f64().map_or(true, |n| !n.is_finite() || n.abs() > 1e8))
                    || !angle.is_finite()
                    || angle.abs() > 360.
                {
                    return Err("INVALID_TRANSFORM".into());
                }
                let mut model = {
                    let state = self.state.lock().await;
                    state["models"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .find(|m| m["id"] == id)
                        .cloned()
                        .ok_or("MODEL_NOT_FOUND")?
                };
                if model["synthetic"].as_bool().unwrap_or(false) {
                    return Err("DEMO_ALIGNMENT_NOT_EDITABLE".into());
                }
                let revision = model["transform"]["revision"].as_u64().unwrap_or(0);
                if input["expectedRevision"].as_u64() != Some(revision) {
                    return Err("REVISION_CONFLICT".into());
                }
                model["transform"] =
                    json!({"translation":offset,"rotationZDegrees":angle,"revision":revision+1});
                let saved = model.clone();
                {
                    let base = self.workspace_root.clone();
                    tokio::task::spawn_blocking(move || {
                        persist_import(&base, &saved, "models.transform")
                    })
                }
                .await
                .map_err(|e| e.to_string())??;
                let mut state = self.state.lock().await;
                for item in state["models"].as_array_mut().ok_or("INVALID_STATE")? {
                    if item["id"] == id {
                        *item = model.clone();
                    }
                }
                Ok(model)
            }
            "checks.run" => {
                let _guard = self.import_lock.lock().await;
                let legacy_id = input["modelId"].as_str().unwrap_or("demo").to_owned();
                let parse_ids = |key: &str| -> Result<Vec<String>, String> {
                    if let Some(array) = input[key].as_array() {
                        if array.is_empty() || array.len() > 12 {
                            return Err("INVALID_MODEL_SCOPE".into());
                        }
                        array
                            .iter()
                            .map(|v| {
                                v.as_str()
                                    .map(str::to_owned)
                                    .ok_or("INVALID_MODEL_SCOPE".into())
                            })
                            .collect()
                    } else {
                        Ok(vec![legacy_id.clone()])
                    }
                };
                let ids_a = parse_ids("modelIdsA")?;
                let ids_b = parse_ids("modelIdsB")?;
                let ids: std::collections::BTreeSet<_> =
                    ids_a.iter().chain(&ids_b).cloned().collect();
                let mut sources = vec![];
                {
                    let state = self.state.lock().await;
                    for model_id in ids {
                        if model_id == "demo" {
                            if self.workspace_root != root() {
                                return Err("MODEL_NOT_FOUND".into());
                            }
                            sources.push(json!({"modelId":"demo","path":root().join("tests/fixtures/synthetic/riverside-demo.ifc"),"idPrefix":"demo:","transform":{"translation":[0,0,0],"rotationZDegrees":0,"revision":0}}));
                        } else {
                            let model = state["models"]
                                .as_array()
                                .into_iter()
                                .flatten()
                                .find(|m| m["id"] == model_id)
                                .ok_or("MODEL_NOT_FOUND")?;
                            let hash = model["hash"].as_str().ok_or("MODEL_HAS_NO_SNAPSHOT")?;
                            if hash.len() != 64 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
                                return Err("INVALID_SNAPSHOT".into());
                            }
                            sources.push(json!({"modelId":model_id,"path":self.workspace_root.join(".local/models").join(hash).join("source.ifc"),"sourceHash":hash,"transform":model.get("transform").cloned().unwrap_or(json!({"translation":[0,0,0],"rotationZDegrees":0,"revision":0}))}));
                        }
                    }
                }
                let mut result=self.worker("checks.run",json!({"sources":sources,"modelIdsA":ids_a,"modelIdsB":ids_b,
                    "classA":input["classA"].as_str().unwrap_or("IfcDuctSegment"),"classB":input["classB"].as_str().unwrap_or("IfcBeam"),
                    "floor":input["floor"].as_str().unwrap_or("all"),"tolerance":input["tolerance"].as_f64().unwrap_or(0.002)})).await?;
                {
                    let state = self.state.lock().await;
                    for finding in result["findings"].as_array().into_iter().flatten() {
                        for side in ["a", "b"] {
                            if !state["elements"]
                                .as_array()
                                .into_iter()
                                .flatten()
                                .any(|e| e["id"] == finding[side])
                            {
                                return Err(
                                    "STALE_WORKSPACE: reload the model before checking".into()
                                );
                            }
                        }
                    }
                }
                let run_id = format!(
                    "run-{}",
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map_err(|e| e.to_string())?
                        .as_nanos()
                );
                result["runId"] = json!(run_id);
                let saved = result.clone();
                let base = self.workspace_root.clone();
                tokio::task::spawn_blocking(move || -> Result<(), String> {
                    let conn = workspace_database_at(&base)?;
                    conn.execute(
                        "INSERT INTO check_runs(id,source_hash,result_json) VALUES (?1,?2,?3)",
                        rusqlite::params![
                            saved["runId"].as_str(),
                            saved["sourceHash"].as_str(),
                            saved.to_string()
                        ],
                    )
                    .map_err(|e| e.to_string())?;
                    Ok(())
                })
                .await
                .map_err(|e| e.to_string())??;
                Ok(result)
            }
            "model.import" => {
                let _upload = TemporaryUpload::from_input(&input, &self.workspace_root);
                self.import_model(input).await
            }
            _ => Err(format!("UNSUPPORTED_OPERATION: {operation}")),
        }
    }

    async fn import_model(&self, input: Value) -> Result<Value, String> {
        let _guard = self.import_lock.lock().await;
        if let Some(id) = input["jobId"].as_str() {
            if let Some(job) = self.jobs.lock().await.get_mut(id) {
                job.status["phase"] = json!("processing");
            }
        }
        let path = input["path"].as_str().ok_or("Missing path")?;
        let mut imported = self
            .worker("model.import", json!({"path":path,"name":input["name"]}))
            .await?;
        {
            let state = self.state.lock().await;
            if let Some(previous) = state["models"]
                .as_array()
                .into_iter()
                .flatten()
                .find(|m| m["id"] == imported["model"]["id"])
            {
                if previous["transform"].is_object() {
                    imported["model"]["transform"] = previous["transform"].clone();
                }
            }
        }
        if let Some(id) = input["jobId"].as_str() {
            if let Some(job) = self.jobs.lock().await.get_mut(id) {
                job.status["phase"] = json!("committing");
                job.status["cancellable"] = json!(false);
            }
        }
        let model = imported["model"].clone();
        {
            let base = self.workspace_root.clone();
            tokio::task::spawn_blocking(move || persist_import(&base, &model, "model.import"))
        }
        .await
        .map_err(|e| e.to_string())??;
        let mut state = self.state.lock().await;
        if state["models"]
            .as_array()
            .into_iter()
            .flatten()
            .any(|m| m["id"] == imported["model"]["id"])
        {
            for model in state["models"].as_array_mut().unwrap() {
                if model["id"] == imported["model"]["id"] {
                    *model = imported["model"].clone();
                }
            }
            let id = imported["model"]["id"].clone();
            state["elements"]
                .as_array_mut()
                .unwrap()
                .retain(|e| e["modelId"] != id);
            state["elements"]
                .as_array_mut()
                .unwrap()
                .extend(imported["elements"].as_array().unwrap().clone());
            return Ok(imported);
        }
        state["models"]
            .as_array_mut()
            .ok_or("Invalid model state")?
            .push(imported["model"].clone());
        let items = imported["elements"]
            .as_array()
            .ok_or("Invalid worker result")?;
        state["elements"]
            .as_array_mut()
            .ok_or("Invalid element state")?
            .extend(items.clone());
        Ok(imported)
    }

    async fn worker(&self, method: &str, params: Value) -> Result<Value, String> {
        let python = std::env::var("QABIM_PYTHON").unwrap_or_else(|_| "python".into());
        let mut child = Command::new(python);
        child
            .env("QABIM_DATA_DIR", self.workspace_root.join(".local"))
            .arg(root().join("workers/bim/src/qabim_worker/main.py"))
            .arg("--once")
            .arg(method)
            .arg(params.to_string())
            .kill_on_drop(true);
        #[cfg(windows)]
        child.creation_flags(0x08000000);
        let output = tokio::time::timeout(std::time::Duration::from_secs(120), child.output())
            .await
            .map_err(|_| "WORKER_TIMEOUT".to_owned())?
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr)
                .chars()
                .take(1500)
                .collect());
        }
        let envelope: Value =
            serde_json::from_slice(&output.stdout).map_err(|e| format!("WORKER_PROTOCOL: {e}"))?;
        if let Some(error) = envelope.get("error") {
            return Err(error.to_string());
        }
        envelope
            .get("result")
            .cloned()
            .ok_or_else(|| "WORKER_PROTOCOL: missing result".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn queued_import_can_be_cancelled_without_workspace_changes() {
        let app = Application::default();
        let before = app.state.lock().await.clone();
        let guard = app.import_lock.lock().await;
        let job = app
            .call("model.import.start", json!({"path":"unused.ifc"}))
            .await
            .unwrap();
        assert!(app
            .call("model.import.start", json!({"path":"unused.ifc"}))
            .await
            .is_err());
        let status = app.call("jobs.cancel", job.clone()).await.unwrap();
        assert_eq!(status["phase"], "cancelled");
        drop(guard);
        tokio::task::yield_now().await;
        assert_eq!(*app.state.lock().await, before);
        assert_eq!(
            app.call("jobs.get", job).await.unwrap()["phase"],
            "cancelled"
        );
    }
    #[tokio::test]
    async fn committing_import_rejects_cancellation() {
        let app = Application::default();
        app.jobs.lock().await.insert(
            "committing".into(),
            ImportJob {
                status: json!({"phase":"committing","cancellable":false}),
                abort: None,
            },
        );
        assert_eq!(
            app.call("jobs.cancel", json!({"jobId":"committing"}))
                .await
                .unwrap()["phase"],
            "committing"
        );
    }
    #[tokio::test]
    async fn query_is_bounded_and_unknown_operations_fail() {
        let app = Application::default();
        let result = app
            .call("elements.search", json!({"limit":1}))
            .await
            .unwrap();
        assert!(result["items"].as_array().unwrap().len() <= 1);
        for item in result["items"].as_array().unwrap() {
            assert!(item.get("vertices").is_none());
            assert!(item.get("indices").is_none());
        }
        assert!(app.call("shell.execute", json!({})).await.is_err());
    }
}
