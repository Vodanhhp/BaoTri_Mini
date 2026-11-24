
-- Inventory Local <-> Cloud synchronization.
-- Local remains the operational source; Cloud accepts validated, idempotent mutations
-- and publishes an append-only change feed for other Local clients.

create table if not exists public.inventory_items (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  code_normalized text not null,
  name text not null,
  item_group text not null default 'Khác',
  unit text not null,
  part_number text,
  size text,
  quantity numeric(20,6) not null default 0 check (quantity >= 0),
  min_quantity numeric(20,6) not null default 0 check (min_quantity >= 0),
  location text not null default '',
  supplier text not null default '',
  unit_price numeric(20,6) not null default 0 check (unit_price >= 0),
  created_by_user_id uuid,
  created_by_label text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  constraint inventory_items_org_code_unique unique (organization_id, code_normalized),
  constraint inventory_items_org_id_unique unique (organization_id, id)
);

create index if not exists inventory_items_org_updated_idx
  on public.inventory_items (organization_id, updated_at desc);

create table if not exists public.inventory_movements (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_date date not null,
  movement_type text not null check (movement_type in ('opening','in','out','adjustment')),
  quantity numeric(20,6) not null check (quantity > 0),
  quantity_delta numeric(20,6) not null,
  balance_before numeric(20,6) not null check (balance_before >= 0),
  balance_after numeric(20,6) not null check (balance_after >= 0),
  counted_quantity numeric(20,6),
  reason text not null default '',
  note text,
  performed_by text not null default '',
  actor_user_id uuid,
  linked_asset_id uuid,
  mutation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint inventory_movements_org_item_fk
    foreign key (organization_id, item_id)
    references public.inventory_items (organization_id, id) on delete cascade,
  constraint inventory_movements_mutation_unique unique (organization_id, mutation_id),
  constraint inventory_movements_balance_check check (balance_after = balance_before + quantity_delta),
  constraint inventory_movements_count_check check (counted_quantity is null or counted_quantity >= 0)
);

create index if not exists inventory_movements_org_item_date_idx
  on public.inventory_movements (organization_id, item_id, movement_date desc, created_at desc);

create schema if not exists private;

create table if not exists private.inventory_mutation_receipts (
  organization_id uuid not null,
  mutation_id uuid not null,
  item_id uuid not null,
  operation text not null,
  response jsonb not null,
  applied_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, mutation_id)
);

create table if not exists private.inventory_sync_events (
  sequence bigint generated always as identity primary key,
  organization_id uuid not null,
  mutation_id uuid not null,
  event_type text not null check (event_type in ('item_upsert','item_archive','movement_append')),
  item_id uuid not null,
  item_snapshot jsonb not null,
  movement_snapshot jsonb,
  created_at timestamptz not null default clock_timestamp(),
  unique (organization_id, mutation_id)
);

create index if not exists inventory_sync_events_org_sequence_idx
  on private.inventory_sync_events (organization_id, sequence);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists inventory_items_read_by_permission on public.inventory_items;
create policy inventory_items_read_by_permission on public.inventory_items
  for select to authenticated
  using (private.has_org_permission(organization_id, 'inventory.view'));

drop policy if exists inventory_movements_read_by_permission on public.inventory_movements;
create policy inventory_movements_read_by_permission on public.inventory_movements
  for select to authenticated
  using (private.has_org_permission(organization_id, 'inventory.view'));

revoke all on public.inventory_items, public.inventory_movements from anon, authenticated;
grant select on public.inventory_items, public.inventory_movements to authenticated;
revoke all on private.inventory_mutation_receipts, private.inventory_sync_events from anon, authenticated, public;

