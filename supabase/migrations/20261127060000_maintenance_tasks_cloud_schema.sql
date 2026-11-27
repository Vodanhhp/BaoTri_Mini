begin;

-- Canonical Cloud table for recurring maintenance schedules.
-- Keep the same shape and tenant constraints already used by the Test project.
create table if not exists public.maintenance_tasks (
  id uuid primary key,
  organization_id uuid not null,
  asset_id uuid not null,
  title text not null,
  due_date date,
  frequency text not null default '',
  status text not null default 'Chờ thực hiện',
  checklist text not null default '',
  readings text not null default '',
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_tasks_org_id_id_unique unique (organization_id, id),
  constraint maintenance_tasks_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) on delete restrict,
  constraint maintenance_tasks_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets(organization_id, id) on delete restrict,
  constraint maintenance_tasks_status_check
    check (status in ('Chờ thực hiện','Đang thực hiện','Hoàn thành','Quá hạn')),
  constraint maintenance_tasks_title_not_blank
    check (char_length(btrim(title)) > 0)
);

create index if not exists maintenance_tasks_org_asset_idx
  on public.maintenance_tasks(organization_id, asset_id);
create index if not exists maintenance_tasks_org_due_date_idx
  on public.maintenance_tasks(organization_id, due_date);
create index if not exists maintenance_tasks_org_status_idx
  on public.maintenance_tasks(organization_id, status);

