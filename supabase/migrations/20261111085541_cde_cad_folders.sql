-- Keep the existing loose-file keys and admit folder paths inside the same project.
create or replace function cde_private.cad_file_access(path text, writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
    select coalesce(
        path ~ '^[^/]+/(folders/([A-Za-z0-9_-]+/)+)?[0-9a-f-]{36}_[A-Za-z0-9_-]+\.(dwg|dxf)$'
        and octet_length(path) <= 1024
        and length(substring(path from '[^/]+$')) <= 381
        and case when writing then role in ('admin', 'reviewer', 'member')
                 else role is not null end,
        false
    )
    from (select cde_private.project_role(split_part(path, '/', 1)) as role) project;
$$;
