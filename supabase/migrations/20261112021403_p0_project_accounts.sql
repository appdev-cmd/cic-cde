create index profiles_organization_lower on cde_private.profiles (lower(organization));
create index memberships_organization_lower on cde_private.memberships (lower(organization));

do $migration$
declare
    api text := pg_get_functiondef(coalesce(to_regprocedure('cde_private.cde_api(text,jsonb,text)'), to_regprocedure('public.cde_api(text,jsonb,text)')));
    clause text[];
begin
    foreach clause slice 1 in array array[
        array[
            $old$if row_data.organization<>org then raise insufficient_privilege; end if;$old$,
            $new$if row_data.organization<>org then raise insufficient_privilege; end if;
        if exists (select 1 from cde_private.memberships m
            where m.project_id=row_data.project_id and m.organization=org and m.active) then
            raise exception 'Đơn vị đã tham gia dự án';
        end if;$new$
        ],
        array[
            $old$    if operation='projects.members' then$old$,
            $new$    if operation='projects.invitations' then
        if role<>'admin' then raise insufficient_privilege; end if;
        return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'organization',i.organization,
            'role',i.role,'isoRole',i.iso_role,'expires',extract(epoch from i.expires)) order by i.expires,i.id)
            from cde_private.invitations i where i.project_id=cde_api.project_id and not i.used and i.expires>now()),'[]');
    end if;
    if operation='projects.members' then$new$
        ],
        array[
            $old$    if operation='projects.members.update' then$old$,
            $new$    if operation='projects.invitations.revoke' then
        if role<>'admin' then raise insufficient_privilege; end if;
        update cde_private.invitations i set used=true
        where i.project_id=cde_api.project_id and i.id::text=payload->>'invitationId' and not i.used and i.expires>now();
        if not found then raise exception 'Lời mời đã hết hiệu lực'; end if;
        return '{"ok":true}';
    end if;
    if operation='projects.members.update' then$new$
        ],
        array[
            $old$where m.project_id=cde_api.project_id and m.organization=target;
        return '{"ok":true}';
    end if;
    if operation='jobs.create' then$old$,
            $new$where m.project_id=cde_api.project_id and m.organization=target;
        update cde_private.invitations i set used=true
        where i.project_id=cde_api.project_id and i.organization=target and not i.used;
        return '{"ok":true}';
    end if;
    if operation='jobs.create' then$new$
        ]
    ] loop
        if strpos(api, clause[1]) = 0 then
            raise exception 'Unexpected cde_api definition: %', clause[1];
        end if;
        api := replace(api, clause[1], clause[2]);
    end loop;
    execute api;
end
$migration$;

create or replace function public.cde_manage_account(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    invite cde_private.invitations%rowtype;
    membership cde_private.memberships%rowtype;
    org text;
    admin boolean := false;
    subject uuid;
    target text;
    administrator uuid;
    project_role text := payload->>'role';
    iso_role text := payload->>'isoRole';
begin
    if action in ('bootstrap.prepare', 'bootstrap.commit') then
        perform pg_advisory_xact_lock(hashtextextended('cde-bootstrap', 0));
        if exists (select 1 from cde_private.profiles where site_admin) or not exists (
            select 1 from cde_private.settings s where s.name='bootstrap_digest'
            and s.value=encode(extensions.digest(payload->>'token','sha256'),'hex')
        ) then
            raise insufficient_privilege;
        end if;
        org := 'CIC';
        admin := true;
    elsif action in ('join.prepare', 'join.commit') then
        select i.project_id into target from cde_private.invitations i
        where i.digest=encode(extensions.digest(payload->>'token','sha256'),'hex');
        perform pg_advisory_xact_lock(hashtextextended(target, 0));
        select i.* into invite from cde_private.invitations i
        join cde_private.projects p on p.id=i.project_id and p.deleted_at is null
        where i.project_id=target and i.digest=encode(extensions.digest(payload->>'token','sha256'),'hex')
            and not i.used and i.expires>now();
        if not found then raise insufficient_privilege; end if;
        org := invite.organization;
    elsif action in ('create.commit', 'project.create.prepare', 'project.create.commit') then
        administrator := (payload->>'actor')::uuid;
        if not exists (select 1 from cde_private.profiles p where p.id=administrator and p.site_admin) then
            raise insufficient_privilege;
        end if;
        org := trim(payload->>'organization');
        if org is null or length(org) not between 1 and 120 then
            raise exception 'Đơn vị không hợp lệ';
        end if;
        if action='create.commit' then
            if project_role is null or project_role not in ('admin','member') then
                raise exception 'Quyền hệ thống không hợp lệ';
            end if;
            admin := project_role='admin';
        else
            target := payload->>'projectId';
            perform pg_advisory_xact_lock(hashtextextended(target, 0));
            if not exists (select 1 from cde_private.projects p where p.id=target and p.deleted_at is null) then
                raise insufficient_privilege;
            end if;
            select m.* into membership from cde_private.memberships m where m.project_id=target and m.organization=org;
            if found then
                if not membership.active then raise exception 'Đơn vị đang tạm ngừng tham gia'; end if;
                project_role := membership.role;
                iso_role := membership.iso_role;
            elsif project_role is null or project_role not in ('admin','reviewer','member','viewer') then
                raise exception 'Quyền dự án không hợp lệ';
            end if;
        end if;
    else
        raise insufficient_privilege;
    end if;

    -- Serialize provisioning for an organization across projects and account entry points.
    perform pg_advisory_xact_lock(hashtextextended(lower(org), 1));
    if action in ('join.prepare', 'join.commit') and (
        exists (select 1 from cde_private.profiles p where lower(p.organization)=lower(org))
        or exists (select 1 from cde_private.memberships m where lower(m.organization)=lower(org))
    ) then
        raise insufficient_privilege;
    end if;
    if action like '%.prepare' then return jsonb_build_object('organization',org); end if;

    subject := (payload->>'userId')::uuid;
    insert into cde_private.profiles(id,username,organization,site_admin)
    values (subject,lower(trim(payload->>'username')),org,admin);
    if action='bootstrap.commit' then
        insert into cde_private.projects(id,name) values ('demo-project','Riverside Tower');
        insert into cde_private.memberships(project_id,organization,role) values ('demo-project',org,'admin');
        delete from cde_private.settings s where s.name='bootstrap_digest';
    elsif action='join.commit' then
        update cde_private.invitations set used=true where id=invite.id;
        insert into cde_private.memberships(project_id,organization,role,iso_role)
        values (invite.project_id,org,invite.role,invite.iso_role);
        insert into cde_private.audit(project_id,actor,operation,details)
        values (invite.project_id,subject,'invitation.join',jsonb_build_object('organization',org,'role',invite.role));
    elsif action='project.create.commit' then
        insert into cde_private.memberships(project_id,organization,role,iso_role)
        values (target,org,project_role,iso_role) on conflict on constraint memberships_pkey do nothing;
        update cde_private.invitations i set used=true
        where i.project_id=target and i.organization=org and not i.used;
        insert into cde_private.audit(project_id,actor,operation,details)
        values (target,administrator,'projects.accounts.create',jsonb_build_object('userId',subject,'organization',org,'role',project_role));
    end if;
    return jsonb_build_object('id',subject,'username',lower(trim(payload->>'username')),'organization',org,'siteAdmin',admin);
end
$$;
