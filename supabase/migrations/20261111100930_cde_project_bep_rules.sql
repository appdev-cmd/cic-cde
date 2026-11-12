create table cde_private.project_bep_rules (
    project_id text primary key references cde_private.projects(id) on delete cascade,
    version integer not null,
    rules jsonb not null,
    updated_at timestamptz not null default now()
);

create table cde_private.document_revision_counters (
    project_id text not null references cde_private.projects(id) on delete cascade,
    code text not null,
    preliminary integer not null default 0,
    published integer not null default 0,
    primary key (project_id, code)
);

alter table cde_private.project_bep_rules enable row level security;
alter table cde_private.document_revision_counters enable row level security;
revoke all on cde_private.project_bep_rules, cde_private.document_revision_counters
    from public, anon, authenticated;

alter table cde_private.documents
    add column revision_code text,
    add column suitability_code text,
    add column bep_rules jsonb,
    add column bep_version integer,
    add column preliminary_number integer;

create function cde_private.validate_bep_rules(rules jsonb)
returns void language plpgsql set search_path = '' as $$
declare
    stage text;
    options jsonb;
begin
    if jsonb_typeof(rules) is distinct from 'object' or octet_length(rules::text) > 32768
        or length(trim(coalesce(rules->>'reference', ''))) not between 1 and 160
        or coalesce(rules->>'workingPrefix', '') !~ '^[A-Z]{1,8}$'
        or coalesce(rules->>'sharedPrefix', '') !~ '^[A-Z]{1,8}$'
        or coalesce(rules->>'publishedPrefix', '') !~ '^[A-Z]{1,8}$'
        or rules->>'publishedPrefix' in (rules->>'workingPrefix', rules->>'sharedPrefix')
        or coalesce(rules->>'digits', '') !~ '^[2-6]$'
        or coalesce(rules->>'workingSuffix', '') !~ '^(\.[0-9]{1,4})?$'
    then
        raise exception 'Kiểm tra lại tham chiếu BEP, tiền tố, số chữ số và hậu tố bản làm việc.';
    end if;

    foreach stage in array array['WIP', 'Shared', 'Review', 'Approved', 'Published'] loop
        options := rules->'statuses'->stage;
        if jsonb_typeof(options) is distinct from 'array' then
            raise exception 'Thiếu danh mục mã cho bước %.', stage;
        end if;
        if jsonb_array_length(options) not between 1 and 20
            or (stage = 'WIP' and jsonb_array_length(options) <> 1)
            or exists (
                select from jsonb_array_elements(options) as option(value)
                where coalesce(option.value->>'code', '') !~ '^[A-Z0-9][A-Z0-9_-]{0,15}$'
                    or length(trim(coalesce(option.value->>'label', ''))) not between 1 and 120
            )
            or exists (
                select from jsonb_array_elements(options) as option(value)
                group by option.value->>'code' having count(*) > 1
            )
        then
            raise exception 'Danh mục mã của bước % không hợp lệ hoặc có mã trùng.', stage;
        end if;
    end loop;
end;
$$;

create function cde_private.bep_revision(rules jsonb, stage text, number integer)
returns text language sql immutable set search_path = '' as $$
    select case stage
        when 'WIP' then rules->>'workingPrefix'
        when 'Published' then rules->>'publishedPrefix'
        else rules->>'sharedPrefix'
    end || lpad(number::text, greatest(length(number::text), (rules->>'digits')::integer), '0')
        || case when stage = 'WIP' then coalesce(rules->>'workingSuffix', '') else '' end;
$$;

