begin;
CREATE OR REPLACE FUNCTION private.claim_checklist_task(p_organization_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_user uuid:=auth.uid();v_task public.checklist_tasks;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'checklist.result.create') then raise exception 'Không có quyền thực hiện Checklist.' using errcode='42501';end if;
 select * into v_task from public.checklist_tasks where organization_id=p_organization_id and id=p_task_id for update;
 if not found then raise exception 'Không tìm thấy lượt Checklist.' using errcode='P0002';end if;
 if v_task.assignee='Admin' and not private.has_org_role(p_organization_id,'admin') then raise exception 'Giai đoạn này chỉ Admin được thực hiện Checklist.' using errcode='42501';end if;
 if v_task.status<>'Chờ thực hiện' then raise exception 'Lượt Checklist đã được nhận hoặc không còn khả dụng.' using errcode='40001';end if;
 if v_task.due_at>now() or now()-v_task.due_at>=interval '24 hours' then raise exception 'Lượt Checklist chưa đến hạn hoặc đã hết thời gian thực hiện.' using errcode='55000';end if;
 update public.checklist_tasks set status='Đang thực hiện',claimed_by_user_id=v_user,claimed_at=clock_timestamp(),updated_at=clock_timestamp() where organization_id=p_organization_id and id=p_task_id returning * into v_task;
 insert into public.checklist_task_events(organization_id,task_id,event_type,actor_user_id,actor_label) values(p_organization_id,p_task_id,'Nhận việc',v_user,coalesce((select display_name from public.profiles where id=v_user),'Admin'));
 return to_jsonb(v_task);
end;$function$