create or replace function private.record_inventory_sync_event(
  p_organization_id uuid,
  p_mutation_id uuid,
  p_event_type text,
  p_item_id uuid,
  p_item_snapshot jsonb,
  p_movement_snapshot jsonb default null
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_sequence bigint;
begin
  insert into private.inventory_sync_events
    (organization_id, mutation_id, event_type, item_id, item_snapshot, movement_snapshot)
  values
    (p_organization_id, p_mutation_id, p_event_type, p_item_id, p_item_snapshot, p_movement_snapshot)
  returning sequence into v_sequence;
  return v_sequence;
end;
$$;

create or replace function public.create_inventory_item(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_item jsonb,
  p_opening_quantity numeric,
  p_opening_movement jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_item public.inventory_items%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_response jsonb;
  v_code text;
  v_name text;
  v_unit text;
  v_opening numeric(20,6);
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id, 'inventory.create') then
    raise exception 'Missing inventory.create permission' using errcode='42501';
  end if;
  if p_opening_quantity is null or p_opening_quantity < 0 or p_opening_quantity > 9999999999999999 then
    raise exception 'Invalid opening quantity' using errcode='22023';
  end if;
  v_opening := round(p_opening_quantity,6);
  if v_opening > 0 and not private.has_org_permission(p_organization_id, 'inventory.adjust') then
    raise exception 'Missing inventory.adjust permission' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_mutation_id::text, 0));
  select response into v_existing from private.inventory_mutation_receipts
    where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then return v_existing; end if;

  v_code := btrim(regexp_replace(coalesce(p_item->>'code',''), '\s+', ' ', 'g'));
  v_name := btrim(coalesce(p_item->>'name',''));
  v_unit := btrim(coalesce(p_item->>'unit',''));
  if v_code='' or v_name='' or v_unit='' then raise exception 'Code, name and unit are required' using errcode='22023'; end if;

  select exists (
    select 1 from public.organization_members m
    join public.member_roles mr on mr.organization_id=m.organization_id and mr.member_id=m.id
    join public.roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.is_active
    where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active' and r.code='admin'
  ) into v_is_admin;

  insert into public.inventory_items (
    id, organization_id, code, code_normalized, name, item_group, unit,
    part_number, size, quantity, min_quantity, location, supplier, unit_price,
    created_by_user_id, created_by_label
  ) values (
    p_item_id, p_organization_id, v_code, upper(v_code), v_name,
    coalesce(nullif(btrim(p_item->>'item_group'),''),'Khác'), v_unit,
    nullif(btrim(p_item->>'part_number'),''), nullif(btrim(p_item->>'size'),''),
    v_opening, coalesce(nullif(p_item->>'min_quantity','')::numeric,0),
    coalesce(p_item->>'location',''), coalesce(p_item->>'supplier',''),
    coalesce(nullif(p_item->>'unit_price','')::numeric,0),
    auth.uid(), coalesce(nullif(p_item->>'created_by_label',''),'Tài khoản')
  ) returning * into v_item;

  if v_opening > 0 then
    if p_opening_movement is null then raise exception 'Opening movement required' using errcode='22023'; end if;
    if abs(coalesce((p_opening_movement->>'quantity_delta')::numeric,0)-v_opening)>0.000001
       or coalesce((p_opening_movement->>'balance_before')::numeric,-1)<>0
       or abs(coalesce((p_opening_movement->>'balance_after')::numeric,-1)-v_opening)>0.000001 then
      raise exception 'Opening movement does not match opening quantity' using errcode='22023';
    end if;
    insert into public.inventory_movements (
      id,organization_id,item_id,movement_date,movement_type,quantity,quantity_delta,
      balance_before,balance_after,reason,note,performed_by,actor_user_id,linked_asset_id,mutation_id
    ) values (
      (p_opening_movement->>'id')::uuid,p_organization_id,p_item_id,
      coalesce(nullif(p_opening_movement->>'date','')::date,current_date),'opening',v_opening,v_opening,
      0,v_opening,coalesce(p_opening_movement->>'reason',''),null,
      coalesce(p_opening_movement->>'performed_by',''),auth.uid(),null,p_mutation_id
    ) returning * into v_movement;
  end if;

  if v_movement.id is not null then
    perform private.record_inventory_sync_event(p_organization_id,p_mutation_id,'movement_append',p_item_id,to_jsonb(v_item),to_jsonb(v_movement));
  else
    perform private.record_inventory_sync_event(p_organization_id,p_mutation_id,'item_upsert',p_item_id,to_jsonb(v_item),null);
  end if;

  v_response := jsonb_build_object(
    'item',to_jsonb(v_item),
    'movement',case when v_movement.id is null then null else to_jsonb(v_movement) end,
    'applied_at',clock_timestamp()
  );
  insert into private.inventory_mutation_receipts(organization_id,mutation_id,item_id,operation,response)
  values(p_organization_id,p_mutation_id,p_item_id,'create',v_response);
  return v_response;
end;
$$;

