-- Preserve Local-generated issuance metadata when the Local asset is mirrored to Cloud.
-- Cloud verifies the confirmed reservation and copies immutable metadata; it does not generate IDs.

begin;

alter table private.asset_id_sequence_reservations
  add column if not exists original_name text,
  add column if not exists normalized_name_at_creation text,
  add column if not exists equipment_type_code text,
  add column if not exists id_components_snapshot jsonb;

drop function if exists public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text);

create or replace function public.confirm_asset_id_sequence_reservation(
  p_organization_id uuid,
  p_reservation_id uuid,
  p_asset_id uuid,
  p_equipment_id text,
  p_original_name text,
  p_normalized_name_at_creation text,
  p_equipment_type_code text,
  p_id_components_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_reservation private.asset_id_sequence_reservations;
  v_sequence_text text;
  v_expected_code text;
  v_components jsonb := p_id_components_snapshot;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.has_org_permission(p_organization_id, 'assets.create') then
    raise exception 'Missing assets.create permission for this organization' using errcode = '42501';
  end if;
  if p_asset_id is null or nullif(btrim(p_equipment_id), '') is null then
    raise exception 'Local asset UUID and generated equipment ID are required' using errcode = '22023';
  end if;
  if nullif(btrim(p_original_name), '') is null
    or nullif(btrim(p_normalized_name_at_creation), '') is null
    or nullif(btrim(p_equipment_type_code), '') is null
    or pg_catalog.jsonb_typeof(v_components) is distinct from 'object' then
    raise exception 'Local issuance metadata is incomplete' using errcode = '22023';
  end if;

  select * into v_reservation from private.asset_id_sequence_reservations r
  where r.organization_id = p_organization_id and r.reservation_id = p_reservation_id for update;
  if not found or v_reservation.actor_user_id <> auth.uid() then
    raise exception 'Reservation not found for this user' using errcode = '42501';
  end if;
  if v_reservation.status = 'released' then raise exception 'Reservation has been released' using errcode = '22023'; end if;

  v_sequence_text := case when length(v_reservation.sequence_value::text) < 3
    then lpad(v_reservation.sequence_value::text, 3, '0') else v_reservation.sequence_value::text end;
  v_expected_code := case
    when v_reservation.plan_code = 'A' then v_reservation.equipment_code || '-' || v_sequence_text
    when v_reservation.plan_code = 'B' then v_reservation.equipment_code || '-' || v_reservation.group_code || '-' || v_sequence_text
    else v_reservation.equipment_code || '-' || v_reservation.group_code || '-' ||
      v_reservation.site_code || '-' || v_sequence_text || '-' || v_reservation.month_year end;

  if btrim(p_equipment_id) <> v_expected_code then
    raise exception 'Local equipment ID does not match the reserved sequence components' using errcode = '23514';
  end if;
  if upper(regexp_replace(p_equipment_type_code, '[^A-Za-z0-9]', '', 'g')) <> v_reservation.equipment_code then
    raise exception 'Equipment type code does not match the reserved sequence' using errcode = '23514';
  end if;
  if coalesce(v_components ->> 'reservation_id', '') <> p_reservation_id::text
    or coalesce(v_components ->> 'plan', '') <> v_reservation.plan_code
    or upper(coalesce(v_components ->> 'equipment_code', '')) <> v_reservation.equipment_code
    or coalesce(v_components ->> 'group_code', '') <> v_reservation.group_code
    or coalesce(v_components ->> 'site_code', '') <> v_reservation.site_code
    or coalesce(v_components ->> 'sequence', '') <> v_reservation.sequence_value::text
    or v_components ->> 'month_year' is distinct from v_reservation.month_year then
    raise exception 'Local ID component snapshot does not match the reserved sequence' using errcode = '23514';
  end if;

  if exists (select 1 from public.assets a where a.organization_id=p_organization_id and a.code=v_expected_code and a.id<>p_asset_id) then
    raise exception 'Equipment ID already exists in this Organization' using errcode = '23505';
  end if;
  if exists (select 1 from public.assets a where a.organization_id=p_organization_id and a.id=p_asset_id and a.code<>v_expected_code) then
    raise exception 'Local UUID already belongs to a different equipment ID in Cloud' using errcode = '23505';
  end if;

  if v_reservation.status = 'confirmed' then
    if v_reservation.asset_id <> p_asset_id or v_reservation.equipment_id <> v_expected_code
      or v_reservation.original_name <> p_original_name
      or v_reservation.normalized_name_at_creation <> p_normalized_name_at_creation
      or v_reservation.equipment_type_code <> p_equipment_type_code
      or v_reservation.id_components_snapshot <> v_components then
      raise exception 'Confirmed reservation cannot be reassigned or have its issuance metadata changed' using errcode = '23514';
    end if;
  else
    update private.asset_id_sequence_reservations
    set status='confirmed', asset_id=p_asset_id, equipment_id=v_expected_code,
        original_name=btrim(p_original_name), normalized_name_at_creation=btrim(p_normalized_name_at_creation),
        equipment_type_code=upper(regexp_replace(p_equipment_type_code,'[^A-Za-z0-9]','','g')),
        id_components_snapshot=v_components, confirmed_at=now()
    where organization_id=p_organization_id and reservation_id=p_reservation_id;
  end if;
  return jsonb_build_object('reservation_id',p_reservation_id,'status','confirmed');
end;
$function$;

revoke all on function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text,text,text,text,jsonb) from public, anon;
grant execute on function public.confirm_asset_id_sequence_reservation(uuid,uuid,uuid,text,text,text,text,jsonb) to authenticated;

create or replace function private.apply_asset_issuance_from_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare v_reservation private.asset_id_sequence_reservations;
begin
  select * into v_reservation from private.asset_id_sequence_reservations r
  where r.organization_id=new.organization_id and r.asset_id=new.id for share;

  if found then
    if v_reservation.status<>'confirmed' or v_reservation.equipment_id<>new.code then
      raise exception 'Local equipment ID reservation has not been confirmed or does not match Cloud payload' using errcode = '23514';
    end if;
    new.original_name:=v_reservation.original_name;
    new.normalized_name_at_creation:=v_reservation.normalized_name_at_creation;
    new.equipment_type_code:=v_reservation.equipment_type_code;
    new.group_code_at_creation:=nullif(v_reservation.group_code,'');
    new.site_code_at_creation:=nullif(v_reservation.site_code,'');
    new.id_components_snapshot:=v_reservation.id_components_snapshot;
  else
    if exists(select 1 from private.asset_id_sequence_reservations r
      where r.organization_id=new.organization_id and r.equipment_id=new.code and r.asset_id is distinct from new.id) then
      raise exception 'Equipment ID is reserved for another Local UUID' using errcode = '23505';
    end if;
    if new.id_components_snapshot is not null or new.original_name is not null
      or new.normalized_name_at_creation is not null or new.equipment_type_code is not null
      or new.group_code_at_creation is not null or new.site_code_at_creation is not null then
      raise exception 'Smart equipment issuance metadata requires a confirmed Local reservation' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.apply_asset_issuance_from_reservation() from public, anon, authenticated;
drop trigger if exists assets_apply_local_issuance on public.assets;
create trigger assets_apply_local_issuance
before insert on public.assets
for each row execute function private.apply_asset_issuance_from_reservation();

commit;