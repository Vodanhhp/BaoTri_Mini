alter table public.maintenance_request_events drop constraint if exists maintenance_request_events_event_type_check;
alter table public.maintenance_request_events add constraint maintenance_request_events_event_type_check
 check(event_type in('created','updated','status_changed','completed'));

create or replace function private.save_maintenance_request(p_organization_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_user uuid:=auth.uid();v_row public.maintenance_requests;v_before jsonb;v_asset uuid;v_kind text;v_description text;v_requester text;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.view') then
  raise exception 'Không có quyền truy cập Phiếu yêu cầu.' using errcode='42501';end if;
 v_asset:=nullif(p_payload->>'asset_id','')::uuid;v_kind:=coalesce(p_payload->>'kind','Sửa chữa');
 v_description:=btrim(coalesce(p_payload->>'description',''));v_requester:=btrim(coalesce(p_payload->>'requested_by',''));
 if v_asset is null or v_description='' or char_length(v_description)>5000 or v_requester='' or char_length(v_requester)>160 or v_kind not in('Bảo dưỡng','Sửa chữa') then
  raise exception 'Thiếu thiết bị, loại yêu cầu, nội dung hoặc người yêu cầu.' using errcode='22023';end if;
 if not exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.id=v_asset and a.deleted_at is null and a.archived_at is null) then
  raise exception 'Thiết bị không tồn tại hoặc đã ngừng quản lý.' using errcode='23503';end if;
 if p_request_id is not null then
  select * into v_row from public.maintenance_requests where organization_id=p_organization_id and id=p_request_id for update;
  if found then
   if v_row.status='Hoàn thành' then return to_jsonb(v_row);end if;
   if not private.has_org_permission(p_organization_id,'maintenance.update') then raise exception 'Không có quyền cập nhật Phiếu yêu cầu.' using errcode='42501';end if;
   v_before:=to_jsonb(v_row);
   update public.maintenance_requests set asset_id=v_asset,request_date=coalesce(nullif(p_payload->>'request_date','')::date,request_date),
    due_date=nullif(p_payload->>'due_date','')::date,kind=v_kind,description=v_description,parts=coalesce(p_payload->>'parts',''),
    readings=coalesce(p_payload->>'readings',''),requested_by=v_requester,updated_at=clock_timestamp()
    where organization_id=p_organization_id and id=p_request_id returning * into v_row;
  else
   if not private.has_org_permission(p_organization_id,'maintenance.create') then raise exception 'Không có quyền tạo Phiếu yêu cầu.' using errcode='42501';end if;
   insert into public.maintenance_requests(id,organization_id,asset_id,request_date,due_date,kind,description,parts,readings,requested_by,requested_by_user_id)
    values(p_request_id,p_organization_id,v_asset,coalesce(nullif(p_payload->>'request_date','')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date),
     nullif(p_payload->>'due_date','')::date,v_kind,v_description,coalesce(p_payload->>'parts',''),coalesce(p_payload->>'readings',''),v_requester,v_user)
    returning * into v_row;
  end if;
 else
  if not private.has_org_permission(p_organization_id,'maintenance.create') then raise exception 'Không có quyền tạo Phiếu yêu cầu.' using errcode='42501';end if;
  insert into public.maintenance_requests(organization_id,asset_id,request_date,due_date,kind,description,parts,readings,requested_by,requested_by_user_id)
   values(p_organization_id,v_asset,coalesce(nullif(p_payload->>'request_date','')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date),
    nullif(p_payload->>'due_date','')::date,v_kind,v_description,coalesce(p_payload->>'parts',''),coalesce(p_payload->>'readings',''),v_requester,v_user)
   returning * into v_row;
 end if;
 insert into public.maintenance_request_events(organization_id,request_id,event_type,summary,actor_user_id,actor_label,before_snapshot,after_snapshot)
 values(p_organization_id,v_row.id,case when v_before is null then 'created' else 'updated' end,
  case when v_before is null then 'Tạo Phiếu yêu cầu' else 'Cập nhật Phiếu yêu cầu' end,v_user,v_requester,v_before,to_jsonb(v_row));
 return to_jsonb(v_row);
end;$$;

