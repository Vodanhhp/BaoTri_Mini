-- Include the immutable Local snapshot timestamp in the scoped receipt response.
-- The privileged lookup remains private; the exposed RPC wrapper is invoker-only.
begin;
create or replace function private.verify_cloud_asset_import_receipt(
  p_organization_id uuid,p_asset_id uuid,p_mutation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_receipt public.asset_import_receipts;
  v_asset public.assets;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_organization_id is null or p_asset_id is null or p_mutation_id is null
     or p_mutation_id <> p_asset_id then
    raise exception 'Invalid import receipt identity' using errcode='22023';
  end if;
  if not private.has_org_permission(p_organization_id,'assets.create')
     and not private.has_org_permission(p_organization_id,'assets.import') then
    raise exception 'Missing asset create/import permission' using errcode='42501';
  end if;
  select * into v_receipt
  from public.asset_import_receipts
  where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if not found or v_receipt.asset_id<>p_asset_id or v_receipt.actor_user_id<>v_actor then
    return jsonb_build_object('verified',false,'asset',null,'receipt_updated_at',null);
  end if;
  select * into v_asset
  from public.assets
  where organization_id=p_organization_id and id=p_asset_id;
  if not found then
    return jsonb_build_object('verified',true,'asset',null,'receipt_updated_at',v_receipt.payload->>'updated_at');
  end if;
  return jsonb_build_object(
    'verified',true,
    'asset',(to_jsonb(v_asset)-'id')||jsonb_build_object('asset_key',v_asset.code),'receipt_updated_at',v_receipt.payload->>'updated_at'
  );
end;
$function$;
revoke all on function private.verify_cloud_asset_import_receipt(uuid,uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.verify_cloud_asset_import_receipt(uuid,uuid,uuid) to authenticated;
create or replace function public.verify_cloud_asset_import_receipt(
  p_organization_id uuid,p_asset_id uuid,p_mutation_id uuid
) returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.verify_cloud_asset_import_receipt(p_organization_id,p_asset_id,p_mutation_id);
$function$;
revoke all on function public.verify_cloud_asset_import_receipt(uuid,uuid,uuid) from public,anon;
grant execute on function public.verify_cloud_asset_import_receipt(uuid,uuid,uuid) to authenticated;
commit;
