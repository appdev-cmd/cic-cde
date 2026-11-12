create function cde_private.move_cad_drawings(project text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    drawings jsonb := payload->'drawings';
    drawing jsonb;
begin
    if jsonb_typeof(drawings) is distinct from 'array' or drawings = '[]'::jsonb then
        raise exception 'Hãy chọn bản vẽ cần di chuyển.' using errcode = '22023';
    end if;
    if not coalesce(payload ? 'folderId', false) then
        raise exception 'Hãy chọn thư mục đích.' using errcode = '22023';
    end if;

    -- Reuse the single-drawing permission and revision checks under its project lock.
    -- An error for any drawing rolls back the whole RPC.
    for drawing in select value from jsonb_array_elements(drawings) loop
        perform cde_private.cad_directory_rpc(project, 'move_drawing', jsonb_build_object(
            'objectId', drawing->'objectId',
            'expectedRevision', drawing->'expectedRevision',
            'folderId', payload->'folderId'
        ));
    end loop;
    return jsonb_build_object('count', jsonb_array_length(drawings));
end;
$$;

revoke all on function cde_private.move_cad_drawings(text, jsonb) from public, anon, authenticated;
grant execute on function cde_private.move_cad_drawings(text, jsonb) to authenticated;

create or replace function public.cde_cad_folders(project_id text, operation text, payload jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
    select case when operation = 'move_drawings'
        then cde_private.move_cad_drawings(project_id, payload)
        else cde_private.cad_directory_rpc(project_id, operation, payload)
    end;
$$;
