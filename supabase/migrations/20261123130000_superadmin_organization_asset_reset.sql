-- Organization-wide asset reset with a monotonic server-side generation barrier.
-- Source only: do not apply until the user explicitly approves a Test migration.

begin;

create table if not exists private.organization_asset_reset_state (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  generation bigint not null default 0 check (generation >= 0),
  reset_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists private.organization_asset_reset_devices (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id text not null check (char_length(btrim(device_id)) between 8 and 160),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform_label text not null default 'Thiết bị',
  registered_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  acknowledged_generation bigint not null default 0 check (acknowledged_generation >= 0),
  local_asset_count integer not null default 0 check (local_asset_count >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, device_id)
);

create table if not exists private.organization_asset_reset_requests (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null,
  generation bigint not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  assets_deleted bigint not null default 0,
  import_receipts_deleted bigint not null default 0,
  mutation_receipts_deleted bigint not null default 0,
  edit_locks_deleted bigint not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, request_id),
  unique (organization_id, generation)
);

alter table private.organization_asset_reset_state enable row level security;
alter table private.organization_asset_reset_devices enable row level security;
alter table private.organization_asset_reset_requests enable row level security;
revoke all on private.organization_asset_reset_state from public, anon, authenticated;
revoke all on private.organization_asset_reset_devices from public, anon, authenticated;
revoke all on private.organization_asset_reset_requests from public, anon, authenticated;
grant usage on schema private to service_role;

-- Preserve audit rows after physical asset deletion by detaching the optional asset link.
alter table public.asset_activity_history alter column asset_id drop not null;
alter table private.asset_group_change_history alter column asset_id drop not null;

create or replace function public.register_organization_asset_reset_device(
  p_organization_id uuid,
  p_device_id text,
  p_platform_label text,
  p_local_asset_count integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_generation bigint;
  v_reset_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_device_id), '') is null or char_length(p_device_id) > 160 then
    raise exception 'Invalid device identifier' using errcode = '22023';
  end if;
  -- A previously registered device may still need to purge after its user is removed.
  if not private.is_org_member(p_organization_id)
     and not exists (
       select 1 from private.organization_asset_reset_devices d
        where d.organization_id = p_organization_id
          and d.device_id = p_device_id
          and d.user_id = v_actor
     ) then
    raise exception 'Active organization membership or prior device registration required' using errcode = '42501';
  end if;
  if coalesce(p_local_asset_count, 0) < 0 then
    raise exception 'Invalid Local asset count' using errcode = '22023';
  end if;

  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation, reset_at
    into v_generation, v_reset_at
    from private.organization_asset_reset_state
   where organization_id = p_organization_id;

  insert into private.organization_asset_reset_devices (
    organization_id, device_id, user_id, platform_label, last_seen_at,
    acknowledged_generation, local_asset_count, updated_at
  ) values (
    p_organization_id, p_device_id, v_actor,
    coalesce(nullif(btrim(p_platform_label), ''), 'Thiết bị'),
    clock_timestamp(), 0, greatest(coalesce(p_local_asset_count, 0), 0), clock_timestamp()
  )
  on conflict (organization_id, device_id) do update
    set user_id = excluded.user_id,
        platform_label = excluded.platform_label,
        last_seen_at = clock_timestamp(),
        local_asset_count = excluded.local_asset_count,
        updated_at = clock_timestamp();

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'generation', v_generation,
    'reset_at', v_reset_at
  );
end;
$function$;

create or replace function public.acknowledge_organization_asset_reset(
  p_organization_id uuid,
  p_device_id text,
  p_generation bigint
) returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_generation bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  if not found then
    raise exception 'Reset generation is not initialized' using errcode = 'P0002';
  end if;
  if p_generation is distinct from v_generation then
    raise exception 'Local reset generation is stale; refresh before acknowledging' using errcode = '40001';
  end if;

  update private.organization_asset_reset_devices
     set acknowledged_generation = p_generation,
         local_asset_count = 0,
         last_seen_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where organization_id = p_organization_id
     and device_id = p_device_id
     and user_id = v_actor;

  if not found then
    raise exception 'Device registration not found for this user' using errcode = 'P0002';
  end if;
  return true;
