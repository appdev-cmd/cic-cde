ALTER TABLE security_users ADD COLUMN project_limit TEXT REFERENCES cde_projects(id);
INSERT INTO cic_migrations(name) VALUES ('009_project_account_scope');
