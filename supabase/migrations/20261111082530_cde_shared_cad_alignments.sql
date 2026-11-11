create table cde_private.cad_alignments (
    project_id text not null references cde_private.projects(id) on delete cascade,
    storey text not null check (length(storey) between 1 and 240),
    alignment jsonb check (alignment is null or jsonb_typeof(alignment) = 'object'),
    revision integer not null check (revision > 0),
    updated_at timestamptz not null default now(),
    primary key (project_id, storey)
);

alter table cde_private.cad_alignments enable row level security;
revoke all on cde_private.cad_alignments from public, anon, authenticated;

create function cde_private.cad_alignments_rpc(project text, operation text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    actor jsonb := cde_private.profile();
    project_role text := cde_private.project_role(project);
    floor_name text;
    expected integer;
    submitted jsonb;
    settings jsonb;
    drawing text;
    saved cde_private.cad_alignments%rowtype;
begin
    if actor is null then
        raise exception 'Phiên đăng nhập đã hết hạn' using errcode = '28000';
    end if;
    if project_role is null then
        raise insufficient_privilege;
    end if;
    if operation = 'list' then
        return coalesce((
            select jsonb_agg(jsonb_build_object(
                'floor', a.storey, 'revision', a.revision, 'alignment', a.alignment
            ) order by a.storey)
            from cde_private.cad_alignments a where a.project_id = project
        ), '[]'::jsonb);
    end if;
    if operation is distinct from 'save' or project_role not in ('admin', 'reviewer', 'member') then
        raise insufficient_privilege;
    end if;

    floor_name := payload->>'floor';
    expected := (payload->>'expectedRevision')::integer;
    submitted := payload->'alignment';
    if floor_name is null or btrim(floor_name) = '' or length(floor_name) > 240 or expected is null
        or expected < 0 or submitted is null or jsonb_typeof(submitted) not in ('null', 'object') then
        raise exception 'Cấu hình CAD không hợp lệ' using errcode = '22023';
    end if;

    if jsonb_typeof(submitted) = 'object' then
        drawing := submitted->>'drawing';
        if drawing is null or not cde_private.cad_file_access(project || '/' || drawing, false)
            or not exists (
                select 1 from storage.objects o where o.bucket_id = 'cde-cad' and o.name = project || '/' || drawing
            ) then
            raise exception 'Bản vẽ CAD không có trong hồ sơ dự án' using errcode = '22023';
        end if;
        if not exists (
            select 1 from cde_private.models m
            where m.project_id = project
                and m.elements @> jsonb_build_array(jsonb_build_object('storey', floor_name))
                and cde_private.model_visible(project, m.id)
        ) then
            raise exception 'Tầng không có trong mô hình IFC được phép xem' using errcode = '22023';
        end if;
        if not coalesce(
            submitted->>'unit' in ('auto', 'mm', 'cm', 'm', 'in', 'ft')
            and jsonb_typeof(submitted->'x') = 'number' and (submitted->>'x')::numeric between -1000000000 and 1000000000
            and jsonb_typeof(submitted->'y') = 'number' and (submitted->>'y')::numeric between -1000000000 and 1000000000
            and jsonb_typeof(submitted->'rotation') = 'number' and (submitted->>'rotation')::numeric between -360 and 360
            and jsonb_typeof(submitted->'opacity') = 'number' and (submitted->>'opacity')::numeric between 0 and 1,
            false
        ) then
            raise exception 'Thông số căn chỉnh CAD không hợp lệ' using errcode = '22023';
        end if;
        settings := jsonb_build_object(
            'drawing', drawing, 'unit', submitted->>'unit', 'x', submitted->'x', 'y', submitted->'y',
            'rotation', submitted->'rotation', 'opacity', submitted->'opacity'
        );
    end if;

    if expected = 0 then
        insert into cde_private.cad_alignments (project_id, storey, alignment, revision)
        values (project, floor_name, settings, 1)
        on conflict (project_id, storey) do nothing returning * into saved;
    else
        update cde_private.cad_alignments a
        set alignment = settings, revision = a.revision + 1, updated_at = now()
        where a.project_id = project and a.storey = floor_name and a.revision = expected
        returning * into saved;
    end if;
    if not found then
        raise exception 'Cấu hình tầng đã thay đổi. Hãy tải lại cấu hình dự án.' using errcode = 'PT409';
    end if;

    insert into cde_private.audit (project_id, actor, operation)
    values (project, (actor->>'id')::uuid, 'cad.alignments.save');
    return jsonb_build_object('floor', saved.storey, 'revision', saved.revision, 'alignment', saved.alignment);
end;
$$;

revoke all on function cde_private.cad_alignments_rpc(text, text, jsonb) from public, anon, authenticated;
grant execute on function cde_private.cad_alignments_rpc(text, text, jsonb) to authenticated;

create function public.cde_cad_alignments(project_id text, operation text, payload jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
    select cde_private.cad_alignments_rpc(project_id, operation, payload);
$$;

revoke all on function public.cde_cad_alignments(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cde_cad_alignments(text, text, jsonb) to authenticated;
