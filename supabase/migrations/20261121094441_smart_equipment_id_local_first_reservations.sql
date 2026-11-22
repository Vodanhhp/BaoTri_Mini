-- Correct Smart Equipment ID allocation to preserve Local-first ownership.
-- Cloud reserves only a numeric sequence; Local constructs and records the final ID.

begin;
drop function if exists public.create_asset_with_smart_id(uuid,text,text,text,text,text,text,date,uuid,text,jsonb);

create table if not exists private.asset_id_sequence_reservations (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  reservation_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  plan_code text not null check (plan_code in ('A','B','C','D')),
  equipment_code text not null check (equipment_code ~ '^[A-Z0-9]{2,4}$'),
  group_code text not null default '',
  site_code text not null default '',
  sequence_value bigint not null check (sequence_value >= 1),
  month_year text,
  status text not null default 'reserved' check (status in ('reserved','confirmed','released')),
  asset_id uuid,
  equipment_id text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  released_at timestamptz,
  primary key (organization_id, reservation_id),
  unique (organization_id, plan_code, equipment_code, group_code, site_code, sequence_value),
  check (group_code = '' or group_code ~ '^[A-Z0-9]{2,4}$'),
  check (site_code = '' or site_code ~ '^[0-9]{2}$'),
  check (
    (status = 'reserved' and asset_id is null and equipment_id is null and confirmed_at is null)
    or (status = 'confirmed' and asset_id is not null and equipment_id is not null and confirmed_at is not null)
    or (status = 'released' and asset_id is null and equipment_id is null and released_at is not null)
  )
);
create unique index if not exists asset_id_sequence_reservations_equipment_id_unique
on private.asset_id_sequence_reservations (organization_id, equipment_id)
where equipment_id is not null;
alter table private.asset_id_sequence_reservations enable row level security;
revoke all on table private.asset_id_sequence_reservations from public, anon, authenticated;

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

  -- Serialize ID reservations with Plan changes. The approval RPC locks this
  -- same tenant catalog row before applying a new Plan, so a reservation can
  -- never allocate under the old Plan after the new Plan becomes effective.
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

  select * into v_existing from private.asset_id_sequence_reservations r
  where r.organization_id = p_organization_id and r.reservation_id = p_reservation_id;
  if found then
    if v_existing.actor_user_id <> auth.uid() or v_existing.plan_code <> v_plan
      or v_existing.equipment_code <> v_equipment_code or v_existing.group_code <> v_group_code
      or v_existing.site_code <> v_site_code or v_existing.month_year is distinct from v_month_year
      or v_existing.status = 'released' then
      raise exception 'Reservation ID already exists with different or released details' using errcode = '23505';
    end if;
    return jsonb_build_object('reservation_id',v_existing.reservation_id,'plan_code',v_existing.plan_code,
      'sequence',v_existing.sequence_value,'equipment_code',v_existing.equipment_code,
      'group_code',nullif(v_existing.group_code,''),'site_code',nullif(v_existing.site_code,''),
      'month_year',v_existing.month_year,'source_data_version',v_source_version,'status',v_existing.status);
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
    organization_id,reservation_id,actor_user_id,plan_code,equipment_code,group_code,site_code,sequence_value,month_year
  ) values(p_organization_id,p_reservation_id,auth.uid(),v_plan,v_equipment_code,v_group_code,v_site_code,v_sequence,v_month_year);

  return jsonb_build_object('reservation_id',p_reservation_id,'plan_code',v_plan,'sequence',v_sequence,
    'equipment_code',v_equipment_code,'group_code',nullif(v_group_code,''),'site_code',nullif(v_site_code,''),
    'month_year',v_month_year,'source_data_version',v_source_version,'status','reserved');
end;
$function$;