end;
$function$;

-- Service-role-only reset transaction. The request UUID makes retries idempotent.
create or replace function public.platform_reset_organization_assets(
  p_organization_id uuid,
  p_request_id uuid,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
  v_existing private.organization_asset_reset_requests;
  v_assets bigint := 0;
  v_imports bigint := 0;
  v_mutations bigint := 0;
  v_locks bigint := 0;
  v_pending_devices bigint := 0;
begin
  if p_organization_id is null or p_request_id is null or p_actor_user_id is null then
    raise exception 'Organization, request and actor are required' using errcode = '22023';
  end if;

  perform 1 from public.organizations
   where id = p_organization_id
   for update;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for update;

  select * into v_existing
    from private.organization_asset_reset_requests
   where organization_id = p_organization_id
     and request_id = p_request_id;

  if found then
    select count(*) into v_pending_devices
      from private.organization_asset_reset_devices
     where organization_id = p_organization_id
       and acknowledged_generation < v_existing.generation;
    return jsonb_build_object(
      'ok', true, 'already_applied', true,
      'organization_id', p_organization_id,
      'generation', v_existing.generation,
      'assets_deleted', v_existing.assets_deleted,
      'import_receipts_deleted', v_existing.import_receipts_deleted,
      'mutation_receipts_deleted', v_existing.mutation_receipts_deleted,
      'edit_locks_deleted', v_existing.edit_locks_deleted,
      'pending_devices', v_pending_devices
    );
  end if;

  v_generation := v_generation + 1;

  update private.organization_asset_reset_state
     set generation = v_generation,
         reset_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where organization_id = p_organization_id;

  update public.asset_activity_history
     set asset_id = null
   where organization_id = p_organization_id
     and asset_id is not null;

  update private.asset_group_change_history
     set asset_id = null
   where organization_id = p_organization_id
     and asset_id is not null;

  delete from public.asset_import_receipts
   where organization_id = p_organization_id;
  get diagnostics v_imports = row_count;

  delete from public.asset_mutation_receipts
   where organization_id = p_organization_id;
  get diagnostics v_mutations = row_count;

  delete from public.asset_edit_locks
   where organization_id = p_organization_id;
  get diagnostics v_locks = row_count;

  -- Retain reservation history and sequence counters; release only unfinished reservations.
  update private.asset_id_sequence_reservations
     set status = 'released',
         asset_id = null,
         equipment_id = null,
         released_at = clock_timestamp()
   where organization_id = p_organization_id
     and status = 'reserved';

  delete from public.assets
   where organization_id = p_organization_id;
  get diagnostics v_assets = row_count;

  insert into private.organization_asset_reset_requests (
    organization_id, request_id, generation, actor_user_id,
    assets_deleted, import_receipts_deleted, mutation_receipts_deleted, edit_locks_deleted
  ) values (
    p_organization_id, p_request_id, v_generation, p_actor_user_id,
    v_assets, v_imports, v_mutations, v_locks
  );

  select count(*) into v_pending_devices
    from private.organization_asset_reset_devices
   where organization_id = p_organization_id
     and acknowledged_generation < v_generation;

  return jsonb_build_object(
    'ok', true, 'already_applied', false,
    'organization_id', p_organization_id,
    'generation', v_generation,
    'assets_deleted', v_assets,
    'import_receipts_deleted', v_imports,
    'mutation_receipts_deleted', v_mutations,
    'edit_locks_deleted', v_locks,
    'pending_devices', v_pending_devices
  );
end;
$function$;

create or replace function public.platform_get_organization_asset_reset_status(
  p_organization_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
  v_reset_at timestamptz;
  v_assets bigint;
  v_registered bigint;
  v_acknowledged bigint;
  v_devices jsonb;
begin
  if p_organization_id is null then
    raise exception 'Organization is required' using errcode = '22023';
  end if;

  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation, reset_at
    into v_generation, v_reset_at
    from private.organization_asset_reset_state
   where organization_id = p_organization_id;

  select count(*) into v_assets
    from public.assets where organization_id = p_organization_id;
  select count(*) into v_registered
    from private.organization_asset_reset_devices where organization_id = p_organization_id;
  select count(*) into v_acknowledged
    from private.organization_asset_reset_devices
   where organization_id = p_organization_id
     and acknowledged_generation >= v_generation;

  select coalesce(jsonb_agg(jsonb_build_object(
    'device_id', device_id,
    'platform_label', platform_label,
    'last_seen_at', last_seen_at,
    'acknowledged_generation', acknowledged_generation,
    'is_pending', acknowledged_generation < v_generation
  ) order by last_seen_at desc), '[]'::jsonb)
    into v_devices
    from private.organization_asset_reset_devices
   where organization_id = p_organization_id;

  return jsonb_build_object(
    'generation', v_generation,
    'reset_at', v_reset_at,
    'cloud_assets', v_assets,
    'registered_devices', v_registered,
    'acknowledged_devices', v_acknowledged,
    'pending_devices', greatest(v_registered - v_acknowledged, 0),
    'devices', v_devices
  );
end;
$function$;

-- Generation-aware import. The shared row lock serializes import with reset.
create or replace function public.import_asset_preserving_identity(
  p_organization_id uuid, p_id uuid, p_code text, p_asset jsonb,
  p_mutation_id uuid, p_reset_generation bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
  v_result jsonb;
  v_asset jsonb;
begin
  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  if p_reset_generation is null or p_reset_generation <> v_generation then
    raise exception 'Local reset generation is stale; purge Local data before importing' using errcode = '40001';
  end if;

  v_result := private.import_asset_preserving_identity(
    p_organization_id, p_id, p_code, p_asset, p_mutation_id
  );
  v_asset := v_result->'asset';
  return (v_result-'asset') || jsonb_build_object(
    'asset', (v_asset-'id') || jsonb_build_object('asset_key', p_code)
  );
end;
$function$;

-- Generation-aware Cloud mutation. Old clients using the six-argument RPC are blocked.
create or replace function public.apply_cloud_asset_mutation_with_lock(
  p_organization_id uuid, p_asset_code text, p_lock_token uuid, p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz, p_payload jsonb, p_reset_generation bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
  v_asset_id uuid;
  v_result jsonb;
  v_asset jsonb;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission' using errcode = '42501';
  end if;

  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  if p_reset_generation is null or p_reset_generation <> v_generation then
    raise exception 'Local reset generation is stale; purge Local data before updating' using errcode = '40001';
  end if;

  select id into v_asset_id
    from public.assets
   where organization_id = p_organization_id and code = p_asset_code;
  if not found then
    raise exception 'Asset not found' using errcode = 'P0002';
  end if;

  v_result := private.apply_asset_mutation_with_lock(
    p_organization_id, v_asset_id, p_lock_token, p_mutation_id,
    p_expected_cloud_updated_at, p_payload
  );
  v_asset := v_result->'asset';
  return (v_result-'asset') || jsonb_build_object(
    'asset', (v_asset-'id') || jsonb_build_object('asset_key', p_asset_code)
  );
end;
$function$;

-- The existing soft-delete RPC remains the implementation; this wrapper adds the reset barrier.
create or replace function public.soft_delete_cloud_asset_with_lock(
  p_organization_id uuid, p_asset_code text, p_lock_token uuid, p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz, p_deleted_at timestamptz, p_reset_generation bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id, 'assets.delete') then
    raise exception 'Missing assets.delete permission' using errcode = '42501';
  end if;

  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  if p_reset_generation is null or p_reset_generation <> v_generation then
    raise exception 'Local reset generation is stale; purge Local data before deleting' using errcode = '40001';
  end if;

  return public.soft_delete_cloud_asset_with_lock(
    p_organization_id, p_asset_code, p_lock_token, p_mutation_id,
    p_expected_cloud_updated_at, p_deleted_at
  );
end;
$function$;

-- Keep delayed Local audit events from attaching to a later asset that reuses a code.
create or replace function public.record_cloud_asset_history_event(
  p_organization_id uuid, p_event_id uuid, p_asset_code text, p_event_type text,
  p_summary text, p_changes jsonb, p_actor_label text, p_occurred_at timestamptz,
  p_reset_generation bigint
) returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
begin
  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  if p_reset_generation is null or p_reset_generation <> v_generation then
    raise exception 'Local reset generation is stale; old audit event remains Local-only' using errcode = '40001';
  end if;

  return public.record_cloud_asset_history_event(
    p_organization_id, p_event_id, p_asset_code, p_event_type,
    p_summary, p_changes, p_actor_label, p_occurred_at
  );
end;
$function$;

create or replace function public.mirror_cloud_asset_group_change_history(
  p_organization_id uuid, p_asset_code text, p_changes jsonb,
  p_reset_generation bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
  v_asset_id uuid;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id, 'assets.import') then
    raise exception 'Missing assets.import permission' using errcode = '42501';
  end if;

  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  if p_reset_generation is null or p_reset_generation <> v_generation then
    raise exception 'Local reset generation is stale; old group history remains Local-only' using errcode = '40001';
  end if;

  select id into v_asset_id
    from public.assets
   where organization_id = p_organization_id and code = p_asset_code;
  if not found then
    raise exception 'Cloud asset does not exist in this organization' using errcode = 'P0002';
  end if;

  return private.mirror_asset_group_change_history(p_organization_id, v_asset_id, p_changes);
end;
$function$;

-- Internal implementation functions must not be directly callable even if a deployment exposes private schemas.
revoke all on function private.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) from public, anon, authenticated;
revoke all on function private.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function private.mirror_asset_group_change_history(uuid,uuid,jsonb) from public, anon, authenticated;

-- Remove legacy write entry points so an old browser bundle cannot bypass the barrier.
revoke all on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.apply_cloud_asset_mutation_with_lock(uuid,text,uuid,uuid,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.soft_delete_cloud_asset_with_lock(uuid,text,uuid,uuid,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.record_cloud_asset_history_event(uuid,uuid,text,text,text,jsonb,text,timestamptz) from public, anon, authenticated;
revoke all on function public.mirror_cloud_asset_group_change_history(uuid,text,jsonb) from public, anon, authenticated;

revoke all on function public.register_organization_asset_reset_device(uuid,text,text,integer) from public, anon;
revoke all on function public.acknowledge_organization_asset_reset(uuid,text,bigint) from public, anon;
revoke all on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid,bigint) from public, anon, authenticated;
revoke all on function public.apply_cloud_asset_mutation_with_lock(uuid,text,uuid,uuid,timestamptz,jsonb,bigint) from public, anon, authenticated;
revoke all on function public.soft_delete_cloud_asset_with_lock(uuid,text,uuid,uuid,timestamptz,timestamptz,bigint) from public, anon, authenticated;
revoke all on function public.record_cloud_asset_history_event(uuid,uuid,text,text,text,jsonb,text,timestamptz,bigint) from public, anon, authenticated;
revoke all on function public.mirror_cloud_asset_group_change_history(uuid,text,jsonb,bigint) from public, anon, authenticated;
revoke all on function public.platform_reset_organization_assets(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.platform_get_organization_asset_reset_status(uuid) from public, anon, authenticated;

grant execute on function public.register_organization_asset_reset_device(uuid,text,text,integer) to authenticated;
grant execute on function public.acknowledge_organization_asset_reset(uuid,text,bigint) to authenticated;
grant execute on function public.platform_reset_organization_assets(uuid,uuid,uuid) to service_role;
grant execute on function public.platform_get_organization_asset_reset_status(uuid) to service_role;

grant execute on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid,bigint) to authenticated;
grant execute on function public.apply_cloud_asset_mutation_with_lock(uuid,text,uuid,uuid,timestamptz,jsonb,bigint) to authenticated;
grant execute on function public.soft_delete_cloud_asset_with_lock(uuid,text,uuid,uuid,timestamptz,timestamptz,bigint) to authenticated;
grant execute on function public.record_cloud_asset_history_event(uuid,uuid,text,text,text,jsonb,text,timestamptz,bigint) to authenticated;
grant execute on function public.mirror_cloud_asset_group_change_history(uuid,text,jsonb,bigint) to authenticated;

commit;
