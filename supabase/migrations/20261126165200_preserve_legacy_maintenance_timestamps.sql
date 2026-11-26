create or replace function private.save_maintenance_task(p_organization_id uuid,p_task_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_user uuid:=auth.uid();v_row public.maintenance_tasks;v_before jsonb;v_asset uuid;v_title text;v_due date;v_status text;
begin
 if v_user is null then raise exception 'Chưa đăng nhập.' using errcode='42501';end if;
 v_asset:=nullif(p_payload->>'asset_id','')::uuid;v_title:=btrim(coalesce(p_payload->>'title',''));
 v_due:=nullif(p_payload->>'due_date','')::date;v_status:=coalesce(p_payload->>'status','Chờ thực hiện');
 if v_asset is null or v_title='' or v_due is null or v_status not in('Chờ thực hiện','Đang thực hiện','Hoàn thành','Quá hạn') then
  raise exception 'Thông tin lịch bảo dưỡng chưa hợp lệ.' using errcode='22023';end if;
 if not exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.id=v_asset and a.deleted_at is null and a.archived_at is null) then
  raise exception 'Thiết bị không tồn tại hoặc đã ngừng quản lý.' using errcode='23503';end if;
 if p_task_id is not null then
  select * into v_row from public.maintenance_tasks where organization_id=p_organization_id and id=p_task_id for update;
  if found then
   if not private.has_org_permission(p_organization_id,'maintenance.update') then raise exception 'Không có quyền cập nhật lịch bảo dưỡng.' using errcode='42501';end if;
   v_before:=to_jsonb(v_row);
   update public.maintenance_tasks set asset_id=v_asset,title=v_title,due_date=v_due,frequency=coalesce(p_payload->>'frequency','Một lần'),
    status=v_status,checklist=coalesce(p_payload->>'checklist',''),readings=coalesce(p_payload->>'readings',''),
    notes=coalesce(p_payload->>'notes',''),completed_at=case when v_status='Hoàn thành' then coalesce(nullif(p_payload->>'completed_at','')::timestamptz,coalesce(completed_at,clock_timestamp())) else null end,
    updated_at=clock_timestamp()
    where organization_id=p_organization_id and id=p_task_id returning * into v_row;
  else
   if not private.has_org_permission(p_organization_id,'maintenance.create') then raise exception 'Không có quyền tạo lịch bảo dưỡng.' using errcode='42501';end if;
   insert into public.maintenance_tasks(id,organization_id,asset_id,title,due_date,frequency,status,checklist,readings,notes,completed_at)
    values(p_task_id,p_organization_id,v_asset,v_title,v_due,coalesce(p_payload->>'frequency','Một lần'),v_status,
     coalesce(p_payload->>'checklist',''),coalesce(p_payload->>'readings',''),coalesce(p_payload->>'notes',''),
     case when v_status='Hoàn thành' then coalesce(nullif(p_payload->>'completed_at','')::timestamptz,clock_timestamp()) else null end) returning * into v_row;
  end if;
 else
  if not private.has_org_permission(p_organization_id,'maintenance.create') then raise exception 'Không có quyền tạo lịch bảo dưỡng.' using errcode='42501';end if;
  insert into public.maintenance_tasks(id,organization_id,asset_id,title,due_date,frequency,status,checklist,readings,notes)
   values(gen_random_uuid(),p_organization_id,v_asset,v_title,v_due,coalesce(p_payload->>'frequency','Một lần'),v_status,
    coalesce(p_payload->>'checklist',''),coalesce(p_payload->>'readings',''),coalesce(p_payload->>'notes','')) returning * into v_row;
 end if;
 insert into public.maintenance_task_events(organization_id,task_id,event_type,summary,actor_user_id,actor_label,before_snapshot,after_snapshot)
 values(p_organization_id,v_row.id,case when v_before is null then 'created' else 'updated' end,
  case when v_before is null then 'Tạo lịch bảo dưỡng định kỳ' else 'Cập nhật lịch bảo dưỡng định kỳ' end,
  v_user,coalesce((select display_name from public.profiles where id=v_user),'Admin'),v_before,to_jsonb(v_row));
 return to_jsonb(v_row);
end;$$;
create or replace function private.import_maintenance_history(p_organization_id uuid,p_events jsonb)
returns integer language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_user uuid:=auth.uid();v_event jsonb;v_count integer:=0;v_inserted integer:=0;v_id uuid;v_record_id uuid;v_type text;v_kind text;v_summary text;v_actor text;v_at timestamptz;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.create')
    or not private.has_org_permission(p_organization_id,'maintenance.update') then
  raise exception 'Không có quyền nhập lịch sử bảo trì cũ.' using errcode='42501';end if;
 if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>5000 then raise exception 'Danh sách lịch sử nhập không hợp lệ hoặc vượt 5.000 dòng.' using errcode='22023';end if;
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
  get diagnostics v_inserted=row_count;
  v_count:=v_count+v_inserted;
 end loop;
 return v_count;
end;$$;

