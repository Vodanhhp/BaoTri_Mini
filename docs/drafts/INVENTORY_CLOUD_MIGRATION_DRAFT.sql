-- DRAFT ONLY — do not apply directly.
-- This is a review artifact, not a Supabase migration. Generate the final migration
-- filename with `supabase migration new inventory_cloud_sync` in a checked-out repo.
-- Target project, after separate approval: BAOTRI Mini New / dskeaiyvldiwlsfqkboq.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tenant-scoped Cloud records. Direct browser table access is intentionally
--    revoked; all writes and reads use checked public RPC wrappers below.
-- ---------------------------------------------------------------------------

create table public.inventory_items (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  code_normalized text not null,
  name text not null,
  item_group text not null default 'Khác',
  unit text not null,
  part_number text,
  size text,
  quantity numeric(20,6) not null default 0,
  min_quantity numeric(20,6) not null default 0,
  location text not null default '',
  supplier text not null default '',
  unit_price numeric(20,6) not null default 0,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_label text not null default 'Tài khoản',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, code_normalized),
  check (char_length(btrim(code)) > 0),
  check (char_length(btrim(code_normalized)) > 0),
  check (char_length(btrim(name)) > 0),
  check (char_length(btrim(item_group)) > 0),
  check (char_length(btrim(unit)) > 0),
  check (quantity >= 0),
  check (min_quantity >= 0),
  check (unit_price >= 0)
);

create index inventory_items_org_group_idx
  on public.inventory_items(organization_id, item_group);
create index inventory_items_org_archived_idx
  on public.inventory_items(organization_id, archived_at);
create index inventory_items_org_updated_idx
  on public.inventory_items(organization_id, updated_at);

create table public.inventory_movements (
  id uuid primary key,
  organization_id uuid not null,
  item_id uuid not null,
  movement_date date not null,
  movement_type text not null
    check (movement_type in ('opening','in','out','adjustment')),
  quantity numeric(20,6) not null check (quantity > 0),
  quantity_delta numeric(20,6) not null check (quantity_delta <> 0),
  balance_before numeric(20,6) not null check (balance_before >= 0),
  balance_after numeric(20,6) not null check (balance_after >= 0),
  counted_quantity numeric(20,6),
  reason text not null,
  note text,
  performed_by text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  linked_asset_id uuid,
  mutation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (organization_id, id),
  unique (organization_id, mutation_id),
  foreign key (organization_id, item_id)
    references public.inventory_items(organization_id, id) on delete restrict,
  foreign key (organization_id, linked_asset_id)
    references public.assets(organization_id, id) on delete restrict,
  check (quantity = abs(quantity_delta)),
  check (balance_after = balance_before + quantity_delta),
  check (
    (movement_type in ('opening','in') and quantity_delta > 0)
    or (movement_type = 'out' and quantity_delta < 0)
    or (movement_type = 'adjustment')
  ),
  check (counted_quantity is null or counted_quantity >= 0),
  check (char_length(btrim(reason)) > 0),
  check (char_length(btrim(performed_by)) > 0)
);

create unique index inventory_movements_one_opening_per_item
  on public.inventory_movements(organization_id, item_id)
  where movement_type = 'opening';
create index inventory_movements_org_item_date_idx
  on public.inventory_movements(organization_id, item_id, movement_date desc, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

-- Defense-in-depth policies; browser roles still have no table grants.
create policy inventory_items_member_select
  on public.inventory_items for select to authenticated
  using (private.is_org_member(organization_id));
create policy inventory_movements_member_select
  on public.inventory_movements for select to authenticated
  using (private.is_org_member(organization_id));

revoke all on table public.inventory_items, public.inventory_movements
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Private idempotency, audit and ordered feed.
-- ---------------------------------------------------------------------------

create table private.inventory_mutation_receipts (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  mutation_id uuid not null,
  item_id uuid not null,
  operation text not null
    check (operation in ('create','update_metadata','post_movement','adjust_count','archive')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_payload jsonb not null,
  result_item jsonb not null,
  result_movement jsonb,
  applied_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, mutation_id),
  foreign key (organization_id, item_id)
    references public.inventory_items(organization_id, id) on delete restrict,
  check (jsonb_typeof(request_payload) = 'object'),
  check (jsonb_typeof(result_item) = 'object'),
  check (result_movement is null or jsonb_typeof(result_movement) = 'object')
);

create table private.inventory_activity_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  item_id uuid not null,
  mutation_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('created','metadata_updated','movement_posted','archived')),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (organization_id, item_id)
    references public.inventory_items(organization_id, id) on delete restrict,
  check (before_snapshot is null or jsonb_typeof(before_snapshot) = 'object'),
  check (jsonb_typeof(after_snapshot) = 'object')
);
create index inventory_activity_history_org_item_time_idx
  on private.inventory_activity_history(organization_id, item_id, created_at desc);

