-- Run only inside BEGIN/ROLLBACK after the P1 migration. No durable test data.
do $$
declare claims jsonb; actor jsonb; project text; job jsonb; first_job jsonb; d jsonb; request jsonb;
begin
 select jsonb_build_object('sub',p.id,'session_id',s.id,'role','authenticated') into claims
 from cde_private.profiles p join auth.sessions s on s.user_id=p.id where p.site_admin order by s.created_at desc limit 1;
 if claims is null then raise exception 'Authenticated test session required'; end if;
 perform set_config('request.jwt.claims',claims::text,true);
 actor := cde_private.profile();
 project := public.cde_api('projects.create','{"name":"P1 rollback-only fixture"}','demo-project')->>'id';
 insert into cde_private.models(project_id,id,metadata,elements,source_path,owners)
 values(project,'p1-model','{"id":"p1-model","hash":"test"}','[]','test',array[actor->>'organization']);
 d := public.cde_api('documents.registerOne','{"code":"P1-TEST","title":"Test","discipline":"STR","modelId":"p1-model"}',project);
 if d->>'code' is distinct from 'P1-TEST' then raise exception 'Compact registration failed'; end if;
 if (public.cde_api('documents.page','{"limit":1}',project)->>'total')::int<>1 then raise exception 'Page count failed'; end if;
 if public.cde_api('documents.page','{"query":"R01"}',project)->'items'->0->>'code' is distinct from 'P1-TEST' then raise exception 'Rxx search failed'; end if;
 if jsonb_array_length(public.cde_api('documents.page','{}',project)->'items'->0->'history')<>0 then raise exception 'List includes history'; end if;
 if jsonb_array_length(public.cde_api('documents.get',jsonb_build_object('id',d->'id'),project)->'history')<>1 then raise exception 'Detail history missing'; end if;
 request:=jsonb_build_object('kind','checks','modelIdsA',jsonb_build_array('p1-model'),'modelIdsB',jsonb_build_array('p1-model'),'requestId',gen_random_uuid());
 first_job:=public.cde_api('jobs.create',request,project);
 job:=public.cde_api('jobs.create',request,project);
 if job<>first_job then raise exception 'Idempotency failed'; end if;
 if (public.cde_api('jobs.list','{}',project)->>'total')::int<>1 then raise exception 'Duplicate job'; end if;
 update cde_private.jobs set phase='running',attempts=1,lease=gen_random_uuid(),updated_at=now()-interval '331 seconds' where id=(job->>'jobId')::uuid;
 if not (public.cde_api('jobs.get',job,project)->>'stale')::boolean then raise exception 'Stale detection failed'; end if;
 if public.cde_api('jobs.retry',job,project)->>'phase'<>'queued' then raise exception 'Stale retry failed'; end if;
 if (select lease is not null from cde_private.jobs where id=(job->>'jobId')::uuid) then raise exception 'Old lease still active'; end if;
 perform public.cde_api('jobs.cancel',job,project);
 begin perform public.cde_api('jobs.retry',job,project); raise exception 'Cancelled retry accepted'; exception when sqlstate 'PT409' then null; end;
end $$;
