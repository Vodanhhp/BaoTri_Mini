CREATE OR REPLACE FUNCTION public.checklist_claim_task(p_organization_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.claim_checklist_task(p_organization_id,p_task_id);
$function$


CREATE OR REPLACE FUNCTION public.checklist_complete_manual_run(p_organization_id uuid, p_definition_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.complete_checklist_manual_run(p_organization_id,p_definition_id,p_payload);
$function$


CREATE OR REPLACE FUNCTION public.checklist_complete_task(p_organization_id uuid, p_task_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.complete_checklist_task(p_organization_id,p_task_id,p_payload);
$function$


CREATE OR REPLACE FUNCTION public.checklist_ensure_occurrences(p_organization_id uuid, p_occurrences jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.ensure_checklist_occurrences(p_organization_id,p_occurrences); $function$


CREATE OR REPLACE FUNCTION public.checklist_release_task(p_organization_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.release_checklist_task(p_organization_id,p_task_id);
$function$


CREATE OR REPLACE FUNCTION public.checklist_save_definition(p_organization_id uuid, p_definition_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.save_checklist_definition(p_organization_id,p_definition_id,p_payload);
$function$

revoke all on function private.save_checklist_definition(uuid,uuid,jsonb) from public,anon;
revoke all on function private.ensure_checklist_occurrences(uuid,jsonb) from public,anon;
revoke all on function private.claim_checklist_task(uuid,uuid) from public,anon;
revoke all on function private.release_checklist_task(uuid,uuid) from public,anon;
revoke all on function private.complete_checklist_task(uuid,uuid,jsonb) from public,anon;
revoke all on function private.complete_checklist_manual_run(uuid,uuid,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.save_checklist_definition(uuid,uuid,jsonb) to authenticated;
grant execute on function private.ensure_checklist_occurrences(uuid,jsonb) to authenticated;
grant execute on function private.claim_checklist_task(uuid,uuid) to authenticated;
grant execute on function private.release_checklist_task(uuid,uuid) to authenticated;
grant execute on function private.complete_checklist_task(uuid,uuid,jsonb) to authenticated;
grant execute on function private.complete_checklist_manual_run(uuid,uuid,jsonb) to authenticated;
revoke all on function public.checklist_save_definition(uuid,uuid,jsonb) from public,anon;
revoke all on function public.checklist_ensure_occurrences(uuid,jsonb) from public,anon;
revoke all on function public.checklist_claim_task(uuid,uuid) from public,anon;
revoke all on function public.checklist_release_task(uuid,uuid) from public,anon;
revoke all on function public.checklist_complete_task(uuid,uuid,jsonb) from public,anon;
revoke all on function public.checklist_complete_manual_run(uuid,uuid,jsonb) from public,anon;
grant execute on function public.checklist_save_definition(uuid,uuid,jsonb) to authenticated;
grant execute on function public.checklist_ensure_occurrences(uuid,jsonb) to authenticated;
grant execute on function public.checklist_claim_task(uuid,uuid) to authenticated;
grant execute on function public.checklist_release_task(uuid,uuid) to authenticated;
grant execute on function public.checklist_complete_task(uuid,uuid,jsonb) to authenticated;
grant execute on function public.checklist_complete_manual_run(uuid,uuid,jsonb) to authenticated;
commit;