create table private.inventory_sync_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

create table private.inventory_sync_events (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence bigint not null check (sequence > 0),
  mutation_id uuid not null,
  event_type text not null check (event_type in ('item_upsert','item_archive','movement_append')),
  item_id uuid not null,
  item_snapshot jsonb not null check (jsonb_typeof(item_snapshot) = 'object'),
  movement_snapshot jsonb check (movement_snapshot is null or jsonb_typeof(movement_snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, sequence),
  unique (organization_id, mutation_id),
  foreign key (organization_id, item_id)
    references public.inventory_items(organization_id, id) on delete restrict
);

alter table private.inventory_mutation_receipts enable row level security;
alter table private.inventory_activity_history enable row level security;
alter table private.inventory_sync_counters enable row level security;
alter table private.inventory_sync_events enable row level security;

revoke all on table private.inventory_mutation_receipts,
  private.inventory_activity_history,
  private.inventory_sync_counters,
  private.inventory_sync_events
  from public, anon, authenticated;

grant usage on schema private to authenticated;

create function private.append_inventory_sync_event(
  p_organization_id uuid,
  p_mutation_id uuid,
  p_event_type text,
  p_item_id uuid,
  p_item_snapshot jsonb,
  p_movement_snapshot jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_sequence bigint;
begin
  if p_organization_id is null or p_mutation_id is null or p_item_id is null
     or p_event_type not in ('item_upsert','item_archive','movement_append')
     or p_item_snapshot is null or jsonb_typeof(p_item_snapshot) <> 'object'
     or (p_movement_snapshot is not null and jsonb_typeof(p_movement_snapshot) <> 'object') then
    raise exception 'Invalid inventory sync event' using errcode='22023';
  end if;

  insert into private.inventory_sync_counters(organization_id,last_sequence)
  values (p_organization_id,1)
  on conflict (organization_id) do update
    set last_sequence = private.inventory_sync_counters.last_sequence + 1,
        updated_at = clock_timestamp()
  returning last_sequence into v_sequence;

  insert into private.inventory_sync_events(
    organization_id,sequence,mutation_id,event_type,item_id,item_snapshot,movement_snapshot
  ) values (
    p_organization_id,v_sequence,p_mutation_id,p_event_type,p_item_id,
    p_item_snapshot,p_movement_snapshot
  );
  return v_sequence;
end;
$function$;
revoke all on function private.append_inventory_sync_event(uuid,uuid,text,uuid,jsonb,jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Create item + optional opening movement in one atomic, idempotent RPC.
-- ---------------------------------------------------------------------------

create function private.create_inventory_item(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_item jsonb,
  p_opening_quantity numeric,
  p_opening_movement jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_item public.inventory_items;
  v_movement public.inventory_movements;
  v_receipt private.inventory_mutation_receipts;
  v_code text;
  v_code_normalized text;
  v_opening numeric := p_opening_quantity;
  v_request jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.create') then
    raise exception 'Missing inventory.create permission' using errcode='42501';
  end if;
  if p_opening_quantity is null or p_opening_quantity < 0 or scale(p_opening_quantity) > 6 then
    raise exception 'Opening quantity must be non-negative with at most 6 decimal places' using errcode='22023';
  end if;
  if p_opening_quantity > 0 and not private.has_org_permission(p_organization_id,'inventory.adjust') then
    raise exception 'Missing inventory.adjust permission for opening balance' using errcode='42501';
  end if;
  if p_organization_id is null or p_item_id is null or p_mutation_id is null
     or p_item is null or jsonb_typeof(p_item) <> 'object' then
    raise exception 'Invalid inventory create request' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_item) k
    where k not in ('code','name','item_group','unit','part_number','size','min_quantity',
                    'location','supplier','unit_price','created_by_label')
  ) then raise exception 'Create payload contains unsupported fields' using errcode='22023'; end if;
  if not (p_item ?& array['code','name','item_group','unit','min_quantity','unit_price']) then
    raise exception 'Create payload is missing required fields' using errcode='22023';
  end if;

  v_code := btrim(p_item->>'code');
  v_code_normalized := upper(regexp_replace(v_code,'[[:space:]]+',' ','g'));
  if v_code is null or v_code = '' or v_code_normalized is null or v_code_normalized = ''
     or nullif(btrim(p_item->>'name'),'') is null
     or nullif(btrim(p_item->>'item_group'),'') is null
     or nullif(btrim(p_item->>'unit'),'') is null then
    raise exception 'Inventory code, name, group and unit are required' using errcode='22023';
  end if;
  if p_item->>'min_quantity' is null or p_item->>'unit_price' is null
     or (p_item->>'min_quantity')::numeric < 0 or (p_item->>'unit_price')::numeric < 0
     or scale((p_item->>'min_quantity')::numeric) > 6
     or scale((p_item->>'unit_price')::numeric) > 6 then
    raise exception 'Minimum quantity and unit price must be non-negative with at most 6 decimal places' using errcode='22023';
  end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then
    raise exception 'Active organization not found' using errcode='P0002';
  end if;
  if p_opening_quantity > 0 then
    if p_opening_movement is null or jsonb_typeof(p_opening_movement) <> 'object'
       or nullif(p_opening_movement->>'id','') is null then
      raise exception 'Opening movement identity is required' using errcode='22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(p_opening_movement) k
      where k not in ('id','date','quantity','quantity_delta','balance_before','balance_after',
                      'reason','performed_by','actor_user_id')
    ) then raise exception 'Opening movement payload contains unsupported fields' using errcode='22023'; end if;
  elsif p_opening_movement is not null then
    raise exception 'Zero opening quantity must not include a movement' using errcode='22023';
  end if;

  v_request := jsonb_build_object(
    'item',p_item,'opening_quantity',p_opening_quantity,'opening_movement',p_opening_movement
  );
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_mutation_id::text,0));
  select * into v_receipt from private.inventory_mutation_receipts
   where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then
    if v_receipt.actor_user_id <> v_actor or v_receipt.item_id <> p_item_id
       or v_receipt.operation <> 'create' or v_receipt.request_payload <> v_request then
      raise exception 'Mutation ID reused with a different inventory create request' using errcode='23505';
    end if;
    return jsonb_build_object('already_applied',true,'item',v_receipt.result_item,
      'movement',v_receipt.result_movement,'applied_at',v_receipt.applied_at);
  end if;

  insert into public.inventory_items(
    id,organization_id,code,code_normalized,name,item_group,unit,part_number,size,
    quantity,min_quantity,location,supplier,unit_price,created_by_user_id,created_by_label
  ) values (
    p_item_id,p_organization_id,v_code,v_code_normalized,btrim(p_item->>'name'),
    btrim(p_item->>'item_group'),btrim(p_item->>'unit'),
    nullif(btrim(coalesce(p_item->>'part_number','')),''),
    nullif(btrim(coalesce(p_item->>'size','')),''),
    v_opening,(p_item->>'min_quantity')::numeric,
    coalesce(p_item->>'location',''),coalesce(p_item->>'supplier',''),
    (p_item->>'unit_price')::numeric,v_actor,
    coalesce(nullif(btrim(p_item->>'created_by_label'),''),'Tài khoản')
  ) returning * into v_item;

  if p_opening_quantity > 0 then
    insert into public.inventory_movements(
      id,organization_id,item_id,movement_date,movement_type,quantity,quantity_delta,
      balance_before,balance_after,counted_quantity,reason,note,performed_by,
      actor_user_id,linked_asset_id,mutation_id
    ) values (
      (p_opening_movement->>'id')::uuid,p_organization_id,p_item_id,
      coalesce(nullif(p_opening_movement->>'date','')::date,current_date),
      'opening',v_opening,v_opening,0,v_opening,null,
      'Tồn đầu kỳ',null,
      coalesce(nullif(btrim(p_opening_movement->>'performed_by'),''),v_item.created_by_label),
      v_actor,null,p_mutation_id
    ) returning * into v_movement;
  end if;

  insert into private.inventory_activity_history(
    organization_id,item_id,mutation_id,actor_user_id,event_type,before_snapshot,after_snapshot
  ) values (p_organization_id,p_item_id,p_mutation_id,v_actor,'created',null,to_jsonb(v_item));

  insert into private.inventory_mutation_receipts(
    organization_id,mutation_id,item_id,operation,actor_user_id,request_payload,result_item,result_movement
  ) values (
    p_organization_id,p_mutation_id,p_item_id,'create',v_actor,v_request,
    to_jsonb(v_item),case when v_movement.id is null then null else to_jsonb(v_movement) end
  ) returning * into v_receipt;

  perform private.append_inventory_sync_event(
    p_organization_id,p_mutation_id,'item_upsert',p_item_id,to_jsonb(v_item),
    case when v_movement.id is null then null else to_jsonb(v_movement) end
  );
  return jsonb_build_object('already_applied',false,'item',to_jsonb(v_item),
    'movement',case when v_movement.id is null then null else to_jsonb(v_movement) end,
    'applied_at',v_receipt.applied_at);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Metadata update. Quantity and movement fields are not accepted.