CREATE OR REPLACE FUNCTION private.complete_checklist_manual_run(p_organization_id uuid, p_definition_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_definition public.checklist_definitions;
  v_run_id uuid:=gen_random_uuid();
  v_answers jsonb:=p_payload->'answers';
  v_failed boolean;
  v_passed boolean;
  v_outcome text;
  v_inspector text;
begin
  if v_user is null or not private.has_org_permission(p_organization_id,'checklist.result.create')
     or not private.has_org_role(p_organization_id,'admin') then
    raise exception 'Giai đoạn này chỉ Admin được thực hiện Checklist.' using errcode='42501';
  end if;
  select * into v_definition from public.checklist_definitions
   where organization_id=p_organization_id and id=p_definition_id and enabled for share;
  if not found then raise exception 'Không tìm thấy mẫu Checklist đang hoạt động.' using errcode='P0002';end if;
  if jsonb_typeof(v_answers)<>'array'
     or jsonb_array_length(v_answers)<>jsonb_array_length(v_definition.questions)
     or exists(select 1 from jsonb_array_elements(v_answers) a where coalesce(a->>'result','') not in ('Đạt','Không đạt','Bỏ qua')) then
    raise exception 'Kết quả Checklist chưa đầy đủ hoặc không hợp lệ.' using errcode='22023';
  end if;
  select exists(select 1 from jsonb_array_elements(v_answers) a where a->>'result'='Không đạt'),
         exists(select 1 from jsonb_array_elements(v_answers) a where a->>'result'='Đạt')
    into v_failed,v_passed;
  v_outcome:=case when v_failed then 'Không đạt' when v_passed then 'Đạt' else 'Bỏ qua' end;
  v_inspector:=coalesce(nullif(btrim(p_payload->>'inspector'),''),(select display_name from public.profiles where id=v_user),'Admin');
  if v_failed and coalesce((p_payload->>'repair_request_created')::boolean,false)=false
     and nullif(btrim(p_payload->>'no_repair_reason'),'') is null then
    raise exception 'Cần ghi lý do chưa tạo Phiếu yêu cầu sửa chữa.' using errcode='22023';
  end if;
  insert into public.checklist_runs(
    organization_id,definition_id,task_id,checklist_title,category_label,target_label,frequency,
    answers,outcome,inspector,inspector_user_id,completed_at,repair_request_created,no_repair_reason,checklist_snapshot
  ) values (
    p_organization_id,v_definition.id,null,v_definition.title,v_definition.category_key,
    v_definition.target_label,v_definition.frequency,v_answers,v_outcome,v_inspector,v_user,
    clock_timestamp(),coalesce((p_payload->>'repair_request_created')::boolean,false),
    nullif(btrim(p_payload->>'no_repair_reason'),''),v_definition.questions
  ) returning id into v_run_id;
  update public.checklist_definitions set last_completed_at=clock_timestamp(),updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=v_definition.id;
  return jsonb_build_object('run_id',v_run_id,'outcome',v_outcome,'completed_at',clock_timestamp());
end;
$function$


CREATE OR REPLACE FUNCTION private.complete_checklist_task(p_organization_id uuid, p_task_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_user uuid:=auth.uid();v_task public.checklist_tasks;v_run_id uuid:=gen_random_uuid();v_answers jsonb;v_failed boolean;v_passed boolean;v_outcome text;v_inspector text;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'checklist.result.create') then raise exception 'Không có quyền hoàn thành Checklist.' using errcode='42501';end if;
 select * into v_task from public.checklist_tasks where organization_id=p_organization_id and id=p_task_id for update;
 if not found or v_task.status<>'Đang thực hiện' or v_task.claimed_by_user_id<>v_user then raise exception 'Bạn không còn quyền nhận lượt Checklist này.' using errcode='42501';end if;
 if v_task.assignee='Admin' and not private.has_org_role(p_organization_id,'admin') then raise exception 'Giai đoạn này chỉ Admin được thực hiện Checklist.' using errcode='42501';end if;
 if now()-v_task.due_at>=interval '24 hours' then raise exception 'Lượt Checklist đã quá thời gian thực hiện.' using errcode='55000';end if;
 v_answers:=p_payload->'answers';
 if jsonb_typeof(v_answers)<>'array' or jsonb_array_length(v_answers)<>jsonb_array_length(v_task.definition_snapshot->'questions') or exists(select 1 from jsonb_array_elements(v_answers) a where coalesce(a->>'result','') not in('Đạt','Không đạt','Bỏ qua')) then raise exception 'Kết quả Checklist chưa đầy đủ hoặc không hợp lệ.' using errcode='22023';end if;
 select exists(select 1 from jsonb_array_elements(v_answers) a where a->>'result'='Không đạt'),exists(select 1 from jsonb_array_elements(v_answers) a where a->>'result'='Đạt') into v_failed,v_passed;
 v_outcome:=case when v_failed then 'Không đạt' when v_passed then 'Đạt' else 'Bỏ qua' end;
 v_inspector:=coalesce(nullif(btrim(p_payload->>'inspector'),''),(select display_name from public.profiles where id=v_user),'Admin');
 if v_failed and coalesce((p_payload->>'repair_request_created')::boolean,false)=false and nullif(btrim(p_payload->>'no_repair_reason'),'') is null then raise exception 'Cần ghi lý do chưa tạo Phiếu yêu cầu sửa chữa.' using errcode='22023';end if;
 insert into public.checklist_runs(id,organization_id,definition_id,task_id,checklist_title,category_label,target_label,frequency,answers,outcome,inspector,inspector_user_id,completed_at,repair_request_created,no_repair_reason,checklist_snapshot)
 values(v_run_id,p_organization_id,v_task.definition_id,p_task_id,coalesce(p_payload->>'checklist_title',''),coalesce(p_payload->>'category_label',''),coalesce(p_payload->>'target_label',''),coalesce(p_payload->>'frequency',''),v_answers,v_outcome,v_inspector,v_user,clock_timestamp(),coalesce((p_payload->>'repair_request_created')::boolean,false),nullif(btrim(p_payload->>'no_repair_reason'),''),coalesce(p_payload->'checklist_snapshot','[]'::jsonb));
 update public.checklist_tasks set status='Hoàn thành',completed_at=clock_timestamp(),run_id=v_run_id,updated_at=clock_timestamp() where organization_id=p_organization_id and id=p_task_id;
 update public.checklist_definitions set last_completed_at=clock_timestamp(),updated_at=clock_timestamp() where organization_id=p_organization_id and id=v_task.definition_id;
 insert into public.checklist_task_events(organization_id,task_id,event_type,actor_user_id,actor_label) values(p_organization_id,p_task_id,'Hoàn thành',v_user,v_inspector);
 return jsonb_build_object('run_id',v_run_id,'outcome',v_outcome,'completed_at',clock_timestamp());
end;$function$


CREATE OR REPLACE FUNCTION private.ensure_checklist_occurrences(p_organization_id uuid, p_occurrences jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_user uuid:=auth.uid();v_item jsonb;v_definition public.checklist_definitions;v_due_at timestamptz;v_due_date date;v_count integer:=0;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'checklist.template.manage') then raise exception 'Chỉ Admin được tạo lịch công việc Checklist trong giai đoạn này.' using errcode='42501';end if;
 if jsonb_typeof(p_occurrences)<>'array' or jsonb_array_length(p_occurrences)>1500 then raise exception 'Danh sách lịch Checklist không hợp lệ.' using errcode='22023';end if;
 for v_item in select value from jsonb_array_elements(p_occurrences) loop
  select * into v_definition from public.checklist_definitions where organization_id=p_organization_id and id=(v_item->>'definition_id')::uuid for share;
  if not found or not v_definition.enabled or v_definition.frequency='Linh hoạt' then continue;end if;
  if v_definition.source='starter' and not exists(select 1 from public.checklist_category_settings s where s.organization_id=p_organization_id and s.category_key=v_definition.category_key and s.enabled) then continue;end if;
  v_due_at:=(v_item->>'due_at')::timestamptz;v_due_date:=(v_item->>'due_date')::date;
  if v_due_at is null or v_due_date is null or v_due_at<now()-interval '366 days' or v_due_at>now()+interval '367 days' then raise exception 'Thời điểm công việc Checklist nằm ngoài phạm vi cho phép.' using errcode='22023';end if;
  insert into public.checklist_tasks(organization_id,definition_id,due_at,due_date,assignee,definition_snapshot)
  values(p_organization_id,v_definition.id,v_due_at,v_due_date,v_definition.assignee,
   jsonb_build_object('categoryKey',v_definition.category_key,'questions',v_definition.questions,'version',v_definition.version,
    'title',v_definition.title,'targetLabel',v_definition.target_label,'frequency',v_definition.frequency,
    'executionTime',v_definition.execution_time,'assignee',v_definition.assignee,'source',v_definition.source))
  on conflict(organization_id,definition_id,due_date) do nothing;
  v_count:=v_count+1;
 end loop;
 update public.checklist_tasks t set status='Không Checklist',claimed_by_user_id=null,claimed_at=null,updated_at=clock_timestamp()
 where t.organization_id=p_organization_id and t.status in('Chờ thực hiện','Đang thực hiện') and t.due_at<=now()-interval '24 hours';
 return jsonb_build_object('occurrences_processed',v_count);
end;$function$


CREATE OR REPLACE FUNCTION private.release_checklist_task(p_organization_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_task public.checklist_tasks;
  v_status text;
begin
  if v_user is null or not private.has_org_permission(p_organization_id,'checklist.result.create') then
    raise exception 'Không có quyền trả lại công việc Checklist.' using errcode='42501';
  end if;
  select * into v_task from public.checklist_tasks
   where organization_id=p_organization_id and id=p_task_id for update;
  if not found or v_task.status<>'Đang thực hiện' or v_task.claimed_by_user_id<>v_user then
    raise exception 'Bạn không còn là người nhận công việc này.' using errcode='42501';
  end if;
  v_status:=case when now()-v_task.due_at>=interval '24 hours' then 'Không Checklist' else 'Chờ thực hiện' end;
  update public.checklist_tasks set status=v_status,claimed_by_user_id=null,claimed_at=null,updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=p_task_id returning * into v_task;
  insert into public.checklist_task_events(organization_id,task_id,event_type,actor_user_id,actor_label,metadata)
  values(p_organization_id,p_task_id,'Hủy thực hiện',v_user,coalesce((select display_name from public.profiles where id=v_user),'Admin'),
    jsonb_build_object('resulting_status',v_status));
  return to_jsonb(v_task);
end;
$function$


CREATE OR REPLACE FUNCTION private.save_checklist_definition(p_organization_id uuid, p_definition_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_row public.checklist_definitions;
  v_existing public.checklist_definitions;
  v_questions jsonb:=p_payload->'questions';
  v_snapshot jsonb;
begin
  if v_user is null or not private.has_org_permission(p_organization_id,'checklist.template.manage') then
    raise exception 'Không có quyền quản lý mẫu Checklist.' using errcode='42501';
  end if;
  if jsonb_typeof(v_questions)<>'array' or jsonb_array_length(v_questions)<1 then
    raise exception 'Mẫu Checklist phải có ít nhất một tiêu chí.' using errcode='22023';
  end if;
  if coalesce(p_payload->>'target_kind','') not in ('equipment','system') then
    raise exception 'Loại đối tượng Checklist không hợp lệ.' using errcode='22023';
  end if;
  if p_payload->>'target_kind'='system' and jsonb_array_length(v_questions)<5 then
    raise exception 'Mẫu Checklist theo hệ thống phải có tối thiểu 5 tiêu chí.' using errcode='23514';
  end if;
  if p_payload->>'target_kind'='equipment' then
    if nullif(p_payload->>'target_asset_id','') is null or not exists(
      select 1 from public.assets a
       where a.organization_id=p_organization_id and a.id=(p_payload->>'target_asset_id')::uuid
         and a.archived_at is null and a.deleted_at is null
    ) then
      raise exception 'Thiết bị không tồn tại hoặc không còn hoạt động trong tổ chức.' using errcode='23503';
    end if;
  end if;
  if nullif(btrim(p_payload->>'title'),'') is null
     or nullif(btrim(p_payload->>'target_label'),'') is null
     or coalesce(p_payload->>'frequency','') not in ('Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','Hàng năm','Linh hoạt')
     or coalesce(p_payload->>'category_key','') not in ('infrastructure','electrical','water','fire','equipment','custom') then
    raise exception 'Thông tin mẫu Checklist chưa hợp lệ.' using errcode='22023';
  end if;

  select * into v_existing from public.checklist_definitions
   where organization_id=p_organization_id and id=p_definition_id for update;

  if found then
    update public.checklist_definitions set
      title=btrim(p_payload->>'title'),
      target_kind=p_payload->>'target_kind',
      target_label=btrim(p_payload->>'target_label'),
      target_asset_id=case when nullif(p_payload->>'target_asset_id','') is null then null else (p_payload->>'target_asset_id')::uuid end,
      category_key=p_payload->>'category_key',
      frequency=p_payload->>'frequency',
      execution_time=coalesce(nullif(p_payload->>'execution_time',''),'09:00'),
      assignee=coalesce(nullif(btrim(p_payload->>'assignee'),''),'Admin'),
      enabled=coalesce((p_payload->>'enabled')::boolean,true),
      questions=v_questions,
      source=coalesce(nullif(p_payload->>'source',''),'custom'),
      version=version+1,
      schedule_started_at=coalesce(nullif(p_payload->>'schedule_started_at','')::timestamptz,schedule_started_at),
      updated_by=v_user,updated_at=clock_timestamp()
    where organization_id=p_organization_id and id=p_definition_id
    returning * into v_row;
  else
    insert into public.checklist_definitions(
      id,organization_id,title,target_kind,target_label,target_asset_id,category_key,frequency,
      execution_time,assignee,enabled,questions,source,version,schedule_started_at,created_by,updated_by
    ) values (
      p_definition_id,p_organization_id,btrim(p_payload->>'title'),p_payload->>'target_kind',
      btrim(p_payload->>'target_label'),
      case when nullif(p_payload->>'target_asset_id','') is null then null else (p_payload->>'target_asset_id')::uuid end,
      p_payload->>'category_key',p_payload->>'frequency',coalesce(nullif(p_payload->>'execution_time',''),'09:00'),
      coalesce(nullif(btrim(p_payload->>'assignee'),''),'Admin'),coalesce((p_payload->>'enabled')::boolean,true),
      v_questions,coalesce(nullif(p_payload->>'source',''),'custom'),1,
      coalesce(nullif(p_payload->>'schedule_started_at','')::timestamptz,clock_timestamp()),v_user,v_user
    ) returning * into v_row;
  end if;

  v_snapshot:=jsonb_build_object(
    'id',v_row.id,'title',v_row.title,'target_kind',v_row.target_kind,'target_label',v_row.target_label,
    'target_asset_id',v_row.target_asset_id,'category_key',v_row.category_key,'frequency',v_row.frequency,
    'execution_time',v_row.execution_time,'assignee',v_row.assignee,'enabled',v_row.enabled,
    'questions',v_row.questions,'source',v_row.source,'version',v_row.version,
    'schedule_started_at',v_row.schedule_started_at
  );
  insert into public.checklist_definition_versions(organization_id,definition_id,version,snapshot,changed_by)
  values(p_organization_id,v_row.id,v_row.version,v_snapshot,v_user)
  on conflict(organization_id,definition_id,version) do nothing;
  return to_jsonb(v_row);
end;
$function$
