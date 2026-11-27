-- Temporarily allow equipment-linked Checklist results to be completed manually.
-- Existing authorization, task snapshots, validation and idempotent run IDs remain unchanged.
begin;

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
  v_run_id uuid:=coalesce(nullif(p_payload->>'run_id','')::uuid,gen_random_uuid());
  v_existing public.checklist_runs;
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
  select * into v_existing from public.checklist_runs where id=v_run_id;
  if found then
    if v_existing.organization_id<>p_organization_id or v_existing.definition_id<>p_definition_id
       or v_existing.inspector_user_id<>v_user then
      raise exception 'Mã lưu kết quả đã được sử dụng cho một phiếu Checklist khác.' using errcode='23505';
    end if;
    return jsonb_build_object('run_id',v_existing.id,'outcome',v_existing.outcome,'completed_at',v_existing.completed_at);
  end if;
  select * into v_definition from public.checklist_definitions
   where organization_id=p_organization_id and id=p_definition_id and enabled for share;
  if not found then raise exception 'Không tìm thấy mẫu Checklist đang hoạt động.' using errcode='P0002';end if;
  if jsonb_typeof(v_answers)<>'array'
     or jsonb_array_length(v_answers)<>jsonb_array_length(v_definition.questions)
     or exists(select 1 from jsonb_array_elements(v_answers) a where coalesce(a->>'result','') not in ('Đạt','Không đạt','Bỏ qua'))
     or (select count(distinct a->>'questionId') from jsonb_array_elements(v_answers) a)<>jsonb_array_length(v_answers)
     or exists(select 1 from jsonb_array_elements(v_answers) a where not exists(
       select 1 from jsonb_array_elements(v_definition.questions) q
        where q->>'id'=a->>'questionId' and q->>'label'=a->>'question'))
     or exists(select 1 from jsonb_array_elements(v_definition.questions) q
        where coalesce((q->>'required')::boolean,true) and not exists(
          select 1 from jsonb_array_elements(v_answers) a where a->>'questionId'=q->>'id')) then
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
    id,organization_id,definition_id,task_id,checklist_title,category_label,target_label,frequency,
    answers,outcome,inspector,inspector_user_id,completed_at,repair_request_created,no_repair_reason,checklist_snapshot
  ) values (
    v_run_id,p_organization_id,v_definition.id,null,v_definition.title,v_definition.category_key,
    v_definition.target_label,v_definition.frequency,v_answers,v_outcome,v_inspector,v_user,
    clock_timestamp(),coalesce((p_payload->>'repair_request_created')::boolean,false),
    nullif(btrim(p_payload->>'no_repair_reason'),''),v_definition.questions
  ) returning id into v_run_id;
  update public.checklist_definitions set last_completed_at=clock_timestamp(),updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=v_definition.id;
  return jsonb_build_object('run_id',v_run_id,'outcome',v_outcome,'completed_at',clock_timestamp());
end;
$function$;

commit;
