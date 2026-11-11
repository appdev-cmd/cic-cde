CREATE TABLE IF NOT EXISTS cde_projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_organizations (
 project_id TEXT NOT NULL REFERENCES cde_projects(id), organization TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','reviewer','member','viewer')),
 active INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(project_id,organization)
);
CREATE TABLE IF NOT EXISTS project_invitations (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES cde_projects(id),
 organization TEXT NOT NULL, role TEXT NOT NULL, digest TEXT NOT NULL UNIQUE,
 expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS project_events (
 id INTEGER PRIMARY KEY, project_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 operation TEXT NOT NULL, details TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cic_migrations (name TEXT PRIMARY KEY);
INSERT OR IGNORE INTO cde_projects(id,name,created_at) VALUES ('demo-project','Riverside Tower',strftime('%s','now'));
INSERT OR IGNORE INTO project_organizations(project_id,organization,role)
 SELECT 'demo-project',organization,CASE WHEN MAX(role='admin') THEN 'admin' ELSE 'member' END
 FROM security_users WHERE NOT EXISTS(SELECT 1 FROM cic_migrations WHERE name='005_projects')
 GROUP BY organization;
INSERT OR IGNORE INTO cic_migrations(name) VALUES ('005_projects');
