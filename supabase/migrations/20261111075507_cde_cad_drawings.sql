insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cde-cad', 'cde-cad', false, 25000000, array['application/octet-stream']);

-- CAD drawings are shared with the project as soon as the object is uploaded.
create function cde_private.cad_file_access(path text, writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
    select coalesce(
        path ~ '^[^/]+/[0-9a-f-]{36}_[A-Za-z0-9_-]+\.(dwg|dxf)$'
        and length(split_part(path, '/', 2)) <= 381
        and case when writing then role in ('admin', 'reviewer', 'member')
                 else role is not null end,
        false
    )
    from (select cde_private.project_role(split_part(path, '/', 1)) as role) project;
$$;

revoke all on function cde_private.cad_file_access(text, boolean) from public, anon, authenticated;
grant execute on function cde_private.cad_file_access(text, boolean) to authenticated;

create policy cde_cad_read on storage.objects for select to authenticated
    using (bucket_id = 'cde-cad' and cde_private.cad_file_access(name, false));

create policy cde_cad_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'cde-cad' and cde_private.cad_file_access(name, true));
