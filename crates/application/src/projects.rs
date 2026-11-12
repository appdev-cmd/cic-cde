use crate::security::{self, Principal};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
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
fn iso_role(input: &Value) -> Result<Option<&str>, String> {
    match input.get("isoRole") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(role))
            if [
                "owner", "design_consultant", "bim_consultant", "verification_consultant",
                "supervision_consultant", "construction_contractor", "other",
                "appointing_party", "lead_appointed_party", "appointed_party",
            ].contains(&role.as_str()) =>
        {
            Ok(Some(role))
        }
        _ => Err("Vai trò trong dự án không hợp lệ".into()),
    }
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
    scope_at(&conn, user, project)
}
fn scope_at(conn: &Connection, user: &Principal, project: &str) -> Result<Principal, String> {
    if user.project_limit.as_deref().is_some_and(|limit| limit != project) {
        return Err("FORBIDDEN".into());
    }
    let name: String = conn
        .query_row(
            "SELECT name FROM cde_projects WHERE id=?1 AND deleted_at IS NULL",
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
    let mut query=conn.prepare("SELECT p.id,p.name,CASE WHEN ?1 THEN 'admin' ELSE o.role END FROM cde_projects p LEFT JOIN project_organizations o ON o.project_id=p.id AND o.organization=?2 AND o.active=1 WHERE p.deleted_at IS NULL AND (?1 OR o.organization IS NOT NULL) AND (?3 IS NULL OR p.id=?3) ORDER BY p.created_at,p.id").map_err(error)?;
    let rows=query.query_map(params![user.site_admin,user.organization,user.project_limit],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"role":r.get::<_,String>(2)?}))).map_err(error)?;
    Ok(json!(rows.collect::<Result<Vec<_>, _>>().map_err(error)?))
}
struct Invitation {
    id: String,
    project: String,
    organization: String,
    role: String,
    iso_role: Option<String>,
}