-- ---------------------------------------------------------------------------

create function private.update_inventory_item_metadata(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_item public.inventory_items;
  v_before jsonb;
  v_receipt private.inventory_mutation_receipts;
  v_code text;
  v_code_normalized text;
  v_request jsonb := p_payload;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.update') then
    raise exception 'Missing inventory.update permission' using errcode='42501';
  end if;
  if p_item_id is null or p_mutation_id is null or p_expected_cloud_updated_at is null
     or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid inventory metadata request' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) k
    where k not in ('code','name','item_group','unit','part_number','size','min_quantity',
                    'location','supplier','unit_price')
  ) then raise exception 'Metadata payload contains unsupported fields' using errcode='22023'; end if;
  if not (p_payload ?& array['code','name','item_group','unit','min_quantity','unit_price']) then
    raise exception 'Metadata payload is missing required fields' using errcode='22023';
  end if;

  v_code := btrim(p_payload->>'code');
  v_code_normalized := upper(regexp_replace(v_code,'[[:space:]]+',' ','g'));
  if v_code is null or v_code = '' or v_code_normalized is null
     or nullif(btrim(p_payload->>'name'),'') is null
     or nullif(btrim(p_payload->>'item_group'),'') is null
     or nullif(btrim(p_payload->>'unit'),'') is null then
    raise exception 'Inventory code, name, group and unit are required' using errcode='22023';
  end if;
  if p_payload->>'min_quantity' is null or p_payload->>'unit_price' is null
     or (p_payload->>'min_quantity')::numeric < 0 or (p_payload->>'unit_price')::numeric < 0
     or scale((p_payload->>'min_quantity')::numeric) > 6
     or scale((p_payload->>'unit_price')::numeric) > 6 then
    raise exception 'Minimum quantity and unit price must be non-negative with at most 6 decimal places' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_mutation_id::text,0));
  select * into v_receipt from private.inventory_mutation_receipts
   where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then
    if v_receipt.actor_user_id <> v_actor or v_receipt.item_id <> p_item_id
       or v_receipt.operation <> 'update_metadata' or v_receipt.request_payload <> v_request then
      raise exception 'Mutation ID reused with a different inventory update request' using errcode='23505';
    end if;
    return jsonb_build_object('already_applied',true,'item',v_receipt.result_item,
      'movement',null,'applied_at',v_receipt.applied_at);
  end if;

  select * into v_item from public.inventory_items
   where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode='P0002'; end if;
  if v_item.archived_at is not null then
    raise exception 'Archived inventory item cannot be updated' using errcode='55000';
  end if;
  if v_item.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Cloud inventory version changed; preserve both snapshots and resolve manually' using errcode='40001';
  end if;
  if v_item.min_quantity is distinct from (p_payload->>'min_quantity')::numeric
     and not private.has_org_role(p_organization_id,'admin') then
    raise exception 'Only Admin can change minimum stock quantity' using errcode='42501';
  end if;
  v_before := to_jsonb(v_item);

  update public.inventory_items set
    code=v_code,
    code_normalized=v_code_normalized,
    name=btrim(p_payload->>'name'),
    item_group=btrim(p_payload->>'item_group'),
    unit=btrim(p_payload->>'unit'),
    part_number=nullif(btrim(coalesce(p_payload->>'part_number','')),''),
    size=nullif(btrim(coalesce(p_payload->>'size','')),''),
    min_quantity=(p_payload->>'min_quantity')::numeric,
    location=coalesce(p_payload->>'location',''),
    supplier=coalesce(p_payload->>'supplier',''),
    unit_price=(p_payload->>'unit_price')::numeric,
    updated_at=clock_timestamp()
  where organization_id=p_organization_id and id=p_item_id
  returning * into v_item;

  insert into private.inventory_activity_history(
    organization_id,item_id,mutation_id,actor_user_id,event_type,before_snapshot,after_snapshot
  ) values (p_organization_id,p_item_id,p_mutation_id,v_actor,'metadata_updated',v_before,to_jsonb(v_item));

  insert into private.inventory_mutation_receipts(
    organization_id,mutation_id,item_id,operation,actor_user_id,request_payload,result_item
  ) values (p_organization_id,p_mutation_id,p_item_id,'update_metadata',v_actor,v_request,to_jsonb(v_item))
  returning * into v_receipt;

  perform private.append_inventory_sync_event(
    p_organization_id,p_mutation_id,'item_upsert',p_item_id,to_jsonb(v_item),null
  );
  return jsonb_build_object('already_applied',false,'item',to_jsonb(v_item),
    'movement',null,'applied_at',v_receipt.applied_at);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Stock-in/out/count adjustment. Server computes balances under row lock.
