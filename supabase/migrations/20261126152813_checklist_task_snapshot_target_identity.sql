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
   jsonb_build_object('categoryKey',v_definition.category_key,'targetKind',v_definition.target_kind,'targetAssetId',v_definition.target_asset_id,'questions',v_definition.questions,'version',v_definition.version,
    'title',v_definition.title,'targetLabel',v_definition.target_label,'frequency',v_definition.frequency,
    'executionTime',v_definition.execution_time,'assignee',v_definition.assignee,'source',v_definition.source))
  on conflict(organization_id,definition_id,due_date) do nothing;
  v_count:=v_count+1;
 end loop;
 -- A disabled starter group or paused definition must not leave future work on the schedule.
 delete from public.checklist_tasks t
 using public.checklist_definitions d
 where t.organization_id=p_organization_id and d.organization_id=t.organization_id and d.id=t.definition_id
   and t.status='Chờ thực hiện' and t.due_at>now()
   and (not d.enabled or (d.source='starter' and not exists(
     select 1 from public.checklist_category_settings s
     where s.organization_id=p_organization_id and s.category_key=d.category_key and s.enabled
   )));
 update public.checklist_tasks t set status='Không Checklist',claimed_by_user_id=null,claimed_at=null,updated_at=clock_timestamp()
 where t.organization_id=p_organization_id and t.status in('Chờ thực hiện','Đang thực hiện') and t.due_at<=now()-interval '24 hours';
 return jsonb_build_object('occurrences_processed',v_count);
end;$function$;
