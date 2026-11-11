create extension if not exists pgcrypto with schema extensions;
create schema cde_private;
revoke all on schema cde_private from public, anon, authenticated;
grant usage on schema cde_private to authenticated;

create table cde_private.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique check (length(username) between 3 and 80),
    organization text not null check (length(organization) between 1 and 120),
    site_admin boolean not null default false
);
create table cde_private.projects (
    id text primary key default gen_random_uuid()::text,
    name text not null check (length(name) between 1 and 160),
    created_at timestamptz not null default now()
);
create table cde_private.memberships (
    project_id text not null references cde_private.projects(id),
    organization text not null,
    role text not null check (role in ('admin','reviewer','member','viewer')),
    active boolean not null default true,
    revision integer not null default 0,
    primary key (project_id, organization)
);
create table cde_private.invitations (
    id uuid primary key default gen_random_uuid(),
    project_id text not null references cde_private.projects(id),
    organization text not null check (length(organization) between 1 and 120),
    role text not null check (role in ('admin','reviewer','member','viewer')),
    digest text not null unique,
    expires timestamptz not null default now() + interval '7 days',
    used boolean not null default false
);
create index invitations_project_org on cde_private.invitations(project_id, organization);
create table cde_private.models (
    project_id text not null references cde_private.projects(id),
    id text not null,
    metadata jsonb not null,
    elements jsonb not null,
    source_path text not null,
    owners text[] not null,
    primary key (project_id, id)
);
create table cde_private.documents (
    id bigint generated always as identity primary key,
    project_id text not null,
    code text not null check (code ~ '^[A-Z0-9_-]{1,64}$'),
    revision integer not null,
    model_id text not null,
    title text not null check (length(title) between 1 and 200),
    discipline text not null check (discipline in ('ARC','STR','MEP','OTHER')),
    state text not null default 'WIP' check (state in ('WIP','Shared','Review','Approved','Published','Archived')),
    owner text not null,
    history jsonb not null default '[]',
    foreign key (project_id, model_id) references cde_private.models(project_id,id),
    unique(project_id,code,revision),
    unique(project_id,code,model_id)
);
create index documents_model_state on cde_private.documents(project_id,model_id,state);
create table cde_private.jobs (
    id uuid primary key default gen_random_uuid(),
    project_id text not null references cde_private.projects(id),
    owner uuid not null references cde_private.profiles(id),
    kind text not null check (kind in ('import','checks')),
    input jsonb not null,
    phase text not null default 'queued' check (phase in ('queued','running','completed','failed','cancelled')),
    lease uuid,
    attempts integer not null default 0,
    updated_at timestamptz not null default now(),
    result jsonb,
    error text
);
create index jobs_owner on cde_private.jobs(project_id,owner,updated_at);
create table cde_private.runs (
    id uuid primary key,
    project_id text not null references cde_private.projects(id),
    owner uuid not null references cde_private.profiles(id),
    result jsonb not null
);
create index runs_project on cde_private.runs(project_id);
create table cde_private.issues (
    id bigint generated always as identity primary key,
    project_id text not null references cde_private.projects(id),
    run_id uuid not null references cde_private.runs(id),
    finding jsonb not null,
    snapshots jsonb not null,
    state text not null default 'Open' check (state in ('Open','InProgress','Review','Closed')),
    assignee text not null default '' check (length(assignee) <= 120),
    revision integer not null default 0,
    comments jsonb not null default '[]'
);
create index issues_project on cde_private.issues(project_id);
create unique index issues_run_finding on cde_private.issues(run_id,(finding->>'id'));
create table cde_private.audit (
    id bigint generated always as identity primary key,
    project_id text,
    actor uuid,
    operation text not null,
    created_at timestamptz not null default now()
);
create index audit_project_created on cde_private.audit(project_id,created_at desc);
create table cde_private.settings (name text primary key, value text not null);

do $$ declare entry record; begin
    for entry in select tablename from pg_tables where schemaname='cde_private' loop
        execute format('alter table cde_private.%I enable row level security', entry.tablename);
    end loop;
end $$;
revoke all on all tables in schema cde_private from public, anon, authenticated;
revoke all on all sequences in schema cde_private from public, anon, authenticated;