alter table public.maintenance_tasks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_tasks' and policyname='maintenance_tasks_select_permission') then
    create policy maintenance_tasks_select_permission on public.maintenance_tasks
      for select to authenticated using (private.has_org_permission(organization_id,'maintenance.view'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_tasks' and policyname='maintenance_tasks_insert_permission') then
    create policy maintenance_tasks_insert_permission on public.maintenance_tasks
      for insert to authenticated with check (private.has_org_permission(organization_id,'maintenance.create'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_tasks' and policyname='maintenance_tasks_update_permission') then
    create policy maintenance_tasks_update_permission on public.maintenance_tasks
      for update to authenticated using (private.has_org_permission(organization_id,'maintenance.update'))
      with check (private.has_org_permission(organization_id,'maintenance.update'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_tasks' and policyname='maintenance_tasks_delete_permission') then
    create policy maintenance_tasks_delete_permission on public.maintenance_tasks
      for delete to authenticated using (private.has_org_permission(organization_id,'maintenance.delete'));
  end if;
end;
$$;

-- Immutable audit trail for recurring maintenance schedule changes.
create table if not exists public.maintenance_task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  task_id uuid not null,
  event_type text not null check (event_type in ('created','updated','status_changed','completed')),
  summary text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text not null,
  occurred_at timestamptz not null default now(),
  before_snapshot jsonb,
  after_snapshot jsonb,
  foreign key (organization_id, task_id)
    references public.maintenance_tasks(organization_id, id) on delete restrict
);

create index if not exists maintenance_task_events_org_task_idx
  on public.maintenance_task_events(organization_id, task_id, occurred_at desc);
create index if not exists maintenance_task_events_actor_idx
  on public.maintenance_task_events(actor_user_id) where actor_user_id is not null;

alter table public.maintenance_task_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_task_events' and policyname='maintenance_task_events_select_permission') then
    create policy maintenance_task_events_select_permission on public.maintenance_task_events
      for select to authenticated using (private.has_org_permission(organization_id,'maintenance.view'));
  end if;
end;
$$;

-- Reads are tenant-scoped by RLS. All writes must pass through audited RPCs.
revoke all on public.maintenance_tasks, public.maintenance_task_events from anon, authenticated;
grant select on public.maintenance_tasks, public.maintenance_task_events to authenticated;

create or replace function private.save_maintenance_task(
  p_organization_id uuid, p_task_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  v_user uuid:=auth.uid();
  v_row public.maintenance_tasks;
  v_before jsonb;
  v_asset uuid;
  v_title text;
  v_due date;
  v_status text;
begin
  if v_user is null then
    raise exception 'Chưa đăng nhập.' using errcode='42501';
  end if;
  v_asset:=nullif(p_payload->>'asset_id','')::uuid;
  v_title:=btrim(coalesce(p_payload->>'title',''));
  v_due:=nullif(p_payload->>'due_date','')::date;
  v_status:=coalesce(p_payload->>'status','Chờ thực hiện');
  if v_asset is null or v_title='' or v_due is null
     or v_status not in ('Chờ thực hiện','Đang thực hiện','Hoàn thành','Quá hạn') then
    raise exception 'Thông tin lịch bảo dưỡng chưa hợp lệ.' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.assets a
    where a.organization_id=p_organization_id and a.id=v_asset
      and a.deleted_at is null and a.archived_at is null
  ) then
    raise exception 'Thiết bị không tồn tại hoặc đã ngừng quản lý.' using errcode='23503';
  end if;

  if p_task_id is not null then
    select * into v_row from public.maintenance_tasks
    where organization_id=p_organization_id and id=p_task_id for update;
    if found then
      if not private.has_org_permission(p_organization_id,'maintenance.update') then
        raise exception 'Không có quyền cập nhật lịch bảo dưỡng.' using errcode='42501';
      end if;
      v_before:=to_jsonb(v_row);
      update public.maintenance_tasks
      set asset_id=v_asset, title=v_title, due_date=v_due,
          frequency=coalesce(p_payload->>'frequency','Một lần'),
          status=v_status, checklist=coalesce(p_payload->>'checklist',''),
          readings=coalesce(p_payload->>'readings',''), notes=coalesce(p_payload->>'notes',''),
          completed_at=case when v_status='Hoàn thành' then coalesce(completed_at,clock_timestamp()) else null end,
          updated_at=clock_timestamp()
      where organization_id=p_organization_id and id=p_task_id
      returning * into v_row;
    else
      if not private.has_org_permission(p_organization_id,'maintenance.create') then
        raise exception 'Không có quyền tạo lịch bảo dưỡng.' using errcode='42501';
      end if;
      insert into public.maintenance_tasks(
        id,organization_id,asset_id,title,due_date,frequency,status,checklist,readings,notes,completed_at
      ) values (
        p_task_id,p_organization_id,v_asset,v_title,v_due,
        coalesce(p_payload->>'frequency','Một lần'),v_status,
        coalesce(p_payload->>'checklist',''),coalesce(p_payload->>'readings',''),
        coalesce(p_payload->>'notes',''),
        case when v_status='Hoàn thành' then clock_timestamp() else null end
      ) returning * into v_row;
    end if;
  else
    if not private.has_org_permission(p_organization_id,'maintenance.create') then
      raise exception 'Không có quyền tạo lịch bảo dưỡng.' using errcode='42501';
    end if;
    insert into public.maintenance_tasks(
      id,organization_id,asset_id,title,due_date,frequency,status,checklist,readings,notes
    ) values (
      gen_random_uuid(),p_organization_id,v_asset,v_title,v_due,
      coalesce(p_payload->>'frequency','Một lần'),v_status,
      coalesce(p_payload->>'checklist',''),coalesce(p_payload->>'readings',''),
      coalesce(p_payload->>'notes','')
    ) returning * into v_row;
  end if;

  insert into public.maintenance_task_events(
    organization_id,task_id,event_type,summary,actor_user_id,actor_label,before_snapshot,after_snapshot
  ) values (
    p_organization_id,v_row.id,
    case when v_before is null then 'created' else 'updated' end,
    case when v_before is null then 'Tạo lịch bảo dưỡng định kỳ' else 'Cập nhật lịch bảo dưỡng định kỳ' end,
    v_user,coalesce((select display_name from public.profiles where id=v_user),'Admin'),
    v_before,to_jsonb(v_row)
  );
  return to_jsonb(v_row);
end;
$$;

create or replace function private.update_maintenance_task_status(
  p_organization_id uuid, p_task_id uuid, p_status text
)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  v_user uuid:=auth.uid();
  v_row public.maintenance_tasks;
  v_before jsonb;
begin
  if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.update') then
    raise exception 'Không có quyền cập nhật trạng thái lịch bảo dưỡng.' using errcode='42501';
  end if;
  if p_status not in ('Chờ thực hiện','Đang thực hiện','Hoàn thành','Quá hạn') then
    raise exception 'Trạng thái không hợp lệ.' using errcode='22023';
  end if;
  select * into v_row from public.maintenance_tasks
  where organization_id=p_organization_id and id=p_task_id for update;
  if not found then
    raise exception 'Không tìm thấy lịch bảo dưỡng.' using errcode='P0002';
  end if;
  v_before:=to_jsonb(v_row);
  update public.maintenance_tasks
  set status=p_status,
      completed_at=case when p_status='Hoàn thành' then coalesce(completed_at,clock_timestamp()) else null end,
      updated_at=clock_timestamp()
  where organization_id=p_organization_id and id=p_task_id
  returning * into v_row;
  insert into public.maintenance_task_events(
    organization_id,task_id,event_type,summary,actor_user_id,actor_label,before_snapshot,after_snapshot
  ) values (
    p_organization_id,p_task_id,
    case when p_status='Hoàn thành' then 'completed' else 'status_changed' end,
    'Cập nhật trạng thái công việc: '||p_status,
    v_user,coalesce((select display_name from public.profiles where id=v_user),'Admin'),
    v_before,to_jsonb(v_row)
  );
  return to_jsonb(v_row);
end;
$$;

create or replace function public.maintenance_save_task(
  p_organization_id uuid, p_task_id uuid, p_payload jsonb
)
returns jsonb
language sql
set search_path=''
as $$
  select private.save_maintenance_task(p_organization_id,p_task_id,p_payload);
$$;

create or replace function public.maintenance_update_task_status(
  p_organization_id uuid, p_task_id uuid, p_status text
)
returns jsonb
language sql
set search_path=''
as $$
  select private.update_maintenance_task_status(p_organization_id,p_task_id,p_status);
$$;

revoke all on function private.save_maintenance_task(uuid,uuid,jsonb) from public,anon;
revoke all on function private.update_maintenance_task_status(uuid,uuid,text) from public,anon;
revoke all on function public.maintenance_save_task(uuid,uuid,jsonb) from public,anon;
revoke all on function public.maintenance_update_task_status(uuid,uuid,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.save_maintenance_task(uuid,uuid,jsonb) to authenticated;
grant execute on function private.update_maintenance_task_status(uuid,uuid,text) to authenticated;
grant execute on function public.maintenance_save_task(uuid,uuid,jsonb) to authenticated;
grant execute on function public.maintenance_update_task_status(uuid,uuid,text) to authenticated;

comment on table public.maintenance_tasks is
  'Maintenance schedule records. Authenticated clients read directly; all writes must use tenant-checked RPCs so maintenance_task_events history cannot be bypassed.';

commit;
