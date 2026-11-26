ALTER TABLE public.checklist_definitions
 ADD COLUMN archived_at timestamptz,
 ADD COLUMN archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN archived_enabled boolean;
ALTER TABLE public.checklist_tasks
 ADD COLUMN cancelled_at timestamptz,
 ADD COLUMN cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.claim_checklist_task(p_organization_id uuid,p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' SET row_security TO 'off'
AS $function$
declare v_user uuid:=auth.uid();v_task public.checklist_tasks;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'checklist.result.create') then raise exception 'Không có quyền thực hiện Checklist.' using errcode='42501';end if;
 select * into v_task from public.checklist_tasks where organization_id=p_organization_id and id=p_task_id for update;
 if not found then raise exception 'Không tìm thấy lượt Checklist.' using errcode='P0002';end if;
 if v_task.cancelled_at is not null or exists(select 1 from public.checklist_definitions d where d.organization_id=p_organization_id and d.id=v_task.definition_id and d.archived_at is not null) then raise exception 'Mẫu Checklist đã lưu trữ hoặc lượt kiểm tra đã bị hủy.' using errcode='55000';end if;
 if not private.has_org_role(p_organization_id,'admin') then raise exception 'Giai đoạn này chỉ Admin được thực hiện Checklist.' using errcode='42501';end if;
 if v_task.status<>'Chờ thực hiện' then raise exception 'Lượt Checklist đã được nhận hoặc không còn khả dụng.' using errcode='40001';end if;
 if v_task.due_at>now() or now()-v_task.due_at>=interval '24 hours' then raise exception 'Lượt Checklist chưa đến hạn hoặc đã hết thời gian thực hiện.' using errcode='55000';end if;
 update public.checklist_tasks set status='Đang thực hiện',claimed_by_user_id=v_user,claimed_at=clock_timestamp(),updated_at=clock_timestamp() where organization_id=p_organization_id and id=p_task_id returning * into v_task;
 insert into public.checklist_task_events(organization_id,task_id,event_type,actor_user_id,actor_label) values(p_organization_id,p_task_id,'Nhận việc',v_user,coalesce((select display_name from public.profiles where id=v_user),'Admin'));
 return to_jsonb(v_task);
end;
$function$;

CREATE OR REPLACE FUNCTION private.archive_checklist_definition(p_organization_id uuid,p_definition_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' SET row_security TO 'off'
AS $function$
declare v_user uuid:=auth.uid();v_row public.checklist_definitions;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'checklist.template.manage') then raise exception 'Không có quyền lưu trữ mẫu Checklist.' using errcode='42501';end if;
 select * into v_row from public.checklist_definitions where organization_id=p_organization_id and id=p_definition_id for update;
 if not found then raise exception 'Không tìm thấy mẫu Checklist.' using errcode='P0002';end if;
 if v_row.archived_at is not null then return to_jsonb(v_row);end if;
 if exists(select 1 from public.checklist_tasks t where t.organization_id=p_organization_id and t.definition_id=p_definition_id and t.status='Đang thực hiện' and t.cancelled_at is null) then
  raise exception 'Mẫu đang có lượt Checklist được nhận. Hãy hoàn tất hoặc trả lượt trước khi lưu trữ.' using errcode='55000';
 end if;
 update public.checklist_definitions set archived_enabled=enabled,archived_at=clock_timestamp(),archived_by=v_user,enabled=false,version=version+1,updated_by=v_user,updated_at=clock_timestamp()
 where organization_id=p_organization_id and id=p_definition_id returning * into v_row;
 update public.checklist_tasks set cancelled_at=clock_timestamp(),cancelled_by=v_user,updated_at=clock_timestamp()
 where organization_id=p_organization_id and definition_id=p_definition_id and status='Chờ thực hiện' and cancelled_at is null;
 insert into public.checklist_definition_versions(organization_id,definition_id,version,snapshot,changed_by)
 values(p_organization_id,v_row.id,v_row.version,jsonb_build_object(
  'id',v_row.id,'title',v_row.title,'target_kind',v_row.target_kind,'target_label',v_row.target_label,
  'target_asset_id',v_row.target_asset_id,'category_key',v_row.category_key,'frequency',v_row.frequency,
  'execution_time',v_row.execution_time,'assignee',v_row.assignee,'enabled',v_row.enabled,
  'questions',v_row.questions,'source',v_row.source,'version',v_row.version,
  'schedule_started_at',v_row.schedule_started_at,'archived_at',v_row.archived_at,'archived_enabled',v_row.archived_enabled
 ),v_user);
 return to_jsonb(v_row);
end;
$function$;

CREATE OR REPLACE FUNCTION private.restore_checklist_definition(p_organization_id uuid,p_definition_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' SET row_security TO 'off'
AS $function$
declare v_user uuid:=auth.uid();v_row public.checklist_definitions;v_resume boolean;
begin
 if v_user is null or not private.has_org_permission(p_organization_id,'checklist.template.manage') then raise exception 'Không có quyền khôi phục mẫu Checklist.' using errcode='42501';end if;
 select * into v_row from public.checklist_definitions where organization_id=p_organization_id and id=p_definition_id for update;
 if not found then raise exception 'Không tìm thấy mẫu Checklist.' using errcode='P0002';end if;
 if v_row.archived_at is null then return to_jsonb(v_row);end if;
 v_resume:=coalesce(v_row.archived_enabled,false);
 update public.checklist_definitions set archived_at=null,archived_by=null,archived_enabled=null,enabled=v_resume,
  schedule_started_at=case when v_resume then clock_timestamp() else schedule_started_at end,
  version=version+1,updated_by=v_user,updated_at=clock_timestamp()
 where organization_id=p_organization_id and id=p_definition_id returning * into v_row;
 insert into public.checklist_definition_versions(organization_id,definition_id,version,snapshot,changed_by)
 values(p_organization_id,v_row.id,v_row.version,jsonb_build_object(
  'id',v_row.id,'title',v_row.title,'target_kind',v_row.target_kind,'target_label',v_row.target_label,
  'target_asset_id',v_row.target_asset_id,'category_key',v_row.category_key,'frequency',v_row.frequency,
  'execution_time',v_row.execution_time,'assignee',v_row.assignee,'enabled',v_row.enabled,
  'questions',v_row.questions,'source',v_row.source,'version',v_row.version,
  'schedule_started_at',v_row.schedule_started_at,'archived_at',v_row.archived_at,'archived_enabled',v_row.archived_enabled
 ),v_user);
 return to_jsonb(v_row);
end;
$function$;

CREATE OR REPLACE FUNCTION public.checklist_archive_definition(p_organization_id uuid,p_definition_id uuid)
 RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $function$ select private.archive_checklist_definition(p_organization_id,p_definition_id); $function$;
CREATE OR REPLACE FUNCTION public.checklist_restore_definition(p_organization_id uuid,p_definition_id uuid)
 RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $function$ select private.restore_checklist_definition(p_organization_id,p_definition_id); $function$;
REVOKE ALL ON FUNCTION public.checklist_archive_definition(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.checklist_restore_definition(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checklist_archive_definition(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checklist_restore_definition(uuid,uuid) TO authenticated;