-- Hide internal asset UUIDs from organization members.
-- All member-facing Cloud reads and mutations use the immutable business code.
begin;

-- Move UUID-based implementations behind the private schema before exposing
-- code-based public RPC wrappers. Preserve the permission checks in the
-- existing SECURITY DEFINER implementations.
-- The UUID-based implementations already exist in private (migration 010).
-- Keep them there and replace the public compatibility wrappers with code-based APIs.

-- Only the SECURITY DEFINER public wrappers below may invoke these internals.
revoke all on function private.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.acquire_asset_edit_lock(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function private.heartbeat_asset_edit_lock(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.release_asset_edit_lock(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.list_asset_edit_locks(uuid) from public,anon,authenticated;

create or replace function public.list_cloud_assets(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then
    raise exception 'Active organization membership required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(
    (to_jsonb(a) - 'id') || jsonb_build_object('asset_key',a.code)
    order by a.name,a.code
  ),'[]'::jsonb) into v_result
  from public.assets a where a.organization_id=p_organization_id;
  return v_result;
end;
$function$;

create or replace function public.acquire_cloud_asset_edit_lock(
  p_organization_id uuid,p_asset_code text,p_device_id text,p_holder_label text
) returns jsonb
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare v_asset_id uuid;v_result jsonb;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id,'assets.update') then raise exception 'Missing assets.update permission' using errcode='42501';end if;
  select id into v_asset_id from public.assets where organization_id=p_organization_id and code=p_asset_code;
  if not found then raise exception 'Asset not found in this organization' using errcode='P0002';end if;
  v_result:=private.acquire_asset_edit_lock(p_organization_id,v_asset_id,p_device_id,p_holder_label);
  return (v_result-'asset_id')||jsonb_build_object('asset_code',p_asset_code);
end;
$function$;

create or replace function public.heartbeat_cloud_asset_edit_lock(
  p_organization_id uuid,p_asset_code text,p_lock_token uuid
) returns jsonb
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare v_asset_id uuid;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then raise exception 'Active organization membership required' using errcode='42501';end if;
  select id into v_asset_id from public.assets where organization_id=p_organization_id and code=p_asset_code;
  if not found then return jsonb_build_object('renewed',false);end if;
  return private.heartbeat_asset_edit_lock(p_organization_id,v_asset_id,p_lock_token);
end;
$function$;

create or replace function public.release_cloud_asset_edit_lock(
  p_organization_id uuid,p_asset_code text,p_lock_token uuid
) returns boolean
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare v_asset_id uuid;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then return false;end if;
  select id into v_asset_id from public.assets where organization_id=p_organization_id and code=p_asset_code;
  if not found then return false;end if;
  return private.release_asset_edit_lock(p_organization_id,v_asset_id,p_lock_token);
end;
$function$;

create or replace function public.list_cloud_asset_edit_locks(p_organization_id uuid)
returns jsonb
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare v_locks jsonb;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then
    raise exception 'Active organization membership required' using errcode='42501';
  end if;
  v_locks:=private.list_asset_edit_locks(p_organization_id);
  return coalesce((
    select jsonb_agg(
      (lock_row.value-'asset_id')||jsonb_build_object('asset_code',a.code)
    )
    from jsonb_array_elements(v_locks) as lock_row(value)
    join public.assets a on a.organization_id=p_organization_id and a.id=(lock_row.value->>'asset_id')::uuid
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.apply_cloud_asset_mutation_with_lock(
  p_organization_id uuid,p_asset_code text,p_lock_token uuid,p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare v_asset_id uuid;v_result jsonb;v_asset jsonb;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id,'assets.update') then raise exception 'Missing assets.update permission' using errcode='42501';end if;
  select id into v_asset_id from public.assets where organization_id=p_organization_id and code=p_asset_code;
  if not found then raise exception 'Asset not found in this organization' using errcode='P0002';end if;
  v_result:=private.apply_asset_mutation_with_lock(
    p_organization_id,v_asset_id,p_lock_token,p_mutation_id,p_expected_cloud_updated_at,p_payload
  );
  v_asset:=v_result->'asset';
  return (v_result-'asset')||jsonb_build_object('asset',(v_asset-'id')||jsonb_build_object('asset_key',p_asset_code));
end;
$function$;

create or replace function public.mirror_cloud_asset_group_change_history(
  p_organization_id uuid,p_asset_code text,p_changes jsonb
) returns jsonb
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare v_asset_id uuid;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id,'assets.import') then raise exception 'Missing assets.import permission' using errcode='42501';end if;
  select id into v_asset_id from public.assets where organization_id=p_organization_id and code=p_asset_code;
  if not found then raise exception 'Cloud asset does not exist in this organization' using errcode='P0002';end if;
  return private.mirror_asset_group_change_history(p_organization_id,v_asset_id,p_changes);
end;
$function$;

-- Preserve the import contract, but never return the internal UUID to the client.
create or replace function public.import_asset_preserving_identity(
  p_organization_id uuid,p_id uuid,p_code text,p_asset jsonb,p_mutation_id uuid
) returns jsonb
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare v_result jsonb;v_asset jsonb;
begin
  v_result:=private.import_asset_preserving_identity(p_organization_id,p_id,p_code,p_asset,p_mutation_id);
  v_asset:=v_result->'asset';
  return (v_result-'asset')||jsonb_build_object('asset',(v_asset-'id')||jsonb_build_object('asset_key',p_code));
end;
$function$;

revoke all on table public.assets from anon,authenticated;
revoke all on function public.acquire_asset_edit_lock(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.heartbeat_asset_edit_lock(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.release_asset_edit_lock(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.list_asset_edit_locks(uuid) from public,anon,authenticated;
revoke all on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.mirror_asset_group_change_history(uuid,uuid,jsonb) from public,anon,authenticated;

revoke all on function public.list_cloud_assets(uuid) from public,anon;
revoke all on function public.acquire_cloud_asset_edit_lock(uuid,text,text,text) from public,anon;
revoke all on function public.heartbeat_cloud_asset_edit_lock(uuid,text,uuid) from public,anon;
revoke all on function public.release_cloud_asset_edit_lock(uuid,text,uuid) from public,anon;
revoke all on function public.list_cloud_asset_edit_locks(uuid) from public,anon;
revoke all on function public.apply_cloud_asset_mutation_with_lock(uuid,text,uuid,uuid,timestamptz,jsonb) from public,anon;
revoke all on function public.mirror_cloud_asset_group_change_history(uuid,text,jsonb) from public,anon;
revoke all on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) from public,anon;

grant execute on function public.list_cloud_assets(uuid) to authenticated;
grant execute on function public.acquire_cloud_asset_edit_lock(uuid,text,text,text) to authenticated;
grant execute on function public.heartbeat_cloud_asset_edit_lock(uuid,text,uuid) to authenticated;
grant execute on function public.release_cloud_asset_edit_lock(uuid,text,uuid) to authenticated;
grant execute on function public.list_cloud_asset_edit_locks(uuid) to authenticated;
grant execute on function public.apply_cloud_asset_mutation_with_lock(uuid,text,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.mirror_cloud_asset_group_change_history(uuid,text,jsonb) to authenticated;
grant execute on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) to authenticated;

commit;
