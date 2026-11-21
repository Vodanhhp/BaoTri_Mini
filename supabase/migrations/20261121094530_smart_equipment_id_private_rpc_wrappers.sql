-- Keep public RPC entrypoints SECURITY INVOKER, matching the BAOTRI Mini RBAC architecture.
-- SECURITY DEFINER implementations live in the private schema; callers retain only the
-- authenticated EXECUTE grants needed by the public wrappers.

begin;

alter function public.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) set schema private;
alter function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text,text,text,text,jsonb) set schema private;
alter function public.release_asset_id_sequence_reservation(uuid,uuid) set schema private;
alter function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) set schema private;
alter function public.mirror_asset_group_change_history(uuid,uuid,jsonb) set schema private;

revoke all on function private.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) from public, anon;
revoke all on function private.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text,text,text,text,jsonb) from public, anon;
revoke all on function private.release_asset_id_sequence_reservation(uuid,uuid) from public, anon;
revoke all on function private.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public, anon;
revoke all on function private.mirror_asset_group_change_history(uuid,uuid,jsonb) from public, anon;

grant execute on function private.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) to authenticated;
grant execute on function private.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function private.release_asset_id_sequence_reservation(uuid,uuid) to authenticated;
grant execute on function private.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function private.mirror_asset_group_change_history(uuid,uuid,jsonb) to authenticated;

create function public.reserve_asset_id_sequence(
  p_organization_id uuid, p_reservation_id uuid, p_equipment_code text,
  p_group_code text default null, p_site_code text default null, p_commissioned_at date default null
)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.reserve_asset_id_sequence(
    p_organization_id,p_reservation_id,p_equipment_code,p_group_code,p_site_code,p_commissioned_at
  );
$function$;

create function public.confirm_asset_id_sequence_reservation(
  p_organization_id uuid,p_reservation_id uuid,p_asset_id uuid,p_equipment_id text,
  p_original_name text,p_normalized_name_at_creation text,p_equipment_type_code text,p_id_components_snapshot jsonb
)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.confirm_asset_id_sequence_reservation(
    p_organization_id,p_reservation_id,p_asset_id,p_equipment_id,
    p_original_name,p_normalized_name_at_creation,p_equipment_type_code,p_id_components_snapshot
  );
$function$;

create function public.release_asset_id_sequence_reservation(p_organization_id uuid,p_reservation_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.release_asset_id_sequence_reservation(p_organization_id,p_reservation_id);
$function$;

create function public.apply_asset_mutation_with_lock(
  p_organization_id uuid,p_asset_id uuid,p_lock_token uuid,p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,p_payload jsonb
)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.apply_asset_mutation_with_lock(
    p_organization_id,p_asset_id,p_lock_token,p_mutation_id,p_expected_cloud_updated_at,p_payload
  );
$function$;

create function public.mirror_asset_group_change_history(p_organization_id uuid,p_asset_id uuid,p_changes jsonb)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.mirror_asset_group_change_history(p_organization_id,p_asset_id,p_changes);
$function$;

revoke all on function public.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) from public, anon;
revoke all on function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text,text,text,text,jsonb) from public, anon;
revoke all on function public.release_asset_id_sequence_reservation(uuid,uuid) from public, anon;
revoke all on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public, anon;
revoke all on function public.mirror_asset_group_change_history(uuid,uuid,jsonb) from public, anon;

grant execute on function public.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) to authenticated;
grant execute on function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.release_asset_id_sequence_reservation(uuid,uuid) to authenticated;
grant execute on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.mirror_asset_group_change_history(uuid,uuid,jsonb) to authenticated;

commit;
