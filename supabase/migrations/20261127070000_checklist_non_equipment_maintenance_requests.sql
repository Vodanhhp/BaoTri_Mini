begin;

-- Maintenance requests may originate from a Checklist that inspects a system or area,
-- not only an individual asset. Preserve asset_id for equipment-linked requests.
alter table public.maintenance_requests alter column asset_id drop not null;
alter table public.maintenance_requests
  add column if not exists target_kind text not null default 'equipment',
  add column if not exists target_label text not null default '',
  add column if not exists target_location text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='maintenance_requests_target_kind_check') then
    alter table public.maintenance_requests add constraint maintenance_requests_target_kind_check
      check (target_kind in ('equipment','system'));
  end if;
  if not exists (select 1 from pg_constraint where conname='maintenance_requests_target_identity_check') then
    alter table public.maintenance_requests add constraint maintenance_requests_target_identity_check
      check (
        (target_kind='equipment' and asset_id is not null)
        or (target_kind='system' and asset_id is null and char_length(btrim(target_label)) between 1 and 240)
      );
  end if;
end $$;

create or replace function private.save_maintenance_request(
 p_organization_id uuid,p_request_id uuid,p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path='' set row_security='off'
as $$
declare
 v_user uuid:=auth.uid(); v_row public.maintenance_requests; v_before jsonb;
 v_asset uuid; v_target_kind text; v_target_label text; v_target_location text;
 v_kind text; v_description text; v_requester text;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.view') then
  raise exception 'Không có quyền truy cập Phiếu yêu cầu.' using errcode='42501';
 end if;
 v_asset:=nullif(p_payload->>'asset_id','')::uuid;
 v_target_kind:=coalesce(nullif(p_payload->>'target_kind',''),case when v_asset is null then 'system' else 'equipment' end);
 v_target_label:=btrim(coalesce(p_payload->>'target_label',''));
 v_target_location:=btrim(coalesce(p_payload->>'target_location',''));
 v_kind:=coalesce(p_payload->>'kind','Sửa chữa');
 v_description:=btrim(coalesce(p_payload->>'description',''));
 v_requester:=btrim(coalesce(p_payload->>'requested_by',''));
 if v_target_kind not in ('equipment','system') or
    (v_target_kind='equipment' and v_asset is null) or
    (v_target_kind='system' and (v_asset is not null or v_target_label='')) or
    v_description='' or v_requester='' or v_kind not in('Bảo dưỡng','Sửa chữa') then
  raise exception 'Thiếu hoặc sai thông tin đối tượng, loại yêu cầu, nội dung hoặc người yêu cầu.' using errcode='22023';
 end if;
 if v_asset is not null and not exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.id=v_asset and a.deleted_at is null and a.archived_at is null) then
  raise exception 'Thiết bị không tồn tại hoặc đã ngừng quản lý.' using errcode='23503';
 end if;
 if p_request_id is not null then
  select * into v_row from public.maintenance_requests where organization_id=p_organization_id and id=p_request_id for update;
  if not found then raise exception 'Không tìm thấy Phiếu yêu cầu.' using errcode='P0002'; end if;
  if v_row.status='Hoàn thành' then raise exception 'Phiếu đã hoàn thành, không thể sửa nội dung.' using errcode='55000'; end if;
  if not private.has_org_permission(p_organization_id,'maintenance.update') then raise exception 'Không có quyền cập nhật Phiếu yêu cầu.' using errcode='42501'; end if;
  v_before:=to_jsonb(v_row);
  update public.maintenance_requests set asset_id=v_asset,target_kind=v_target_kind,target_label=v_target_label,target_location=v_target_location,
   request_date=coalesce(nullif(p_payload->>'request_date','')::date,request_date),
   due_date=nullif(p_payload->>'due_date','')::date,kind=v_kind,description=v_description,
   parts=coalesce(p_payload->>'parts',''),readings=coalesce(p_payload->>'readings',''),
   requested_by=v_requester,updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=p_request_id returning * into v_row;
 else
  if not private.has_org_permission(p_organization_id,'maintenance.create') then raise exception 'Không có quyền tạo Phiếu yêu cầu.' using errcode='42501'; end if;
  insert into public.maintenance_requests(id,organization_id,asset_id,target_kind,target_label,target_location,request_date,due_date,kind,description,parts,readings,requested_by,requested_by_user_id)
  values(coalesce(p_request_id,gen_random_uuid()),p_organization_id,v_asset,v_target_kind,v_target_label,v_target_location,
   coalesce(nullif(p_payload->>'request_date','')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date),
   nullif(p_payload->>'due_date','')::date,v_kind,v_description,coalesce(p_payload->>'parts',''),
   coalesce(p_payload->>'readings',''),v_requester,v_user) returning * into v_row;
 end if;
 insert into public.maintenance_request_events(organization_id,request_id,event_type,summary,actor_user_id,actor_label,before_snapshot,after_snapshot)
 values(p_organization_id,v_row.id,case when v_before is null then 'created' else 'updated' end,
  case when v_before is null then 'Tạo Phiếu yêu cầu' else 'Cập nhật Phiếu yêu cầu' end,v_user,v_requester,v_before,to_jsonb(v_row));
 return to_jsonb(v_row);
end;$$;

