-- Validate organization catalog snapshots so custom additions cannot collide with standard codes.

create or replace function private.validate_equipment_catalog_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_count bigint;
  v_distinct bigint;
begin
  if pg_catalog.jsonb_typeof(new.snapshot) is distinct from 'object'
    or pg_catalog.jsonb_typeof(new.snapshot -> 'equipmentGroups') is distinct from 'array'
    or pg_catalog.jsonb_typeof(new.snapshot -> 'equipmentDictionary') is distinct from 'array' then
    raise exception 'Catalog Snapshot must contain equipmentGroups and equipmentDictionary arrays' using errcode = '22023';
  end if;

  select count(*),count(distinct regexp_replace(upper(coalesce(g ->> 'code','')),'[^A-Z0-9]','','g'))
    into v_count,v_distinct
  from pg_catalog.jsonb_array_elements(new.snapshot -> 'equipmentGroups') g;
  if v_count<>v_distinct or exists(
    select 1 from pg_catalog.jsonb_array_elements(new.snapshot -> 'equipmentGroups') g
    where length(regexp_replace(upper(coalesce(g ->> 'code','')),'[^A-Z0-9]','','g')) not between 2 and 4
      or nullif(btrim(g ->> 'name'),'') is null
      or coalesce(g ->> 'availableFromPlan','B') not in ('A','B','C','D')
  ) then
    raise exception 'Catalog Snapshot contains duplicate or invalid equipment group codes/fields' using errcode = '22023';
  end if;

  select count(*),count(distinct regexp_replace(upper(coalesce(d ->> 'shortCode','')),'[^A-Z0-9]','','g'))
    into v_count,v_distinct
  from pg_catalog.jsonb_array_elements(new.snapshot -> 'equipmentDictionary') d;
  if v_count<>v_distinct or exists(
    select 1 from pg_catalog.jsonb_array_elements(new.snapshot -> 'equipmentDictionary') d
    where length(regexp_replace(upper(coalesce(d ->> 'shortCode','')),'[^A-Z0-9]','','g')) not between 2 and 4
      or nullif(btrim(d ->> 'standardName'),'') is null
  ) then
    raise exception 'Catalog Snapshot contains duplicate or invalid equipment short codes/names' using errcode = '22023';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_equipment_catalog_snapshot() from public, anon, authenticated;
drop trigger if exists organization_equipment_catalog_validate_snapshot on public.organization_equipment_catalog;
create trigger organization_equipment_catalog_validate_snapshot
before insert or update of snapshot on public.organization_equipment_catalog
for each row execute function private.validate_equipment_catalog_snapshot();