-- Only trusted database profiles and live Auth sessions determine permissions.
create function cde_private.profile() returns jsonb language sql stable security definer set search_path='' as $$
    select jsonb_build_object('id',p.id,'username',p.username,'organization',p.organization,
        'siteAdmin',p.site_admin,'role',case when p.site_admin then 'admin' else 'member' end)
    from cde_private.profiles p where p.id=(select auth.uid())
    and exists (select 1 from auth.sessions s where s.user_id=p.id and s.id::text=(select auth.jwt()->>'session_id'))
$$;
create function cde_private.project_role(project text) returns text language sql stable security definer set search_path='' as $$
    select case when (cde_private.profile()->>'siteAdmin')::boolean then 'admin' else
        (select m.role from cde_private.memberships m where m.project_id=project
         and m.organization=cde_private.profile()->>'organization' and m.active) end
    where exists (select 1 from cde_private.projects p where p.id=project)
$$;
create function cde_private.model_visible(project text, model text) returns boolean language sql stable security definer set search_path='' as $$
    select coalesce(cde_private.project_role(project) is not null and exists (
        select 1 from cde_private.models m where m.project_id=project and m.id=model and (
            cde_private.project_role(project)='admin' or cde_private.profile()->>'organization'=any(m.owners)
            or exists (select 1 from cde_private.documents d where d.project_id=project and d.model_id=model and d.state<>'WIP')
        )),false)
$$;
create function cde_private.snapshots_visible(project text, snapshots jsonb) returns boolean language sql stable security definer set search_path='' as $$
    select jsonb_array_length(snapshots)>0 and not exists (
        select 1 from jsonb_array_elements(snapshots) s where not cde_private.model_visible(project,s->>'modelId'))
