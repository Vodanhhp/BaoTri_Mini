create or replace function private.create_maintenance_request_from_checklist(
 p_organization_id uuid,p_run_id uuid,p_due_date date default null
) returns jsonb language plpgsql security definer set search_path='' set row_security='off'
as $$
declare
 v_user uuid:=auth.uid();v_run public.checklist_runs;v_asset_id uuid;v_description text;
 v_request public.maintenance_requests;v_actor text;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'maintenance.create')
    or not private.has_org_permission(p_organization_id,'checklist.view') then
  raise exception 'Không có quyền tạo Phiếu yêu cầu từ Checklist.' using errcode='42501';
 end if;
 select * into v_run from public.checklist_runs where organization_id=p_organization_id and id=p_run_id for update;
 if not found then raise exception 'Không tìm thấy kết quả Checklist.' using errcode='P0002';end if;
 if v_run.outcome<>'Không đạt' then raise exception 'Chỉ Checklist có kết quả Không đạt mới tạo Phiếu yêu cầu.' using errcode='22023';end if;
 if v_run.maintenance_request_id is not null then
  select * into v_request from public.maintenance_requests where organization_id=p_organization_id and id=v_run.maintenance_request_id;
  if found then return to_jsonb(v_request);end if;
 end if;
 select * into v_request from public.maintenance_requests where organization_id=p_organization_id and checklist_run_id=v_run.id;
 if found then
  update public.checklist_runs set maintenance_request_id=v_request.id,repair_request_created=true,no_repair_reason=null
   where organization_id=p_organization_id and id=v_run.id;
  return to_jsonb(v_request);
 end if;
 select coalesce(nullif(t.definition_snapshot->>'target_asset_id','')::uuid,d.target_asset_id)
  into v_asset_id
  from public.checklist_definitions d
  left join public.checklist_tasks t on t.organization_id=v_run.organization_id and t.id=v_run.task_id
  where d.organization_id=p_organization_id and d.id=v_run.definition_id;
 if v_asset_id is null then raise exception 'Checklist này không gắn với thiết bị cụ thể, không thể tự tạo Phiếu yêu cầu thiết bị.' using errcode='22023';end if;
 if not exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.id=v_asset_id and a.deleted_at is null and a.archived_at is null) then
  raise exception 'Thiết bị của Checklist không còn hoạt động.' using errcode='23503';
 end if;
 select string_agg(coalesce(a->>'question','Tiêu chí không đạt')
   ||case when nullif(btrim(a->>'note'),'') is not null then ': '||btrim(a->>'note') else '' end,E'\n' order by ord)
  into v_description
  from jsonb_array_elements(v_run.answers) with ordinality x(a,ord)
  where a->>'result'='Không đạt';
 v_actor:=coalesce(nullif(btrim(v_run.inspector),''),'Admin');
 insert into public.maintenance_requests(organization_id,asset_id,checklist_run_id,request_date,due_date,kind,description,requested_by,requested_by_user_id,status)
 values(p_organization_id,v_asset_id,v_run.id,(now() at time zone 'Asia/Ho_Chi_Minh')::date,p_due_date,'Sửa chữa',
  left('Phát hiện từ Checklist: '||v_run.checklist_title||E'\n'||coalesce(v_description,'Có tiêu chí kiểm tra Không đạt.'),5000),
  v_actor,v_run.inspector_user_id,'Chưa hoàn thành') returning * into v_request;
 insert into public.maintenance_request_events(organization_id,request_id,event_type,summary,actor_user_id,actor_label,after_snapshot)
 values(p_organization_id,v_request.id,'created','Tạo Phiếu yêu cầu từ Checklist Không đạt',v_user,v_actor,to_jsonb(v_request));
 update public.checklist_runs set maintenance_request_id=v_request.id,repair_request_created=true,no_repair_reason=null
  where organization_id=p_organization_id and id=v_run.id;
 return to_jsonb(v_request);
end;$$;

create or replace function public.maintenance_create_request_from_checklist(p_organization_id uuid,p_run_id uuid,p_due_date date default null)
returns jsonb language sql set search_path='' as $$ select private.create_maintenance_request_from_checklist(p_organization_id,p_run_id,p_due_date); $$;
revoke all on function private.create_maintenance_request_from_checklist(uuid,uuid,date) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.create_maintenance_request_from_checklist(uuid,uuid,date) to authenticated;
revoke all on function public.maintenance_create_request_from_checklist(uuid,uuid,date) from public,anon;
grant execute on function public.maintenance_create_request_from_checklist(uuid,uuid,date) to authenticated;