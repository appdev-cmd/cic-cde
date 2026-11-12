-- The appointment role is independent of the CDE permission role.
alter table cde_private.memberships add column iso_role text
    check (iso_role in ('appointing_party', 'lead_appointed_party', 'appointed_party'));
alter table cde_private.invitations add column iso_role text
    check (iso_role in ('appointing_party', 'lead_appointed_party', 'appointed_party'));

do $migration$
declare
    api text := pg_get_functiondef(coalesce(to_regprocedure('cde_private.cde_api(text,jsonb,text)'), to_regprocedure('public.cde_api(text,jsonb,text)')));
    accounts text := pg_get_functiondef('public.cde_manage_account(text,jsonb)'::regprocedure);
    clause text[];
    old_join text := 'on conflict on constraint memberships_pkey do update set role=excluded.role,active=true,revision=cde_private.memberships.revision+1;';
    new_join text := 'on conflict on constraint memberships_pkey do update set role=excluded.role,active=true,revision=cde_private.memberships.revision+1,iso_role=coalesce(excluded.iso_role,cde_private.memberships.iso_role);';
    old_account text := 'insert into cde_private.memberships(project_id,organization,role) values(invite.project_id,org,invite.role)';
begin
    foreach clause slice 1 in array array[
        array[
            $old$'projectName',target,'role',role); end if;$old$,
            $new$'projectName',target,'role',role,'isoRole',(
                select m.iso_role from cde_private.memberships m where m.project_id=cde_api.project_id and m.organization=org and m.active
            )); end if;$new$
        ],
        array[
            $old$'role',m.role,'active',m.active,'revision',m.revision$old$,
            $new$'role',m.role,'active',m.active,'revision',m.revision,'isoRole',m.iso_role$new$
        ],
        array[
            $old$insert into cde_private.invitations(project_id,organization,role,digest) values(project_id,target,payload->>'role',encode(extensions.digest(token,'sha256'),'hex'))$old$,
            $new$insert into cde_private.invitations(project_id,organization,role,digest,iso_role)
                values(project_id,target,payload->>'role',encode(extensions.digest(token,'sha256'),'hex'),payload->>'isoRole')$new$
        ],
        array[
            $old$set role=payload->>'role',active=(payload->>'active')::boolean,revision=m.revision+1$old$,
            $new$set role=payload->>'role',active=(payload->>'active')::boolean,revision=m.revision+1,
                iso_role=case when payload ? 'isoRole' then payload->>'isoRole' else m.iso_role end$new$
        ],
        array[
            $old$insert into cde_private.memberships(project_id,organization,role) values(row_data.project_id,org,row_data.role)$old$,
            $new$insert into cde_private.memberships(project_id,organization,role,iso_role)
                values(row_data.project_id,org,row_data.role,row_data.iso_role)$new$
        ],
        array[old_join, new_join]
    ] loop
        if strpos(api, clause[1]) = 0 then
            raise exception 'Unexpected cde_api definition: %', clause[1];
        end if;
        api := replace(api, clause[1], clause[2]);
    end loop;
    execute api;

    if strpos(accounts, old_account) = 0 or strpos(accounts, old_join) = 0 then
        raise exception 'Unexpected cde_manage_account invitation definition';
    end if;
    accounts := replace(accounts, old_account,
        'insert into cde_private.memberships(project_id,organization,role,iso_role) values(invite.project_id,org,invite.role,invite.iso_role)');
    execute replace(accounts, old_join, new_join);
end
$migration$;
