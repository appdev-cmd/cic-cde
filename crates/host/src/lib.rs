use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use qabim_application::{
    security::{self, Principal},
    Application,
};
use serde_json::{json, Value};
use tokio::io::AsyncWriteExt;
use tower_http::cors::CorsLayer;

const MAX_IFC_BYTES: usize = 500_000_000;

fn session_token(request: &axum::extract::Request) -> String {
    if let Some(token) = request
        .headers()
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
    {
        return token.into();
    }
    request
        .headers()
        .get("cookie")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| {
            s.split(';')
                .find_map(|part| part.trim().strip_prefix("ciccde_session="))
        })
        .unwrap_or("")
        .to_owned()
}
async fn authenticate(
    mut request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    if std::env::var("QABIM_AUTH_REQUIRED").as_deref() != Ok("1")
        || ["/health", "/auth/login", "/auth/join"].contains(&request.uri().path())
    {
        return next.run(request).await;
    }
    let token = session_token(&request);
    match tokio::task::spawn_blocking(move || security::authenticate(&token)).await {
        Ok(Ok(user)) => {
            request.extensions_mut().insert(user);
            next.run(request).await
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"UNAUTHORIZED"})),
        )
            .into_response(),
    }
}
async fn login(Json(input): Json<Value>) -> axum::response::Response {
    static LOGIN_LIMIT: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
    let permit = match LOGIN_LIMIT.try_acquire() {
        Ok(permit) => permit,
        Err(_) => {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({"error":"Thử lại sau vài giây"})),
            )
                .into_response()
        }
    };
    let result = tokio::task::spawn_blocking(move || security::login(input)).await;
    drop(permit);
    match result {
        Ok(Ok(value)) => {
            let cookie = format!(
                "ciccde_session={}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800",
                value["token"].as_str().unwrap_or("")
            );
            (
                [
                    (axum::http::header::SET_COOKIE, cookie),
                    (axum::http::header::CACHE_CONTROL, "no-store".into()),
                ],
                Json(value),
            )
                .into_response()
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(
                json!({"error":"Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản tạm khóa"}),
            ),
        )
            .into_response(),
    }
}
async fn join(Json(input): Json<Value>) -> axum::response::Response {
    match tokio::task::spawn_blocking(move ||qabim_application::projects::join(input)).await {
        Ok(Ok(value))=>{
            let cookie=format!("ciccde_session={}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800",value["token"].as_str().unwrap_or(""));
            ([(axum::http::header::SET_COOKIE,cookie),(axum::http::header::CACHE_CONTROL,"no-store".into())],Json(value)).into_response()
        }
        _=>(StatusCode::BAD_REQUEST,Json(json!({"error":"Lời mời không hợp lệ, đã dùng hoặc thông tin tài khoản chưa hợp lệ"}))).into_response()
    }
}
fn selected_project(headers: &HeaderMap) -> &str {
    headers
        .get("x-cic-project")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("demo-project")
}
async fn project_context(
    app: &Application,
    user: Option<&Principal>,
    headers: &HeaderMap,
) -> Result<(Application, Option<Principal>), String> {
    if let Some(user) = user {
        let scoped = qabim_application::projects::scope(user, selected_project(headers))?;
        let project = app.for_project(&scoped.project_id).await?;
        Ok((project, Some(scoped)))
    } else {
        Ok((app.clone(), None))
    }
}
async fn logout(request: axum::extract::Request) -> axum::response::Response {
    let token = session_token(&request);
    let result = tokio::task::spawn_blocking(move || security::logout(&token)).await;
    if !matches!(result, Ok(Ok(()))) {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
    (
        [(
            axum::http::header::SET_COOKIE,
            "ciccde_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        )],
        Json(json!({"ok":true})),
    )
        .into_response()
}
async fn me(user: Option<Extension<Principal>>) -> Json<Value> {
    Json(
        json!({"user":user.map(|u|u.public()),"required":std::env::var("QABIM_AUTH_REQUIRED").as_deref()==Ok("1")}),
    )
}
async fn invoke(
    app: &Application,
    user: Option<&Principal>,
    operation: &str,
    input: Value,
    headers: &HeaderMap,
) -> Result<Value, String> {
    if let Some(user) = user {
        if operation.starts_with("projects.") {
            let user = user.clone();
            let operation = operation.to_owned();
            return tokio::task::spawn_blocking(move || {
                qabim_application::projects::execute(&user, &operation, input)
            })
            .await
            .map_err(|e| e.to_string())?;
        }
        if operation.starts_with("users.") {
            if !user.site_admin {
                return Err("FORBIDDEN".into());
            }
            return app.call_as(user, operation, input).await;
        }
    }
    let (app, user) = project_context(app, user, headers).await?;
    if let Some(user) = user {
        app.call_as(&user, operation, input).await
    } else {
        app.call(operation, input).await
    }
}

async fn geometry(
    State(app): State<Application>,
    Path(id): Path<String>,
    user: Option<Extension<Principal>>,
    headers: HeaderMap,
) -> axum::response::Response {
    let (app, user) = match project_context(&app, user.as_ref().map(|u| &u.0), &headers).await {
        Ok(context) => context,
        Err(_) => return StatusCode::FORBIDDEN.into_response(),
    };
    if let Some(user) = &user {
        let models = app
            .call("models.list", json!({}))
            .await
            .unwrap_or(json!([]));
        let permitted = models.as_array().into_iter().flatten().any(|model| {
            security::can_model(user, model["id"].as_str().unwrap_or(""))
                && model["geometryAssets"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|asset| asset["id"] == id)
        });
        if !permitted {
            return StatusCode::FORBIDDEN.into_response();
        }
    }
    match app.geometry_bytes(&id).await {
        Ok(bytes) => (
            [
                (axum::http::header::CONTENT_TYPE, "application/octet-stream"),
                (axum::http::header::CACHE_CONTROL, "private, no-store"),
            ],
            bytes,
        )
            .into_response(),
        Err(error) => (StatusCode::NOT_FOUND, error).into_response(),
    }
}

async fn local_origin(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    if request.method() == Method::POST {
        if let Some(origin) = request.headers().get(axum::http::header::ORIGIN) {
            let configured_origins = [
                std::env::var("QABIM_PILOT_ORIGIN").ok(),
                std::env::var("QABIM_PUBLIC_ORIGIN").ok(),
            ];
            if !configured_origins
                .iter()
                .flatten()
                .any(|allowed| allowed.as_bytes() == origin.as_bytes())
                && ![
                    "http://127.0.0.1:1420",
                    "http://localhost:1420",
                    "http://tauri.localhost",
                    "tauri://localhost",
                ]
                .iter()
                .any(|allowed| origin.as_bytes() == allowed.as_bytes())
            {
                return (StatusCode::FORBIDDEN, "Origin not allowed").into_response();
            }
        }
    }
    next.run(request).await
}

async fn rpc(
    State(app): State<Application>,
    user: Option<Extension<Principal>>,
    headers: HeaderMap,
    Json(request): Json<Value>,
) -> impl IntoResponse {
    let operation = request["operation"].as_str().unwrap_or("");
    // The browser development adapter exposes only these operations; filesystem imports use upload.
    if ![
        "health",
        "project.get",
        "models.list",
        "workspace.get",
        "elements.search",
        "tools.list",
        "worker.hello",
        "assistant.command",
        "checks.run",
        "models.transform",
        "jobs.get",
        "jobs.cancel",
        "documents.list",
        "documents.register",
        "documents.transition",
        "issues.list",
        "issues.create",
        "issues.comment",
        "issues.update",
        "users.list",
        "users.create",
        "projects.list",
        "projects.create",
        "projects.current",
        "projects.invite",
        "projects.accept",
        "projects.members",
        "projects.members.update",
        "projects.accounts.create",
        "projects.invitations",
        "projects.invitations.revoke",
    ]
    .contains(&operation)
    {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"OPERATION_NOT_EXPOSED"})),
        );
    }
    match invoke(
        &app,
        user.as_ref().map(|u| &u.0),
        operation,
        request["input"].clone(),
        &headers,
    )
    .await
    {
        Ok(value) => (StatusCode::OK, Json(json!({"result":value}))),
        Err(e) => (
            if e == "FORBIDDEN" {
                StatusCode::FORBIDDEN
            } else {
                StatusCode::BAD_REQUEST
            },
            Json(json!({"error":e})),
        ),
    }
}

