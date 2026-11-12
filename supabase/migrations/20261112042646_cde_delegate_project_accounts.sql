alter table cde_private.profiles add column project_limit text references cde_private.projects(id);

create or replace function cde_private.profile()
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object('id',p.id,'username',p.username,'organization',p.organization,
        'siteAdmin',p.site_admin,'role',case when p.site_admin then 'admin' else 'member' end,
        'projectLimit',p.project_limit)
    from cde_private.profiles p where p.id=(select auth.uid())
    and exists (select 1 from auth.sessions s where s.user_id=p.id and s.id::text=(select auth.jwt()->>'session_id'))
$$;

create function cde_private.project_role_for(project text, subject uuid)
returns text language sql stable set search_path = '' as $$
    select case when u.site_admin then 'admin' else m.role end
    from cde_private.projects p cross join cde_private.profiles u
    left join cde_private.memberships m on m.project_id=project and m.organization=u.organization and m.active
    where p.id=project and p.deleted_at is null and u.id=subject
        and (u.project_limit is null or u.project_limit=project)
$$;
revoke all on function cde_private.project_role_for(text,uuid) from public,anon,authenticated;

create or replace function cde_private.project_role(project text)
returns text language sql stable security definer set search_path = '' as $$
    select cde_private.project_role_for(project,(cde_private.profile()->>'id')::uuid)
$$;

do $migration$
declare
    api text := pg_get_functiondef('cde_private.cde_api(text,jsonb,text)'::regprocedure);
    accounts text := pg_get_functiondef('public.cde_manage_account(text,jsonb)'::regprocedure);
    original text;
    clause text[];
begin
    original := 'if row_data.organization<>org then raise insufficient_privilege; end if;';
    if strpos(api, original) = 0 then
        raise exception 'Unexpected cde_api invitation definition';
    end if;
    execute replace(api, original, $sql$if row_data.organization<>org or
        (actor->>'projectLimit' is not null and actor->>'projectLimit'<>row_data.project_id) then
            raise insufficient_privilege;
        end if;$sql$);

    foreach clause slice 1 in array array[
        array[
            $old$    administrator uuid;$old$,
            $new$    administrator uuid;
    administrator_is_site_admin boolean;
    account_project_limit text;$new$
        ],
        array[
            $old$        if not exists (select 1 from cde_private.profiles p where p.id=administrator and p.site_admin) then
            raise insufficient_privilege;
        end if;$old$,
            $new$        select p.site_admin into administrator_is_site_admin
        from cde_private.profiles p where p.id=administrator;
        if not found or (action='create.commit' and not administrator_is_site_admin) then
            raise insufficient_privilege;
        end if;$new$
        ],
        array[
            $old$            if not exists (select 1 from cde_private.projects p where p.id=target and p.deleted_at is null) then
                raise insufficient_privilege;
            end if;$old$,
            $new$            if cde_private.project_role_for(target,administrator) is distinct from 'admin' then
                raise insufficient_privilege;
            end if;
            if not administrator_is_site_admin then
                if coalesce(payload->>'username','') !~ '^[a-z0-9._-]{3,64}$' then
                    raise exception 'Nhập tên đăng nhập từ 3 đến 64 ký tự';
                end if;
                account_project_limit := target;
            end if;$new$
        ],
        array[
            $old$    insert into cde_private.profiles(id,username,organization,site_admin)
    values (subject,lower(trim(payload->>'username')),org,admin);$old$,
            $new$    insert into cde_private.profiles(id,username,organization,site_admin,project_limit)
    values (subject,lower(trim(payload->>'username')),org,admin,account_project_limit);$new$
        ],
        array[
            $old$jsonb_build_object('userId',subject,'organization',org,'role',project_role)$old$,
            $new$jsonb_build_object('userId',subject,'organization',org,'role',project_role,'projectLimit',account_project_limit)$new$
        ]
    ] loop
        if strpos(accounts, clause[1]) = 0 then
            raise exception 'Unexpected cde_manage_account definition: %', clause[1];
        end if;
        accounts := replace(accounts, clause[1], clause[2]);
    end loop;
    execute accounts;
end
$migration$;
