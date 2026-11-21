-- Smart Equipment ID Engine v1
-- Adds organization-scoped catalog snapshots, immutable asset identity metadata,
-- and an atomic Plan A/B/C/D ID allocator. Existing code-generation RPC remains intact.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.organization_equipment_catalog (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  plan_code text not null check (plan_code in ('A','B','C','D')),
  source_data_version text not null,
  snapshot jsonb not null,
  initialized_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  constraint organization_equipment_catalog_snapshot_object
    check (jsonb_typeof(snapshot) = 'object'),
  constraint organization_equipment_catalog_groups_array
    check (jsonb_typeof(snapshot -> 'equipmentGroups') = 'array'),
  constraint organization_equipment_catalog_dictionary_array
    check (jsonb_typeof(snapshot -> 'equipmentDictionary') = 'array')
);

alter table public.organization_equipment_catalog enable row level security;

revoke all on table public.organization_equipment_catalog from public, anon, authenticated;
grant select on table public.organization_equipment_catalog to authenticated;
grant update (snapshot, updated_at) on table public.organization_equipment_catalog to authenticated;

create policy organization_equipment_catalog_select
on public.organization_equipment_catalog
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'settings.view')
  or public.has_org_permission(organization_id, 'assets.create')
);

create policy organization_equipment_catalog_update
on public.organization_equipment_catalog
for update
to authenticated
using (public.has_org_permission(organization_id, 'settings.manage'))
with check (public.has_org_permission(organization_id, 'settings.manage'));

comment on table public.organization_equipment_catalog is
  'Organization-owned immutable-version catalog snapshot plus tenant-only custom additions. The plan is provisioned by trusted platform operations and cannot be changed through the client Data API.';

create table if not exists private.asset_id_sequences (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_code text not null check (plan_code in ('A','B','C','D')),
  equipment_code text not null check (equipment_code ~ '^[A-Z0-9]{2,4}$'),
  group_code text not null default '',
  site_code text not null default '',
  last_value bigint not null check (last_value >= 1),
  updated_at timestamptz not null default now(),
  primary key (organization_id, plan_code, equipment_code, group_code, site_code),
  check (group_code = '' or group_code ~ '^[A-Z0-9]{2,4}$'),
  check (site_code = '' or site_code ~ '^[0-9]{2}$')
);

alter table private.asset_id_sequences enable row level security;
revoke all on table private.asset_id_sequences from public, anon, authenticated;

alter table public.assets
  add column if not exists original_name text,
  add column if not exists normalized_name_at_creation text,
  add column if not exists equipment_type_code text,
  add column if not exists group_code_at_creation text,
  add column if not exists site_code_at_creation text,
  add column if not exists id_components_snapshot jsonb;

comment on column public.assets.id is
  'Immutable equipment UUID / technical identity. Existing UUID primary key is reused; no duplicate UUID column is created.';
comment on column public.assets.code is
  'Immutable business equipment ID after the asset record is created.';
comment on column public.assets.original_name is
  'Original user-entered name captured at the time the equipment ID is issued; does not change with later display-name edits.';
comment on column public.assets.normalized_name_at_creation is
  'Normalized/standardized name used by the ID engine at issuance; historical value only.';
comment on column public.assets.equipment_type_code is
  'Equipment dictionary short code used when the business ID was issued.';
comment on column public.assets.group_code_at_creation is
  'Group code used when the business ID was issued; remains unchanged if the current group changes.';
comment on column public.assets.site_code_at_creation is
  'Site code used when the business ID was issued; historical value only.';
comment on column public.assets.id_components_snapshot is
  'Immutable snapshot of Plan and code components used to issue the business equipment ID.';

create or replace function public.guard_asset_identity_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id then
    raise exception 'Equipment UUID is immutable' using errcode = '23514';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Equipment organization is immutable' using errcode = '23514';
  end if;

  if new.code is distinct from old.code then
    raise exception 'Equipment ID is immutable after creation' using errcode = '23514';
  end if;

  if new.original_name is distinct from old.original_name
    or new.normalized_name_at_creation is distinct from old.normalized_name_at_creation
    or new.equipment_type_code is distinct from old.equipment_type_code
    or new.group_code_at_creation is distinct from old.group_code_at_creation
    or new.site_code_at_creation is distinct from old.site_code_at_creation
    or new.id_components_snapshot is distinct from old.id_components_snapshot then
    raise exception 'Equipment ID issuance metadata is immutable' using errcode = '23514';
  end if;

  if new.category is distinct from old.category
    and not public.has_org_permission(old.organization_id, 'settings.manage') then
    raise exception 'Only an organization Admin may change the current equipment group' using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_asset_identity_fields() from public, anon, authenticated;