async fn upload(
    State(app): State<Application>,
    user: Option<Extension<Principal>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let result: Result<Value, String> = async {
        let (workspace, principal) =
            project_context(&app, user.as_ref().map(|u| &u.0), &headers).await?;
        if principal.as_ref().is_some_and(|u| u.role == "viewer") {
            return Err("FORBIDDEN".into());
        }
        let mut field = multipart
            .next_field()
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Missing file")?;
        let background = field.name() == Some("job");
        let name = field
            .file_name()
            .unwrap_or("model.ifc")
            .chars()
            .take(200)
            .collect::<String>();
        let dir = workspace.workspace_root().join(".local/uploads");
        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| e.to_string())?;
        let path = dir.join(format!("{}.ifc", uuid::Uuid::new_v4()));
        let written: Result<(), String> = async {
            let mut output = tokio::fs::File::create(&path)
                .await
                .map_err(|e| e.to_string())?;
            let signature = b"ISO-10303-21";
            let mut size = 0;
            while let Some(chunk) = field.chunk().await.map_err(|e| e.to_string())? {
                if size < signature.len() {
                    let length = chunk.len().min(signature.len() - size);
                    if chunk[..length] != signature[size..size + length] {
                        return Err("Only IFC STEP files are supported".into());
                    }
                }
                size += chunk.len();
                if size > MAX_IFC_BYTES {
                    return Err("IFC exceeds 500 MB".into());
                }
                output.write_all(&chunk).await.map_err(|e| e.to_string())?;
            }
            if size < signature.len() {
                return Err("Only IFC STEP files are supported".into());
            }
            output.flush().await.map_err(|e| e.to_string())
        }
        .await;
        if let Err(error) = written {
            let _ = tokio::fs::remove_file(&path).await;
            return Err(error);
        }
        let operation = if background {
            "model.import.start"
        } else {
            "model.import"
        };
        let input = json!({"path":path,"name":name,"temporaryUpload":true});
        if let Some(principal) = principal {
            workspace.call_as(&principal, operation, input).await
        } else {
            workspace.call(operation, input).await
        }
    }
    .await;
    match result {
        Ok(v) => (StatusCode::OK, Json(json!({"result":v}))),
        Err(e) => (
            if e == "FORBIDDEN" {
                StatusCode::FORBIDDEN
            } else {
                StatusCode::BAD_REQUEST
            },
            Json(json!({"error":e})),
        ),
    }
}

