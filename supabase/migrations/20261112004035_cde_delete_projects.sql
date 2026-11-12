alter table cde_private.projects add column deleted_at timestamptz;

create or replace function cde_private.project_role(project text)
returns text language sql stable security definer set search_path = '' as $$
    select case when (cde_private.profile()->>'siteAdmin')::boolean then 'admin' else
        (select m.role from cde_private.memberships m where m.project_id = project
         and m.organization = cde_private.profile()->>'organization' and m.active) end
    where exists (
        select 1 from cde_private.projects p where p.id = project and p.deleted_at is null
    )
$$;

create function cde_private.delete_project(target text)
returns void language plpgsql security definer set search_path = '' as $$
declare
    actor jsonb := cde_private.profile();
    project_name text;
begin
    if actor is null then
        raise exception 'Phiên đăng nhập đã hết hạn' using errcode = '28000';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(target, 0));
    if cde_private.project_role(target) is distinct from 'admin' then
        raise insufficient_privilege;
    end if;

    update cde_private.projects
    set deleted_at = now()
    where id = target
    returning name into project_name;

    update cde_private.invitations set used = true where project_id = target and not used;
    insert into cde_private.audit(project_id, actor, operation, details)
    values (target, (actor->>'id')::uuid, 'projects.delete', jsonb_build_object('name', project_name));
end
$$;

create function public.cde_delete_project(project_id text)
returns void language sql security invoker set search_path = '' as $$
    select cde_private.delete_project(project_id)
$$;

revoke all on function cde_private.delete_project(text) from public, anon, authenticated;
revoke all on function public.cde_delete_project(text) from public, anon, authenticated;
grant execute on function cde_private.delete_project(text) to authenticated;
grant execute on function public.cde_delete_project(text) to authenticated;
