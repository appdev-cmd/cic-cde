-- Keep the existing API field and its legacy values for previously saved roles.
alter table cde_private.memberships
    drop constraint memberships_iso_role_check,
    add constraint memberships_iso_role_check check (iso_role in (
        'owner', 'design_consultant', 'bim_consultant', 'verification_consultant',
        'supervision_consultant', 'construction_contractor', 'other',
        'appointing_party', 'lead_appointed_party', 'appointed_party'
    ));

alter table cde_private.invitations
    drop constraint invitations_iso_role_check,
    add constraint invitations_iso_role_check check (iso_role in (
        'owner', 'design_consultant', 'bim_consultant', 'verification_consultant',
        'supervision_consultant', 'construction_contractor', 'other',
        'appointing_party', 'lead_appointed_party', 'appointed_party'
    ));