pub async fn serve(app: Application) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let address = std::env::var("QABIM_BIND").unwrap_or_else(|_| "127.0.0.1:4318".into());
    let listener = tokio::net::TcpListener::bind(address).await?;
    serve_with(listener, app).await
}
pub async fn serve_std(
    listener: std::net::TcpListener,
    app: Application,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    serve_with(tokio::net::TcpListener::from_std(listener)?, app).await
}
async fn serve_with(
    listener: tokio::net::TcpListener,
    app: Application,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let cors = CorsLayer::new()
        .allow_origin([
            HeaderValue::from_static("http://127.0.0.1:1420"),
            HeaderValue::from_static("http://localhost:1420"),
            HeaderValue::from_static("http://tauri.localhost"),
            HeaderValue::from_static("tauri://localhost"),
        ])
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::HeaderName::from_static("x-cic-project"),
        ]);
    let router = Router::new()
        .route(
            "/health",
            get(|| async { Json(json!({"status":"ready","mode":"development"})) }),
        )
        .route(
            "/auth/login",
            post(login).layer(DefaultBodyLimit::max(4096)),
        )
        .route("/auth/join", post(join).layer(DefaultBodyLimit::max(4096)))
        .route("/auth/me", get(me))
        .route("/auth/logout", post(logout))
        .route("/rpc", post(rpc))
        .route("/import", post(upload))
        .route("/geometry/{id}", get(geometry))
        .layer(DefaultBodyLimit::max(MAX_IFC_BYTES + 64 * 1024))
        .layer(axum::middleware::from_fn(authenticate))
        .layer(cors)
        .layer(axum::middleware::from_fn(local_origin))
        .with_state(app);
    axum::serve(listener, router).await?;
    Ok(())
}