-- ---------------------------------------------------------------------------

create function private.apply_inventory_movement(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,
  p_movement jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_item public.inventory_items;
  v_movement public.inventory_movements;
  v_receipt private.inventory_mutation_receipts;
  v_before_snapshot jsonb;
  v_before numeric(20,6);
  v_after numeric(20,6);
  v_delta numeric(20,6);
  v_quantity numeric(20,6);
  v_counted numeric(20,6);
  v_type text;
  v_movement_type text;
  v_reason text;
  v_performed_by text;
  v_linked_asset_id uuid;
  v_request jsonb := p_movement;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.adjust') then
    raise exception 'Missing inventory.adjust permission' using errcode='42501';
  end if;
  if p_item_id is null or p_mutation_id is null or p_expected_cloud_updated_at is null
     or p_movement is null or jsonb_typeof(p_movement) <> 'object' then
    raise exception 'Invalid inventory movement request' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_movement) k
    where k not in ('id','date','type','quantity','quantity_delta','balance_before','balance_after',
                    'counted_quantity','reason','note','performed_by','actor_user_id','linked_asset_id')
  ) then raise exception 'Movement payload contains unsupported fields' using errcode='22023'; end if;
  if nullif(p_movement->>'id','') is null then
    raise exception 'Movement ID is required' using errcode='22023';
  end if;

  v_type := p_movement->>'type';
  v_reason := btrim(coalesce(p_movement->>'reason',''));
  v_performed_by := coalesce(nullif(btrim(p_movement->>'performed_by'),''),'Tài khoản');
  v_linked_asset_id := nullif(p_movement->>'linked_asset_id','')::uuid;
  if v_reason = '' then raise exception 'Movement reason is required' using errcode='22023'; end if;
  if v_type = 'Nhập' then
    v_movement_type := 'in';
    if p_movement->>'quantity' is null or (p_movement->>'quantity')::numeric <= 0 or scale((p_movement->>'quantity')::numeric) > 6 then
      raise exception 'Stock-in quantity must be positive with at most 6 decimal places' using errcode='22023';
    end if;
    v_quantity := (p_movement->>'quantity')::numeric;
    v_delta := v_quantity;
  elsif v_type = 'Xuất' then
    v_movement_type := 'out';
    if p_movement->>'quantity' is null or (p_movement->>'quantity')::numeric <= 0 or scale((p_movement->>'quantity')::numeric) > 6 then
      raise exception 'Stock-out quantity must be positive with at most 6 decimal places' using errcode='22023';
    end if;
    v_quantity := (p_movement->>'quantity')::numeric;
    v_delta := -v_quantity;
  elsif v_type = 'Điều chỉnh' then
    v_movement_type := 'adjustment';
    if p_movement->>'counted_quantity' is null or (p_movement->>'counted_quantity')::numeric < 0
       or scale((p_movement->>'counted_quantity')::numeric) > 6 then
      raise exception 'Counted quantity must be non-negative with at most 6 decimal places' using errcode='22023';
    end if;
    v_counted := (p_movement->>'counted_quantity')::numeric;
  else
    raise exception 'Unsupported inventory movement type' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_mutation_id::text,0));
  select * into v_receipt from private.inventory_mutation_receipts
   where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then
    if v_receipt.actor_user_id <> v_actor or v_receipt.item_id <> p_item_id
       or v_receipt.operation not in ('post_movement','adjust_count')
       or v_receipt.request_payload <> v_request then
      raise exception 'Mutation ID reused with a different inventory movement request' using errcode='23505';
    end if;
    return jsonb_build_object('already_applied',true,'item',v_receipt.result_item,
      'movement',v_receipt.result_movement,'applied_at',v_receipt.applied_at);
  end if;

  select * into v_item from public.inventory_items
   where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode='P0002'; end if;
  if v_item.archived_at is not null then
    raise exception 'Archived inventory item cannot receive movements' using errcode='55000';
  end if;
  if v_item.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Cloud inventory version changed; preserve both snapshots and resolve manually' using errcode='40001';
  end if;

  v_before := v_item.quantity;
  if v_type = 'Điều chỉnh' then
    v_delta := v_counted - v_before;
    v_quantity := abs(v_delta);
  end if;
  if v_delta = 0 then
    insert into private.inventory_mutation_receipts(
      organization_id,mutation_id,item_id,operation,actor_user_id,request_payload,result_item
    ) values (
      p_organization_id,p_mutation_id,p_item_id,
      case when v_type='Điều chỉnh' then 'adjust_count' else 'post_movement' end,
      v_actor,v_request,to_jsonb(v_item)
    ) returning * into v_receipt;
    return jsonb_build_object('already_applied',false,'status','no_change',
      'item',to_jsonb(v_item),'movement',null,'applied_at',v_receipt.applied_at);
  end if;
  v_after := v_before + v_delta;
  if v_after < 0 then raise exception 'Stock-out exceeds available quantity' using errcode='23514'; end if;

  v_before_snapshot := to_jsonb(v_item);
  update public.inventory_items set quantity=v_after,updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=p_item_id
   returning * into v_item;

  insert into public.inventory_movements(
    id,organization_id,item_id,movement_date,movement_type,quantity,quantity_delta,
    balance_before,balance_after,counted_quantity,reason,note,performed_by,
    actor_user_id,linked_asset_id,mutation_id
  ) values (
    (p_movement->>'id')::uuid,p_organization_id,p_item_id,
    coalesce(nullif(p_movement->>'date','')::date,current_date),
    v_movement_type,v_quantity,v_delta,v_before,v_after,
    case when v_type='Điều chỉnh' then v_counted else null end,
    v_reason,nullif(p_movement->>'note',''),v_performed_by,
    v_actor,v_linked_asset_id,p_mutation_id
  ) returning * into v_movement;

  insert into private.inventory_activity_history(
    organization_id,item_id,mutation_id,actor_user_id,event_type,before_snapshot,after_snapshot
  ) values (p_organization_id,p_item_id,p_mutation_id,v_actor,'movement_posted',
    v_before_snapshot,to_jsonb(v_item));

  insert into private.inventory_mutation_receipts(
    organization_id,mutation_id,item_id,operation,actor_user_id,request_payload,result_item,result_movement
  ) values (
    p_organization_id,p_mutation_id,p_item_id,
    case when v_type='Điều chỉnh' then 'adjust_count' else 'post_movement' end,
    v_actor,v_request,to_jsonb(v_item),to_jsonb(v_movement)
  ) returning * into v_receipt;

  perform private.append_inventory_sync_event(
    p_organization_id,p_mutation_id,'movement_append',p_item_id,to_jsonb(v_item),to_jsonb(v_movement)
  );
  return jsonb_build_object('already_applied',false,'item',to_jsonb(v_item),
    'movement',to_jsonb(v_movement),'applied_at',v_receipt.applied_at);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Admin-only soft archive; non-zero stock must be dealt with first.