create or replace function public.update_inventory_item_metadata(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_item public.inventory_items%rowtype;
  v_response jsonb;
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.update') then
    raise exception 'Missing inventory.update permission' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_mutation_id::text, 0));
  select response into v_existing from private.inventory_mutation_receipts where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then return v_existing; end if;

  select exists (
    select 1 from public.organization_members m
    join public.member_roles mr on mr.organization_id=m.organization_id and mr.member_id=m.id
    join public.roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.is_active
    where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active' and r.code='admin'
  ) into v_is_admin;

  select * into v_item from public.inventory_items
   where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode='P0002'; end if;
  if v_item.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Inventory item changed in Cloud; refresh and reconcile' using errcode='40001';
  end if;
  if not v_is_admin and coalesce(nullif(p_payload->>'min_quantity','')::numeric,0) is distinct from v_item.min_quantity then
    raise exception 'Only Admin may change minimum quantity' using errcode='42501';
  end if;

  update public.inventory_items set
    code=btrim(regexp_replace(coalesce(p_payload->>'code',code), '\s+', ' ', 'g')),
    code_normalized=upper(btrim(regexp_replace(coalesce(p_payload->>'code',code), '\s+', ' ', 'g'))),
    name=coalesce(nullif(btrim(p_payload->>'name'),''),name),
    item_group=coalesce(nullif(btrim(p_payload->>'item_group'),''),'Khác'),
    unit=coalesce(nullif(btrim(p_payload->>'unit'),''),unit),
    part_number=nullif(btrim(p_payload->>'part_number'),''),
    size=nullif(btrim(p_payload->>'size'),''),
    min_quantity=coalesce(nullif(p_payload->>'min_quantity','')::numeric,0),
    location=coalesce(p_payload->>'location',''),
    supplier=coalesce(p_payload->>'supplier',''),
    unit_price=coalesce(nullif(p_payload->>'unit_price','')::numeric,0),
    updated_at=clock_timestamp()
  where organization_id=p_organization_id and id=p_item_id
  returning * into v_item;

  perform private.record_inventory_sync_event(p_organization_id,p_mutation_id,'item_upsert',p_item_id,to_jsonb(v_item),null);
  v_response:=jsonb_build_object('item',to_jsonb(v_item),'movement',null,'applied_at',clock_timestamp());
  insert into private.inventory_mutation_receipts(organization_id,mutation_id,item_id,operation,response)
  values(p_organization_id,p_mutation_id,p_item_id,'update_metadata',v_response);
  return v_response;
end;
$$;

create or replace function public.apply_inventory_movement(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,
  p_movement jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_item public.inventory_items%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_response jsonb;
  v_type text;
  v_delta numeric(20,6);
  v_qty numeric(20,6);
  v_before numeric(20,6);
  v_after numeric(20,6);
  v_movement_type text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.adjust') then
    raise exception 'Missing inventory.adjust permission' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_mutation_id::text, 0));
  select response into v_existing from private.inventory_mutation_receipts where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then return v_existing; end if;

  select * into v_item from public.inventory_items
   where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode='P0002'; end if;
  if v_item.archived_at is not null then raise exception 'Archived inventory item cannot be adjusted' using errcode='55000'; end if;
  if v_item.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Inventory item changed in Cloud; refresh and reconcile' using errcode='40001';
  end if;

  v_type:=p_movement->>'type';
  v_qty:=round(coalesce(nullif(p_movement->>'quantity','')::numeric,0),6);
  v_delta:=round(coalesce(nullif(p_movement->>'quantity_delta','')::numeric,0),6);
  v_before:=round(coalesce(nullif(p_movement->>'balance_before','')::numeric,-1),6);
  v_after:=round(coalesce(nullif(p_movement->>'balance_after','')::numeric,-1),6);
  if v_type not in ('Nhập','Xuất','Điều chỉnh') then raise exception 'Unsupported movement type' using errcode='22023'; end if;
  if v_qty<=0 or v_before<>v_item.quantity or v_after<>v_before+v_delta or abs(v_delta)<>v_qty or v_after<0 then
    raise exception 'Invalid movement quantity or balance snapshot' using errcode='22023';
  end if;
  if v_type='Nhập' and v_delta<=0 then raise exception 'Stock-in must increase quantity' using errcode='22023'; end if;
  if v_type='Xuất' and v_delta>=0 then raise exception 'Stock-out must decrease quantity' using errcode='22023'; end if;
  if v_type='Điều chỉnh' and v_delta=0 then raise exception 'Zero adjustment is not allowed' using errcode='22023'; end if;
  v_movement_type:=case v_type when 'Nhập' then 'in' when 'Xuất' then 'out' else 'adjustment' end;

  insert into public.inventory_movements (
    id,organization_id,item_id,movement_date,movement_type,quantity,quantity_delta,
    balance_before,balance_after,counted_quantity,reason,note,performed_by,actor_user_id,linked_asset_id,mutation_id
  ) values (
    (p_movement->>'id')::uuid,p_organization_id,p_item_id,
    coalesce(nullif(p_movement->>'date','')::date,current_date),v_movement_type,v_qty,v_delta,
    v_before,v_after,nullif(p_movement->>'counted_quantity','')::numeric,
    coalesce(p_movement->>'reason',''),nullif(p_movement->>'note',''),
    coalesce(p_movement->>'performed_by',''),auth.uid(),
    nullif(p_movement->>'linked_asset_id','')::uuid,p_mutation_id
  ) returning * into v_movement;

  update public.inventory_items set quantity=v_after,updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=p_item_id returning * into v_item;

  perform private.record_inventory_sync_event(p_organization_id,p_mutation_id,'movement_append',p_item_id,to_jsonb(v_item),to_jsonb(v_movement));
  v_response:=jsonb_build_object('item',to_jsonb(v_item),'movement',to_jsonb(v_movement),'applied_at',clock_timestamp());
  insert into private.inventory_mutation_receipts(organization_id,mutation_id,item_id,operation,response)
  values(p_organization_id,p_mutation_id,p_item_id,case when v_type='Điều chỉnh' then 'adjust_count' else 'post_movement' end,v_response);
  return v_response;
