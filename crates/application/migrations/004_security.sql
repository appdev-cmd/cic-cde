CREATE TABLE IF NOT EXISTS security_users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 organization TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')),
 enabled INTEGER NOT NULL DEFAULT 1, failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS security_sessions (
 digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES security_users(id),
 expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS security_models (
 model_id TEXT NOT NULL, organization TEXT NOT NULL,
 PRIMARY KEY(model_id,organization)
);
CREATE TABLE IF NOT EXISTS security_jobs (job_id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS security_runs (run_id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS security_documents (
 code TEXT PRIMARY KEY, organization TEXT NOT NULL
);