-- A change of prefix must not reissue a code already used by another version.
create function cde_private.assert_bep_revision_available(project text, container text, document_id bigint, requested_revision text)
returns void language plpgsql set search_path = '' as $$
begin
    if exists (
        select from cde_private.documents d
        where d.project_id = project and d.code = container and d.id <> document_id
            and (coalesce(d.revision_code, 'R' || lpad(d.revision::text, greatest(2, length(d.revision::text)), '0')) = requested_revision
                or d.history @> jsonb_build_array(jsonb_build_object('revisionCode', requested_revision)))
    ) or exists (
        select from cde_private.audit a
        where a.project_id = project and a.operation = 'documents.delete' and a.details->>'code' = container
            and (coalesce(a.details->>'revision_code', 'R' || lpad(a.details->>'revision', greatest(2, length(a.details->>'revision')), '0')) = requested_revision
                or a.details->'history' @> jsonb_build_array(jsonb_build_object('revisionCode', requested_revision)))
    ) then
        raise exception 'Mã phiên bản % đã được cấp cho hồ sơ này. Hãy kiểm tra tiền tố và quy tắc BEP.', requested_revision using errcode = 'PT409';
    end if;
end;
$$;

revoke all on function cde_private.validate_bep_rules(jsonb),
    cde_private.bep_revision(jsonb, text, integer),
    cde_private.assert_bep_revision_available(text, text, bigint, text) from public, anon, authenticated;

-- Keep the existing API implementation and its access checks behind the public entry point.
alter function public.cde_api(text, jsonb, text) set schema cde_private;
revoke all on function cde_private.cde_api(text, jsonb, text) from public, anon, authenticated;

