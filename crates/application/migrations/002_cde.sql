CREATE TABLE IF NOT EXISTS cde_issues (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES check_runs(id),
  finding_id TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  UNIQUE(run_id, finding_id)
);
CREATE TABLE IF NOT EXISTS cde_comments (
  id INTEGER PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES cde_issues(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
