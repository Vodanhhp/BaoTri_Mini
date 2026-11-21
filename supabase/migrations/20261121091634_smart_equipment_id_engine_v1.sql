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

commit;
