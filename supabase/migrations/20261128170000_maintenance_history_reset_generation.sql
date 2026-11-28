begin;

-- Current clients may import legitimate legacy history for scheduled maintenance
-- tasks after a request-only Reset. The generation check prevents old sessions
-- from importing stale request history; the underlying importer still requires
-- every request/task ID to exist in the current organization.
create or replace function public.maintenance_import_legacy_history_v2(
  p_organization_id uuid,
  p_events jsonb,
  p_reset_generation bigint
) returns integer
language plpgsql
set search_path = ''
as $function$
begin
  perform private.assert_maintenance_reset_generation(p_organization_id,p_reset_generation);
  return private.import_maintenance_history(p_organization_id,p_events);
end;
$function$;

revoke all on function public.maintenance_import_legacy_history_v2(uuid,jsonb,bigint) from public,anon;
grant execute on function public.maintenance_import_legacy_history_v2(uuid,jsonb,bigint) to authenticated;

commit;
