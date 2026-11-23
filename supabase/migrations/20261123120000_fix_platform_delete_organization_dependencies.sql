-- Complete all organization-owned dependency cleanup before deleting the tenant row.
-- Keep this operation atomic: any failure rolls back the entire deletion.
create or replace function private.platform_delete_organization(
  p_organization_id uuid,
  p_confirm_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_import_receipts integer := 0;
  v_mutation_receipts integer := 0;
  v_locks integer := 0;
  v_group_history integer := 0;
  v_activity_history integer := 0;
  v_assets integer := 0;
  v_id_reservations integer := 0;
  v_id_sequences integer := 0;
  v_equipment_catalog integer := 0;
  v_plan_history integer := 0;
  v_plan_requests integer := 0;
  v_members integer := 0;
  v_roles integer := 0;
begin
  select o.name
    into v_name
    from public.organizations o
   where o.id = p_organization_id
   for update;

  if v_name is null then
    raise exception 'Không tìm thấy tổ chức hoặc tổ chức đã bị xóa.';
  end if;

  if btrim(coalesce(p_confirm_name, '')) is distinct from v_name then
    raise exception 'Tên xác nhận không khớp với tên tổ chức.';
  end if;

  delete from public.asset_import_receipts
   where organization_id = p_organization_id;
  get diagnostics v_import_receipts = row_count;

  delete from public.asset_mutation_receipts
   where organization_id = p_organization_id;
  get diagnostics v_mutation_receipts = row_count;

  delete from public.asset_edit_locks
   where organization_id = p_organization_id;
  get diagnostics v_locks = row_count;

  -- These histories have RESTRICT references to both the tenant and/or its assets.
  delete from private.asset_group_change_history
   where organization_id = p_organization_id;
  get diagnostics v_group_history = row_count;

  delete from public.asset_activity_history
   where organization_id = p_organization_id;
  get diagnostics v_activity_history = row_count;

  delete from public.assets
   where organization_id = p_organization_id;
  get diagnostics v_assets = row_count;

  -- Smart-ID reservations reference auth.users with RESTRICT, so remove them
  -- before deleting the tenant. The user accounts themselves are intentionally retained.
  delete from private.asset_id_sequence_reservations
   where organization_id = p_organization_id;
  get diagnostics v_id_reservations = row_count;

  delete from private.asset_id_sequences
   where organization_id = p_organization_id;
  get diagnostics v_id_sequences = row_count;

  delete from public.organization_equipment_catalog
   where organization_id = p_organization_id;
  get diagnostics v_equipment_catalog = row_count;

  -- Explicitly remove plan history/requests (the FK also has CASCADE).
  delete from private.organization_plan_change_history
   where organization_id = p_organization_id;
  get diagnostics v_plan_history = row_count;

  delete from private.organization_plan_change_requests
   where organization_id = p_organization_id;
  get diagnostics v_plan_requests = row_count;

  delete from public.organization_members
   where organization_id = p_organization_id;
  get diagnostics v_members = row_count;

  delete from public.roles
   where organization_id = p_organization_id;
  get diagnostics v_roles = row_count;

  delete from public.organizations
   where id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'organization_name', v_name,
    'deleted', jsonb_build_object(
      'asset_import_receipts', v_import_receipts,
      'asset_mutation_receipts', v_mutation_receipts,
      'asset_edit_locks', v_locks,
      'asset_group_change_history', v_group_history,
      'asset_activity_history', v_activity_history,
      'assets', v_assets,
      'asset_id_sequence_reservations', v_id_reservations,
      'asset_id_sequences', v_id_sequences,
      'organization_equipment_catalog', v_equipment_catalog,
      'organization_plan_change_history', v_plan_history,
      'organization_plan_change_requests', v_plan_requests,
      'organization_members', v_members,
      'roles', v_roles,
      'organizations', 1
    )
  );
end;
$$;

revoke all on function private.platform_delete_organization(uuid, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.platform_delete_organization(uuid, text) to service_role;
