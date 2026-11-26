begin;

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  checklist_run_id uuid,
  request_date date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  due_date date,
  kind text not null check (kind in ('Bảo dưỡng','Sửa chữa')),
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  parts text not null default '',
  readings text not null default '',
  completion_readings text,
  condition_after_repair text,
  requested_by text not null check (char_length(btrim(requested_by)) between 1 and 160),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'Chưa hoàn thành' check (status in ('Chưa hoàn thành','Hoàn thành')),
  result text not null default '' check (result in ('','Đạt','Không đạt')),
  performed_by text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id,asset_id) references public.assets(organization_id,id) on delete restrict,
  foreign key (organization_id,checklist_run_id) references public.checklist_runs(organization_id,id) on delete restrict,
  check (due_date is null or due_date >= request_date),
  check (
    (status='Chưa hoàn thành' and completed_at is null)
    or (status='Hoàn thành' and completed_at is not null and performed_by<>'' and result<>'')
  )
);

create unique index if not exists maintenance_requests_checklist_run_unique
  on public.maintenance_requests(organization_id,checklist_run_id)
  where checklist_run_id is not null;
create index if not exists maintenance_requests_org_date_idx
  on public.maintenance_requests(organization_id,request_date desc);
create index if not exists maintenance_requests_org_status_due_idx
  on public.maintenance_requests(organization_id,status,due_date);

create table if not exists public.maintenance_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null,
  event_type text not null check (event_type in ('created','updated','completed')),
  summary text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text not null,
  occurred_at timestamptz not null default now(),
  before_snapshot jsonb,
  after_snapshot jsonb,
  foreign key (organization_id,request_id) references public.maintenance_requests(organization_id,id) on delete restrict
);
create index if not exists maintenance_request_events_org_request_idx
  on public.maintenance_request_events(organization_id,request_id,occurred_at desc);

alter table public.checklist_runs
  add column if not exists maintenance_request_id uuid;
alter table public.checklist_runs
  add constraint checklist_runs_maintenance_request_fk
  foreign key (organization_id,maintenance_request_id)
  references public.maintenance_requests(organization_id,id) on delete restrict;

alter table public.maintenance_requests enable row level security;
alter table public.maintenance_request_events enable row level security;
create policy maintenance_requests_select_permission on public.maintenance_requests
  for select to authenticated using (private.has_org_permission(organization_id,'maintenance.view'));
create policy maintenance_request_events_select_permission on public.maintenance_request_events
  for select to authenticated using (private.has_org_permission(organization_id,'maintenance.view'));

revoke all on public.maintenance_requests,public.maintenance_request_events from anon,authenticated;
grant select on public.maintenance_requests,public.maintenance_request_events to authenticated;

create or replace function private.create_maintenance_request_from_checklist(
  p_organization_id uuid,p_run_id uuid,p_due_date date default null
) returns jsonb
language plpgsql security definer set search_path='' set row_security='off'
as $$
declare
  v_user uuid:=auth.uid();
  v_run public.checklist_runs;
  v_asset_id uuid;
  v_description text;
  v_request public.maintenance_requests;
  v_actor text;
begin
  if v_user is null
     or not private.has_org_permission(p_organization_id,'maintenance.create')
     or not private.has_org_permission(p_organization_id,'checklist.view') then
    raise exception 'Không có quyền tạo Phiếu yêu cầu từ Checklist.' using errcode='42501';
  end if;
  select * into v_run from public.checklist_runs
   where organization_id=p_organization_id and id=p_run_id for update;
  if not found then raise exception 'Không tìm thấy kết quả Checklist.' using errcode='P0002'; end if;
  if v_run.outcome<>'Không đạt' then raise exception 'Chỉ Checklist có kết quả Không đạt mới tạo Phiếu yêu cầu.' using errcode='22023'; end if;

  if v_run.maintenance_request_id is not null then
    select * into v_request from public.maintenance_requests
     where organization_id=p_organization_id and id=v_run.maintenance_request_id;
    if found then return to_jsonb(v_request); end if;
  end if;

  select coalesce(
    nullif(t.definition_snapshot->>'target_asset_id','')::uuid,
    d.target_asset_id
  ) into v_asset_id
  from public.checklist_definitions d
  left join public.checklist_tasks t
    on t.organization_id=v_run.organization_id and t.id=v_run.task_id
  where d.organization_id=p_organization_id and d.id=v_run.definition_id;

  if v_asset_id is null then
    raise exception 'Checklist này không gắn với thiết bị cụ thể, không thể tự tạo Phiếu yêu cầu thiết bị.' using errcode='22023';
  end if;
  if not exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.id=v_asset_id and a.deleted_at is null and a.archived_at is null) then
    raise exception 'Thiết bị của Checklist không còn hoạt động.' using errcode='23503';
  end if;

  select string_agg(
    coalesce(a->>'question','Tiêu chí không đạt')
    || case when nullif(btrim(a->>'note'),'') is not null then ': '||btrim(a->>'note') else '' end,
    E'\n' order by ord
  ) into v_description
  from jsonb_array_elements(v_run.answers) with ordinality x(a,ord)
  where a->>'result'='Không đạt';

  v_actor:=coalesce(nullif(btrim(v_run.inspector),''),'Admin');
  insert into public.maintenance_requests(
    organization_id,asset_id,checklist_run_id,request_date,due_date,kind,description,
    requested_by,requested_by_user_id,status
  ) values (
    p_organization_id,v_asset_id,v_run.id,(now() at time zone 'Asia/Ho_Chi_Minh')::date,p_due_date,
    'Sửa chữa','Phát hiện từ Checklist: '||v_run.checklist_title||E'\n'||coalesce(v_description,'Có tiêu chí kiểm tra Không đạt.'),
    v_actor,v_run.inspector_user_id,'Chưa hoàn thành'
  ) returning * into v_request;

  insert into public.maintenance_request_events(
    organization_id,request_id,event_type,summary,actor_user_id,actor_label,after_snapshot
  ) values (
    p_organization_id,v_request.id,'created','Tạo Phiếu yêu cầu từ Checklist Không đạt',v_user,v_actor,to_jsonb(v_request)
  );

  update public.checklist_runs
    set maintenance_request_id=v_request.id,repair_request_created=true,no_repair_reason=null
    where organization_id=p_organization_id and id=v_run.id;
  return to_jsonb(v_request);
end;
$$;

create or replace function public.maintenance_create_request_from_checklist(
  p_organization_id uuid,p_run_id uuid,p_due_date date default null
) returns jsonb language sql set search_path=''
as $$ select private.create_maintenance_request_from_checklist(p_organization_id,p_run_id,p_due_date); $$;

revoke all on function private.create_maintenance_request_from_checklist(uuid,uuid,date) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.create_maintenance_request_from_checklist(uuid,uuid,date) to authenticated;
revoke all on function public.maintenance_create_request_from_checklist(uuid,uuid,date) from public,anon;
grant execute on function public.maintenance_create_request_from_checklist(uuid,uuid,date) to authenticated;

commit;