use crate::Application;
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rusqlite::params;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

#[derive(Clone)]
pub struct Principal {
    pub id: String,
    pub organization: String,
    pub role: String,
    pub username: String,
    pub site_admin: bool,
    pub project_limit: Option<String>,
    pub project_id: String,
    pub project_name: String,
    pub workspace: std::path::PathBuf,
}
impl Principal {
    pub fn public(&self) -> Value {
        json!({"id":self.id,"organization":self.organization,"role":self.role,"username":self.username,"siteAdmin":self.site_admin,"projectId":self.project_id,"projectName":self.project_name})
    }
    fn admin(&self) -> bool {
        self.role == "admin"
    }
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn digest(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
fn db_error(error: rusqlite::Error) -> String {
    error.to_string()
}

pub fn create_user(input: &Value) -> Result<Value, String> {
    create_user_at(&super::database()?, input)
}
pub(crate) fn create_user_at(conn: &rusqlite::Connection, input: &Value) -> Result<Value, String> {
    let username = input["username"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let password = input["password"].as_str().unwrap_or("");
    let organization = input["organization"].as_str().unwrap_or("").trim();
    let role = input["role"].as_str().unwrap_or("member");
    if username.len() < 3
        || username.len() > 80
        || !username
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'@' | b'.' | b'_' | b'-'))
        || !(12..=128).contains(&password.len())
        || organization.is_empty()
        || organization.chars().count() > 120
        || !["admin", "member"].contains(&role)
    {
        return Err(
            "INVALID_USER: tên đăng nhập 3–80 ký tự, mật khẩu 12–128 byte, đơn vị 1–120 ký tự"
                .into(),
        );
    }
    let salt = SaltString::encode_b64(Uuid::new_v4().as_bytes()).map_err(|e| e.to_string())?;
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();
    let id = Uuid::new_v4().to_string();
    conn.execute("INSERT INTO security_users(id,username,password_hash,organization,role) VALUES (?1,?2,?3,?4,?5)",params![id,username,hash,organization,role]).map_err(db_error)?;
    Ok(json!({"id":id,"username":username,"organization":organization,"role":role}))
}
pub fn users() -> Result<Value, String> {
    let conn = super::database()?;
    let mut statement = conn
        .prepare("SELECT id,username,organization,role FROM security_users ORDER BY username")
        .map_err(db_error)?;
    let rows=statement.query_map([],|r|Ok(json!({"id":r.get::<_,String>(0)?,"username":r.get::<_,String>(1)?,"organization":r.get::<_,String>(2)?,"role":r.get::<_,String>(3)?}))).map_err(db_error)?;
    Ok(json!(rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?))
}
pub fn login(input: Value) -> Result<Value, String> {
    let conn = super::database()?;
    let username = input["username"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let password = input["password"].as_str().unwrap_or("");
    if username.len() > 80 || password.len() > 128 {
        return Err("INVALID_LOGIN".into());
    }
    let row: (String,String,i64)=conn.query_row("SELECT id,password_hash,locked_until FROM security_users WHERE username=?1 AND enabled=1",[&username],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(|_|"INVALID_LOGIN".to_string())?;
    if row.2 > now() {
        return Err("INVALID_LOGIN".into());
    }
    let valid = PasswordHash::new(&row.1).ok().is_some_and(|hash| {
        Argon2::default()
            .verify_password(password.as_bytes(), &hash)
            .is_ok()
    });
    if !valid {
        conn.execute("UPDATE security_users SET failed=failed+1, locked_until=CASE WHEN failed>=4 THEN ?2 ELSE 0 END WHERE id=?1",params![row.0,now()+300]).map_err(db_error)?;
        return Err("INVALID_LOGIN".into());
    }
    conn.execute(
        "UPDATE security_users SET failed=0,locked_until=0 WHERE id=?1",
        [&row.0],
    )
    .map_err(db_error)?;
    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    conn.execute("DELETE FROM security_sessions WHERE expires<?1", [now()])
        .map_err(db_error)?;
    conn.execute(
        "INSERT INTO security_sessions(digest,user_id,expires) VALUES (?1,?2,?3)",
        params![digest(&token), row.0, now() + 8 * 3600],
    )
    .map_err(db_error)?;
    Ok(json!({"token":token,"user":authenticate(&token)?.public()}))
}
pub fn authenticate(token: &str) -> Result<Principal, String> {
    if token.len() != 64 {
        return Err("UNAUTHORIZED".into());
    }
    super::database()?.query_row(
        "SELECT u.id,u.organization,u.role,u.username,u.project_limit FROM security_sessions s JOIN security_users u ON u.id=s.user_id WHERE s.digest=?1 AND s.expires>?2 AND u.enabled=1",
        params![digest(token),now()],|r|Ok(Principal{id:r.get(0)?,organization:r.get(1)?,role:r.get(2)?,username:r.get(3)?,site_admin:r.get::<_,String>(2)?=="admin",project_limit:r.get(4)?,project_id:String::new(),project_name:String::new(),workspace:super::root()})
    ).map_err(|_|"UNAUTHORIZED".into())
}
pub fn logout(token: &str) -> Result<(), String> {
    super::database()?
        .execute(
            "DELETE FROM security_sessions WHERE digest=?1",
            [digest(token)],
        )
        .map_err(db_error)?;
    Ok(())
}
fn own_model(user: &Principal, id: &str) -> bool {
    super::workspace_database_at(&user.workspace).and_then(|db|db.query_row("SELECT EXISTS(SELECT 1 FROM security_models WHERE model_id=?1 AND organization=?2)",params![id,user.organization],|r|r.get(0)).map_err(db_error)).unwrap_or(false)
}
pub fn can_model(user: &Principal, id: &str) -> bool {
    user.admin() || own_model(user,id) ||
    super::workspace_database_at(&user.workspace).and_then(|db|db.query_row("SELECT EXISTS(SELECT 1 FROM cde_document_versions WHERE model_id=?1 AND state<>'WIP')",[id],|r|r.get(0)).map_err(db_error)).unwrap_or(false)
}
fn own_job(user: &Principal, id: &str) -> bool {
    user.admin()
        || super::workspace_database_at(&user.workspace)
            .and_then(|db| {
                db.query_row(
                    "SELECT EXISTS(SELECT 1 FROM security_jobs WHERE job_id=?1 AND user_id=?2)",
                    params![id, user.id],
                    |r| r.get(0),
                )
                .map_err(db_error)
            })
            .unwrap_or(false)
}
fn own_document(user: &Principal, code: &str) -> bool {
    super::workspace_database_at(&user.workspace)
        .and_then(|db| {
            db.query_row(
                "SELECT EXISTS(SELECT 1 FROM security_documents WHERE code=?1 AND organization=?2)",
                params![code, user.organization],
                |r| r.get(0),
            )
            .map_err(db_error)
        })
        .unwrap_or(false)
}
fn visible_documents(user: &Principal, result: Value) -> Value {
    json!(result
        .as_array()
        .into_iter()
        .flatten()
        .filter(|doc| user.admin()
            || doc["state"] != "WIP"
            || own_document(user, doc["code"].as_str().unwrap_or("")))
        .collect::<Vec<_>>())
}
fn visible_issue(user: &Principal, issue: &Value) -> bool {
    if user.admin() {
        return true;
    }
    let owner = super::workspace_database_at(&user.workspace)
        .ok()
        .and_then(|db| {
            db.query_row(
                "SELECT user_id FROM security_runs WHERE run_id=?1",
                [issue["runId"].as_str()],
                |r| r.get::<_, String>(0),
            )
            .ok()
        })
        .and_then(|id| {
            super::database().ok().and_then(|db| {
                db.query_row(
                    "SELECT organization FROM security_users WHERE id=?1",
                    [id],
                    |r| r.get::<_, String>(0),
                )
                .ok()
            })
        })
        .is_some_and(|organization| organization == user.organization);
    owner || issue["snapshots"].as_array().is_some_and(|snapshots|!snapshots.is_empty() && snapshots.iter().all(|s| {
        super::workspace_database_at(&user.workspace).and_then(|db|db.query_row("SELECT EXISTS(SELECT 1 FROM cde_document_versions WHERE model_id=?1 AND state<>'WIP')",[s["modelId"].as_str()],|r|r.get::<_,bool>(0)).map_err(db_error)).unwrap_or(false)
    }))
}
fn visible_issues(user: &Principal, result: Value) -> Value {
    json!(result
        .as_array()
        .into_iter()
        .flatten()
        .filter(|issue| visible_issue(user, issue))
        .collect::<Vec<_>>())
}
fn denied() -> Result<(), String> {
    Err("FORBIDDEN".into())
}

impl Application {
    pub async fn call_as(
        &self,
        user: &Principal,
        operation: &str,
        input: Value,
    ) -> Result<Value, String> {
        if user.workspace != self.workspace_root {
            return Err("FORBIDDEN".into());
        }
        if user.role == "viewer"
            && ![
                "health",
                "project.get",
                "models.list",
                "workspace.get",
                "documents.list",
                "issues.list",
            ]
            .contains(&operation)
        {
            return Err("FORBIDDEN".into());
        }
        if operation == "project.get" {
            return Ok(
                json!({"id":user.project_id,"name":user.project_name,"demo":user.project_id=="demo-project"}),
            );
        }
        let _registration = if operation == "documents.register" {
            Some(self.security_lock.lock().await)
        } else {
            None
        };
        let requested_code = input["code"]
            .as_str()
            .unwrap_or("")
            .trim()
            .to_ascii_uppercase();
        match operation {
            "users.list" if user.site_admin => return users(),
            "users.create" if user.site_admin => return create_user(&input),
            "health" | "project.get" | "models.list" | "workspace.get" | "documents.list"
            | "issues.list" => {}
            "model.import" | "model.import.start" => {}
            "jobs.get" | "jobs.cancel" => {
                if !own_job(user, input["jobId"].as_str().unwrap_or("")) {
                    denied()?;
                }
            }
            "documents.register" => {
                let model = input["modelId"].as_str().unwrap_or("");
                if !user.admin() && !own_model(user, model) {
                    denied()?;
                }
                if !user.admin() {
                    let docs = super::documents::execute(
                        &self.workspace_root,
                        "documents.list",
                        json!({}),
                    )?;
                    let code = input["code"]
                        .as_str()
                        .unwrap_or("")
                        .trim()
                        .to_ascii_uppercase();
                    if docs.as_array().into_iter().flatten().any(|doc| {
                        doc["code"] == code
                            && !own_document(user, doc["code"].as_str().unwrap_or(""))
                    }) {
                        denied()?;
                    }
                }
            }
            "documents.transition" => {
                let docs =
                    super::documents::execute(&self.workspace_root, "documents.list", json!({}))?;
                let doc = docs
                    .as_array()
                    .into_iter()
                    .flatten()
                    .find(|doc| doc["id"] == input["id"])
                    .ok_or("FORBIDDEN")?;
                let review_action = user.role == "reviewer"
                    && doc["state"] == "Review"
                    && ["Approved", "WIP"].contains(&input["state"].as_str().unwrap_or(""));
                if !user.admin()
                    && !review_action
                    && (!own_document(user, doc["code"].as_str().unwrap_or(""))
                        || !["Shared", "Review"].contains(&input["state"].as_str().unwrap_or("")))
                {
                    denied()?;
                }
            }
            "checks.run" => {
                if !user.admin() {
                    for key in ["modelIdsA", "modelIdsB"] {
                        let ids = input[key].as_array().ok_or("FORBIDDEN")?;
                        if ids.is_empty()
                            || ids
                                .iter()
                                .any(|id| !can_model(user, id.as_str().unwrap_or("")))
                        {
                            denied()?;
                        }
                    }
                }
            }
            "issues.create" => {
                if !user.admin() {
                    let conn = super::workspace_database_at(&user.workspace)?;
                    let owner:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM security_runs WHERE run_id=?1 AND user_id=?2)",params![input["runId"].as_str(),user.id],|r|r.get(0)).map_err(db_error)?;
                    if !owner {
                        denied()?;
                    }
                    let run: String = conn
                        .query_row(
                            "SELECT result_json FROM check_runs WHERE id=?1",
                            [input["runId"].as_str()],
                            |r| r.get(0),
                        )
                        .map_err(db_error)?;
                    let mut run: Value = serde_json::from_str(&run).map_err(|e| e.to_string())?;
                    run["runId"] = input["runId"].clone();
                    if !visible_issue(user, &run) {
                        denied()?;
                    }
                }
            }
            "issues.comment" | "issues.update" => {
                let issues =
                    super::issues::execute(&self.workspace_root, "issues.list", json!({}))?;
                let issue = issues
                    .as_array()
                    .into_iter()
                    .flatten()
                    .find(|i| i["id"] == input["issueId"])
                    .ok_or("FORBIDDEN")?;
                if !visible_issue(user, issue)
                    || (!user.admin()
                        && user.role != "reviewer"
                        && operation == "issues.update"
                        && ["Closed", "Open"].contains(&input["state"].as_str().unwrap_or(""))
                        && input["state"] != issue["state"])
                {
                    denied()?;
                }
            }
            "models.transform" if user.admin() => {}
            _ => denied()?,
        }
        let mut result = self.call(operation, input).await?;
        match operation {
            "model.import.start" => {
                super::workspace_database_at(&user.workspace)?
                    .execute(
                        "INSERT INTO security_jobs(job_id,user_id) VALUES (?1,?2)",
                        params![result["jobId"].as_str(), user.id],
                    )
                    .map_err(db_error)?;
            }
            "jobs.get" | "model.import" => {
                let imported = if operation == "model.import" {
                    &result
                } else {
                    &result["result"]
                };
                if let Some(id) = imported["model"]["id"].as_str() {
                    super::workspace_database_at(&user.workspace)?.execute("INSERT OR IGNORE INTO security_models(model_id,organization) VALUES (?1,?2)",params![id,user.organization]).map_err(db_error)?;
                }
            }
            "checks.run" => {
                super::workspace_database_at(&user.workspace)?
                    .execute(
                        "INSERT INTO security_runs(run_id,user_id) VALUES (?1,?2)",
                        params![result["runId"].as_str(), user.id],
                    )
                    .map_err(db_error)?;
            }
            "documents.list" | "documents.register" | "documents.transition" => {
                if operation == "documents.register" {
                    for doc in result.as_array().into_iter().flatten() {
                        if doc["code"] == requested_code {
                            super::workspace_database_at(&user.workspace)?.execute("INSERT OR IGNORE INTO security_documents(code,organization) VALUES (?1,?2)",params![doc["code"].as_str(),user.organization]).map_err(db_error)?;
                        }
                    }
                }
                return Ok(visible_documents(user, result));
            }
            "issues.list" | "issues.create" | "issues.comment" | "issues.update" => {
                return Ok(visible_issues(user, result))
            }
            "models.list" => {
                result = json!(result
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|m| can_model(user, m["id"].as_str().unwrap_or("")))
                    .collect::<Vec<_>>());
            }
            "workspace.get" => {
                let allowed: HashSet<String> = result["models"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|m| can_model(user, m["id"].as_str().unwrap_or("")))
                    .filter_map(|m| m["id"].as_str().map(str::to_owned))
                    .collect();
                result["models"] = json!(result["models"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|m| allowed.contains(m["id"].as_str().unwrap_or("")))
                    .collect::<Vec<_>>());
                result["elements"] = json!(result["elements"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|e| allowed.contains(e["modelId"].as_str().unwrap_or("")))
                    .collect::<Vec<_>>());
                result["findings"] = json!([]);
            }
            _ => {}
        }
        Ok(result)
    }
}
