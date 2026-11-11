create table cde_private.cad_folders (
    project_id text not null references cde_private.projects(id) on delete cascade,
    id uuid not null default gen_random_uuid(),
    parent_id uuid,
    name text not null check (
        octet_length(name) between 1 and 255 and btrim(name) not in ('', '.', '..')
        and position('/' in name) = 0 and position(chr(92) in name) = 0 and name !~ '[[:cntrl:]]'
    ),
    revision integer not null default 1 check (revision > 0),
    removed boolean not null default false,
    primary key (project_id, id),
    foreign key (project_id, parent_id) references cde_private.cad_folders(project_id, id)
);

create unique index cad_folder_sibling_names
    on cde_private.cad_folders (project_id, parent_id, name) nulls not distinct where not removed;

-- Existing objects keep their keys. Their original encoded prefixes map to stable folders.
create table cde_private.cad_folder_aliases (
    project_id text not null,
    prefix text not null,
    folder_id uuid not null,
    primary key (project_id, prefix),
    foreign key (project_id, folder_id) references cde_private.cad_folders(project_id, id) on delete cascade
);

alter table cde_private.cad_folders enable row level security;
alter table cde_private.cad_folder_aliases enable row level security;
revoke all on cde_private.cad_folders, cde_private.cad_folder_aliases from public, anon, authenticated;

create function cde_private.find_or_create_cad_folder(project text, parent uuid, folder_name text)
returns uuid language plpgsql set search_path = '' as $$
declare
    folder_id uuid;
begin
    select f.id into folder_id from cde_private.cad_folders f
    where f.project_id = project and f.parent_id is not distinct from parent
        and f.name = folder_name and not f.removed;
    if not found then
        insert into cde_private.cad_folders (project_id, parent_id, name)
        values (project, parent, folder_name) returning id into folder_id;
    end if;
    return folder_id;
end;
$$;

-- Materialize folders from already-uploaded legacy objects, including uploads from older tabs.
create function cde_private.sync_cad_folder_aliases(project text)
returns void language plpgsql set search_path = '' as $$
declare
    legacy_prefix text;
    segments text[];
    names text[];
    segment text;
    folder_name text;
    folder_prefix text;
    parent uuid;
    known cde_private.cad_folders%rowtype;
begin
    for legacy_prefix in
        select distinct candidate.prefix
        from storage.objects o
        cross join lateral (
            select regexp_replace(substr(o.name, length(project) + 2), '/[^/]+$', '') as prefix
        ) candidate
        where o.bucket_id = 'cde-cad' and starts_with(o.name, project || '/folders/')
            and candidate.prefix ~ '^folders(/[A-Za-z0-9_-]+)+$'
            and not exists (
                select 1 from cde_private.cad_folder_aliases a
                where a.project_id = project and a.prefix = candidate.prefix
            )
    loop
        begin
            segments := string_to_array(legacy_prefix, '/');
            names := array[]::text[];
            foreach segment in array segments[2:array_length(segments, 1)] loop
                folder_name := convert_from(decode(translate(segment, '-_', '+/')
                    || repeat('=', (4 - length(segment) % 4) % 4), 'base64'), 'UTF8');
                names := array_append(names, folder_name);
            end loop;
            parent := null;
            for i in 1..array_length(names, 1) loop
                folder_prefix := array_to_string(segments[1:i+1], '/');
                select f.* into known from cde_private.cad_folder_aliases a
                join cde_private.cad_folders f on f.project_id = a.project_id and f.id = a.folder_id
                where a.project_id = project and a.prefix = folder_prefix;
                if found then
                    while known.removed and known.parent_id is not null loop
                        select f.* into known from cde_private.cad_folders f
                        where f.project_id = project and f.id = known.parent_id;
                    end loop;
                    parent := case when known.removed then null else known.id end;
                else
                    parent := cde_private.find_or_create_cad_folder(project, parent, names[i]);
                    insert into cde_private.cad_folder_aliases (project_id, prefix, folder_id)
                    values (project, folder_prefix, parent);
                end if;
            end loop;
        exception when data_exception or check_violation then
            -- A malformed legacy key cannot prevent the project catalog from loading.
            continue;
        end;
    end loop;
end;
$$;