-- ---------------------------------------------------------------------------

create function private.archive_inventory_item(
  p_organization_id uuid,
  p_item_id uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_item public.inventory_items;
  v_before jsonb;
  v_receipt private.inventory_mutation_receipts;
  v_request jsonb := jsonb_build_object('item_id',p_item_id,'expected_cloud_updated_at',p_expected_cloud_updated_at);
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.has_org_permission(p_organization_id,'inventory.delete')
     or not private.has_org_role(p_organization_id,'admin') then
    raise exception 'Admin inventory.delete permission required' using errcode='42501';
  end if;
  if p_organization_id is null or p_item_id is null or p_mutation_id is null
     or p_expected_cloud_updated_at is null then
    raise exception 'Invalid inventory archive request' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_mutation_id::text,0));
  select * into v_receipt from private.inventory_mutation_receipts
   where organization_id=p_organization_id and mutation_id=p_mutation_id;
  if found then
    if v_receipt.actor_user_id <> v_actor or v_receipt.item_id <> p_item_id
       or v_receipt.operation <> 'archive' or v_receipt.request_payload <> v_request then
      raise exception 'Mutation ID reused with a different inventory archive request' using errcode='23505';
    end if;
    return jsonb_build_object('already_applied',true,'item',v_receipt.result_item,
      'movement',null,'applied_at',v_receipt.applied_at);
  end if;

  select * into v_item from public.inventory_items
   where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode='P0002'; end if;
  if v_item.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Cloud inventory version changed; preserve both snapshots and resolve manually' using errcode='40001';
  end if;
  if v_item.quantity <> 0 then
    raise exception 'Inventory item can only be archived with zero stock' using errcode='23514';
  end if;

  v_before := to_jsonb(v_item);
  if v_item.archived_at is null then
    update public.inventory_items set archived_at=clock_timestamp(),updated_at=clock_timestamp()
     where organization_id=p_organization_id and id=p_item_id
     returning * into v_item;

    insert into private.inventory_activity_history(
      organization_id,item_id,mutation_id,actor_user_id,event_type,before_snapshot,after_snapshot
    ) values (p_organization_id,p_item_id,p_mutation_id,v_actor,'archived',v_before,to_jsonb(v_item));

    perform private.append_inventory_sync_event(
      p_organization_id,p_mutation_id,'item_archive',p_item_id,to_jsonb(v_item),null
    );
  end if;

  insert into private.inventory_mutation_receipts(
    organization_id,mutation_id,item_id,operation,actor_user_id,request_payload,result_item
  ) values (p_organization_id,p_mutation_id,p_item_id,'archive',v_actor,v_request,to_jsonb(v_item))
  returning * into v_receipt;

  return jsonb_build_object('already_applied',false,'item',to_jsonb(v_item),
    'movement',null,'applied_at',v_receipt.applied_at);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Ordered per-organization incremental pull.
