ALTER TABLE cde_projects ADD COLUMN deleted_at INTEGER;
INSERT INTO cic_migrations(name) VALUES ('007_delete_projects');
