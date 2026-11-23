-- Add server event timestamp to the Incremental Pull contract.
begin;
create or replace function private.list_asset_sync_changes(
  p_organization_id uuid,
  p_after_sequence bigint,
  p_limit integer default 200
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_uid uuid:=auth.uid();
  v_limit integer:=greatest(1,least(coalesce(p_limit,200),500));
  v_can_view_deleted boolean;
  v_generation bigint;
  v_items jsonb;
  v_has_more boolean;
  v_next_cursor bigint;
begin
  if v_uid is null or not private.has_org_permission(p_organization_id,'assets.view') then
    raise exception 'Missing assets.view permission for this organization' using errcode='42501';
  end if;
  if p_after_sequence is null or p_after_sequence<0 then
    raise exception 'Invalid Incremental Pull cursor' using errcode='22023';
  end if;
  if p_limit is null or p_limit<1 or p_limit>500 then
    raise exception 'Page size must be between 1 and 500' using errcode='22023';
  end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then
    raise exception 'Active organization not found' using errcode='P0002';
  end if;

  v_can_view_deleted:=private.has_org_permission(p_organization_id,'assets.delete');
  select coalesce(generation,0) into v_generation
    from private.organization_asset_reset_state where organization_id=p_organization_id;

  with page_rows as (
    select e.* from private.asset_sync_events e
    where e.organization_id=p_organization_id and e.sequence>p_after_sequence
    order by e.sequence limit v_limit+1
  ),
  numbered as (
    select p.*,row_number() over(order by p.sequence) as rn from page_rows p
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'organization_id',n.organization_id,
      'sequence',n.sequence,
      'asset_id',n.asset_id,
      'asset_code',n.asset_code,
      'event_type',n.event_type,
      'asset_updated_at',n.asset_updated_at,
      'event_created_at',n.created_at,
      'reset_generation',n.reset_generation,
      'snapshot',case when n.event_type='soft_delete' and not v_can_view_deleted then null else n.snapshot end
    ) order by n.sequence) filter(where n.rn<=v_limit),'[]'::jsonb),
    count(*)>v_limit,
    max(n.sequence) filter(where n.rn<=v_limit)
  into v_items,v_has_more,v_next_cursor
  from numbered n;

  return jsonb_build_object(
    'items',v_items,
    'has_more',coalesce(v_has_more,false),
    'next_cursor',coalesce(v_next_cursor,p_after_sequence),
    'current_generation',coalesce(v_generation,0)
  );
end;
$function$;
commit;