create or replace function private.complete_maintenance_request(p_organization_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_user uuid:=auth.uid();v_row public.maintenance_requests;v_before jsonb;v_performer text;v_readings text;v_condition text;v_result text;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.update') then raise exception 'Không có quyền hoàn thành Phiếu yêu cầu.' using errcode='42501';end if;
 select * into v_row from public.maintenance_requests where organization_id=p_organization_id and id=p_request_id for update;
 if not found then raise exception 'Không tìm thấy Phiếu yêu cầu.' using errcode='P0002';end if;
 if v_row.status='Hoàn thành' then return to_jsonb(v_row);end if;
 v_performer:=btrim(coalesce(p_payload->>'performed_by',''));v_readings:=btrim(coalesce(p_payload->>'completion_readings',''));
 v_condition:=btrim(coalesce(p_payload->>'condition_after_repair',''));v_result:=coalesce(p_payload->>'result','');
 if v_performer='' or v_readings='' or v_condition='' or v_result not in('Đạt','Không đạt') then
  raise exception 'Cần nhập người thực hiện, thông số, tình trạng sau xử lý và kết quả.' using errcode='22023';end if;
 v_before:=to_jsonb(v_row);
 update public.maintenance_requests set status='Hoàn thành',performed_by=v_performer,completion_readings=v_readings,
  condition_after_repair=v_condition,result=v_result,completed_at=coalesce(nullif(p_payload->>'completed_at','')::timestamptz,clock_timestamp()),
  updated_at=clock_timestamp() where organization_id=p_organization_id and id=p_request_id returning * into v_row;
 insert into public.maintenance_request_events(organization_id,request_id,event_type,summary,actor_user_id,actor_label,before_snapshot,after_snapshot)
 values(p_organization_id,v_row.id,'completed','Hoàn thành Phiếu yêu cầu – đã ghi nhận kết quả xử lý',v_user,v_performer,v_before,to_jsonb(v_row));
 return to_jsonb(v_row);
end;$$;

create or replace function private.import_maintenance_history(p_organization_id uuid,p_events jsonb)
returns integer language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_user uuid:=auth.uid();v_event jsonb;v_count integer:=0;v_id uuid;v_record_id uuid;v_type text;v_kind text;v_summary text;v_actor text;v_at timestamptz;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.create')
    or not private.has_org_permission(p_organization_id,'maintenance.update') then
  raise exception 'Không có quyền nhập lịch sử bảo trì cũ.' using errcode='42501';end if;
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>5000 then raise exception 'Danh sách lịch sử nhập không hợp lệ hoặc vượt 5.000 dòng.' using errcode='22023';end if;
 for v_event in select value from jsonb_array_elements(p_events) loop
  v_id:=nullif(v_event->>'id','')::uuid;v_record_id:=nullif(v_event->>'record_id','')::uuid;
  v_type:=coalesce(v_event->>'record_type','');v_kind:=coalesce(v_event->>'event_type','');
  v_summary:=btrim(coalesce(v_event->>'summary',''));v_actor:=btrim(coalesce(v_event->>'actor_label',''));
  v_at:=coalesce(nullif(v_event->>'occurred_at','')::timestamptz,clock_timestamp());
  if v_id is null or v_record_id is null or v_summary='' or v_actor='' or v_kind not in('created','updated','status_changed','completed') then
   raise exception 'Một dòng lịch sử cũ thiếu mã, nội dung, người thực hiện hoặc loại sự kiện.' using errcode='22023';end if;
  if v_type='request' then
   if not exists(select 1 from public.maintenance_requests where organization_id=p_organization_id and id=v_record_id) then
    raise exception 'Không tìm thấy Phiếu yêu cầu tương ứng khi nhập lịch sử.' using errcode='P0002';end if;
   insert into public.maintenance_request_events(id,organization_id,request_id,event_type,summary,actor_user_id,actor_label,occurred_at,before_snapshot,after_snapshot)
   values(v_id,p_organization_id,v_record_id,v_kind,v_summary,null,v_actor,v_at,
    case when nullif(v_event->>'before_snapshot','') is null then null else (v_event->>'before_snapshot')::jsonb end,
    case when nullif(v_event->>'after_snapshot','') is null then null else (v_event->>'after_snapshot')::jsonb end)
   on conflict(id) do nothing;
  elsif v_type='task' then
   if not exists(select 1 from public.maintenance_tasks where organization_id=p_organization_id and id=v_record_id) then
    raise exception 'Không tìm thấy lịch bảo dưỡng tương ứng khi nhập lịch sử.' using errcode='P0002';end if;
   insert into public.maintenance_task_events(id,organization_id,task_id,event_type,summary,actor_user_id,actor_label,occurred_at,before_snapshot,after_snapshot)
   values(v_id,p_organization_id,v_record_id,v_kind,v_summary,null,v_actor,v_at,
    case when nullif(v_event->>'before_snapshot','') is null then null else (v_event->>'before_snapshot')::jsonb end,
    case when nullif(v_event->>'after_snapshot','') is null then null else (v_event->>'after_snapshot')::jsonb end)
   on conflict(id) do nothing;
  else raise exception 'Loại bản ghi lịch sử không hợp lệ.' using errcode='22023';end if;
  get diagnostics v_count=row_count;
 end loop;
 return v_count;
end;$$;

create or replace function public.maintenance_import_legacy_history(p_organization_id uuid,p_events jsonb)
returns integer language sql set search_path='' as $$ select private.import_maintenance_history(p_organization_id,p_events); $$;

create or replace function public.maintenance_save_request(p_organization_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language sql set search_path='' as $$ select private.save_maintenance_request(p_organization_id,p_request_id,p_payload); $$;
create or replace function public.maintenance_complete_request(p_organization_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language sql set search_path='' as $$ select private.complete_maintenance_request(p_organization_id,p_request_id,p_payload); $$;

revoke all on function private.save_maintenance_request(uuid,uuid,jsonb) from public,anon;
revoke all on function private.complete_maintenance_request(uuid,uuid,jsonb) from public,anon;
revoke all on function private.import_maintenance_history(uuid,jsonb) from public,anon;
revoke all on function public.maintenance_save_request(uuid,uuid,jsonb) from public,anon;
revoke all on function public.maintenance_complete_request(uuid,uuid,jsonb) from public,anon;
revoke all on function public.maintenance_import_legacy_history(uuid,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.save_maintenance_request(uuid,uuid,jsonb) to authenticated;
grant execute on function private.complete_maintenance_request(uuid,uuid,jsonb) to authenticated;
grant execute on function private.import_maintenance_history(uuid,jsonb) to authenticated;
grant execute on function public.maintenance_save_request(uuid,uuid,jsonb) to authenticated;
grant execute on function public.maintenance_complete_request(uuid,uuid,jsonb) to authenticated;
grant execute on function public.maintenance_import_legacy_history(uuid,jsonb) to authenticated;