create function cde_private.cde_bep_api(operation text, payload jsonb, project_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    project text := project_id;
    settings cde_private.project_bep_rules%rowtype;
    document cde_private.documents%rowtype;
    actor jsonb;
    next_state text;
    next_status text;
    next_revision text;
    revision_number integer;
    existing boolean;
    result jsonb;
begin
    if operation not in ('bep.get', 'bep.save', 'documents.list', 'documents.register', 'documents.transition') then
        return cde_private.cde_api(operation, payload, project);
    end if;

    actor := cde_private.profile();
    if actor is null then
        raise exception 'Phiên đăng nhập đã hết hạn' using errcode = '28000';
    end if;
    if cde_private.project_role(project) is null then
        raise insufficient_privilege;
    end if;

    if operation in ('bep.save', 'documents.register', 'documents.transition') then
        perform pg_advisory_xact_lock(hashtextextended(project, 0));
    end if;
    select * into settings from cde_private.project_bep_rules b where b.project_id = project;

    if operation = 'bep.get' then
        return case when settings.version is not null
            then jsonb_build_object('version', settings.version, 'rules', settings.rules) end;
    end if;

    if operation = 'bep.save' then
        if cde_private.project_role(project) is distinct from 'admin' then
            raise insufficient_privilege;
        end if;
        if coalesce(settings.version, 0) is distinct from (payload->>'expectedVersion')::integer then
            raise exception 'Cấu hình BEP đã thay đổi. Hãy tải lại.' using errcode = 'PT409';
        end if;
        perform cde_private.validate_bep_rules(payload->'rules');
        insert into cde_private.project_bep_rules(project_id, version, rules)
            values (project, 1, payload->'rules')
            on conflict on constraint project_bep_rules_pkey do update
                set version = project_bep_rules.version + 1, rules = excluded.rules, updated_at = now()
            returning * into settings;
        insert into cde_private.audit(project_id, actor, operation, details)
            values (project, (actor->>'id')::uuid, 'bep.save', to_jsonb(settings));
        return jsonb_build_object('version', settings.version, 'rules', settings.rules);
    end if;

    if operation = 'documents.list' then
        result := cde_private.cde_api(operation, payload, project);
        return coalesce((
            select jsonb_agg(item.value || jsonb_build_object(
                'revisionCode', d.revision_code,
                'suitabilityCode', d.suitability_code,
                'suitabilityOptions', d.bep_rules->'statuses',
                'bepVersion', d.bep_version,
                'bepReference', d.bep_rules->>'reference'
            ) order by item.ordinality)
            from jsonb_array_elements(result) with ordinality as item(value, ordinality)
            join cde_private.documents d on d.project_id = project and d.id = (item.value->>'id')::bigint
        ), '[]'::jsonb);
    end if;

    if operation = 'documents.register' and settings.version is not null then
        select exists (
            select from cde_private.documents d where d.project_id = project
                and d.code = upper(trim(payload->>'code')) and d.model_id = payload->>'modelId'
        ) into existing;
        result := cde_private.cde_api(operation, payload, project);
        if existing then return result; end if;
        select * into strict document from cde_private.documents d where d.project_id = project
            and d.code = upper(trim(payload->>'code')) and d.model_id = payload->>'modelId';
        insert into cde_private.document_revision_counters(project_id, code, preliminary)
            values (project, document.code, 1)
            on conflict on constraint document_revision_counters_pkey do update
                set preliminary = document_revision_counters.preliminary + 1
            returning preliminary into revision_number;
        next_status := settings.rules->'statuses'->'WIP'->0->>'code';
        next_revision := cde_private.bep_revision(settings.rules, 'WIP', revision_number);
        perform cde_private.assert_bep_revision_available(project, document.code, document.id, next_revision);
        update cde_private.documents d set revision_code = next_revision, suitability_code = next_status,
            bep_rules = settings.rules, bep_version = settings.version, preliminary_number = revision_number,
            history = jsonb_set(d.history, '{0}', (d.history->0) || jsonb_build_object(
                'revisionCode', next_revision, 'suitabilityCode', next_status, 'actorId', actor->>'id', 'bepVersion', settings.version))
        where d.id = document.id;
        return public.cde_api('documents.list', '{}', project);
    end if;

    if operation = 'documents.transition' then
        select * into document from cde_private.documents d
            where d.project_id = project and d.id = (payload->>'id')::bigint;
        if document.bep_version is not null then
            next_state := payload->>'state';
            next_status := case next_state
                when 'WIP' then document.bep_rules->'statuses'->'WIP'->0->>'code'
                when 'Archived' then document.suitability_code
                else payload->>'suitabilityCode'
            end;
            if next_state is distinct from 'Archived' and not exists (
                select from jsonb_array_elements(document.bep_rules->'statuses'->next_state) as option(value)
                where option.value->>'code' = next_status
            ) then
                raise exception 'Chọn mã trạng thái sử dụng hợp lệ cho bước tiếp theo.';
            end if;
            perform cde_private.cde_api(operation, payload, project);
            revision_number := document.preliminary_number;
            if next_state = 'WIP' then
                update cde_private.document_revision_counters c set preliminary = c.preliminary + 1
                    where c.project_id = project and c.code = document.code returning preliminary into revision_number;
            elsif next_state = 'Published' then
                update cde_private.document_revision_counters c set published = c.published + 1
                    where c.project_id = project and c.code = document.code returning published into revision_number;
            end if;
            next_revision := case when next_state = 'Archived' then document.revision_code
                else cde_private.bep_revision(document.bep_rules, next_state, revision_number) end;
            perform cde_private.assert_bep_revision_available(project, document.code, document.id, next_revision);
            update cde_private.documents d set revision_code = next_revision, suitability_code = next_status,
                preliminary_number = case when next_state = 'WIP' then revision_number else d.preliminary_number end,
                history = jsonb_set(d.history, '{0}', (d.history->0) || jsonb_build_object(
                    'revisionCode', next_revision, 'suitabilityCode', next_status, 'actorId', actor->>'id', 'bepVersion', d.bep_version))
            where d.id = document.id;
            return public.cde_api('documents.list', '{}', project);
        end if;
    end if;

    return cde_private.cde_api(operation, payload, project);
end;
$$;

revoke all on function cde_private.cde_bep_api(text, jsonb, text) from public, anon, authenticated;
grant execute on function cde_private.cde_bep_api(text, jsonb, text) to authenticated;

create function public.cde_api(operation text, payload jsonb default '{}', project_id text default 'demo-project')
returns jsonb language sql security invoker set search_path = '' as $$
    select cde_private.cde_bep_api(operation, payload, project_id);
$$;

revoke all on function public.cde_api(text, jsonb, text) from public, anon;
grant execute on function public.cde_api(text, jsonb, text) to authenticated;
notify pgrst, 'reload schema';
