-- Additional issue data is stored separately from the existing coordination log.
create table cde_private.issue_details (
    issue_id bigint primary key references cde_private.issues(id),
    assigned_user uuid,
    due_date date,
    viewpoint jsonb
);
create table cde_private.issue_attachments (
    issue_id bigint not null references cde_private.issues(id),
    object_id uuid primary key references storage.objects(id) on delete restrict,
    filename text not null check (length(filename) between 1 and 200),
    added_by text not null,
    added_at timestamptz not null default now()
);
create index issue_attachments_issue on cde_private.issue_attachments(issue_id,added_at);
create table cde_private.issue_assignment_notices (
    id uuid primary key default gen_random_uuid(),
    issue_id bigint not null references cde_private.issues(id),
    recipient uuid not null,
    actor text not null,
    created_at timestamptz not null default now(),
    read_at timestamptz
);
create index issue_assignment_notices_inbox on cde_private.issue_assignment_notices(recipient,created_at desc);
alter table cde_private.issue_details enable row level security;
alter table cde_private.issue_attachments enable row level security;
alter table cde_private.issue_assignment_notices enable row level security;
revoke all on cde_private.issue_details,cde_private.issue_attachments,cde_private.issue_assignment_notices from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cde-issue-evidence','cde-issue-evidence',false,20000000,array['application/octet-stream']);

