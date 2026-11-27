begin;
create or replace function private.claim_checklist_task(p_organization_id uuid,p_task_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
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
end;$$;
create or replace function private.complete_checklist_task(p_organization_id uuid,p_task_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
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
end;$$;
commit;