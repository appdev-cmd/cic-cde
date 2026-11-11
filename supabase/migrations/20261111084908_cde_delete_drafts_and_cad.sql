insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cde-documents', 'cde-documents', false, 50000000, array['application/octet-stream']);

create function cde_private.project_document_access(path text, writing boolean)
returns boolean language sql stable security definer set search_path = '' as $$
    select coalesce(
        path ~ '^[^/]+/[0-9a-f-]{36}_(EIR|BEP|STANDARD|MINUTES|REPORT|OTHER)_[A-Za-z0-9_-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|png|jpe?g)$'
        and length(split_part(path, '/', 2)) <= 391
        and case when writing then role in ('admin', 'reviewer', 'member') else role is not null end,
        false
    )
    from (select cde_private.project_role(split_part(path, '/', 1)) as role) project;
$$;

create function cde_private.project_file_admin(path text)
returns boolean language sql stable security definer set search_path = '' as $$
    select coalesce(cde_private.project_role(split_part(path, '/', 1)) = 'admin', false);
$$;

revoke all on function cde_private.project_document_access(text, boolean) from public, anon, authenticated;
revoke all on function cde_private.project_file_admin(text) from public, anon, authenticated;
grant execute on function cde_private.project_document_access(text, boolean) to authenticated;
grant execute on function cde_private.project_file_admin(text) to authenticated;

create policy cde_documents_read on storage.objects for select to authenticated
    using (bucket_id = 'cde-documents' and cde_private.project_document_access(name, false));
create policy cde_documents_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'cde-documents' and cde_private.project_document_access(name, true));
create policy cde_project_files_delete on storage.objects for delete to authenticated
    using (
        bucket_id in ('cde-cad', 'cde-documents')
        and cde_private.project_file_admin(name)
    );

alter table cde_private.audit add column details jsonb;
create index cde_deleted_document_code on cde_private.audit (project_id, (details->>'code'))
    where operation = 'documents.delete';

-- Keep revision numbers from deleted drafts out of circulation.
create function cde_private.reserve_deleted_document_revisions()
returns trigger language plpgsql set search_path = '' as $$
begin
    select greatest(new.revision, coalesce(max((a.details->>'revision')::integer), 0) + 1)
    into new.revision
    from cde_private.audit a
    where a.project_id = new.project_id and a.operation = 'documents.delete' and a.details->>'code' = new.code;
    return new;
end;
$$;

revoke all on function cde_private.reserve_deleted_document_revisions() from public, anon, authenticated;
create trigger cde_reserve_deleted_revisions before insert on cde_private.documents
    for each row execute function cde_private.reserve_deleted_document_revisions();

create function cde_private.delete_document_draft(project text, document bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    actor jsonb := cde_private.profile();
    deleted cde_private.documents%rowtype;
begin
    if actor is null then
        raise exception 'Phiên đăng nhập đã hết hạn' using errcode = '28000';
    end if;
    if cde_private.project_role(project) is distinct from 'admin' then
        raise insufficient_privilege;
    end if;
    -- Match the lock used by registration and transitions.
    perform pg_advisory_xact_lock(hashtextextended(project, 0));
    if cde_private.project_role(project) is distinct from 'admin' then
        raise insufficient_privilege;
    end if;

    delete from cde_private.documents d
        where d.project_id = project and d.id = document and d.state = 'WIP'
        returning * into deleted;
    if not found then
        raise exception 'Phiên bản đã thay đổi hoặc đã bị xóa. Hãy tải lại danh sách.' using errcode = 'PT409';
    end if;
    insert into cde_private.audit(project_id, actor, operation, details)
        values (project, (actor->>'id')::uuid, 'documents.delete', to_jsonb(deleted));
    return public.cde_api('documents.list', '{}', project);
end;
$$;

revoke all on function cde_private.delete_document_draft(text, bigint) from public, anon, authenticated;
grant execute on function cde_private.delete_document_draft(text, bigint) to authenticated;

create function public.cde_delete_document_draft(project_id text, document_id bigint)
returns jsonb language sql security invoker set search_path = '' as $$
    select cde_private.delete_document_draft(project_id, document_id);
$$;

revoke all on function public.cde_delete_document_draft(text, bigint) from public, anon, authenticated;
grant execute on function public.cde_delete_document_draft(text, bigint) to authenticated;