create or replace function public.confirm_asset_id_sequence_reservation(
  p_organization_id uuid,p_reservation_id uuid,p_asset_id uuid,p_equipment_id text
)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off
as $function$
declare v_reservation private.asset_id_sequence_reservations; v_sequence_text text; v_expected_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.has_org_permission(p_organization_id,'assets.create') then
    raise exception 'Missing assets.create permission for this organization' using errcode = '42501';
  end if;
  if p_asset_id is null or nullif(btrim(p_equipment_id),'') is null then
    raise exception 'Local asset UUID and generated equipment ID are required' using errcode = '22023';
  end if;
  select * into v_reservation from private.asset_id_sequence_reservations r
  where r.organization_id=p_organization_id and r.reservation_id=p_reservation_id for update;
  if not found or v_reservation.actor_user_id<>auth.uid() then raise exception 'Reservation not found for this user' using errcode = '42501'; end if;
  if v_reservation.status='released' then raise exception 'Reservation has been released' using errcode = '22023'; end if;

  v_sequence_text := case when length(v_reservation.sequence_value::text)<3
    then lpad(v_reservation.sequence_value::text,3,'0') else v_reservation.sequence_value::text end;
  v_expected_code := case
    when v_reservation.plan_code='A' then v_reservation.equipment_code||'-'||v_sequence_text
    when v_reservation.plan_code='B' then v_reservation.equipment_code||'-'||v_reservation.group_code||'-'||v_sequence_text
    else v_reservation.equipment_code||'-'||v_reservation.group_code||'-'||v_reservation.site_code||'-'||v_sequence_text||'-'||v_reservation.month_year end;
  if btrim(p_equipment_id)<>v_expected_code then raise exception 'Local equipment ID does not match the reserved sequence components' using errcode = '23514'; end if;
  if exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.code=v_expected_code and a.id<>p_asset_id) then
    raise exception 'Equipment ID already exists in this Organization' using errcode = '23505';
  end if;
  if v_reservation.status='confirmed' then
    if v_reservation.asset_id<>p_asset_id or v_reservation.equipment_id<>v_expected_code then
      raise exception 'Confirmed reservation cannot be reassigned' using errcode = '23514';
    end if;
  else
    update private.asset_id_sequence_reservations set status='confirmed',asset_id=p_asset_id,equipment_id=v_expected_code,confirmed_at=now()
    where organization_id=p_organization_id and reservation_id=p_reservation_id;
  end if;
  return jsonb_build_object('reservation_id',p_reservation_id,'status','confirmed');
end;
$function$;

create or replace function public.release_asset_id_sequence_reservation(p_organization_id uuid,p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off
as $function$
declare v_reservation private.asset_id_sequence_reservations;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.has_org_permission(p_organization_id,'assets.create') then
    raise exception 'Missing assets.create permission for this organization' using errcode = '42501';
  end if;
  select * into v_reservation from private.asset_id_sequence_reservations r
  where r.organization_id=p_organization_id and r.reservation_id=p_reservation_id for update;
  if not found then return jsonb_build_object('reservation_id',p_reservation_id,'status','not_found'); end if;
  if v_reservation.actor_user_id<>auth.uid() and not private.has_org_permission(p_organization_id,'settings.manage') then
    raise exception 'Only the reserving user or an Admin may release this reservation' using errcode = '42501';
  end if;
  if v_reservation.status='confirmed' then raise exception 'Confirmed reservation cannot be released or reused' using errcode = '23514'; end if;
  update private.asset_id_sequence_reservations set status='released',released_at=now()
  where organization_id=p_organization_id and reservation_id=p_reservation_id;
  return jsonb_build_object('reservation_id',p_reservation_id,'status','released');
end;
$function$;

revoke all on function public.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) from public,anon;
revoke all on function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text) from public,anon;
revoke all on function public.release_asset_id_sequence_reservation(uuid,uuid) from public,anon;
grant execute on function public.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) to authenticated;
grant execute on function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.release_asset_id_sequence_reservation(uuid,uuid) to authenticated;

comment on function public.reserve_asset_id_sequence(uuid,uuid,text,text,text,date) is
  'Reserves only a numeric sequence for Local to construct its own equipment ID; never creates an asset or returns a completed ID.';
comment on function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text) is
  'Confirms that Local saved an equipment ID matching its previously reserved sequence; never creates or updates an asset.';
comment on function public.release_asset_id_sequence_reservation(uuid,uuid) is
  'Releases an unused sequence reservation; the numeric sequence is never reused.';

commit;