end;
$$;

create or replace function public.archive_inventory_item(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_item public.inventory_items%rowtype;
  v_response jsonb;
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.delete') then
    raise exception 'Missing inventory.delete permission' using errcode='42501';
  end if;
  select exists (
    select 1 from public.organization_members m
    join public.member_roles mr on mr.organization_id=m.organization_id and mr.member_id=m.id
    join public.roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.is_active
    where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active' and r.code='admin'
  ) into v_is_admin;
  if not v_is_admin then raise exception 'Only Admin may archive inventory items' using errcode='42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_mutation_id::text, 0));
  select response into v_existing from private.inventory_mutation_receipts where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then return v_existing; end if;

  select * into v_item from public.inventory_items
   where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode='P0002'; end if;
  if v_item.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Inventory item changed in Cloud; refresh and reconcile' using errcode='40001';
  end if;
  if v_item.quantity<>0 then raise exception 'Only zero-stock inventory items may be archived' using errcode='22023'; end if;

  update public.inventory_items set archived_at=clock_timestamp(),updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=p_item_id returning * into v_item;
  perform private.record_inventory_sync_event(p_organization_id,p_mutation_id,'item_archive',p_item_id,to_jsonb(v_item),null);
  v_response:=jsonb_build_object('item',to_jsonb(v_item),'movement',null,'applied_at',clock_timestamp());
  insert into private.inventory_mutation_receipts(organization_id,mutation_id,item_id,operation,response)
  values(p_organization_id,p_mutation_id,p_item_id,'archive',v_response);
  return v_response;
end;
$$;

create or replace function public.list_inventory_sync_changes(
  p_organization_id uuid,
  p_after_sequence bigint default 0,
  p_limit integer default 200
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_count integer;
  v_next bigint;
  v_has_more boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.view') then
    raise exception 'Missing inventory.view permission' using errcode='42501';
  end if;
  if p_after_sequence<0 or p_limit<1 or p_limit>200 then
    raise exception 'Invalid inventory feed cursor or page size' using errcode='22023';
  end if;

  with page as (
    select e.* from private.inventory_sync_events e
    where e.organization_id=p_organization_id and e.sequence>p_after_sequence
    order by e.sequence
    limit p_limit+1
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'organization_id',p.organization_id,
      'sequence',p.sequence,
      'mutation_id',p.mutation_id,
      'event_type',p.event_type,
      'item_id',p.item_id,
      'item_snapshot',p.item_snapshot,
      'movement_snapshot',p.movement_snapshot,
      'event_created_at',p.created_at
    ) order by p.sequence) filter (where rn<=p_limit),'[]'::jsonb),
    count(*)::integer,
    coalesce(max(sequence) filter (where rn<=p_limit),p_after_sequence),
    count(*)>p_limit
  into v_items,v_count,v_next,v_has_more
  from (select page.*,row_number() over(order by sequence) rn from page) p;

  return jsonb_build_object('items',v_items,'has_more',v_has_more,'next_cursor',v_next);
end;
$$;

revoke all on function public.create_inventory_item(uuid,uuid,uuid,jsonb,numeric,jsonb) from public, anon;
revoke all on function public.update_inventory_item_metadata(uuid,uuid,uuid,timestamptz,jsonb) from public, anon;
revoke all on function public.apply_inventory_movement(uuid,uuid,uuid,timestamptz,jsonb) from public, anon;
revoke all on function public.archive_inventory_item(uuid,uuid,uuid,timestamptz) from public, anon;
revoke all on function public.list_inventory_sync_changes(uuid,bigint,integer) from public, anon;
grant execute on function public.create_inventory_item(uuid,uuid,uuid,jsonb,numeric,jsonb) to authenticated;
grant execute on function public.update_inventory_item_metadata(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.apply_inventory_movement(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.archive_inventory_item(uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.list_inventory_sync_changes(uuid,bigint,integer) to authenticated;
