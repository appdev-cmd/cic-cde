-- Additive pilot hardening. Never rewrite document revisions or history.
set lock_timeout = '3s';
create index cad_locations_folder_fk on cde_private.cad_drawing_locations(project_id, folder_id);
create index cad_aliases_folder_fk on cde_private.cad_folder_aliases(project_id, folder_id);
create index jobs_profile_fk on cde_private.jobs(owner);
create index runs_profile_fk on cde_private.runs(owner);
create index documents_project_page on cde_private.documents(project_id, id desc);
alter table cde_private.jobs add column request_key uuid, add column request_hash text;
create unique index jobs_request_key on cde_private.jobs(project_id, owner, request_key) where request_key is not null;

create function cde_private.document_response(d cde_private.documents, detail boolean default true)
returns jsonb language sql immutable set search_path = '' as $$
select jsonb_build_object('id',d.id,'code',d.code,'revision',d.revision,'modelId',d.model_id,
 'title',d.title,'discipline',d.discipline,'state',d.state,'revisionCode',d.revision_code,
 'suitabilityCode',d.suitability_code,'bepVersion',d.bep_version,'bepReference',d.bep_rules->>'reference')
 || case when detail then jsonb_build_object('history',d.history,'suitabilityOptions',d.bep_rules->'statuses')
 else jsonb_build_object('history','[]'::jsonb) end;
$$;
revoke all on function cde_private.document_response(cde_private.documents,boolean) from public,anon,authenticated;

create function cde_private.job_response(j cde_private.jobs, detail boolean default false)
returns jsonb language sql stable set search_path = '' as $$
select jsonb_build_object('jobId',j.id,'kind',j.kind,'name',coalesce(j.input->>'name','Kiểm tra va chạm'),
 'phase',j.phase,'attempts',j.attempts,'updatedAt',j.updated_at,'error',j.error,
 'stale',j.phase='running' and j.updated_at <= now()-interval '330 seconds',
 'retryable',j.owner=auth.uid() and j.attempts<3 and (j.phase in ('failed','queued') or (j.phase='running' and j.updated_at <= now()-interval '330 seconds')),
 'cancellable',j.owner=auth.uid() and j.phase in ('queued','running'))
 || case when detail then jsonb_build_object('result',j.result) else '{}'::jsonb end;
$$;
revoke all on function cde_private.job_response(cde_private.jobs,boolean) from public,anon,authenticated;