fn invitation(conn: &Connection, token: &str) -> Result<Invitation, String> {
    if token.len() != 64 {
        return Err("INVITATION_INVALID".into());
    }
    conn.query_row(
        "SELECT i.id,i.project_id,i.organization,i.role,i.iso_role FROM project_invitations i
         JOIN cde_projects p ON p.id=i.project_id
         WHERE i.digest=?1 AND i.used=0 AND i.expires>?2 AND p.deleted_at IS NULL",
        params![digest(token), now()],
        |row| Ok(Invitation {
            id: row.get(0)?,
            project: row.get(1)?,
            organization: row.get(2)?,
            role: row.get(3)?,
            iso_role: row.get(4)?,
        }),
    ).map_err(|_| "INVITATION_INVALID".into())
}
fn accept(
    conn: &Connection,
    user: &Principal,
    invite: Invitation,
) -> Result<(), String> {
    let Invitation { id, project, organization, role, iso_role } = invite;
    if user.organization != organization || user.project_limit.as_ref().is_some_and(|limit| limit != &project) {
        return Err("FORBIDDEN".into());
    }
    if conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM project_organizations WHERE project_id=?1 AND organization=?2 AND active=1)",
        params![project, organization], |row| row.get::<_, bool>(0),
    ).map_err(error)? {
        return Err("Đơn vị đã tham gia dự án".into());
    }
    conn.execute("UPDATE project_invitations SET used=1 WHERE id=?1", [id])
        .map_err(error)?;
    conn.execute(
        "INSERT INTO project_organizations(project_id,organization,role,iso_role) VALUES (?1,?2,?3,?4)
         ON CONFLICT(project_id,organization) DO UPDATE SET role=excluded.role,active=1,revision=revision+1,
         iso_role=coalesce(excluded.iso_role,project_organizations.iso_role)",
        params![project, organization, role, iso_role],
    ).map_err(error)?;
    audit(
        conn,
        &project,
        &user.id,
        "invitation.accept",
        json!({"organization":organization,"role":role,"isoRole":iso_role}),
    )?;
    Ok(())
}
pub fn join(input: Value) -> Result<Value, String> {
    let mut conn = super::database()?;
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(error)?;
    let invite = invitation(&tx, input["token"].as_str().unwrap_or(""))?;
    if tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM security_users WHERE organization=?1 COLLATE NOCASE
         UNION ALL SELECT 1 FROM project_organizations WHERE organization=?1 COLLATE NOCASE)",
        [&invite.organization], |row| row.get::<_, bool>(0),
    ).map_err(error)? {
        return Err("Hãy đăng nhập bằng tài khoản của đơn vị để nhận lời mời.".into());
    }
    let account = json!({"username":input["username"],"password":input["password"],"organization":invite.organization,"role":"member"});
    let created = security::create_user_at(&tx, &account)?;
    let user = Principal {
        id: created["id"].as_str().unwrap().into(),
        organization: invite.organization.clone(),
        role: "member".into(),
        username: created["username"].as_str().unwrap().into(),
        site_admin: false,
        project_limit: None,
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
    if operation == "projects.delete" {
        let mut conn = super::database()?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(error)?;
        let scoped = scope_at(&tx, user, project)?;
        if scoped.role != "admin" {
            return Err("Bạn cần quyền quản trị dự án để xóa dự án.".into());
        }
        tx.execute("UPDATE cde_projects SET deleted_at=?1 WHERE id=?2", params![now(), project])
            .map_err(error)?;
        tx.execute("UPDATE project_invitations SET used=1 WHERE project_id=?1 AND used=0", [project])
            .map_err(error)?;
        audit(&tx, project, &user.id, operation, json!({"name":scoped.project_name}))?;
        tx.commit().map_err(error)?;
        return Ok(Value::Null);
    }
    let scoped = scope(user, project)?;
    if operation == "projects.current" {
        let conn = super::database()?;
        let role = conn.query_row(
            "SELECT iso_role FROM project_organizations WHERE project_id=?1 AND organization=?2 AND active=1",
            params![project, user.organization],
            |row| row.get::<_, Option<String>>(0),
        ).optional().map_err(error)?.flatten();
        let mut profile = scoped.public();
        profile["isoRole"] = json!(role);
        return Ok(profile);
    }
    if scoped.role != "admin" {
        return Err("FORBIDDEN".into());
    }
    let mut conn = super::database()?;
    if operation == "projects.members" {
        let mut query=conn.prepare("SELECT organization,role,active,revision,iso_role FROM project_organizations WHERE project_id=?1 ORDER BY organization").map_err(error)?;
        let rows=query.query_map([project],|r|Ok(json!({"organization":r.get::<_,String>(0)?,"role":r.get::<_,String>(1)?,"active":r.get::<_,bool>(2)?,"revision":r.get::<_,i64>(3)?,"isoRole":r.get::<_,Option<String>>(4)?}))).map_err(error)?;
        return Ok(json!(rows.collect::<Result<Vec<_>, _>>().map_err(error)?));
    }
    if operation == "projects.invitations" {
        let mut query = conn.prepare(
            "SELECT id,organization,role,iso_role,expires FROM project_invitations
             WHERE project_id=?1 AND used=0 AND expires>?2 ORDER BY expires,id",
        ).map_err(error)?;
        let rows = query.query_map(params![project, now()], |row| {
            Ok(json!({"id":row.get::<_,String>(0)?,"organization":row.get::<_,String>(1)?,
                "role":row.get::<_,String>(2)?,"isoRole":row.get::<_,Option<String>>(3)?,"expires":row.get::<_,i64>(4)?}))
        }).map_err(error)?;
        return Ok(json!(rows.collect::<Result<Vec<_>, _>>().map_err(error)?));
    }
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(error)?;
    if scope_at(&tx, user, project)?.role != "admin" {
        return Err("FORBIDDEN".into());
    }
    let result = match operation {
        "projects.accounts.create" => {
            let username = input["username"].as_str().unwrap_or("").trim();
            if !user.site_admin && (!(3..=64).contains(&username.len()) ||
                !username.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'_' | b'-'))) {
                return Err("Dùng tên đăng nhập từ 3 đến 64 ký tự để cấp tài khoản dự án.".into());
            }
            let organization = input["organization"].as_str().unwrap_or("").trim();
            let membership = tx.query_row(
                "SELECT role,active FROM project_organizations WHERE project_id=?1 AND organization=?2",
                params![project, organization], |row| Ok((row.get::<_, String>(0)?, row.get::<_, bool>(1)?)),
            ).optional().map_err(error)?;
            let role = match &membership {
                Some((role, true)) => role.as_str(),
                Some((_, false)) => return Err("Đơn vị đang tạm ngừng tham gia".into()),
                None => input["role"].as_str().filter(|role| role_valid(role)).ok_or("Quyền dự án không hợp lệ")?,
            };
            let created = security::create_user_at(&tx, &json!({
                "username": input["username"], "password": input["password"], "organization": organization, "role": "member",
            }))?;
            let project_limit = (!user.site_admin).then_some(project);
            if let Some(limit) = project_limit {
                tx.execute(
                    "UPDATE security_users SET project_limit=?1 WHERE id=?2",
                    params![limit, created["id"].as_str()],
                ).map_err(error)?;
            }
            if membership.is_none() {
                tx.execute(
                    "INSERT INTO project_organizations(project_id,organization,role,iso_role) VALUES (?1,?2,?3,?4)",
                    params![project, organization, role, iso_role(&input)?],
                ).map_err(error)?;
            }
            tx.execute(
                "UPDATE project_invitations SET used=1 WHERE project_id=?1 AND organization=?2 AND used=0",
                params![project, organization],
            ).map_err(error)?;
            audit(&tx, project, &user.id, operation, json!({"userId":created["id"],"organization":organization,"role":role,"projectLimit":project_limit}))?;
            json!({"user":created})
        }
        "projects.invitations.revoke" => {
            let id = input["invitationId"].as_str().unwrap_or("");
            let changed = tx.execute(
                "UPDATE project_invitations SET used=1 WHERE project_id=?1 AND id=?2 AND used=0 AND expires>?3",
                params![project, id, now()],
            ).map_err(error)?;
            if changed != 1 {
                return Err("Lời mời đã hết hiệu lực".into());
            }
            audit(&tx, project, &user.id, operation, json!({"invitationId":id}))?;
            json!({"ok":true})
        }
        "projects.invite" => {
            let organization = input["organization"].as_str().unwrap_or("").trim();
            let role = input["role"].as_str().unwrap_or("");
            let iso_role = iso_role(&input)?;
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
            tx.execute(
                "INSERT INTO project_invitations(id,project_id,organization,role,digest,expires,iso_role) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![id, project, organization, role, digest(&token), now()+7*86400, iso_role],
            ).map_err(error)?;
            audit(
                &tx,
                project,
                &user.id,
                operation,
                json!({"organization":organization,"role":role,"isoRole":iso_role,"invitationId":id}),
            )?;
            json!({"id":id,"token":token,"organization":organization,"expires":now()+7*86400})
        }
        "projects.members.update" => {
            let organization = input["organization"].as_str().unwrap_or("");
            let role = input["role"].as_str().unwrap_or("");
            let iso_role = iso_role(&input)?;
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
            let changed = tx.execute(
                "UPDATE project_organizations SET role=?1,active=?2,revision=revision+1,
                 iso_role=CASE WHEN ?3 THEN ?4 ELSE iso_role END
                 WHERE project_id=?5 AND organization=?6 AND revision=?7",
                params![role, active, input.get("isoRole").is_some(), iso_role, project, organization, revision],
            ).map_err(error)?;
            if changed != 1 {
                return Err("Danh sách đã thay đổi. Hãy tải lại".into());
            }
            tx.execute(
                "UPDATE project_invitations SET used=1 WHERE project_id=?1 AND organization=?2 AND used=0",
                params![project, organization],
            ).map_err(error)?;
            audit(
                &tx,
                project,
                &user.id,
                operation,
                json!({"organization":organization,"role":role,"active":active,"isoRole":iso_role}),
            )?;
            json!({"ok":true})
        }
        _ => return Err("UNSUPPORTED_OPERATION".into()),
    };
    tx.commit().map_err(error)?;
    Ok(result)
}
