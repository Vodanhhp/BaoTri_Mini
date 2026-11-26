begin;
create or replace function public.checklist_save_definition(p_organization_id uuid,p_definition_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.save_checklist_definition(p_organization_id,p_definition_id,p_payload); $$;
create or replace function public.checklist_ensure_occurrences(p_organization_id uuid,p_occurrences jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.ensure_checklist_occurrences(p_organization_id,p_occurrences); $$;
create or replace function public.checklist_claim_task(p_organization_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.claim_checklist_task(p_organization_id,p_task_id); $$;
create or replace function public.checklist_release_task(p_organization_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.release_checklist_task(p_organization_id,p_task_id); $$;
create or replace function public.checklist_complete_task(p_organization_id uuid,p_task_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.complete_checklist_task(p_organization_id,p_task_id,p_payload); $$;
create or replace function public.checklist_complete_manual_run(p_organization_id uuid,p_definition_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.complete_checklist_manual_run(p_organization_id,p_definition_id,p_payload); $$;
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