create or replace function private.create_maintenance_request_from_checklist(
 p_organization_id uuid,p_run_id uuid,p_due_date date default null
) returns jsonb language plpgsql security definer set search_path='' set row_security='off'
as $$
declare
 v_user uuid:=auth.uid(); v_run public.checklist_runs; v_asset_id uuid;
 v_target_kind text; v_target_label text; v_target_location text:='';
 v_description text; v_request public.maintenance_requests; v_actor text;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.create')
    or not private.has_org_permission(p_organization_id,'checklist.view') then
  raise exception 'Không có quyền tạo Phiếu yêu cầu từ Checklist.' using errcode='42501';
 end if;
 select * into v_run from public.checklist_runs where organization_id=p_organization_id and id=p_run_id for update;
 if not found then raise exception 'Không tìm thấy kết quả Checklist.' using errcode='P0002'; end if;
 if v_run.outcome<>'Không đạt' then raise exception 'Chỉ Checklist có kết quả Không đạt mới tạo Phiếu yêu cầu.' using errcode='22023'; end if;
 if v_run.maintenance_request_id is not null then
  select * into v_request from public.maintenance_requests where organization_id=p_organization_id and id=v_run.maintenance_request_id;
  if found then return to_jsonb(v_request); end if;
 end if;
 select coalesce(nullif(t.definition_snapshot->>'target_asset_id','')::uuid,d.target_asset_id),
        d.target_kind, d.target_label
  into v_asset_id,v_target_kind,v_target_label
  from public.checklist_definitions d
  left join public.checklist_tasks t on t.organization_id=v_run.organization_id and t.id=v_run.task_id
  where d.organization_id=p_organization_id and d.id=v_run.definition_id;
 if not found then raise exception 'Không tìm thấy mẫu Checklist gốc.' using errcode='P0002'; end if;
 if v_target_kind='equipment' then
  if v_asset_id is null or not exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.id=v_asset_id and a.deleted_at is null and a.archived_at is null) then
   raise exception 'Thiết bị của Checklist không còn hoạt động.' using errcode='23503';
  end if;
  v_target_label:=coalesce(nullif(v_run.target_label,''),v_target_label);
 elsif v_target_kind='system' then
  v_asset_id:=null;
  v_target_label:=coalesce(nullif(btrim(v_run.target_label),''),nullif(btrim(v_target_label),''),'Hệ thống chưa đặt tên');
 else
  raise exception 'Loại đối tượng Checklist không hợp lệ.' using errcode='22023';
 end if;
 select string_agg(coalesce(a->>'question','Tiêu chí không đạt')
   ||case when nullif(btrim(a->>'note'),'') is not null then ': '||btrim(a->>'note') else '' end,E'\n' order by ord)
  into v_description from jsonb_array_elements(v_run.answers) with ordinality x(a,ord)
  where a->>'result'='Không đạt';
 v_actor:=coalesce(nullif(btrim(v_run.inspector),''),'Admin');
 insert into public.maintenance_requests(
  organization_id,asset_id,target_kind,target_label,target_location,checklist_run_id,request_date,due_date,kind,description,requested_by,requested_by_user_id,status
 ) values (
  p_organization_id,v_asset_id,v_target_kind,v_target_label,v_target_location,v_run.id,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,p_due_date,'Sửa chữa',
  left('Phát hiện từ Checklist: '||v_run.checklist_title||E'\n'||coalesce(v_description,'Có tiêu chí kiểm tra Không đạt.'),5000),
  v_actor,v_run.inspector_user_id,'Chưa hoàn thành'
 ) returning * into v_request;
 insert into public.maintenance_request_events(organization_id,request_id,event_type,summary,actor_user_id,actor_label,after_snapshot)
 values(p_organization_id,v_request.id,'created','Tạo Phiếu yêu cầu từ Checklist Không đạt',v_user,v_actor,to_jsonb(v_request));
 update public.checklist_runs set maintenance_request_id=v_request.id,repair_request_created=true,no_repair_reason=null
  where organization_id=p_organization_id and id=v_run.id;
 return to_jsonb(v_request);
end;$$;

create or replace function public.maintenance_save_request(p_organization_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language sql set search_path='' as $$ select private.save_maintenance_request(p_organization_id,p_request_id,p_payload); $$;
create or replace function public.maintenance_create_request_from_checklist(p_organization_id uuid,p_run_id uuid,p_due_date date default null)
returns jsonb language sql set search_path='' as $$ select private.create_maintenance_request_from_checklist(p_organization_id,p_run_id,p_due_date); $$;

revoke all on function private.save_maintenance_request(uuid,uuid,jsonb) from public,anon;
revoke all on function private.create_maintenance_request_from_checklist(uuid,uuid,date) from public,anon;
revoke all on function public.maintenance_save_request(uuid,uuid,jsonb) from public,anon;
revoke all on function public.maintenance_create_request_from_checklist(uuid,uuid,date) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.save_maintenance_request(uuid,uuid,jsonb) to authenticated;
grant execute on function private.create_maintenance_request_from_checklist(uuid,uuid,date) to authenticated;
grant execute on function public.maintenance_save_request(uuid,uuid,jsonb) to authenticated;
grant execute on function public.maintenance_create_request_from_checklist(uuid,uuid,date) to authenticated;

commit;
