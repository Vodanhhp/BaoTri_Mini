begin;

-- Independent monotonic generation for maintenance requests and their audit history.
alter table private.organization_asset_reset_state
  add column if not exists maintenance_generation bigint not null default 0
  check (maintenance_generation >= 0);

alter table private.organization_asset_reset_devices
  add column if not exists acknowledged_maintenance_generation bigint not null default 0
  check (acknowledged_maintenance_generation >= 0);

-- A successful approved reset writes exactly one idempotency receipt. Bump the
-- maintenance generation from that receipt, so retries cannot bump it twice.
create or replace function private.bump_maintenance_reset_generation()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_reset_selected boolean;
begin
  select coalesce(r.reset_maintenance_requests, false)
    into v_reset_selected
    from private.organization_asset_reset_approval_requests r
   where r.organization_id = new.organization_id
     and r.request_id = new.request_id;

  if coalesce(v_reset_selected, false) then
    update private.organization_asset_reset_state
       set maintenance_generation = maintenance_generation + 1,
           updated_at = clock_timestamp()
     where organization_id = new.organization_id;
  end if;
  return new;
end;
$function$;

revoke all on function private.bump_maintenance_reset_generation() from public, anon, authenticated;

drop trigger if exists organization_asset_reset_maintenance_generation
  on private.organization_asset_reset_requests;
create trigger organization_asset_reset_maintenance_generation
after insert on private.organization_asset_reset_requests
for each row execute function private.bump_maintenance_reset_generation();

-- Return all independent reset generations to each registered browser/device.
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
  v_asset_generation bigint;
  v_inventory_generation bigint;
  v_checklist_generation bigint;
  v_maintenance_generation bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_device_id), '') is null or char_length(p_device_id) > 160 then
    raise exception 'Invalid device identifier' using errcode = '22023';
  end if;
  if not coalesce(private.is_org_member(p_organization_id), false)
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

  select generation, inventory_generation, checklist_generation, maintenance_generation
    into v_asset_generation, v_inventory_generation, v_checklist_generation, v_maintenance_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  insert into private.organization_asset_reset_devices (
    organization_id, device_id, user_id, platform_label, last_seen_at,
    local_asset_count, updated_at
  ) values (
    p_organization_id, p_device_id, v_actor,
    coalesce(nullif(btrim(p_platform_label), ''), 'Thiết bị'),
    clock_timestamp(), greatest(coalesce(p_local_asset_count, 0), 0), clock_timestamp()
  )
  on conflict (organization_id, device_id) do update
    set user_id = excluded.user_id,
        platform_label = excluded.platform_label,
        last_seen_at = clock_timestamp(),
        local_asset_count = excluded.local_asset_count,
        updated_at = clock_timestamp();

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'generation', v_asset_generation,
    'inventory_generation', v_inventory_generation,
    'checklist_generation', v_checklist_generation,
    'maintenance_generation', v_maintenance_generation
  );
end;
$function$;

-- New clients acknowledge all reset domains. Keep the older five-argument
-- overload for compatibility with pre-existing equipment/inventory/checklist clients.
create or replace function public.acknowledge_organization_asset_reset(
  p_organization_id uuid,
  p_device_id text,
  p_generation bigint,
  p_inventory_generation bigint,
  p_checklist_generation bigint,
  p_maintenance_generation bigint
) returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_asset bigint;
  v_inventory bigint;
  v_checklist bigint;
  v_maintenance bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select generation, inventory_generation, checklist_generation, maintenance_generation
    into v_asset, v_inventory, v_checklist, v_maintenance
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;

  if not found then
    raise exception 'Reset generation is not initialized' using errcode = 'P0002';
  end if;
  if p_generation is distinct from v_asset
     or p_inventory_generation is distinct from v_inventory
     or p_checklist_generation is distinct from v_checklist
     or p_maintenance_generation is distinct from v_maintenance then
    raise exception 'Local reset generation is stale; refresh before acknowledging' using errcode = '40001';
  end if;

  update private.organization_asset_reset_devices
     set acknowledged_generation = p_generation,
         acknowledged_inventory_generation = p_inventory_generation,
         acknowledged_checklist_generation = p_checklist_generation,
         acknowledged_maintenance_generation = p_maintenance_generation,
         local_asset_count = case when p_generation > acknowledged_generation then 0 else local_asset_count end,
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

revoke all on function public.acknowledge_organization_asset_reset(uuid,text,bigint,bigint,bigint,bigint) from public, anon;
grant execute on function public.acknowledge_organization_asset_reset(uuid,text,bigint,bigint,bigint,bigint) to authenticated;

-- Generation check used by versioned request writes and legacy-import barriers.
create or replace function private.assert_maintenance_reset_generation(
  p_organization_id uuid,
  p_expected_generation bigint
) returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_generation bigint;
begin
  if v_actor is null or not coalesce(private.is_org_member(p_organization_id), false) then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;
  select maintenance_generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for share;
  if not found then v_generation := 0; end if;
  if p_expected_generation is distinct from v_generation then
    raise exception 'Dữ liệu Phiếu yêu cầu Local đã cũ sau Reset. Hãy tải lại BAOTRI Mini trước khi tiếp tục.' using errcode = '40001';
  end if;
end;
$function$;

revoke all on function private.assert_maintenance_reset_generation(uuid,bigint) from public, anon;
grant execute on function private.assert_maintenance_reset_generation(uuid,bigint) to authenticated;

-- The legacy three-argument RPC is fail-closed after the first request Reset.
-- Current clients use the versioned RPC below and must present the current generation.
create or replace function public.maintenance_save_request(
  p_organization_id uuid,
  p_request_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $function$
begin
  perform private.assert_maintenance_reset_generation(p_organization_id, 0);
  return private.save_maintenance_request(p_organization_id, p_request_id, p_payload);
end;
$function$;

create or replace function public.maintenance_save_request_v2(
  p_organization_id uuid,
  p_request_id uuid,
  p_payload jsonb,
  p_reset_generation bigint
) returns jsonb
language plpgsql
set search_path = ''
as $function$
begin
  perform private.assert_maintenance_reset_generation(p_organization_id, p_reset_generation);
  return private.save_maintenance_request(p_organization_id, p_request_id, p_payload);
end;
$function$;

revoke all on function public.maintenance_save_request_v2(uuid,uuid,jsonb,bigint) from public, anon;
grant execute on function public.maintenance_save_request_v2(uuid,uuid,jsonb,bigint) to authenticated;

-- Old clients must not be able to re-import orphaned audit rows after a Reset.
create or replace function public.maintenance_import_legacy_history(
  p_organization_id uuid,
  p_events jsonb
) returns integer
language plpgsql
set search_path = ''
as $function$
begin
  perform private.assert_maintenance_reset_generation(p_organization_id, 0);
  return private.import_maintenance_history(p_organization_id, p_events);
end;
$function$;

commit;