-- ---------------------------------------------------------------------------

create function private.get_inventory_sync_checkpoint(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_sequence bigint;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id,'inventory.view') then
    raise exception 'Missing inventory.view permission' using errcode='42501';
  end if;
  select coalesce(c.last_sequence,0) into v_sequence
    from public.organizations o
    left join private.inventory_sync_counters c on c.organization_id=o.id
   where o.id=p_organization_id and o.status='active';
  if not found then raise exception 'Active organization not found' using errcode='P0002'; end if;
  return jsonb_build_object('last_sequence',v_sequence);
end;
$function$;

create function private.list_inventory_sync_changes(
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
  v_limit integer := coalesce(p_limit,200);
  v_items jsonb;
  v_has_more boolean;
  v_next_cursor bigint;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id,'inventory.view') then
    raise exception 'Missing inventory.view permission' using errcode='42501';
  end if;
  if p_after_sequence is null or p_after_sequence < 0 then
    raise exception 'Invalid inventory sync cursor' using errcode='22023';
  end if;
  if v_limit < 1 or v_limit > 500 then
    raise exception 'Inventory page size must be between 1 and 500' using errcode='22023';
  end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then
    raise exception 'Active organization not found' using errcode='P0002';
  end if;

  with page_rows as (
    select e.* from private.inventory_sync_events e
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
      'mutation_id',n.mutation_id,
      'event_type',n.event_type,
      'item_id',n.item_id,
      'item_snapshot',n.item_snapshot,
      'movement_snapshot',n.movement_snapshot,
      'event_created_at',n.created_at
    ) order by n.sequence) filter(where n.rn<=v_limit),'[]'::jsonb),
    count(*)>v_limit,
    max(n.sequence) filter(where n.rn<=v_limit)
  into v_items,v_has_more,v_next_cursor
  from numbered n;

  return jsonb_build_object(
    'items',v_items,
    'has_more',coalesce(v_has_more,false),
    'next_cursor',coalesce(v_next_cursor,p_after_sequence)
  );