create function cde_private.cad_folders_rpc(project text, operation text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    actor jsonb := cde_private.profile();
    role text := cde_private.project_role(project);
    target uuid;
    destination uuid;
    ancestor uuid;
    folder_name text;
    item cde_private.cad_folders%rowtype;
begin
    if actor is null then
        raise exception 'Phiên đăng nhập đã hết hạn' using errcode = '28000';
    end if;
    if role is null or (operation is distinct from 'list' and role not in ('admin', 'reviewer', 'member')) then
        raise insufficient_privilege;
    end if;

    -- Folder edits and legacy materialization share one transaction lock per project.
    perform pg_advisory_xact_lock(hashtextextended('cad-folder:' || project, 0));
    if operation in ('list', 'ensure', 'create') then
        perform cde_private.sync_cad_folder_aliases(project);
    end if;

    if operation = 'list' then
        return jsonb_build_object(
            'folders', coalesce((select jsonb_agg(jsonb_build_object(
                'id', f.id, 'name', f.name, 'parentId', f.parent_id, 'revision', f.revision, 'removed', f.removed
            )) from cde_private.cad_folders f where f.project_id = project), '[]'::jsonb),
            'aliases', coalesce((select jsonb_object_agg(a.prefix, a.folder_id)
                from cde_private.cad_folder_aliases a where a.project_id = project), '{}'::jsonb)
        );
    end if;

    if operation in ('create', 'move', 'ensure') then
        destination := (payload->>'parentId')::uuid;
        if destination is not null and not exists (
            select 1 from cde_private.cad_folders f
            where f.project_id = project and f.id = destination and not f.removed
        ) then
            raise exception 'Thư mục đích không còn trong dự án.' using errcode = '22023';
        end if;
    end if;

    if operation = 'ensure' then
        if jsonb_typeof(payload->'path') is distinct from 'array' or jsonb_array_length(payload->'path') = 0 then
            raise exception 'Đường dẫn thư mục không hợp lệ.' using errcode = '22023';
        end if;
        for folder_name in select jsonb_array_elements_text(payload->'path') loop
            destination := cde_private.find_or_create_cad_folder(project, destination, folder_name);
        end loop;
        return jsonb_build_object('id', destination);
    end if;

    if operation = 'create' then
        insert into cde_private.cad_folders(project_id, parent_id, name)
        values (project, destination, payload->>'name') returning * into item;
    elsif operation in ('rename', 'move', 'remove') then
        target := (payload->>'id')::uuid;
        select f.* into item from cde_private.cad_folders f
        where f.project_id = project and f.id = target and not f.removed;
        if not found or item.revision is distinct from (payload->>'expectedRevision')::integer then
            raise exception 'Thư mục đã thay đổi. Hãy tải lại cây bản vẽ.' using errcode = 'PT409';
        end if;
        if operation = 'rename' then
            update cde_private.cad_folders f set name = payload->>'name', revision = f.revision + 1
            where f.project_id = project and f.id = target returning * into item;
        elsif operation = 'move' then
            ancestor := destination;
            while ancestor is not null loop
                if ancestor = target then
                    raise exception 'Không thể di chuyển thư mục vào chính nó hoặc thư mục con.' using errcode = '22023';
                end if;
                select f.parent_id into ancestor from cde_private.cad_folders f
                where f.project_id = project and f.id = ancestor;
            end loop;
            update cde_private.cad_folders f set parent_id = destination, revision = f.revision + 1
            where f.project_id = project and f.id = target returning * into item;
        else
            -- A removed folder still points to its parent so its immutable file keys remain valid.
            update cde_private.cad_folders f set removed = true, revision = f.revision + 1
            where f.project_id = project and f.id = target returning * into item;
            update cde_private.cad_folders f set parent_id = item.parent_id, revision = f.revision + 1
            where f.project_id = project and f.parent_id = target and not f.removed;
        end if;
    else
        raise exception 'Thao tác thư mục không hợp lệ.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', item.id);
exception
    when unique_violation then
        raise exception 'Thư mục đích đã có thư mục cùng tên.' using errcode = 'PT409';
    when check_violation or not_null_violation then
        raise exception 'Tên thư mục không hợp lệ hoặc quá dài.' using errcode = '22023';
end;
$$;

revoke all on function cde_private.find_or_create_cad_folder(text, uuid, text) from public, anon, authenticated;
revoke all on function cde_private.sync_cad_folder_aliases(text) from public, anon, authenticated;
revoke all on function cde_private.cad_folders_rpc(text, text, jsonb) from public, anon, authenticated;
grant execute on function cde_private.cad_folders_rpc(text, text, jsonb) to authenticated;

create function public.cde_cad_folders(project_id text, operation text, payload jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
    select cde_private.cad_folders_rpc(project_id, operation, payload);
$$;

revoke all on function public.cde_cad_folders(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cde_cad_folders(text, text, jsonb) to authenticated;

create or replace function cde_private.cad_file_access(path text, writing boolean)
returns boolean language sql stable security definer set search_path = '' as $$
    select coalesce(
        octet_length(path) <= 1024 and length(substring(path from '[^/]+$')) <= 381
        and case when writing then role in ('admin', 'reviewer', 'member') else role is not null end
        and case
            when path ~ '^[^/]+/by-folder/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}_[A-Za-z0-9_-]+\.(dwg|dxf)$'
            then exists (
                select 1 from cde_private.cad_folders f
                where f.project_id = split_part(path, '/', 1) and f.id = split_part(path, '/', 3)::uuid
                    and (not writing or not f.removed)
            )
            else path ~ '^[^/]+/(folders/([A-Za-z0-9_-]+/)+)?[0-9a-f-]{36}_[A-Za-z0-9_-]+\.(dwg|dxf)$'
        end,
        false
    )
    from (select cde_private.project_role(split_part(path, '/', 1)) as role) project;
$$;
