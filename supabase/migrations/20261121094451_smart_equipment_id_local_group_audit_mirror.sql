-- Mirror Local-first Admin group-change audit events into the private Cloud history table.

create or replace function public.mirror_asset_group_change_history(
  p_organization_id uuid,
  p_asset_id uuid,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_asset public.assets;
  v_change jsonb;
  v_event_id uuid;
  v_actor uuid;
  v_old_category text;
  v_new_category text;
  v_changed_at timestamptz;
  v_reason text;
  v_last_category text;
  v_inserted integer := 0;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.has_org_permission(p_organization_id,'assets.import') then
    raise exception 'Missing assets.import permission for this organization' using errcode = '42501';
  end if;
  if p_asset_id is null or pg_catalog.jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Asset UUID and group-change array are required' using errcode = '22023';
  end if;

  select * into v_asset from public.assets a
  where a.organization_id=p_organization_id and a.id=p_asset_id;
  if not found then raise exception 'Cloud asset does not exist in this Organization' using errcode = 'P0002'; end if;

  for v_change in select value from pg_catalog.jsonb_array_elements(p_changes) as x(value) loop
    v_count:=v_count+1;
    v_event_id:=nullif(v_change->>'id','')::uuid;
    v_actor:=nullif(v_change->>'changedByUserId','')::uuid;
    v_old_category:=nullif(btrim(v_change->>'oldCategory'),'');
    v_new_category:=nullif(btrim(v_change->>'newCategory'),'');
    v_changed_at:=nullif(v_change->>'changedAt','')::timestamptz;
    v_reason:=nullif(btrim(v_change->>'reason'),'');
    if v_event_id is null or v_old_category is null or v_new_category is null
      or v_old_category=v_new_category or v_changed_at is null then
      raise exception 'Group-change event contains missing or invalid fields' using errcode = '22023';
    end if;
    if v_actor is not null and not exists(
      select 1 from public.organization_members m
      where m.organization_id=p_organization_id and m.user_id=v_actor
    ) then
      raise exception 'Group-change actor does not belong to this Organization' using errcode = '42501';
    end if;

    insert into private.asset_group_change_history(
      id,organization_id,asset_id,old_category,new_category,changed_by_user_id,changed_at,reason
    ) values (
      v_event_id,p_organization_id,p_asset_id,v_old_category,v_new_category,v_actor,v_changed_at,v_reason
    ) on conflict(id) do nothing;
    if found then v_inserted:=v_inserted+1; end if;
    v_last_category:=v_new_category;
  end loop;

  if v_count=0 then return jsonb_build_object('inserted',0,'already_present',true); end if;
  if v_last_category is distinct from v_asset.category then
    raise exception 'Local group history does not end at the current Cloud group' using errcode = '23514';
  end if;

  return jsonb_build_object('inserted',v_inserted,'already_present',v_inserted=0);
end;
$function$;

revoke all on function public.mirror_asset_group_change_history(uuid,uuid,jsonb) from public, anon;
grant execute on function public.mirror_asset_group_change_history(uuid,uuid,jsonb) to authenticated;