end;
$function$;

-- Private RPC implementations are callable only through authenticated wrappers.
revoke all on function private.create_inventory_item(uuid,uuid,uuid,jsonb,numeric,jsonb)
  from public, anon;
revoke all on function private.update_inventory_item_metadata(uuid,uuid,uuid,timestamptz,jsonb)
  from public, anon;
revoke all on function private.apply_inventory_movement(uuid,uuid,uuid,timestamptz,jsonb)
  from public, anon;
revoke all on function private.archive_inventory_item(uuid,uuid,uuid,timestamptz)
  from public, anon;
revoke all on function private.get_inventory_sync_checkpoint(uuid) from public, anon;
revoke all on function private.list_inventory_sync_changes(uuid,bigint,integer) from public, anon;

grant execute on function private.create_inventory_item(uuid,uuid,uuid,jsonb,numeric,jsonb) to authenticated;
grant execute on function private.update_inventory_item_metadata(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function private.apply_inventory_movement(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function private.archive_inventory_item(uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function private.get_inventory_sync_checkpoint(uuid) to authenticated;
grant execute on function private.list_inventory_sync_changes(uuid,bigint,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Public RPC wrappers are SECURITY INVOKER and expose no direct table writes.
-- ---------------------------------------------------------------------------

create function public.create_inventory_item(
  p_organization_id uuid,p_item_id uuid,p_mutation_id uuid,p_item jsonb,
  p_opening_quantity numeric,p_opening_movement jsonb
) returns jsonb language sql security invoker set search_path=''
as $$ select private.create_inventory_item(
  p_organization_id,p_item_id,p_mutation_id,p_item,p_opening_quantity,p_opening_movement
); $$;

create function public.update_inventory_item_metadata(
  p_organization_id uuid,p_item_id uuid,p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,p_payload jsonb
) returns jsonb language sql security invoker set search_path=''
as $$ select private.update_inventory_item_metadata(
  p_organization_id,p_item_id,p_mutation_id,p_expected_cloud_updated_at,p_payload
); $$;

create function public.apply_inventory_movement(
  p_organization_id uuid,p_item_id uuid,p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,p_movement jsonb
) returns jsonb language sql security invoker set search_path=''
as $$ select private.apply_inventory_movement(
  p_organization_id,p_item_id,p_mutation_id,p_expected_cloud_updated_at,p_movement
); $$;

create function public.archive_inventory_item(
  p_organization_id uuid,p_item_id uuid,p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz
) returns jsonb language sql security invoker set search_path=''
as $$ select private.archive_inventory_item(
  p_organization_id,p_item_id,p_mutation_id,p_expected_cloud_updated_at
); $$;

create function public.get_inventory_sync_checkpoint(p_organization_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.get_inventory_sync_checkpoint(p_organization_id); $$;

create function public.list_inventory_sync_changes(
  p_organization_id uuid,p_after_sequence bigint,p_limit integer default 200
) returns jsonb language sql security invoker set search_path=''
as $$ select private.list_inventory_sync_changes(p_organization_id,p_after_sequence,p_limit); $$;

revoke all on function public.create_inventory_item(uuid,uuid,uuid,jsonb,numeric,jsonb) from public, anon;
revoke all on function public.update_inventory_item_metadata(uuid,uuid,uuid,timestamptz,jsonb) from public, anon;
revoke all on function public.apply_inventory_movement(uuid,uuid,uuid,timestamptz,jsonb) from public, anon;
revoke all on function public.archive_inventory_item(uuid,uuid,uuid,timestamptz) from public, anon;
revoke all on function public.get_inventory_sync_checkpoint(uuid) from public, anon;
revoke all on function public.list_inventory_sync_changes(uuid,bigint,integer) from public, anon;

grant execute on function public.create_inventory_item(uuid,uuid,uuid,jsonb,numeric,jsonb) to authenticated;
grant execute on function public.update_inventory_item_metadata(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.apply_inventory_movement(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.archive_inventory_item(uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.get_inventory_sync_checkpoint(uuid) to authenticated;
grant execute on function public.list_inventory_sync_changes(uuid,bigint,integer) to authenticated;

comment on table public.inventory_items is
  'Organization-scoped Local-first inventory mirror. Browser writes are only through checked RPCs.';
comment on table public.inventory_movements is
  'Append-only stock ledger. Direct browser writes are revoked; quantities change only through atomic RPCs.';
comment on table private.inventory_mutation_receipts is
  'Idempotency receipts for Local-first inventory mutations.';
comment on table private.inventory_sync_events is
  'Ordered, tenant-scoped inventory change feed for incremental pull.';

commit;