drop trigger if exists assets_guard_identity_fields on public.assets;
create trigger assets_guard_identity_fields
before update on public.assets
for each row execute function public.guard_asset_identity_fields();

create or replace function public.create_asset_with_smart_id(
  p_organization_id uuid,
  p_name text,
  p_category text,
  p_equipment_code text,
  p_normalized_name_at_creation text,
  p_group_code text default null,
  p_site_code text default null,
  p_commissioned_at date default null,
  p_id uuid default null,
  p_original_name text default null,
  p_asset_data jsonb default '{}'::jsonb
)
returns public.assets
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_plan text;
  v_snapshot jsonb;
  v_source_version text;
  v_equipment_code text;
  v_group_code text;
  v_site_code text;
  v_group jsonb;
  v_dictionary_entry jsonb;
  v_available_plan text;
  v_plan_rank integer;
  v_available_rank integer;
  v_sequence bigint;
  v_sequence_text text;
  v_month_year text;
  v_code text;
  v_id uuid;
  v_asset public.assets;
  v_asset_data jsonb := coalesce(p_asset_data, '{}'::jsonb);
  v_asset_count bigint;
  v_components jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_org_permission(p_organization_id, 'assets.create') then
    raise exception 'Missing assets.create permission for this organization' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null or nullif(btrim(p_category), '') is null then
    raise exception 'Equipment name and current group are required' using errcode = '22023';
  end if;

  if jsonb_typeof(v_asset_data) <> 'object' then
    raise exception 'Asset data must be a JSON object' using errcode = '22023';
  end if;

  v_equipment_code := regexp_replace(upper(coalesce(p_equipment_code, '')), '[^A-Z0-9]', '', 'g');
  if v_equipment_code !~ '^[A-Z0-9]{2,4}$' then
    raise exception 'Equipment short code must contain 2 to 4 letters/digits' using errcode = '22023';
  end if;

  if nullif(btrim(p_normalized_name_at_creation), '') is null then
    raise exception 'Normalized name at ID creation is required' using errcode = '22023';
  end if;

  select c.plan_code, c.snapshot, c.source_data_version
    into v_plan, v_snapshot, v_source_version
  from public.organization_equipment_catalog as c
  where c.organization_id = p_organization_id;

  if not found then
    raise exception 'Organization catalog snapshot and Plan have not been initialized' using errcode = '22023';
  end if;

  select d
    into v_dictionary_entry
  from jsonb_array_elements(v_snapshot -> 'equipmentDictionary') as d
  where regexp_replace(upper(coalesce(d ->> 'shortCode', '')), '[^A-Z0-9]', '', 'g') = v_equipment_code
  limit 1;

  if v_dictionary_entry is null then
    raise exception 'Equipment short code is not present in this Organization catalog snapshot' using errcode = '22023';
  end if;

  v_plan_rank := case v_plan when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 0 end;
  if v_plan_rank = 0 then
    raise exception 'Invalid Organization Plan' using errcode = '22023';
  end if;

  if v_plan = 'A' then
    -- Plan A has no group-management feature and its ID contains no group segment.
    v_group_code := '';
    v_site_code := '';
  else
    v_group_code := regexp_replace(upper(coalesce(p_group_code, '')), '[^A-Z0-9]', '', 'g');
    if v_group_code !~ '^[A-Z0-9]{2,4}$' then
      raise exception 'Plan B/C/D requires a valid 2–4 character group code' using errcode = '22023';
    end if;

    select g
      into v_group
    from jsonb_array_elements(v_snapshot -> 'equipmentGroups') as g
    where upper(coalesce(g ->> 'code', '')) = v_group_code
    limit 1;

    if v_group is null then
      raise exception 'Selected group code is not present in this Organization catalog snapshot' using errcode = '22023';
    end if;

    v_available_plan := coalesce(nullif(v_group ->> 'availableFromPlan', ''), 'B');
    v_available_rank := case v_available_plan when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 99 end;
    if v_available_rank > v_plan_rank then
      raise exception 'Selected group is not available on this Organization Plan' using errcode = '42501';
    end if;

    if v_plan in ('C','D') then
      v_site_code := coalesce(nullif(btrim(p_site_code), ''), '00');
      if v_site_code !~ '^[0-9]{2}$' then
        raise exception 'Plan C/D requires a two-digit site code' using errcode = '22023';
      end if;
      if p_commissioned_at is null then
        raise exception 'Plan C/D requires a confirmed commissioning date' using errcode = '22023';
      end if;
    else
      v_site_code := '';
    end if;
  end if;

  -- Serialize capacity checks for this Organization across all equipment code families.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));

  select count(*) into v_asset_count
  from public.assets as a
  where a.organization_id = p_organization_id;

  if (v_plan = 'A' and v_asset_count >= 200)
    or (v_plan = 'B' and v_asset_count >= 500)
    or (v_plan = 'C' and v_asset_count >= 1000) then
    raise exception 'Organization has reached the equipment capacity of Plan %', v_plan using errcode = '22023';
  end if;

  v_id := coalesce(p_id, gen_random_uuid());
  v_month_year := case when v_plan in ('C','D') then to_char(p_commissioned_at, 'MMYY') else null end;

  loop
    insert into private.asset_id_sequences (
      organization_id, plan_code, equipment_code, group_code, site_code, last_value
    )
    values (
      p_organization_id, v_plan, v_equipment_code, v_group_code, v_site_code, 1
    )
    on conflict (organization_id, plan_code, equipment_code, group_code, site_code)
    do update set
      last_value = private.asset_id_sequences.last_value + 1,
      updated_at = now()
    returning last_value into v_sequence;

    v_sequence_text := case
      when length(v_sequence::text) < 3 then lpad(v_sequence::text, 3, '0')
      else v_sequence::text
    end;

    v_code := case
      when v_plan = 'A' then v_equipment_code || '-' || v_sequence_text
      when v_plan = 'B' then v_equipment_code || '-' || v_group_code || '-' || v_sequence_text
      else v_equipment_code || '-' || v_group_code || '-' || v_site_code || '-' || v_sequence_text || '-' || v_month_year
    end;

    exit when not exists (
      select 1 from public.assets a
      where a.organization_id = p_organization_id and a.code = v_code
    );
  end loop;

  v_components := jsonb_build_object(
    'plan', v_plan,
    'equipment_code', v_equipment_code,
    'group_code', nullif(v_group_code, ''),
    'site_code', nullif(v_site_code, ''),
    'sequence', v_sequence,
    'month_year', v_month_year,
    'standard_equipment_name', v_dictionary_entry ->> 'standardName',
    'group_name_at_creation', v_group ->> 'name',
    'source_data_version', v_source_version,
    'issued_at', now()
  );

  insert into public.assets (
    id, organization_id, code, name, category,
    brand, model, serial, location, commissioned_at, power, cycle, cycle_started_at,
    transferred_from_other_facility, status, notes,
    created_by_user_id, created_by_label,
    original_name, normalized_name_at_creation, equipment_type_code,
    group_code_at_creation, site_code_at_creation, id_components_snapshot
  ) values (
    v_id, p_organization_id, v_code, btrim(p_name), btrim(p_category),
    coalesce(v_asset_data ->> 'brand', ''),
    coalesce(v_asset_data ->> 'model', ''),
    coalesce(v_asset_data ->> 'serial', ''),
    coalesce(v_asset_data ->> 'location', ''),
    p_commissioned_at,
    coalesce(v_asset_data ->> 'power', ''),
    coalesce(v_asset_data ->> 'cycle', ''),
    nullif(v_asset_data ->> 'cycle_started_at', '')::date,
    coalesce((v_asset_data ->> 'transferred_from_other_facility')::boolean, false),
    coalesce(nullif(v_asset_data ->> 'status', ''), 'Đang hoạt động'),
    coalesce(v_asset_data ->> 'notes', ''),
    auth.uid(),
    coalesce(nullif(auth.jwt() ->> 'email', ''), auth.uid()::text),
    coalesce(nullif(btrim(p_original_name), ''), btrim(p_name)),
    btrim(p_normalized_name_at_creation),
    v_equipment_code,
    nullif(v_group_code, ''),
    nullif(v_site_code, ''),
    v_components
  )
  returning * into v_asset;

  return v_asset;
end;
$function$;

revoke all on function public.create_asset_with_smart_id(uuid,text,text,text,text,text,text,date,uuid,text,jsonb) from public, anon;
grant execute on function public.create_asset_with_smart_id(uuid,text,text,text,text,text,text,date,uuid,text,jsonb) to authenticated;

comment on function public.create_asset_with_smart_id(uuid,text,text,text,text,text,text,date,uuid,text,jsonb) is
  'Atomically allocates an Organization-scoped Plan A/B/C/D equipment ID and creates the asset with immutable issuance metadata.';

commit;
