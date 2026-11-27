begin;

alter table public.checklist_tasks
  drop constraint if exists checklist_tasks_organization_id_definition_id_due_date_key;

create unique index if not exists checklist_tasks_active_definition_due_date_uidx
  on public.checklist_tasks(organization_id,definition_id,due_date)
  where cancelled_at is null;

create or replace function private.ensure_checklist_occurrences(p_organization_id uuid,p_occurrences jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
set row_security to 'off'
as $function$
declare
  v_user uuid:=auth.uid();
  v_item jsonb;
  v_definition public.checklist_definitions;
  v_due_at timestamptz;
  v_due_date date;
  v_count integer:=0;
begin
  if v_user is null or not private.has_org_permission(p_organization_id,'checklist.template.manage') then
    raise exception 'Chỉ Admin được tạo lịch công việc Checklist trong giai đoạn này.' using errcode='42501';
  end if;
  if jsonb_typeof(p_occurrences)<>'array' or jsonb_array_length(p_occurrences)>1500 then
    raise exception 'Danh sách lịch Checklist không hợp lệ.' using errcode='22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_occurrences) loop
    select * into v_definition from public.checklist_definitions
    where organization_id=p_organization_id and id=(v_item->>'definition_id')::uuid for share;

    if not found or not v_definition.enabled or v_definition.frequency='Linh hoạt' then
      continue;
    end if;
    if v_definition.source='starter' and not exists(
      select 1 from public.checklist_category_settings s
      where s.organization_id=p_organization_id
        and s.category_key=v_definition.category_key and s.enabled
    ) then
      continue;
    end if;

    v_due_at:=(v_item->>'due_at')::timestamptz;
    v_due_date:=(v_item->>'due_date')::date;
    if v_due_at is null or v_due_date is null
       or v_due_at<now()-interval '366 days'
       or v_due_at>now()+interval '367 days' then
      raise exception 'Thời điểm công việc Checklist nằm ngoài phạm vi cho phép.' using errcode='22023';
    end if;

    insert into public.checklist_tasks(
      organization_id,definition_id,due_at,due_date,assignee,definition_snapshot
    ) values(
      p_organization_id,v_definition.id,v_due_at,v_due_date,v_definition.assignee,
      jsonb_build_object(
        'categoryKey',v_definition.category_key,
        'targetKind',v_definition.target_kind,
        'targetAssetId',v_definition.target_asset_id,
        'questions',v_definition.questions,
        'version',v_definition.version,
        'title',v_definition.title,
        'targetLabel',v_definition.target_label,
        'frequency',v_definition.frequency,
        'executionTime',v_definition.execution_time,
        'assignee',v_definition.assignee,
        'source',v_definition.source
      )
    )
    on conflict(organization_id,definition_id,due_date) where cancelled_at is null do nothing;
    v_count:=v_count+1;
  end loop;

  -- Preserve cancelled/archived rows as history; remove only active pending occurrences.
  delete from public.checklist_tasks t
  using public.checklist_definitions d
  where t.organization_id=p_organization_id
    and d.organization_id=t.organization_id
    and d.id=t.definition_id
    and t.status='Chờ thực hiện'
    and t.due_at>now()
    and t.cancelled_at is null
    and (
      not d.enabled
      or (d.source='starter' and not exists(
        select 1 from public.checklist_category_settings s
        where s.organization_id=p_organization_id
          and s.category_key=d.category_key and s.enabled
      ))
    );

  update public.checklist_tasks t
  set status='Không Checklist',claimed_by_user_id=null,claimed_at=null,updated_at=clock_timestamp()
  where t.organization_id=p_organization_id
    and t.status in('Chờ thực hiện','Đang thực hiện')
    and t.cancelled_at is null
    and t.due_at<=now()-interval '24 hours';

  return jsonb_build_object('occurrences_processed',v_count);
end;
$function$;

create or replace function private.save_checklist_definition(p_organization_id uuid,p_definition_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
set row_security to 'off'
as $function$
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
  if exists(
    select 1 from jsonb_array_elements(v_questions) q
    where jsonb_typeof(q)<>'object'
       or nullif(btrim(q->>'id'),'') is null
       or nullif(btrim(q->>'label'),'') is null
       or char_length(q->>'id')>128
       or char_length(q->>'label')>1000
       or ((q ? 'required') and jsonb_typeof(q->'required')<>'boolean')
  ) then
    raise exception 'Mỗi tiêu chí phải có mã, nội dung và trạng thái bắt buộc hợp lệ.' using errcode='22023';
  end if;
  if (select count(distinct q->>'id') from jsonb_array_elements(v_questions) q)<>jsonb_array_length(v_questions) then
    raise exception 'Mã tiêu chí trong một mẫu Checklist không được trùng nhau.' using errcode='22023';
  end if;
  if coalesce(nullif(btrim(p_payload->>'assignee'),''),'Admin')<>'Admin' then
    raise exception 'Giai đoạn 1 chỉ cho phép Admin phụ trách Checklist; phân công KTV sẽ có ở giai đoạn 2.' using errcode='42501';
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
      where a.organization_id=p_organization_id
        and a.id=(p_payload->>'target_asset_id')::uuid
        and a.archived_at is null and a.deleted_at is null
        and a.status<>'Thanh lý'
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

  if found and v_existing.archived_at is not null then
    raise exception 'Mẫu Checklist đã lưu trữ. Hãy khôi phục trước khi chỉnh sửa.' using errcode='55000';
  end if;

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
    ) values(
      p_definition_id,p_organization_id,btrim(p_payload->>'title'),p_payload->>'target_kind',
      btrim(p_payload->>'target_label'),
      case when nullif(p_payload->>'target_asset_id','') is null then null else (p_payload->>'target_asset_id')::uuid end,
      p_payload->>'category_key',p_payload->>'frequency',
      coalesce(nullif(p_payload->>'execution_time',''),'09:00'),
      coalesce(nullif(btrim(p_payload->>'assignee'),''),'Admin'),
      coalesce((p_payload->>'enabled')::boolean,true),v_questions,
      coalesce(nullif(p_payload->>'source',''),'custom'),1,
      coalesce(nullif(p_payload->>'schedule_started_at','')::timestamptz,clock_timestamp()),v_user,v_user
    ) returning * into v_row;
  end if;

  -- Preserve cancelled task history when a restored template is edited.
  delete from public.checklist_tasks
  where organization_id=p_organization_id
    and definition_id=v_row.id
    and status='Chờ thực hiện'
    and due_at>clock_timestamp()
    and cancelled_at is null;

  v_snapshot:=jsonb_build_object(
    'id',v_row.id,'title',v_row.title,'target_kind',v_row.target_kind,
    'target_label',v_row.target_label,'target_asset_id',v_row.target_asset_id,
    'category_key',v_row.category_key,'frequency',v_row.frequency,
    'execution_time',v_row.execution_time,'assignee',v_row.assignee,
    'enabled',v_row.enabled,'questions',v_row.questions,'source',v_row.source,
    'version',v_row.version,'schedule_started_at',v_row.schedule_started_at
  );
  insert into public.checklist_definition_versions(organization_id,definition_id,version,snapshot,changed_by)
  values(p_organization_id,v_row.id,v_row.version,v_snapshot,v_user)
  on conflict(organization_id,definition_id,version) do nothing;
  return to_jsonb(v_row);
end;
$function$;

commit;