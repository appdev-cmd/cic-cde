CREATE TABLE IF NOT EXISTS cde_document_versions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  revision INTEGER NOT NULL,
  model_id TEXT NOT NULL REFERENCES model_versions(id),
  title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'WIP',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, revision),
  UNIQUE(code, model_id)
);
CREATE TABLE IF NOT EXISTS cde_document_events (
  id INTEGER PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES cde_document_versions(id),
  state TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cde_issue_workflow (
  issue_id INTEGER PRIMARY KEY REFERENCES cde_issues(id),
  assignee TEXT NOT NULL,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL
);
