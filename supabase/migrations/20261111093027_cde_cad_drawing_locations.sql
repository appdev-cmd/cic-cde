-- Track the displayed location independently of the immutable Storage key used by IFC alignments.
create table cde_private.cad_drawing_locations (
    project_id text not null references cde_private.projects(id) on delete cascade,
    object_id uuid not null,
    folder_id uuid,
    revision integer not null default 1 check (revision > 0),
    primary key (project_id, object_id),
    foreign key (project_id, folder_id) references cde_private.cad_folders(project_id, id)
);

alter table cde_private.cad_drawing_locations enable row level security;
revoke all on cde_private.cad_drawing_locations from public, anon, authenticated;

create function cde_private.cad_directory_rpc(project text, operation text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    catalog jsonb;
    target_object uuid;
    destination uuid;
    revision integer;
begin
    if operation = 'list' then
        catalog := cde_private.cad_folders_rpc(project, operation, payload);
        return catalog || jsonb_build_object('locations', coalesce((
            select jsonb_object_agg(l.object_id, jsonb_build_object('folderId', l.folder_id, 'revision', l.revision))
            from cde_private.cad_drawing_locations l
            join storage.objects o on o.id = l.object_id and o.bucket_id = 'cde-cad'
                and starts_with(o.name, project || '/')
            where l.project_id = project
        ), '{}'::jsonb));
    end if;
    if operation is distinct from 'move_drawing' then
        return cde_private.cad_folders_rpc(project, operation, payload);
    end if;

    if cde_private.profile() is null then
        raise exception 'Phiên đăng nhập đã hết hạn' using errcode = '28000';
    end if;
    if not coalesce(cde_private.project_role(project) in ('admin', 'reviewer', 'member'), false) then
        raise insufficient_privilege;
    end if;

    -- Serialize placement updates with folder moves, removals, and catalog reads.
    perform pg_advisory_xact_lock(hashtextextended('cad-folder:' || project, 0));
    target_object := (payload->>'objectId')::uuid;
    destination := (payload->>'folderId')::uuid;
    if not exists (
        select 1 from storage.objects o
        where o.id = target_object and o.bucket_id = 'cde-cad' and starts_with(o.name, project || '/')
            and cde_private.cad_file_access(o.name, false)
    ) then
        raise exception 'Bản vẽ không còn trong dự án.' using errcode = '22023';
    end if;
    if destination is not null and not exists (
        select 1 from cde_private.cad_folders f
        where f.project_id = project and f.id = destination and not f.removed
    ) then
        raise exception 'Thư mục đích không còn trong dự án.' using errcode = '22023';
    end if;

    select l.revision into revision from cde_private.cad_drawing_locations l
    where l.project_id = project and l.object_id = target_object;
    if coalesce(revision, 0) is distinct from (payload->>'expectedRevision')::integer then
        raise exception 'Bản vẽ đã được di chuyển. Hãy kiểm tra lại cây bản vẽ.' using errcode = 'PT409';
    end if;

    insert into cde_private.cad_drawing_locations as l (project_id, object_id, folder_id)
    values (project, target_object, destination)
    on conflict (project_id, object_id) do update
        set folder_id = excluded.folder_id, revision = l.revision + 1
    returning l.revision into revision;
    return jsonb_build_object('folderId', destination, 'revision', revision);
end;
$$;

revoke all on function cde_private.cad_directory_rpc(text, text, jsonb) from public, anon, authenticated;
grant execute on function cde_private.cad_directory_rpc(text, text, jsonb) to authenticated;

create or replace function public.cde_cad_folders(project_id text, operation text, payload jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
    select cde_private.cad_directory_rpc(project_id, operation, payload);
$$;
