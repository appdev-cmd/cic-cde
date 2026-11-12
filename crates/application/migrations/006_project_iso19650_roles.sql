ALTER TABLE project_organizations ADD COLUMN iso_role TEXT
 CHECK(iso_role IN ('appointing_party','lead_appointed_party','appointed_party'));
ALTER TABLE project_invitations ADD COLUMN iso_role TEXT
 CHECK(iso_role IN ('appointing_party','lead_appointed_party','appointed_party'));
INSERT INTO cic_migrations(name) VALUES ('006_project_iso19650_roles');
