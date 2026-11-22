-- Preserve existing Smart ID reservations across tenant Plan transitions.
-- New reservations remain serialized with Plan approval; retries reuse the
-- originally issued reservation and its original Plan/components.
begin;

-- Retain the catalog version that governed each newly issued reservation so
-- retries after a Plan transition preserve the original issuance metadata.
alter table private.asset_id_sequence_reservations
  add column if not exists source_data_version text;

create or replace function public.reserve_asset_id_sequence(
  p_organization_id uuid, p_reservation_id uuid, p_equipment_code text,
  p_group_code text default null, p_site_code text default null, p_commissioned_at date default null
)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off
as $function$
declare
  v_plan text; v_snapshot jsonb; v_source_version text; v_equipment_code text;
  v_group_code text; v_site_code text; v_group jsonb; v_dictionary_entry jsonb;
  v_available_plan text; v_plan_rank integer; v_available_rank integer;
  v_sequence bigint; v_existing private.asset_id_sequence_reservations;
  v_asset_count bigint; v_month_year text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.has_org_permission(p_organization_id, 'assets.create') then
    raise exception 'Missing assets.create permission for this organization' using errcode = '42501';
  end if;
  if p_reservation_id is null then raise exception 'Reservation ID is required' using errcode = '22023'; end if;
  v_equipment_code := regexp_replace(upper(coalesce(p_equipment_code, '')), '[^A-Z0-9]', '', 'g');
  if v_equipment_code !~ '^[A-Z0-9]{2,4}$' then
    raise exception 'Equipment short code must contain 2 to 4 letters/digits' using errcode = '22023';
  end if;

  -- Retry an existing reservation against the Plan and components under
  -- which it was originally issued. A later Plan transition must not invalidate
  -- a previously reserved ID or cause a second sequence to be allocated.
  select * into v_existing
  from private.asset_id_sequence_reservations r
  where r.organization_id = p_organization_id
    and r.reservation_id = p_reservation_id
  for update;
  if found then
    if v_existing.actor_user_id <> auth.uid()
      or v_existing.equipment_code <> v_equipment_code
      or v_existing.status = 'released' then
      raise exception 'Reservation ID already exists with different or released details' using errcode = '23505';
    end if;

    -- A retry may come from a form loaded under a newer Plan. Compare only
    -- original components that the caller actually supplied; never require
    -- fields that the current Plan no longer asks the user to enter.
    if v_existing.plan_code in ('B','C','D')
      and nullif(btrim(p_group_code), '') is not null
      and v_existing.group_code <> regexp_replace(upper(p_group_code), '[^A-Z0-9]', '', 'g') then
      raise exception 'Reservation ID already exists with a different original group code' using errcode = '23505';
    end if;
    if v_existing.plan_code in ('C','D') then
      if nullif(btrim(p_site_code), '') is not null
        and v_existing.site_code <> regexp_replace(upper(p_site_code), '[^A-Z0-9]', '', 'g') then
        raise exception 'Reservation ID already exists with a different original site code' using errcode = '23505';
      end if;
      if p_commissioned_at is not null
        and v_existing.month_year is distinct from to_char(p_commissioned_at, 'MMYY') then
        raise exception 'Reservation ID already exists with a different original commissioning date' using errcode = '23505';
      end if;
    end if;

    select c.source_data_version into v_source_version
    from public.organization_equipment_catalog c
    where c.organization_id = p_organization_id;
    if v_source_version is null then
      raise exception 'Organization catalog snapshot is unavailable for reservation retry' using errcode = '55000';
    end if;

    return jsonb_build_object('reservation_id',v_existing.reservation_id,'plan_code',v_existing.plan_code,
      'sequence',v_existing.sequence_value,'equipment_code',v_existing.equipment_code,
      'group_code',nullif(v_existing.group_code,''),'site_code',nullif(v_existing.site_code,''),
      'month_year',v_existing.month_year,'source_data_version',coalesce(v_existing.source_data_version,v_source_version),'status',v_existing.status);
  end if;

  -- Serialize new reservations with Plan changes. The approval RPC locks this
  -- same tenant catalog row before applying a new Plan, so a new reservation
  -- cannot allocate under the old Plan after the new Plan becomes effective.
  select c.plan_code, c.snapshot, c.source_data_version into v_plan, v_snapshot, v_source_version
  from public.organization_equipment_catalog c
  where c.organization_id = p_organization_id
  for update;
  if not found then raise exception 'Organization catalog snapshot and Plan have not been initialized' using errcode = '22023'; end if;

  select d into v_dictionary_entry from jsonb_array_elements(v_snapshot -> 'equipmentDictionary') d
  where regexp_replace(upper(coalesce(d ->> 'shortCode', '')), '[^A-Z0-9]', '', 'g') = v_equipment_code limit 1;
  if v_dictionary_entry is null then raise exception 'Equipment short code is not present in this Organization catalog snapshot' using errcode = '22023'; end if;

  v_plan_rank := case v_plan when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 0 end;
  if v_plan_rank = 0 then raise exception 'Invalid Organization Plan' using errcode = '22023'; end if;

  if v_plan = 'A' then
    v_group_code := ''; v_site_code := '';
  else
    v_group_code := regexp_replace(upper(coalesce(p_group_code, '')), '[^A-Z0-9]', '', 'g');
    if v_group_code !~ '^[A-Z0-9]{2,4}$' then raise exception 'Plan B/C/D requires a valid 2–4 character group code' using errcode = '22023'; end if;
    select g into v_group from jsonb_array_elements(v_snapshot -> 'equipmentGroups') g
    where regexp_replace(upper(coalesce(g ->> 'code', '')), '[^A-Z0-9]', '', 'g') = v_group_code limit 1;
    if v_group is null then raise exception 'Selected group code is not present in this Organization catalog snapshot' using errcode = '22023'; end if;
    v_available_plan := coalesce(nullif(v_group ->> 'availableFromPlan', ''), 'B');
    v_available_rank := case v_available_plan when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 99 end;
    if v_available_rank > v_plan_rank then raise exception 'Selected group is not available on this Organization Plan' using errcode = '42501'; end if;
    if v_plan in ('C','D') then
      v_site_code := coalesce(nullif(btrim(p_site_code), ''), '00');
      if v_site_code !~ '^[0-9]{2}$' then raise exception 'Plan C/D requires a two-digit site code' using errcode = '22023'; end if;
      if p_commissioned_at is null then raise exception 'Plan C/D requires a confirmed commissioning date' using errcode = '22023'; end if;
    else v_site_code := ''; end if;
  end if;
  v_month_year := case when v_plan in ('C','D') then to_char(p_commissioned_at, 'MMYY') else null end;

  -- Recheck after acquiring the catalog row lock: another request may have
  -- created this reservation while this transaction was waiting. Validate it
  -- against its original Plan, not whichever Plan became current in the meantime.
  select * into v_existing from private.asset_id_sequence_reservations r
  where r.organization_id = p_organization_id and r.reservation_id = p_reservation_id
  for update;
  if found then
    if v_existing.actor_user_id <> auth.uid()
      or v_existing.equipment_code <> v_equipment_code
      or v_existing.status = 'released' then
      raise exception 'Reservation ID already exists with different or released details' using errcode = '23505';
    end if;
    -- A retry may come from a form loaded under a newer Plan. Compare only
    -- original components that the caller actually supplied; never require
    -- fields that the current Plan no longer asks the user to enter.
    if v_existing.plan_code in ('B','C','D')
      and nullif(btrim(p_group_code), '') is not null
      and v_existing.group_code <> regexp_replace(upper(p_group_code), '[^A-Z0-9]', '', 'g') then
      raise exception 'Reservation ID already exists with a different original group code' using errcode = '23505';
    end if;
    if v_existing.plan_code in ('C','D') then
      if nullif(btrim(p_site_code), '') is not null
        and v_existing.site_code <> regexp_replace(upper(p_site_code), '[^A-Z0-9]', '', 'g') then
        raise exception 'Reservation ID already exists with a different original site code' using errcode = '23505';
      end if;
      if p_commissioned_at is not null
        and v_existing.month_year is distinct from to_char(p_commissioned_at, 'MMYY') then
        raise exception 'Reservation ID already exists with a different original commissioning date' using errcode = '23505';
      end if;
    end if;
    return jsonb_build_object('reservation_id',v_existing.reservation_id,'plan_code',v_existing.plan_code,
      'sequence',v_existing.sequence_value,'equipment_code',v_existing.equipment_code,
      'group_code',nullif(v_existing.group_code,''),'site_code',nullif(v_existing.site_code,''),
      'month_year',v_existing.month_year,'source_data_version',coalesce(v_existing.source_data_version,v_source_version),'status',v_existing.status);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));
  select count(*) into v_asset_count from public.assets a where a.organization_id = p_organization_id;
  v_asset_count := v_asset_count + (
    select count(*) from private.asset_id_sequence_reservations r
    where r.organization_id = p_organization_id and r.status in ('reserved','confirmed')
      and (r.asset_id is null or not exists (
        select 1 from public.assets a where a.organization_id = r.organization_id and a.id = r.asset_id
      ))
  );
  if (v_plan = 'A' and v_asset_count >= 200) or (v_plan = 'B' and v_asset_count >= 500)
    or (v_plan = 'C' and v_asset_count >= 1000) then
    raise exception 'Organization has reached the equipment capacity of Plan %', v_plan using errcode = '22023';
  end if;

  insert into private.asset_id_sequences(organization_id,plan_code,equipment_code,group_code,site_code,last_value)
  values(p_organization_id,v_plan,v_equipment_code,v_group_code,v_site_code,1)
  on conflict(organization_id,plan_code,equipment_code,group_code,site_code)
  do update set last_value=private.asset_id_sequences.last_value+1,updated_at=now()
  returning last_value into v_sequence;

  insert into private.asset_id_sequence_reservations(
    organization_id,reservation_id,actor_user_id,plan_code,equipment_code,group_code,site_code,sequence_value,month_year,source_data_version
  ) values(p_organization_id,p_reservation_id,auth.uid(),v_plan,v_equipment_code,v_group_code,v_site_code,v_sequence,v_month_year,v_source_version);

  return jsonb_build_object('reservation_id',p_reservation_id,'plan_code',v_plan,'sequence',v_sequence,
    'equipment_code',v_equipment_code,'group_code',nullif(v_group_code,''),'site_code',nullif(v_site_code,''),
    'month_year',v_month_year,'source_data_version',v_source_version,'status','reserved');
end;
$function$;


commit;
