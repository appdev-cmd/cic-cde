use crate::security::{self, Principal};
use rusqlite::{params, Connection, TransactionBehavior};
use serde_json::{json, Value};
use uuid::Uuid;

fn error(e: rusqlite::Error) -> String {
    e.to_string()
}
fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn digest(value: &str) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
fn role_valid(role: &str) -> bool {
    ["admin", "reviewer", "member", "viewer"].contains(&role)
}
fn audit(
    conn: &Connection,
    project: &str,
    actor: &str,
    operation: &str,
    details: Value,
) -> Result<(), String> {
    conn.execute("INSERT INTO project_events(project_id,actor_id,operation,details,created_at) VALUES (?1,?2,?3,?4,?5)",params![project,actor,operation,details.to_string(),now()]).map_err(error)?;
    Ok(())
}
pub fn scope(user: &Principal, project: &str) -> Result<Principal, String> {
    let conn = super::database()?;
    let name: String = conn
        .query_row(
            "SELECT name FROM cde_projects WHERE id=?1",
            [project],
            |r| r.get(0),
        )
        .map_err(|_| "FORBIDDEN")?;
    let role = if user.site_admin {
        "admin".into()
    } else {
        conn.query_row("SELECT role FROM project_organizations WHERE project_id=?1 AND organization=?2 AND active=1",params![project,user.organization],|r|r.get::<_,String>(0)).map_err(|_|"FORBIDDEN")?
    };
    let mut scoped = user.clone();
    scoped.role = role;
    scoped.project_id = project.into();
    scoped.project_name = name;
    scoped.workspace = if project == "demo-project" {
        super::root()
    } else {
        super::root().join(".local/projects").join(project)
    };
    Ok(scoped)
}
fn list(user: &Principal) -> Result<Value, String> {
    let conn = super::database()?;
    let mut query=conn.prepare("SELECT p.id,p.name,CASE WHEN ?1 THEN 'admin' ELSE o.role END FROM cde_projects p LEFT JOIN project_organizations o ON o.project_id=p.id AND o.organization=?2 AND o.active=1 WHERE ?1 OR o.organization IS NOT NULL ORDER BY p.created_at,p.id").map_err(error)?;
    let rows=query.query_map(params![user.site_admin,user.organization],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"role":r.get::<_,String>(2)?}))).map_err(error)?;
    Ok(json!(rows.collect::<Result<Vec<_>, _>>().map_err(error)?))
}
fn invitation(conn: &Connection, token: &str) -> Result<(String, String, String, String), String> {
    if token.len() != 64 {
        return Err("INVITATION_INVALID".into());
    }
    conn.query_row("SELECT id,project_id,organization,role FROM project_invitations WHERE digest=?1 AND used=0 AND expires>?2",params![digest(token),now()],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(|_|"INVITATION_INVALID".into())
}
fn accept(
    conn: &Connection,
    user: &Principal,
    invite: (String, String, String, String),
) -> Result<(), String> {
    let (id, project, organization, role) = invite;
    if user.organization != organization {
        return Err("FORBIDDEN".into());
    }
    conn.execute("UPDATE project_invitations SET used=1 WHERE id=?1", [id])
        .map_err(error)?;
    conn.execute("INSERT INTO project_organizations(project_id,organization,role) VALUES (?1,?2,?3) ON CONFLICT(project_id,organization) DO UPDATE SET role=excluded.role,active=1,revision=revision+1",params![project,organization,role]).map_err(error)?;
    audit(
        conn,
        &project,
        &user.id,
        "invitation.accept",
        json!({"organization":organization,"role":role}),
    )?;
    Ok(())
}
pub fn join(input: Value) -> Result<Value, String> {
    let mut conn = super::database()?;
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(error)?;
    let invite = invitation(&tx, input["token"].as_str().unwrap_or(""))?;
    let account = json!({"username":input["username"],"password":input["password"],"organization":invite.2,"role":"member"});
    let created = security::create_user_at(&tx, &account)?;
    let user = Principal {
        id: created["id"].as_str().unwrap().into(),
        organization: invite.2.clone(),
        role: "member".into(),
        username: created["username"].as_str().unwrap().into(),
        site_admin: false,
        project_id: String::new(),
        project_name: String::new(),
        workspace: super::root(),
    };
    accept(&tx, &user, invite)?;
    tx.commit().map_err(error)?;
    security::login(account)
}
pub fn execute(user: &Principal, operation: &str, input: Value) -> Result<Value, String> {
    if operation == "projects.list" {
        return list(user);
    }
    if operation == "projects.create" {
        if !user.site_admin {
            return Err("FORBIDDEN".into());
        }
        let name = input["name"].as_str().unwrap_or("").trim();
        if name.is_empty() || name.chars().count() > 160 {
            return Err("Tên dự án phải có từ 1 đến 160 ký tự".into());
        }
        let mut conn = super::database()?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(error)?;
        let id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO cde_projects(id,name,created_at) VALUES (?1,?2,?3)",
            params![id, name, now()],
        )
        .map_err(error)?;
        tx.execute("INSERT INTO project_organizations(project_id,organization,role) VALUES (?1,?2,'admin')",params![id,user.organization]).map_err(error)?;
        audit(&tx, &id, &user.id, operation, json!({"name":name}))?;
        tx.commit().map_err(error)?;
        return Ok(json!({"id":id,"name":name,"role":"admin"}));
    }
    if operation == "projects.accept" {
        let mut conn = super::database()?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(error)?;
        let invite = invitation(&tx, input["token"].as_str().unwrap_or(""))?;
        accept(&tx, user, invite)?;
        tx.commit().map_err(error)?;
        return list(user);
    }
    let project = input["projectId"].as_str().unwrap_or("");
    let scoped = scope(user, project)?;
    if operation == "projects.current" {
        return Ok(scoped.public());
    }
    if scoped.role != "admin" {
        return Err("FORBIDDEN".into());
    }
    let mut conn = super::database()?;
    if operation == "projects.members" {
        let mut query=conn.prepare("SELECT organization,role,active,revision FROM project_organizations WHERE project_id=?1 ORDER BY organization").map_err(error)?;
        let rows=query.query_map([project],|r|Ok(json!({"organization":r.get::<_,String>(0)?,"role":r.get::<_,String>(1)?,"active":r.get::<_,bool>(2)?,"revision":r.get::<_,i64>(3)?}))).map_err(error)?;
        return Ok(json!(rows.collect::<Result<Vec<_>, _>>().map_err(error)?));
    }
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(error)?;
    let result = match operation {
        "projects.invite" => {
            let organization = input["organization"].as_str().unwrap_or("").trim();
            let role = input["role"].as_str().unwrap_or("");
            if organization.is_empty() || organization.chars().count() > 120 || !role_valid(role) {
                return Err("Đơn vị hoặc vai trò không hợp lệ".into());
            }
            let exists:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM project_organizations WHERE project_id=?1 AND organization=?2 AND active=1)",params![project,organization],|r|r.get(0)).map_err(error)?;
            if exists {
                return Err("Đơn vị đã tham gia dự án. Hãy chỉnh vai trò trong danh sách".into());
            }
            tx.execute("UPDATE project_invitations SET used=1 WHERE project_id=?1 AND organization=?2 AND used=0",params![project,organization]).map_err(error)?;
            let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
            let id = Uuid::new_v4().to_string();
            tx.execute("INSERT INTO project_invitations(id,project_id,organization,role,digest,expires) VALUES (?1,?2,?3,?4,?5,?6)",params![id,project,organization,role,digest(&token),now()+7*86400]).map_err(error)?;
            audit(
                &tx,
                project,
                &user.id,
                operation,
                json!({"organization":organization,"role":role,"invitationId":id}),
            )?;
            json!({"id":id,"token":token,"organization":organization,"expires":now()+7*86400})
        }
        "projects.members.update" => {
            let organization = input["organization"].as_str().unwrap_or("");
            let role = input["role"].as_str().unwrap_or("");
            let active = input["active"].as_bool().ok_or("INVALID_MEMBERSHIP")?;
            let revision = input["expectedRevision"]
                .as_i64()
                .ok_or("INVALID_MEMBERSHIP")?;
            if !role_valid(role) {
                return Err("INVALID_ROLE".into());
            }
            let old:(String,bool)=tx.query_row("SELECT role,active FROM project_organizations WHERE project_id=?1 AND organization=?2",params![project,organization],|r|Ok((r.get(0)?,r.get(1)?))).map_err(error)?;
            if old.0 == "admin" && old.1 && (role != "admin" || !active) {
                let count:i64=tx.query_row("SELECT COUNT(*) FROM project_organizations WHERE project_id=?1 AND role='admin' AND active=1",[project],|r|r.get(0)).map_err(error)?;
                if count <= 1 {
                    return Err("Cần giữ ít nhất một đơn vị quản trị dự án".into());
                }
            }
            let changed=tx.execute("UPDATE project_organizations SET role=?1,active=?2,revision=revision+1 WHERE project_id=?3 AND organization=?4 AND revision=?5",params![role,active,project,organization,revision]).map_err(error)?;
            if changed != 1 {
                return Err("Danh sách đã thay đổi. Hãy tải lại".into());
            }
            audit(
                &tx,
                project,
                &user.id,
                operation,
                json!({"organization":organization,"role":role,"active":active}),
            )?;
            json!({"ok":true})
        }
        _ => return Err("UNSUPPORTED_OPERATION".into()),
    };
    tx.commit().map_err(error)?;
    Ok(result)
}
