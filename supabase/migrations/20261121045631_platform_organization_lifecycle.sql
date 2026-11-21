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
  v_assets integer := 0;
  v_members integer := 0;
  v_roles integer := 0;
begin
  select o.name into v_name
  from public.organizations o
  where o.id = p_organization_id
  for update;

  if v_name is null then
    raise exception 'Không tìm thấy tổ chức hoặc tổ chức đã bị xóa.';
  end if;
  if btrim(coalesce(p_confirm_name, '')) is distinct from v_name then
    raise exception 'Tên xác nhận không khớp với tên tổ chức.';
  end if;

  delete from public.asset_import_receipts where organization_id = p_organization_id;
  get diagnostics v_import_receipts = row_count;
  delete from public.asset_mutation_receipts where organization_id = p_organization_id;
  get diagnostics v_mutation_receipts = row_count;
  delete from public.asset_edit_locks where organization_id = p_organization_id;
  get diagnostics v_locks = row_count;
  delete from public.assets where organization_id = p_organization_id;
  get diagnostics v_assets = row_count;
  delete from public.organization_members where organization_id = p_organization_id;
  get diagnostics v_members = row_count;
  delete from public.roles where organization_id = p_organization_id;
  get diagnostics v_roles = row_count;
  delete from public.organizations where id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'organization_name', v_name,
    'deleted', jsonb_build_object(
      'asset_import_receipts', v_import_receipts,
      'asset_mutation_receipts', v_mutation_receipts,
      'asset_edit_locks', v_locks,
      'assets', v_assets,
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

create or replace function public.platform_delete_organization(p_organization_id uuid, p_confirm_name text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.platform_delete_organization(p_organization_id, p_confirm_name);
$$;

revoke all on function public.platform_delete_organization(uuid, text) from public, anon, authenticated;
grant execute on function public.platform_delete_organization(uuid, text) to service_role;
