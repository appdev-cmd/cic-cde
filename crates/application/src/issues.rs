use rusqlite::{params, Connection};
use serde_json::{json, Value};

fn list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut query =
        conn.prepare("SELECT i.id, i.run_id, i.evidence_json, COALESCE(w.assignee,''), COALESCE(w.state,'Open'), COALESCE(w.revision,0)
         FROM cde_issues i LEFT JOIN cde_issue_workflow w ON i.id=w.issue_id ORDER BY i.id DESC")?;
    let mut comments = conn
        .prepare("SELECT id, body, created_at FROM cde_comments WHERE issue_id=?1 ORDER BY id")?;
    let mut issues = Vec::new();
    let rows = query.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, i64>(5)?,
        ))
    })?;
    for row in rows {
        let (id, run_id, evidence, assignee, state, revision) = row?;
        let evidence: Value = serde_json::from_str(&evidence).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Text, Box::new(e))
        })?;
        let thread = comments.query_map([id], |row| {
            Ok(json!({"id":row.get::<_, i64>(0)?,"body":row.get::<_, String>(1)?,"createdAt":row.get::<_, String>(2)?}))
        })?.collect::<Result<Vec<_>, _>>()?;
        issues.push(json!({"id":id,"runId":run_id,"finding":evidence["finding"],"snapshots":evidence["snapshots"],"comments":thread,"assignee":assignee,"state":state,"revision":revision}));
    }
    Ok(json!(issues))
}

pub fn execute(base: &std::path::Path, operation: &str, input: Value) -> Result<Value, String> {
    let mut conn = super::workspace_database_at(base)?;
    let db_error = |e: rusqlite::Error| e.to_string();
    match operation {
        "issues.create" => {
            let run_id = input["runId"].as_str().ok_or("RUN_REQUIRED")?;
            let finding_id = input["findingId"].as_str().ok_or("FINDING_REQUIRED")?;
            let saved: String = conn
                .query_row(
                    "SELECT result_json FROM check_runs WHERE id=?1",
                    [run_id],
                    |row| row.get(0),
                )
                .map_err(db_error)?;
            let run: Value = serde_json::from_str(&saved).map_err(|e| e.to_string())?;
            let finding = run["findings"]
                .as_array()
                .into_iter()
                .flatten()
                .find(|finding| finding["id"] == finding_id)
                .ok_or("FINDING_NOT_FOUND")?;
            let evidence = json!({"finding":finding,"snapshots":run["snapshots"]});
            conn.execute("INSERT INTO cde_issues(run_id,finding_id,evidence_json) VALUES (?1,?2,?3) ON CONFLICT(run_id,finding_id) DO NOTHING", params![run_id,finding_id,evidence.to_string()]).map_err(db_error)?;
        }
        "issues.comment" => {
            let issue_id = input["issueId"].as_i64().ok_or("ISSUE_REQUIRED")?;
            let body = input["body"].as_str().unwrap_or("").trim();
            if body.is_empty() || body.chars().count() > 2000 {
                return Err("Bình luận phải có từ 1 đến 2.000 ký tự".into());
            }
            conn.execute(
                "INSERT INTO cde_comments(issue_id,body) VALUES (?1,?2)",
                params![issue_id, body],
            )
            .map_err(db_error)?;
        }
        "issues.update" => {
            let id = input["issueId"].as_i64().ok_or("ISSUE_REQUIRED")?;
            let expected = input["expectedRevision"]
                .as_i64()
                .ok_or("REVISION_REQUIRED")?;
            let assignee = input["assignee"].as_str().unwrap_or("").trim();
            let state = input["state"].as_str().unwrap_or("");
            if assignee.chars().count() > 120 {
                return Err("Đơn vị phụ trách tối đa 120 ký tự".into());
            }
            let tx = conn
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .map_err(db_error)?;
            let (before, revision): (String, i64) = tx
                .query_row(
                    "SELECT COALESCE(w.state,'Open'), COALESCE(w.revision,0)
                 FROM cde_issues i LEFT JOIN cde_issue_workflow w ON i.id=w.issue_id WHERE i.id=?1",
                    [id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(db_error)?;
            if revision != expected {
                return Err("Issue đã được cập nhật ở phiên khác. Hãy mở lại issue".into());
            }
            let valid = ["Open", "InProgress", "Review", "Closed"].contains(&state);
            let transition = before == state
                || matches!(
                    (before.as_str(), state),
                    ("Open", "InProgress")
                        | ("InProgress", "Review")
                        | ("Review", "Closed")
                        | ("Review", "InProgress")
                        | ("Closed", "Open")
                );
            if !valid || !transition {
                return Err("Chuyển trạng thái issue không hợp lệ".into());
            }
            tx.execute("INSERT INTO cde_issue_workflow(issue_id,assignee,state,revision) VALUES (?1,?2,?3,?4)
                ON CONFLICT(issue_id) DO UPDATE SET assignee=excluded.assignee,state=excluded.state,revision=excluded.revision",
                params![id,assignee,state,revision+1]).map_err(db_error)?;
            tx.execute(
                "INSERT INTO audit_entries(operation,subject_id) VALUES ('issues.update',?1)",
                [id.to_string()],
            )
            .map_err(db_error)?;
            tx.commit().map_err(db_error)?;
        }
        "issues.list" => {}
        _ => return Err("UNSUPPORTED_OPERATION".into()),
    }
    list(&conn).map_err(db_error)
}