$$;
create function cde_private.file_access(path text, writing boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare project text:=split_part(path,'/',1); role text:=cde_private.project_role(project);
begin
    if role is null then return false; end if;
    if writing then
        return role<>'viewer' and (path ~ '^[^/]+/uploads/[0-9a-f-]{36}\.ifc$'
            or exists (select 1 from cde_private.jobs j where j.project_id=project
                and j.owner=(select auth.uid()) and j.phase='running' and path like project||'/jobs/'||j.id::text||'/%'));
    end if;
    return exists (select 1 from cde_private.jobs j where j.project_id=project and j.owner=(select auth.uid()) and j.input->>'path'=path)
        or exists (select 1 from cde_private.models m where m.project_id=project and cde_private.model_visible(project,m.id)
            and (m.source_path=path or exists(select 1 from jsonb_array_elements(m.metadata->'geometryAssets') a where a->>'storagePath'=path)));
end $$;
revoke all on all functions in schema cde_private from public, anon, authenticated;
grant execute on function cde_private.file_access(text,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values ('cde-files','cde-files',false,104857600);
create policy cde_files_read on storage.objects for select to authenticated
    using (bucket_id='cde-files' and cde_private.file_access(name,false));
create policy cde_files_insert on storage.objects for insert to authenticated
    with check (bucket_id='cde-files' and cde_private.file_access(name,true));

-- The API is the intentional authorization boundary. Tables have no direct client grants.
create function public.cde_api(operation text, payload jsonb default '{}', project_id text default 'demo-project')
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
    actor jsonb:=cde_private.profile();
    org text:=actor->>'organization';
    role text;
    result jsonb;
    target text;
    token text;
    row_data record;
    item jsonb;
    before_state text;
    after_state text;
begin
    if actor is null then raise exception 'Phiên đăng nhập đã hết hạn' using errcode='28000'; end if;
    if operation='profile' then return actor; end if;
    if operation='health' then return '{"status":"ready","mode":"cloud"}'; end if;
    if operation='projects.list' then
        return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',cde_private.project_role(p.id)) order by p.created_at,p.id)
            from cde_private.projects p where cde_private.project_role(p.id) is not null),'[]');
    end if;
    if operation='projects.create' then
        if not (actor->>'siteAdmin')::boolean then raise insufficient_privilege; end if;
        insert into cde_private.projects(name) values(trim(payload->>'name')) returning id into target;
        insert into cde_private.memberships(project_id,organization,role) values(target,org,'admin');
        insert into cde_private.audit(project_id,actor,operation) values(target,(actor->>'id')::uuid,operation);
        return jsonb_build_object('id',target,'name',trim(payload->>'name'),'role','admin');
    end if;
    if operation='projects.accept' then
        select i.project_id into target from cde_private.invitations i where i.digest=encode(extensions.digest(payload->>'token','sha256'),'hex');
        perform pg_advisory_xact_lock(hashtextextended(target,0));
        select * into row_data from cde_private.invitations i where i.digest=encode(extensions.digest(payload->>'token','sha256'),'hex') and not i.used and i.expires>now() for update;
        if not found then raise exception 'Lời mời không hợp lệ, đã dùng hoặc hết hạn'; end if;
        if row_data.organization<>org then raise insufficient_privilege; end if;
        update cde_private.invitations set used=true where id=row_data.id;
        insert into cde_private.memberships(project_id,organization,role) values(row_data.project_id,org,row_data.role)
            on conflict on constraint memberships_pkey do update set role=excluded.role,active=true,revision=cde_private.memberships.revision+1;
        insert into cde_private.audit(project_id,actor,operation) values(row_data.project_id,(actor->>'id')::uuid,operation);
        return public.cde_api('projects.list','{}',project_id);
    end if;
    if operation='users.list' then
        if not (actor->>'siteAdmin')::boolean then raise insufficient_privilege; end if;
        return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'organization',p.organization,'role',case when p.site_admin then 'admin' else 'member' end)) from cde_private.profiles p),'[]');
    end if;
    if operation like 'projects.%' then project_id:=payload->>'projectId'; end if;
    role:=cde_private.project_role(project_id);
    if role is null then raise insufficient_privilege; end if;
    if operation in ('project.get','projects.current') then
        select name into target from cde_private.projects p where p.id=project_id;
        if operation='projects.current' then return actor||jsonb_build_object('projectId',project_id,'projectName',target,'role',role); end if;
        return jsonb_build_object('id',project_id,'name',target,'stage','G1-cloud','role',role);
    end if;
    if operation='projects.members' then
        if role<>'admin' then raise insufficient_privilege; end if;
        return coalesce((select jsonb_agg(jsonb_build_object('organization',m.organization,'role',m.role,'active',m.active,'revision',m.revision) order by m.organization)
            from cde_private.memberships m where m.project_id=cde_api.project_id),'[]');
    end if;
    if operation='models.list' then
        return coalesce((select jsonb_agg(m.metadata order by m.id) from cde_private.models m where m.project_id=cde_api.project_id and cde_private.model_visible(project_id,m.id)),'[]');
    end if;
    if operation='workspace.get' then
        return jsonb_build_object('models',public.cde_api('models.list','{}',project_id),'elements',
            coalesce((select jsonb_agg(e) from cde_private.models m cross join lateral jsonb_array_elements(m.elements) e
                where m.project_id=cde_api.project_id and cde_private.model_visible(project_id,m.id)),'[]'),'findings','[]'::jsonb,'synthetic',false);
    end if;
    if operation='models.sources' then
        return coalesce((select jsonb_agg(jsonb_build_object('modelId',m.id,'sourcePath',m.source_path,'sourceHash',m.metadata->>'hash','transform',m.metadata->'transform'))
            from cde_private.models m where m.project_id=cde_api.project_id and m.id in (select jsonb_array_elements_text(payload->'ids')) and cde_private.model_visible(project_id,m.id)),'[]');
    end if;
    if operation='geometry.get' then
        select a into result from cde_private.models m cross join lateral jsonb_array_elements(m.metadata->'geometryAssets') a
            where m.project_id=cde_api.project_id and a->>'id'=payload->>'id' and cde_private.model_visible(project_id,m.id) limit 1;
        if result is null then raise insufficient_privilege; end if;
        return result;
    end if;
    if operation='documents.list' then
        return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'revision',d.revision,'modelId',d.model_id,
            'title',d.title,'discipline',d.discipline,'state',d.state,'history',d.history) order by d.code,d.revision desc)
            from cde_private.documents d where d.project_id=cde_api.project_id and (role='admin' or d.owner=org or d.state<>'WIP')),'[]');
    end if;
    if operation='issues.list' then
        return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'runId',i.run_id,'finding',i.finding,'snapshots',i.snapshots,
            'state',i.state,'assignee',i.assignee,'revision',i.revision,'comments',i.comments) order by i.id desc)
            from cde_private.issues i where i.project_id=cde_api.project_id and cde_private.snapshots_visible(project_id,i.snapshots)),'[]');
    end if;
    if operation='jobs.get' then
        select * into row_data from cde_private.jobs j where j.project_id=cde_api.project_id and j.id=(payload->>'jobId')::uuid and (j.owner=(actor->>'id')::uuid or role='admin');
        if not found then raise insufficient_privilege; end if;
        return jsonb_build_object('jobId',row_data.id,'phase',row_data.phase,'cancellable',row_data.phase in ('queued','running'),'result',row_data.result,'error',row_data.error);
    end if;
    if operation='elements.search' then
        return coalesce((select jsonb_agg(e) from jsonb_array_elements(public.cde_api('workspace.get','{}',project_id)->'elements') e
            where coalesce(payload->>'query','')='' or (e->>'name') ilike '%'||(payload->>'query')||'%'),'[]');
    end if;
    if role='viewer' then raise insufficient_privilege; end if;
    perform pg_advisory_xact_lock(hashtextextended(project_id,0));
    role:=cde_private.project_role(project_id);
    if role is null or role='viewer' then raise insufficient_privilege; end if;
    insert into cde_private.audit(project_id,actor,operation) values(project_id,(actor->>'id')::uuid,operation);
    if operation='projects.invite' then
        if role<>'admin' then raise insufficient_privilege; end if;
        target:=trim(payload->>'organization');
        if exists(select 1 from cde_private.memberships m where m.project_id=cde_api.project_id and m.organization=target and m.active) then
            raise exception 'Đơn vị đã tham gia dự án';
        end if;
        update cde_private.invitations i set used=true where i.project_id=cde_api.project_id and i.organization=target and not i.used;
        token:=encode(extensions.gen_random_bytes(32),'hex');
        insert into cde_private.invitations(project_id,organization,role,digest) values(project_id,target,payload->>'role',encode(extensions.digest(token,'sha256'),'hex'))
            returning jsonb_build_object('id',id,'token',token,'organization',organization,'expires',extract(epoch from expires)) into result;
        return result;
    end if;
    if operation='projects.members.update' then
        if role<>'admin' then raise insufficient_privilege; end if;
        target:=payload->>'organization';
        select * into row_data from cde_private.memberships m where m.project_id=cde_api.project_id and m.organization=target;
        if not found or row_data.revision is distinct from (payload->>'expectedRevision')::int then raise exception 'Danh sách đã thay đổi. Hãy tải lại'; end if;
        if row_data.role='admin' and row_data.active and (payload->>'role'<>'admin' or not (payload->>'active')::boolean)
            and (select count(*) from cde_private.memberships m where m.project_id=cde_api.project_id and m.role='admin' and m.active)<=1 then
            raise exception 'Cần giữ ít nhất một đơn vị quản trị dự án';
        end if;
        update cde_private.memberships m set role=payload->>'role',active=(payload->>'active')::boolean,revision=m.revision+1
            where m.project_id=cde_api.project_id and m.organization=target;
        return '{"ok":true}';
    end if;
    if operation='jobs.create' then
        if payload->>'kind'='import' then
            target:=payload->>'path';
            if split_part(target,'/',1) is distinct from project_id or target !~ '^[^/]+/uploads/[0-9a-f-]{36}\.ifc$'
                or not exists(select 1 from storage.objects o where o.bucket_id='cde-files' and o.name=target and o.owner_id=actor->>'id') then
                raise insufficient_privilege;
            end if;
            item:=jsonb_build_object('path',target,'name',left(coalesce(payload->>'name','model.ifc'),240));
        elsif payload->>'kind'='checks' then
            if jsonb_typeof(payload->'modelIdsA') is distinct from 'array' or jsonb_typeof(payload->'modelIdsB') is distinct from 'array'
                or jsonb_array_length(payload->'modelIdsA') not between 1 and 12 or jsonb_array_length(payload->'modelIdsB') not between 1 and 12
                or exists(select 1 from jsonb_array_elements_text(payload->'modelIdsA'||payload->'modelIdsB') m where not cde_private.model_visible(project_id,m)) then
                raise insufficient_privilege;
            end if;
            item:=jsonb_build_object('modelIdsA',payload->'modelIdsA','modelIdsB',payload->'modelIdsB','classA',coalesce(payload->>'classA','IfcDuctSegment'),
                'classB',coalesce(payload->>'classB','IfcBeam'),'floor',coalesce(payload->>'floor','all'),'tolerance',coalesce(payload->'tolerance','0.002'));
        else raise exception 'Loại tác vụ không hợp lệ'; end if;
        insert into cde_private.jobs(project_id,owner,kind,input) values(project_id,(actor->>'id')::uuid,payload->>'kind',item)
            returning jsonb_build_object('jobId',id) into result;
        return result;
    end if;
    if operation like 'jobs.%' then
        select * into row_data from cde_private.jobs j where j.project_id=cde_api.project_id and j.id=(payload->>'jobId')::uuid and j.owner=(actor->>'id')::uuid for update;
        if not found then raise insufficient_privilege; end if;
        if operation='jobs.cancel' then
            update cde_private.jobs set phase='cancelled',updated_at=now() where id=row_data.id and phase in ('queued','running');
            return public.cde_api('jobs.get',payload,project_id);
        end if;
        if not exists (select 1 from cde_private.settings s where s.name='worker_digest' and s.value=encode(extensions.digest(payload->>'workerKey','sha256'),'hex')) then
            raise insufficient_privilege;
        end if;
        if operation='jobs.claim' then
            if row_data.phase not in ('queued','running') or (row_data.phase='running' and row_data.updated_at>now()-interval '330 seconds') then return 'null'; end if;
            if row_data.attempts>=3 then
                update cde_private.jobs set phase='failed',error='Worker đã vượt quá số lần thử',updated_at=now() where id=row_data.id;
                return 'null';
            end if;
            update cde_private.jobs set phase='running',lease=gen_random_uuid(),attempts=attempts+1,updated_at=now() where id=row_data.id
                returning jsonb_build_object('kind',kind,'input',input,'leaseId',lease) into result;
            return result;
        end if;
        if row_data.phase<>'running' or row_data.lease::text is distinct from payload->>'leaseId' then return 'null'; end if;
        if operation='jobs.fail' then
            update cde_private.jobs set phase='failed',error=left(coalesce(payload->>'error','Worker không hoàn tất tác vụ'),500),updated_at=now() where id=row_data.id;
            return '{"ok":true}';
        end if;
        if operation='jobs.complete' then
            result:=payload->'result';
            if row_data.kind='import' then
                item:=result->'model';
                insert into cde_private.models(project_id,id,metadata,elements,source_path,owners)
                    values(project_id,item->>'id',item,result->'elements',row_data.input->>'path',array[org])
                    on conflict on constraint models_pkey do update set owners=(select array_agg(distinct o) from unnest(cde_private.models.owners||excluded.owners) o);
                select result||jsonb_build_object('model',m.metadata,'elements',m.elements) into result from cde_private.models m where m.project_id=cde_api.project_id and m.id=item->>'id';
            else
                if not cde_private.snapshots_visible(project_id,result->'snapshots') then raise insufficient_privilege; end if;
                result:=result||jsonb_build_object('runId',row_data.id);
                insert into cde_private.runs(id,project_id,owner,result) values(row_data.id,project_id,row_data.owner,result);
            end if;
            update cde_private.jobs set phase='completed',result=result,updated_at=now() where id=row_data.id;
            return '{"ok":true}';
        end if;
    end if;
    if operation='documents.register' then
        target:=upper(trim(payload->>'code'));
        if not cde_private.model_visible(project_id,payload->>'modelId')
            or (role<>'admin' and not exists(select 1 from cde_private.models m where m.project_id=cde_api.project_id and m.id=payload->>'modelId' and org=any(m.owners)))
            or exists(select 1 from cde_private.documents d where d.project_id=cde_api.project_id and d.code=target and d.owner<>org and role<>'admin') then
            raise insufficient_privilege;
        end if;
        insert into cde_private.documents(project_id,code,revision,model_id,title,discipline,owner,history)
            select project_id,target,coalesce(max(d.revision),0)+1,payload->>'modelId',trim(payload->>'title'),payload->>'discipline',org,
                jsonb_build_array(jsonb_build_object('state','WIP','note','','createdAt',now()))
            from cde_private.documents d where d.project_id=cde_api.project_id and d.code=target on conflict do nothing;
        return public.cde_api('documents.list','{}',project_id);
    end if;
    if operation='documents.transition' then
        select * into row_data from cde_private.documents d where d.project_id=cde_api.project_id and d.id=(payload->>'id')::bigint;
        if not found then raise insufficient_privilege; end if;
        before_state:=row_data.state;
        after_state:=payload->>'state';
        target:=trim(coalesce(payload->>'note',''));
        if before_state is distinct from payload->>'expectedState' then raise exception 'Hồ sơ đã thay đổi. Hãy tải lại danh sách'; end if;
        if not ((before_state,after_state) in (('WIP','Shared'),('Shared','Review'),('Review','Approved'),('Review','WIP'),('Approved','Published'),('Published','Archived'))) then
            raise exception 'Chuyển trạng thái không hợp lệ';
        end if;
        if (before_state in ('WIP','Shared') and role<>'admin' and row_data.owner<>org)
            or (before_state='Review' and role not in ('admin','reviewer'))
            or (before_state in ('Approved','Published') and role<>'admin') then raise insufficient_privilege; end if;
        if length(target)>500 or (before_state='Review' and after_state='WIP' and target='') then raise exception 'Cần lý do khi trả hồ sơ, tối đa 500 ký tự'; end if;
        update cde_private.documents d set state=after_state,history=jsonb_build_array(jsonb_build_object('state',after_state,'note',target,'createdAt',now()))||d.history where d.id=row_data.id;
        return public.cde_api('documents.list','{}',project_id);
    end if;
    if operation='issues.create' then
        select r.result into result from cde_private.runs r where r.id=(payload->>'runId')::uuid and r.project_id=cde_api.project_id and (role='admin' or r.owner=(actor->>'id')::uuid);
        if not found or not cde_private.snapshots_visible(project_id,result->'snapshots') then raise insufficient_privilege; end if;
        select f into item from jsonb_array_elements(result->'findings') f where f->>'id'=payload->>'findingId';
        if not found then raise exception 'Va chạm không tồn tại'; end if;
        insert into cde_private.issues(project_id,run_id,finding,snapshots) values(project_id,(payload->>'runId')::uuid,item,result->'snapshots') on conflict do nothing;
        return public.cde_api('issues.list','{}',project_id);
    end if;
    if operation in ('issues.comment','issues.update') then
        select * into row_data from cde_private.issues i where i.project_id=cde_api.project_id and i.id=(payload->>'issueId')::bigint;
        if not found or not cde_private.snapshots_visible(project_id,row_data.snapshots) then raise insufficient_privilege; end if;
        if operation='issues.comment' then
            target:=trim(payload->>'body');
            if target is null or length(target) not between 1 and 2000 then raise exception 'Bình luận phải có từ 1 đến 2.000 ký tự'; end if;
            update cde_private.issues i set comments=i.comments||jsonb_build_array(jsonb_build_object('id',jsonb_array_length(i.comments)+1,'body',target,'createdAt',now())) where i.id=row_data.id;
        else
            before_state:=row_data.state;
            after_state:=payload->>'state';
            if row_data.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'Issue đã thay đổi. Hãy tải lại'; end if;
            if after_state in ('Open','Closed') and after_state<>before_state and role not in ('admin','reviewer') then raise insufficient_privilege; end if;
            if before_state<>after_state and (before_state,after_state) not in (('Open','InProgress'),('InProgress','Review'),('Review','Closed'),('Review','InProgress'),('Closed','Open')) then
                raise exception 'Chuyển trạng thái issue không hợp lệ';
            end if;
            update cde_private.issues i set state=after_state,assignee=trim(coalesce(payload->>'assignee','')),revision=i.revision+1 where i.id=row_data.id;
        end if;
        return public.cde_api('issues.list','{}',project_id);
    end if;
    if operation='models.transform' then
        if role<>'admin' then raise insufficient_privilege; end if;
        if jsonb_typeof(payload->'translation') is distinct from 'array' or jsonb_array_length(payload->'translation')<>3
            or exists(select 1 from jsonb_array_elements(payload->'translation') a where jsonb_typeof(a)<>'number' or abs((a#>>'{}')::numeric)>100000000)
            or jsonb_typeof(payload->'rotationZDegrees') is distinct from 'number' or abs((payload->>'rotationZDegrees')::numeric)>3600 then
            raise exception 'Thông số định vị không hợp lệ';
        end if;
        update cde_private.models m set metadata=jsonb_set(m.metadata,'{transform}',jsonb_build_object('translation',payload->'translation',
            'rotationZDegrees',payload->'rotationZDegrees','revision',(payload->>'expectedRevision')::int+1))
            where m.project_id=cde_api.project_id and m.id=payload->>'modelId'
            and (m.metadata->'transform'->>'revision')::int=(payload->>'expectedRevision')::int returning metadata into result;
        if not found then raise exception 'Mô hình đã thay đổi. Hãy tải lại'; end if;
        return result;
    end if;
    raise exception 'UNSUPPORTED_OPERATION %',operation;
end $$;
revoke all on function public.cde_api(text,jsonb,text) from public,anon;
grant execute on function public.cde_api(text,jsonb,text) to authenticated;

-- This RPC is called only by the account Edge Function with the service role.
create function public.cde_manage_account(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare invite cde_private.invitations%rowtype; org text; admin boolean:=false; subject uuid; target text;
begin
    if action in ('bootstrap.prepare','bootstrap.commit') then
        perform pg_advisory_xact_lock(hashtextextended('cde-bootstrap',0));
        if exists(select 1 from cde_private.profiles where site_admin) or not exists (
            select 1 from cde_private.settings s where s.name='bootstrap_digest' and s.value=encode(extensions.digest(payload->>'token','sha256'),'hex')) then
            raise insufficient_privilege;
        end if;
        org:='CIC'; admin:=true;
    elsif action in ('join.prepare','join.commit') then
        select i.project_id into target from cde_private.invitations i where i.digest=encode(extensions.digest(payload->>'token','sha256'),'hex');
        perform pg_advisory_xact_lock(hashtextextended(target,0));
        select * into invite from cde_private.invitations i where i.project_id=target and i.digest=encode(extensions.digest(payload->>'token','sha256'),'hex') and not i.used and i.expires>now() for update;
        if not found then raise insufficient_privilege; end if;
        org:=invite.organization;
    elsif action='create.commit' then
        if not exists(select 1 from cde_private.profiles p where p.id=(payload->>'actor')::uuid and p.site_admin) then raise insufficient_privilege; end if;
        org:=trim(payload->>'organization');
        admin:=payload->>'role'='admin';
    else raise insufficient_privilege; end if;
    if action like '%.prepare' then return jsonb_build_object('organization',org); end if;
    subject:=(payload->>'userId')::uuid;
    insert into cde_private.profiles(id,username,organization,site_admin) values(subject,lower(trim(payload->>'username')),org,coalesce(admin,false));
    if action='bootstrap.commit' then
        insert into cde_private.projects(id,name) values('demo-project','Riverside Tower');
        insert into cde_private.memberships(project_id,organization,role) values('demo-project',org,'admin');
        delete from cde_private.settings s where s.name='bootstrap_digest';
    elsif action='join.commit' then
        update cde_private.invitations set used=true where id=invite.id;
        insert into cde_private.memberships(project_id,organization,role) values(invite.project_id,org,invite.role)
            on conflict on constraint memberships_pkey do update set role=excluded.role,active=true,revision=cde_private.memberships.revision+1;
        insert into cde_private.audit(project_id,actor,operation) values(invite.project_id,subject,'invitation.join');
    end if;
    return jsonb_build_object('id',subject,'organization',org,'siteAdmin',admin);
end $$;
revoke all on function public.cde_manage_account(text,jsonb) from public,anon,authenticated;
grant execute on function public.cde_manage_account(text,jsonb) to service_role;