create function cde_private.issue_evidence_access(object_id uuid,object_path text,writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
    select case when object_path ~ '^[^/]+/[1-9][0-9]{0,17}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|png|jpe?g|txt|docx|xlsx)$' then
      exists(select 1 from cde_private.issues i
        where i.project_id=split_part(object_path,'/',1)
          and i.id=split_part(object_path,'/',2)::bigint
          and cde_private.snapshots_visible(i.project_id,i.snapshots)
          and case when writing then
            cde_private.project_role(i.project_id) in ('admin','reviewer','member')
            and split_part(object_path,'/',3)=auth.uid()::text
          else
            cde_private.project_role(i.project_id) is not null
            and (split_part(object_path,'/',3)=auth.uid()::text or exists(
              select 1 from cde_private.issue_attachments a where a.issue_id=i.id and a.object_id=$1))
          end)
    else false end
$$;
revoke all on function cde_private.issue_evidence_access(uuid,text,boolean) from public,anon,authenticated;
grant execute on function cde_private.issue_evidence_access(uuid,text,boolean) to authenticated;
create policy cde_issue_evidence_read on storage.objects for select to authenticated
  using(bucket_id='cde-issue-evidence' and cde_private.issue_evidence_access(id,name,false));
create policy cde_issue_evidence_insert on storage.objects for insert to authenticated
  with check(bucket_id='cde-issue-evidence' and cde_private.issue_evidence_access(id,name,true));

create function cde_private.issue_details_api(operation text,payload jsonb,project text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
    actor jsonb := cde_private.profile();
    permission text;
    issue cde_private.issues%rowtype;
    detail cde_private.issue_details%rowtype;
    attachment storage.objects%rowtype;
    assignee_record cde_private.profiles%rowtype;
    issue_key bigint := nullif(payload->>'issueId','')::bigint;
    assignee_id uuid;
    previous_assignee uuid;
    due_date_value date;
    viewpoint_value jsonb := payload->'viewpoint';
    vector jsonb;
    reply jsonb;
    label text;
    text_value text := trim(coalesce(payload->>'body',''));
begin
    if actor is null then raise exception 'Phiên đăng nhập đã hết hạn' using errcode='28000'; end if;
    permission := cde_private.project_role(project);
    if permission is null then raise insufficient_privilege; end if;
    if operation='list' then
        return coalesce((select jsonb_agg(item.value || jsonb_build_object(
          'assignedUserId',p.id,'assignedUsername',p.username,'dueDate',d.due_date,'viewpoint',d.viewpoint,
          'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.object_id,'filename',a.filename,
            'path',o.name,'addedBy',a.added_by,'addedAt',a.added_at) order by a.added_at,a.object_id)
            from cde_private.issue_attachments a join storage.objects o on o.id=a.object_id where a.issue_id=d_issue.id),'[]')
          ) order by item.ordinality)
          from jsonb_array_elements(cde_private.cde_pilot_api('issues.list','{}',project)) with ordinality item(value,ordinality)
          join cde_private.issues d_issue on d_issue.id=(item.value->>'id')::bigint and d_issue.project_id=project
          left join cde_private.issue_details d on d.issue_id=d_issue.id
          left join cde_private.profiles p on p.id=d.assigned_user and p.organization=d_issue.assignee),'[]');
    end if;
    if operation='assignees' then
        if permission='viewer' then return '[]'; end if;
        return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'organization',p.organization)
          order by p.organization,p.username)
          from cde_private.profiles p join cde_private.memberships m on m.organization=p.organization
          where m.project_id=project and m.active and m.role in ('admin','reviewer','member')),'[]');
    end if;
    if operation='notices' then
        return coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id)
          from (select n.id,n.issue_id,n.actor,n.created_at,n.read_at,i.finding->>'title' title
            from cde_private.issue_assignment_notices n join cde_private.issues i on i.id=n.issue_id
            where i.project_id=project and n.recipient=auth.uid() and cde_private.snapshots_visible(project,i.snapshots)
            order by n.created_at desc,n.id limit 25) n),'[]');
    end if;
    if operation='notice.read' then
        update cde_private.issue_assignment_notices n set read_at=coalesce(n.read_at,now())
          from cde_private.issues i where i.id=n.issue_id and i.project_id=project
          and n.id=(payload->>'id')::uuid and n.recipient=auth.uid()
          and cde_private.snapshots_visible(project,i.snapshots);
        return jsonb_build_object('read',found);
    end if;

    if permission='viewer' then raise insufficient_privilege; end if;
    perform pg_advisory_xact_lock(hashtextextended(project,0));
    permission := cde_private.project_role(project);
    if permission is null or permission='viewer' then raise insufficient_privilege; end if;
    if operation='create' then
        perform cde_private.cde_pilot_api('issues.create',payload,project);
        return cde_private.issue_details_api('list','{}',project);
    end if;
    select * into issue from cde_private.issues i where i.project_id=project and i.id=issue_key;
    if not found or not cde_private.snapshots_visible(project,issue.snapshots) then raise insufficient_privilege; end if;

    if operation='comment' then
        if length(text_value) not between 1 and 2000 then raise exception 'Bình luận phải có từ 1 đến 2.000 ký tự'; end if;
        update cde_private.issues i set comments=i.comments||jsonb_build_array(jsonb_build_object(
          'id',jsonb_array_length(i.comments)+1,'body',text_value,'createdAt',now(),'author',actor->>'username','organization',actor->>'organization'))
          where i.id=issue.id;
    elsif operation='update' then
        select * into detail from cde_private.issue_details d where d.issue_id=issue.id;
        previous_assignee := detail.assigned_user;
        assignee_id := nullif(payload->>'assignedUserId','')::uuid;
        due_date_value := nullif(payload->>'dueDate','')::date;
        label := trim(coalesce(payload->>'assignee',''));
        if due_date_value is not null and (due_date_value < date '2000-01-01' or due_date_value > date '2100-12-31') then
            raise exception 'Hạn xử lý nằm ngoài phạm vi cho phép.';
        end if;
        if assignee_id is not null then
            select p.* into assignee_record from cde_private.profiles p join cde_private.memberships m on m.organization=p.organization
              where p.id=assignee_id and m.project_id=project and m.active and m.role in ('admin','reviewer','member');
            if not found then raise exception 'Người phụ trách cần có quyền cập nhật trong dự án.'; end if;
            label := assignee_record.organization;
        end if;
        if issue.revision is distinct from (payload->>'expectedRevision')::int then
            raise exception 'Vấn đề đã được cập nhật. Hãy tải lại.' using errcode='PT409';
        end if;
        perform cde_private.cde_pilot_api('issues.update',payload||jsonb_build_object('assignee',label),project);
        insert into cde_private.issue_details(issue_id,assigned_user,due_date) values(issue.id,assignee_id,due_date_value)
          on conflict(issue_id) do update set assigned_user=excluded.assigned_user,due_date=excluded.due_date;
        if assignee_id is not null and assignee_id is distinct from previous_assignee then
            insert into cde_private.issue_assignment_notices(issue_id,recipient,actor) values(issue.id,assignee_id,actor->>'username');
        end if;
    elsif operation='viewpoint' then
        if jsonb_typeof(viewpoint_value) is distinct from 'object' then raise exception 'Thiếu góc nhìn 3D.'; end if;
        for vector in select v from (values(viewpoint_value->'position'),(viewpoint_value->'target')) as coordinates(v) loop
            if jsonb_typeof(vector) is distinct from 'array' or jsonb_array_length(vector)<>3 then
                raise exception 'Tọa độ góc nhìn không hợp lệ.';
            end if;
            if exists(select 1 from jsonb_array_elements(vector) v where jsonb_typeof(v)<>'number' or abs((v#>>'{}')::numeric)>1000000000) then
                raise exception 'Tọa độ góc nhìn không hợp lệ.';
            end if;
        end loop;
        if viewpoint_value->'position'=viewpoint_value->'target' or jsonb_typeof(viewpoint_value->'fov') is distinct from 'number'
          or (viewpoint_value->>'fov')::numeric not between 1 and 170 then raise exception 'Thông số camera không hợp lệ.'; end if;
        if viewpoint_value ? 'aspectRatio' and (jsonb_typeof(viewpoint_value->'aspectRatio') is distinct from 'number'
          or (viewpoint_value->>'aspectRatio')::numeric not between 0.01 and 100) then
            raise exception 'Tỷ lệ khung nhìn không hợp lệ.';
        end if;
        if issue.revision is distinct from (payload->>'expectedRevision')::int then
            raise exception 'Vấn đề đã được cập nhật. Hãy tải lại.' using errcode='PT409';
        end if;
        update cde_private.issues i set revision=i.revision+1 where i.id=issue.id;
        insert into cde_private.issue_details(issue_id,viewpoint)
          values(issue.id,jsonb_strip_nulls(jsonb_build_object('position',viewpoint_value->'position','target',viewpoint_value->'target',
            'fov',viewpoint_value->'fov','aspectRatio',viewpoint_value->'aspectRatio')))
          on conflict(issue_id) do update set viewpoint=excluded.viewpoint;
    elsif operation='attach' then
        select * into attachment from storage.objects o where o.bucket_id='cde-issue-evidence'
          and o.name=payload->>'path' and starts_with(o.name,project||'/'||issue.id::text||'/')
          and o.owner_id=auth.uid()::text and cde_private.issue_evidence_access(o.id,o.name,true);
        if not found then raise insufficient_privilege; end if;
        if not exists(select 1 from cde_private.issue_attachments a where a.object_id=attachment.id)
          and (select count(*) from cde_private.issue_attachments a where a.issue_id=issue.id)>=25 then
            raise exception 'Mỗi vấn đề có tối đa 25 tệp đính kèm.';
        end if;
        label := trim(coalesce(payload->>'filename',''));
        if length(label) not between 1 and 200 or position('/' in label)>0 or position(chr(92) in label)>0 then
            raise exception 'Tên tệp đính kèm không hợp lệ.';
        end if;
        insert into cde_private.issue_attachments(issue_id,object_id,filename,added_by)
          values(issue.id,attachment.id,label,actor->>'username') on conflict(object_id) do nothing;
    else
        raise exception 'Thao tác vấn đề không hợp lệ.';
    end if;
    return cde_private.issue_details_api('list','{}',project);
end $$;
revoke all on function cde_private.issue_details_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function cde_private.issue_details_api(text,jsonb,text) to authenticated;
create function public.cde_issue_details(operation text,payload jsonb,project_id text)
returns jsonb language sql security invoker set search_path='' as $$
    select cde_private.issue_details_api(operation,payload,project_id)
$$;
revoke all on function public.cde_issue_details(text,jsonb,text) from public,anon;
grant execute on function public.cde_issue_details(text,jsonb,text) to authenticated;
notify pgrst,'reload schema';

alter table cde_private.issues
    alter column run_id drop not null,
    alter column finding drop not null,
    add column manual jsonb,
    add column manual_request_id uuid,
    add column manual_creator uuid,
    add constraint issue_source_check check (
      (run_id is not null and finding is not null and manual is null
        and manual_request_id is null and manual_creator is null)
      or (run_id is null and finding is null and manual is not null
        and manual_request_id is not null and manual_creator is not null and snapshots='[]'::jsonb));
create unique index issues_manual_request on cde_private.issues(project_id,manual_creator,manual_request_id)
    where manual_request_id is not null;

create or replace function cde_private.issue_evidence_access(object_id uuid,object_path text,writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
    select case when object_path ~ '^[^/]+/[1-9][0-9]{0,17}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|png|jpe?g|txt|docx|xlsx)$' then
      exists(select 1 from cde_private.issues i
        where i.project_id=split_part(object_path,'/',1)
          and i.id=split_part(object_path,'/',2)::bigint
          and (i.manual is not null or cde_private.snapshots_visible(i.project_id,i.snapshots))
          and case when writing then
            cde_private.project_role(i.project_id) in ('admin','reviewer','member')
            and split_part(object_path,'/',3)=auth.uid()::text
          else
            cde_private.project_role(i.project_id) is not null
            and (split_part(object_path,'/',3)=auth.uid()::text or exists(
              select 1 from cde_private.issue_attachments a where a.issue_id=i.id and a.object_id=$1))
          end)
    else false end
$$;

create or replace function cde_private.issue_details_api(operation text,payload jsonb,project text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
    request_id uuid;
    title_value text;
    description_value text;
    location_value text;
    priority_value text;
    state_value text;
    actor jsonb := cde_private.profile();
    permission text;
    issue cde_private.issues%rowtype;
    detail cde_private.issue_details%rowtype;
    attachment storage.objects%rowtype;
    assignee_record cde_private.profiles%rowtype;
    issue_key bigint := nullif(payload->>'issueId','')::bigint;
    assignee_id uuid;
    previous_assignee uuid;
    due_date_value date;
    viewpoint_value jsonb := payload->'viewpoint';
    vector jsonb;
    reply jsonb;
    label text;
    text_value text := trim(coalesce(payload->>'body',''));
begin
    if actor is null then raise exception 'Phiên đăng nhập đã hết hạn' using errcode='28000'; end if;
    permission := cde_private.project_role(project);
    if permission is null then raise insufficient_privilege; end if;
    if operation in ('list','get') then
        return coalesce((select jsonb_agg(jsonb_build_object(
          'id',i.id,'runId',i.run_id,'finding',i.finding,'manual',i.manual,'snapshots',i.snapshots,
          'state',i.state,'assignee',i.assignee,'revision',i.revision,'comments',i.comments,
          'assignedUserId',p.id,'assignedUsername',p.username,'dueDate',d.due_date,'viewpoint',d.viewpoint,
          'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.object_id,'filename',a.filename,
            'path',o.name,'addedBy',a.added_by,'addedAt',a.added_at) order by a.added_at,a.object_id)
            from cde_private.issue_attachments a join storage.objects o on o.id=a.object_id where a.issue_id=i.id),'[]')
          ) order by i.id desc)
          from cde_private.issues i
          left join cde_private.issue_details d on d.issue_id=i.id
          left join cde_private.profiles p on p.id=d.assigned_user and p.organization=i.assignee
          where i.project_id=project and (operation='list' or i.id=issue_key)
            and (i.manual is not null or cde_private.snapshots_visible(project,i.snapshots))),'[]');
    end if;
    if operation='assignees' then
        if permission='viewer' then return '[]'; end if;
        return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'organization',p.organization)
          order by p.organization,p.username)
          from cde_private.profiles p join cde_private.memberships m on m.organization=p.organization
          where m.project_id=project and m.active and m.role in ('admin','reviewer','member')
            and cde_private.project_role_for(project,p.id) in ('admin','reviewer','member')),'[]');
    end if;
    if operation='notices' then
        return coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id)
          from (select n.id,n.issue_id,n.actor,n.created_at,n.read_at,coalesce(i.manual->>'title',i.finding->>'title') title
            from cde_private.issue_assignment_notices n join cde_private.issues i on i.id=n.issue_id
            where i.project_id=project and n.recipient=auth.uid() and (i.manual is not null or cde_private.snapshots_visible(project,i.snapshots))
            order by n.created_at desc,n.id limit 25) n),'[]');
    end if;
    if operation='notice.read' then
        update cde_private.issue_assignment_notices n set read_at=coalesce(n.read_at,now())
          from cde_private.issues i where i.id=n.issue_id and i.project_id=project
          and n.id=(payload->>'id')::uuid and n.recipient=auth.uid()
          and (i.manual is not null or cde_private.snapshots_visible(project,i.snapshots));
        return jsonb_build_object('read',found);
    end if;

    if permission='viewer' then raise insufficient_privilege; end if;
    perform pg_advisory_xact_lock(hashtextextended(project,0));
    permission := cde_private.project_role(project);
    if permission is null or permission='viewer' then raise insufficient_privilege; end if;
    if operation='create' then
        perform cde_private.cde_pilot_api('issues.create',payload,project);
        return cde_private.issue_details_api('list','{}',project);
    end if;
    if operation in ('createManual','update') then
        assignee_id := nullif(payload->>'assignedUserId','')::uuid;
        due_date_value := nullif(payload->>'dueDate','')::date;
        label := trim(coalesce(payload->>'assignee',''));
        if due_date_value is not null and (due_date_value < date '2000-01-01' or due_date_value > date '2100-12-31') then
            raise exception 'Hạn xử lý nằm ngoài phạm vi cho phép.';
        end if;
        if assignee_id is not null then
            select p.* into assignee_record from cde_private.profiles p join cde_private.memberships m on m.organization=p.organization
              where p.id=assignee_id and m.project_id=project and m.active and m.role in ('admin','reviewer','member')
                and cde_private.project_role_for(project,p.id) in ('admin','reviewer','member');
            if not found then raise exception 'Người phụ trách cần có quyền cập nhật trong dự án.'; end if;
            label := assignee_record.organization;
        end if;
        if length(label)>120 then raise exception 'Đơn vị phụ trách tối đa 120 ký tự.'; end if;
    end if;
    if operation='createManual' then
        request_id := (payload->>'requestId')::uuid;
        if request_id is null then raise exception 'Thiếu mã yêu cầu.'; end if;
        select i.id into issue_key from cde_private.issues i
          where i.project_id=project and i.manual_creator=auth.uid() and i.manual_request_id=request_id;
        if found then return cde_private.issue_details_api('get',jsonb_build_object('issueId',issue_key),project)->0; end if;
        title_value := btrim(coalesce(payload->>'title',''), E' \t\r\n');
        description_value := btrim(coalesce(payload->>'description',''), E' \t\r\n');
        location_value := btrim(coalesce(payload->>'location',''), E' \t\r\n');
        priority_value := coalesce(payload->>'priority','');
        if length(title_value) not between 1 and 160 then raise exception 'Tiêu đề phải có từ 1 đến 160 ký tự.'; end if;
        if length(description_value) not between 1 and 4000 then raise exception 'Mô tả phải có từ 1 đến 4.000 ký tự.'; end if;
        if length(location_value)>160 then raise exception 'Vị trí tối đa 160 ký tự.'; end if;
        if priority_value not in ('low','medium','high','critical') then raise exception 'Mức ưu tiên không hợp lệ.'; end if;
        insert into cde_private.issues(project_id,snapshots,assignee,manual,manual_request_id,manual_creator)
          values(project,'[]',label,jsonb_build_object('title',title_value,'description',description_value,
            'location',location_value,'priority',priority_value,'author',actor->>'username','createdAt',now()),request_id,auth.uid())
          returning id into issue_key;
        insert into cde_private.issue_details(issue_id,assigned_user,due_date) values(issue_key,assignee_id,due_date_value);
        if assignee_id is not null then
            insert into cde_private.issue_assignment_notices(issue_id,recipient,actor) values(issue_key,assignee_id,actor->>'username');
        end if;
        insert into cde_private.audit(project_id,actor,operation,details)
          values(project,auth.uid(),'issues.createManual',jsonb_build_object('issueId',issue_key));
        return cde_private.issue_details_api('get',jsonb_build_object('issueId',issue_key),project)->0;
    end if;
    select * into issue from cde_private.issues i where i.project_id=project and i.id=issue_key;
    if not found or (issue.manual is null and not cde_private.snapshots_visible(project,issue.snapshots)) then raise insufficient_privilege; end if;

    if operation='comment' then
        if length(text_value) not between 1 and 2000 then raise exception 'Bình luận phải có từ 1 đến 2.000 ký tự'; end if;
        update cde_private.issues i set comments=i.comments||jsonb_build_array(jsonb_build_object(
          'id',jsonb_array_length(i.comments)+1,'body',text_value,'createdAt',now(),'author',actor->>'username','organization',actor->>'organization'))
          where i.id=issue.id;
    elsif operation='update' then
        select * into detail from cde_private.issue_details d where d.issue_id=issue.id;
        previous_assignee := detail.assigned_user;
        if issue.revision is distinct from (payload->>'expectedRevision')::int then
            raise exception 'Vấn đề đã được cập nhật. Hãy tải lại.' using errcode='PT409';
        end if;
        if issue.manual is null then
            perform cde_private.cde_pilot_api('issues.update',payload||jsonb_build_object('assignee',label),project);
        else
            state_value := payload->>'state';
            if state_value is null or (issue.state<>state_value and (issue.state,state_value) not in (
                ('Open','InProgress'),('InProgress','Review'),('Review','Closed'),('Review','InProgress'),('Closed','Open'))) then
                raise exception 'Chuyển trạng thái issue không hợp lệ.';
            end if;
            if issue.state<>state_value and state_value in ('Open','Closed') and permission not in ('admin','reviewer') then
                raise insufficient_privilege;
            end if;
            update cde_private.issues i set state=state_value,assignee=label,revision=i.revision+1 where i.id=issue.id;
            insert into cde_private.audit(project_id,actor,operation,details)
              values(project,auth.uid(),'issues.update',jsonb_build_object('issueId',issue.id));
        end if;
        insert into cde_private.issue_details(issue_id,assigned_user,due_date) values(issue.id,assignee_id,due_date_value)
          on conflict(issue_id) do update set assigned_user=excluded.assigned_user,due_date=excluded.due_date;
        if assignee_id is not null and assignee_id is distinct from previous_assignee then
            insert into cde_private.issue_assignment_notices(issue_id,recipient,actor) values(issue.id,assignee_id,actor->>'username');
        end if;
    elsif operation='viewpoint' then
        if jsonb_typeof(viewpoint_value) is distinct from 'object' then raise exception 'Thiếu góc nhìn 3D.'; end if;
        for vector in select v from (values(viewpoint_value->'position'),(viewpoint_value->'target')) as coordinates(v) loop
            if jsonb_typeof(vector) is distinct from 'array' or jsonb_array_length(vector)<>3 then
                raise exception 'Tọa độ góc nhìn không hợp lệ.';
            end if;
            if exists(select 1 from jsonb_array_elements(vector) v where jsonb_typeof(v)<>'number' or abs((v#>>'{}')::numeric)>1000000000) then
                raise exception 'Tọa độ góc nhìn không hợp lệ.';
            end if;
        end loop;
        if viewpoint_value->'position'=viewpoint_value->'target' or jsonb_typeof(viewpoint_value->'fov') is distinct from 'number'
          or (viewpoint_value->>'fov')::numeric not between 1 and 170 then raise exception 'Thông số camera không hợp lệ.'; end if;
        if viewpoint_value ? 'aspectRatio' and (jsonb_typeof(viewpoint_value->'aspectRatio') is distinct from 'number'
          or (viewpoint_value->>'aspectRatio')::numeric not between 0.01 and 100) then
            raise exception 'Tỷ lệ khung nhìn không hợp lệ.';
        end if;
        if issue.revision is distinct from (payload->>'expectedRevision')::int then
            raise exception 'Vấn đề đã được cập nhật. Hãy tải lại.' using errcode='PT409';
        end if;
        update cde_private.issues i set revision=i.revision+1 where i.id=issue.id;
        insert into cde_private.issue_details(issue_id,viewpoint)
          values(issue.id,jsonb_strip_nulls(jsonb_build_object('position',viewpoint_value->'position','target',viewpoint_value->'target',
            'fov',viewpoint_value->'fov','aspectRatio',viewpoint_value->'aspectRatio')))
          on conflict(issue_id) do update set viewpoint=excluded.viewpoint;
    elsif operation='attach' then
        select * into attachment from storage.objects o where o.bucket_id='cde-issue-evidence'
          and o.name=payload->>'path' and starts_with(o.name,project||'/'||issue.id::text||'/')
          and o.owner_id=auth.uid()::text and cde_private.issue_evidence_access(o.id,o.name,true);
        if not found then raise insufficient_privilege; end if;
        if not exists(select 1 from cde_private.issue_attachments a where a.object_id=attachment.id)
          and (select count(*) from cde_private.issue_attachments a where a.issue_id=issue.id)>=25 then
            raise exception 'Mỗi vấn đề có tối đa 25 tệp đính kèm.';
        end if;
        label := trim(coalesce(payload->>'filename',''));
        if length(label) not between 1 and 200 or position('/' in label)>0 or position(chr(92) in label)>0 then
            raise exception 'Tên tệp đính kèm không hợp lệ.';
        end if;
        insert into cde_private.issue_attachments(issue_id,object_id,filename,added_by)
          values(issue.id,attachment.id,label,actor->>'username') on conflict(object_id) do nothing;
    else
        raise exception 'Thao tác vấn đề không hợp lệ.';
    end if;
    return cde_private.issue_details_api('list','{}',project);
end $$;
