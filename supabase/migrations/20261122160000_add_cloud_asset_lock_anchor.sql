-- Restore the per-asset anchor lock required by the live Cloud mutation RPC.
-- Lock the asset row before touching the edit-lock row, matching
-- private.acquire_asset_edit_lock and preventing races with asset deletion.

create or replace function private.lock_asset_anchor(
  p_organization_id uuid,
  p_asset_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
begin
  if p_organization_id is null or p_asset_id is null then
    raise exception 'Organization and asset are required' using errcode = '22023';
  end if;

  perform 1
  from public.assets a
  where a.organization_id = p_organization_id
    and a.id = p_asset_id
  for update;

  if not found then
    raise exception 'Asset not found in this organization' using errcode = 'P0002';
  end if;
end;
$function$;

-- This is an internal helper. The SECURITY DEFINER mutation function runs
-- as its owner and can call it; API roles must not invoke it directly.
revoke all on function private.lock_asset_anchor(uuid, uuid) from public, anon, authenticated;
