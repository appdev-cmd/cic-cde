use rusqlite::{params, Connection, TransactionBehavior};
use serde_json::{json, Value};

fn list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut query = conn.prepare(
        "SELECT v.id, v.code, v.revision, v.model_id, v.title, v.discipline, v.state, m.source_hash
         FROM cde_document_versions v JOIN model_versions m ON m.id=v.model_id
         ORDER BY v.code, v.revision DESC",
    )?;
    let mut events = conn.prepare(
        "SELECT state, note, created_at FROM cde_document_events WHERE version_id=?1 ORDER BY id DESC",
    )?;
    let rows = query.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, i64>(0)?, "code": row.get::<_, String>(1)?,
            "revision": row.get::<_, i64>(2)?, "modelId": row.get::<_, String>(3)?,
            "title": row.get::<_, String>(4)?, "discipline": row.get::<_, String>(5)?,
            "state": row.get::<_, String>(6)?, "sourceHash": row.get::<_, String>(7)?
        }))
    })?;
    let mut documents = Vec::new();
    for row in rows {
        let mut row = row?;
        row["history"] = json!(events.query_map([row["id"].as_i64()], |event| {
            Ok(json!({"state":event.get::<_, String>(0)?,"note":event.get::<_, String>(1)?,"createdAt":event.get::<_, String>(2)?}))
        })?.collect::<Result<Vec<_>, _>>()?);
        documents.push(row);
    }
    Ok(json!(documents))
}

pub fn execute(base: &std::path::Path, operation: &str, input: Value) -> Result<Value, String> {
    let mut conn = super::workspace_database_at(base)?;
    let db_error = |e: rusqlite::Error| e.to_string();
    if operation == "documents.list" {
        return list(&conn).map_err(db_error);
    }
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(db_error)?;
    let (id, state, note) = match operation {
        "documents.register" => {
            let code = input["code"]
                .as_str()
                .unwrap_or("")
                .trim()
                .to_ascii_uppercase();
            if code.is_empty()
                || code.len() > 64
                || !code
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_'))
            {
                return Err(
                    "Mã hồ sơ phải gồm 1–64 ký tự chữ, số, gạch ngang hoặc gạch dưới".into(),
                );
            }
            let title = input["title"].as_str().unwrap_or("").trim();
            if title.is_empty() || title.chars().count() > 200 {
                return Err("Tên hồ sơ phải có từ 1 đến 200 ký tự".into());
            }
            let discipline = input["discipline"].as_str().unwrap_or("");
            if !["ARC", "STR", "MEP", "OTHER"].contains(&discipline) {
                return Err("Bộ môn không hợp lệ".into());
            }
            let model_id = input["modelId"].as_str().ok_or("Thiếu mô hình IFC")?;
            let changed = tx
                .execute(
                    "INSERT INTO cde_document_versions(code, revision, model_id, title, discipline)
                 SELECT ?1, COALESCE(MAX(revision),0)+1, ?2, ?3, ?4
                 FROM cde_document_versions WHERE code=?1 ON CONFLICT(code,model_id) DO NOTHING",
                    params![code, model_id, title, discipline],
                )
                .map_err(db_error)?;
            if changed == 0 {
                return list(&tx).map_err(db_error);
            }
            (tx.last_insert_rowid(), "WIP", "")
        }
        "documents.transition" => {
            let id = input["id"].as_i64().ok_or("Thiếu phiên bản hồ sơ")?;
            let from = input["expectedState"].as_str().unwrap_or("");
            let to = input["state"].as_str().unwrap_or("");
            let note = input["note"].as_str().unwrap_or("").trim();
            if !matches!(
                (from, to),
                ("WIP", "Shared")
                    | ("Shared", "Review")
                    | ("Review", "WIP")
                    | ("Review", "Approved")
                    | ("Approved", "Published")
                    | ("Published", "Archived")
            ) {
                return Err("Chuyển trạng thái không hợp lệ".into());
            }
            if note.chars().count() > 500 || (from == "Review" && to == "WIP" && note.is_empty()) {
                return Err("Cần lý do khi trả hồ sơ, tối đa 500 ký tự".into());
            }
            let changed = tx
                .execute(
                    "UPDATE cde_document_versions SET state=?1 WHERE id=?2 AND state=?3",
                    params![to, id, from],
                )
                .map_err(db_error)?;
            if changed != 1 {
                return Err("Hồ sơ đã thay đổi. Hãy tải lại danh sách".into());
            }
            (id, to, note)
        }
        _ => return Err("UNSUPPORTED_OPERATION".into()),
    };
    tx.execute(
        "INSERT INTO cde_document_events(version_id,state,note) VALUES (?1,?2,?3)",
        params![id, state, note],
    )
    .map_err(db_error)?;
    tx.commit().map_err(db_error)?;
    list(&conn).map_err(db_error)
}