create function cde_private.cde_pilot_api(operation text, payload jsonb, project_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 project text := project_id;
 actor jsonb;
 role text;
 org text;
 reply jsonb;
 entry cde_private.jobs%rowtype;
 doc cde_private.documents%rowtype;
 page_limit integer := least(100,greatest(1,coalesce((payload->>'limit')::integer,25)));
 page_offset integer := greatest(0,coalesce((payload->>'offset')::integer,0));
 request_id uuid;
 request_hash_value text;
begin
 -- Compact responses are transaction-local and only enabled around authenticated mutations.
 if operation='documents.list' and current_setting('cde.compact_document_response',true)='true' then return '[]'; end if;
 if operation not in ('documents.page','documents.get','documents.modelIds','documents.registerOne','documents.transitionOne',
                     'jobs.list','jobs.get','jobs.retry','jobs.create') then
   return cde_private.cde_bep_api(operation,payload,project);
 end if;
 actor := cde_private.profile();
 if actor is null then raise exception 'Phiên đăng nhập đã hết hạn' using errcode='28000'; end if;
 role := cde_private.project_role(project);
 if role is null then raise insufficient_privilege; end if;
 org := actor->>'organization';

 if operation='documents.modelIds' then
   return coalesce((select jsonb_agg(distinct d.model_id) from cde_private.documents d
     where d.project_id=project and (role='admin' or d.owner=org or d.state<>'WIP')),'[]');
 end if;
 if operation='documents.page' then
   select jsonb_build_object('items',coalesce(jsonb_agg(cde_private.document_response(d,false) order by d.id desc),'[]')) into reply
   from (select d.* from cde_private.documents d where d.project_id=project
     and (role='admin' or d.owner=org or d.state<>'WIP')
     and (coalesce(payload->>'state','')='' or d.state=payload->>'state')
     and (coalesce(payload->>'query','')='' or strpos(lower(concat_ws(' ',d.code,d.title,d.discipline,
       coalesce(d.revision_code,'R'||case when d.revision<10 then '0' else '' end||d.revision::text),d.suitability_code)),lower(left(payload->>'query',200)))>0)
     order by d.id desc limit page_limit offset page_offset) d;
   return reply || (select jsonb_build_object('total',count(*),'review',count(*) filter(where d.state='Review'),
     'published',count(*) filter(where d.state='Published'),'offset',page_offset,'limit',page_limit,
     'filteredTotal',count(*) filter(where (coalesce(payload->>'state','')='' or d.state=payload->>'state')
       and (coalesce(payload->>'query','')='' or strpos(lower(concat_ws(' ',d.code,d.title,d.discipline,
         coalesce(d.revision_code,'R'||case when d.revision<10 then '0' else '' end||d.revision::text),d.suitability_code)),lower(left(payload->>'query',200)))>0)))
     from cde_private.documents d where d.project_id=project and (role='admin' or d.owner=org or d.state<>'WIP'));
 end if;
 if operation in ('documents.registerOne','documents.transitionOne') then
   perform set_config('cde.compact_document_response','true',true);
   perform cde_private.cde_bep_api(case operation when 'documents.registerOne' then 'documents.register' else 'documents.transition' end,payload,project);
   perform set_config('cde.compact_document_response','false',true);
   if operation='documents.registerOne' then
     select * into doc from cde_private.documents d where d.project_id=project and d.code=upper(trim(payload->>'code')) and d.model_id=payload->>'modelId';
     payload := jsonb_build_object('id',doc.id);
   end if;
   operation := 'documents.get';
 end if;
 if operation='documents.get' then
   select * into doc from cde_private.documents d where d.project_id=project and d.id=(payload->>'id')::bigint
     and (role='admin' or d.owner=org or d.state<>'WIP');
   if not found then raise insufficient_privilege; end if;
   return cde_private.document_response(doc,true);
 end if;
 if operation='jobs.list' then
   -- A user's recovery inbox; administrators do not retry another user's jobs.
   return jsonb_build_object('items',coalesce((select jsonb_agg(cde_private.job_response(j) order by j.updated_at desc,j.id desc)
     from (select * from cde_private.jobs j where j.project_id=project and j.owner=auth.uid()
       order by j.updated_at desc,j.id desc limit page_limit offset page_offset) j),'[]'),
     'total',(select count(*) from cde_private.jobs j where j.project_id=project and j.owner=auth.uid()),'offset',page_offset,'limit',page_limit);
 end if;
 if operation='jobs.get' then
   select * into entry from cde_private.jobs j where j.project_id=project and j.id=(payload->>'jobId')::uuid and (j.owner=auth.uid() or role='admin');
   if not found then raise insufficient_privilege; end if;
   if entry.kind='checks' and entry.result is not null and not cde_private.snapshots_visible(project,entry.result->'snapshots') then raise insufficient_privilege; end if;
   if entry.kind='import' and entry.result is not null and not cde_private.model_visible(project,entry.result->'model'->>'id') then raise insufficient_privilege; end if;
   return cde_private.job_response(entry,true);
 end if;
 if role='viewer' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(project,0));
 if cde_private.project_role(project) is null or cde_private.project_role(project)='viewer' then raise insufficient_privilege; end if;
 if operation='jobs.retry' then
   select * into entry from cde_private.jobs j where j.project_id=project and j.id=(payload->>'jobId')::uuid and j.owner=auth.uid() for update;
   if not found then raise insufficient_privilege; end if;
   if entry.phase='completed' then return cde_private.job_response(entry); end if;
   if entry.phase='cancelled' then raise exception 'Tác vụ đã hủy không thể tiếp tục.' using errcode='PT409'; end if;
   if entry.attempts>=3 then raise exception 'Đã hết 3 lượt xử lý. Kiểm tra tệp hoặc phạm vi trước khi tạo tác vụ mới.' using errcode='PT409'; end if;
   if entry.phase='running' and entry.updated_at>now()-interval '330 seconds' then
     raise exception 'Worker vẫn đang giữ tác vụ. Hãy chờ cập nhật.' using errcode='PT409';
   end if;
   update cde_private.jobs j set phase='queued',lease=null,error=null,updated_at=now() where j.id=entry.id returning * into entry;
   insert into cde_private.audit(project_id,actor,operation,details) values(project,auth.uid(),'jobs.retry',jsonb_build_object('jobId',entry.id,'attempts',entry.attempts));
   return cde_private.job_response(entry);
 end if;
 if operation='jobs.create' then
   request_id := (payload->>'requestId')::uuid;
   request_hash_value := md5((payload-'requestId')::text);
   if request_id is not null then
     select * into entry from cde_private.jobs j where j.project_id=project and j.owner=auth.uid() and j.request_key=request_id;
     if found then
       if entry.request_hash is distinct from request_hash_value then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='PT409'; end if;
       return jsonb_build_object('jobId',entry.id);
     end if;
   end if;
   reply := cde_private.cde_bep_api(operation,payload-'requestId',project);
   if request_id is not null then update cde_private.jobs j set request_key=request_id,request_hash=request_hash_value where j.id=(reply->>'jobId')::uuid; end if;
   return reply;
 end if;
 raise exception 'Thao tác không hợp lệ';
end;
$$;
revoke all on function cde_private.cde_pilot_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function cde_private.cde_pilot_api(text,jsonb,text) to authenticated;
create or replace function public.cde_api(operation text, payload jsonb default '{}', project_id text default 'demo-project')
returns jsonb language sql security invoker set search_path = '' as $$
 select cde_private.cde_pilot_api(operation,payload,project_id);
$$;
revoke all on function public.cde_api(text,jsonb,text) from public,anon;
grant execute on function public.cde_api(text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
