ALTER TABLE project_organizations ADD COLUMN party_role TEXT CHECK(party_role IN (
 'owner','design_consultant','bim_consultant','verification_consultant',
 'supervision_consultant','construction_contractor','other',
 'appointing_party','lead_appointed_party','appointed_party'
));
UPDATE project_organizations SET party_role=iso_role WHERE iso_role IS NOT NULL;
ALTER TABLE project_organizations DROP COLUMN iso_role;
ALTER TABLE project_organizations RENAME COLUMN party_role TO iso_role;

ALTER TABLE project_invitations ADD COLUMN party_role TEXT CHECK(party_role IN (
 'owner','design_consultant','bim_consultant','verification_consultant',
 'supervision_consultant','construction_contractor','other',
 'appointing_party','lead_appointed_party','appointed_party'
));
UPDATE project_invitations SET party_role=iso_role WHERE iso_role IS NOT NULL;
ALTER TABLE project_invitations DROP COLUMN iso_role;
ALTER TABLE project_invitations RENAME COLUMN party_role TO iso_role;

INSERT INTO cic_migrations(name) VALUES ('008_project_party_roles');
