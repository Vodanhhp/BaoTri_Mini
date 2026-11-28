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

  -- Pending future occurrences use the new definition; completed and in-progress snapshots remain immutable.
  delete from public.checklist_tasks
   where organization_id=p_organization_id and definition_id=v_row.id
     and status='Chờ thực hiện' and due_at>clock_timestamp();

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
$function$;