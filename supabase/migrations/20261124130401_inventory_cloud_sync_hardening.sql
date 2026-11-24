-- Tighten inventory RPC invariants after initial Local/Cloud sync rollout.
revoke all on function private.record_inventory_sync_event(uuid,uuid,text,uuid,jsonb,jsonb) from public, anon, authenticated;

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
    code=v_item.code,
    code_normalized=v_item.code_normalized,
    name=coalesce(nullif(btrim(p_payload->>'name'),''),v_item.name),
    item_group=coalesce(nullif(btrim(p_payload->>'item_group'),''),'Khác'),
    unit=coalesce(nullif(btrim(p_payload->>'unit'),''),v_item.unit),
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
  v_counted numeric(20,6);
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
  v_counted:=nullif(p_movement->>'counted_quantity','')::numeric;
  if v_type not in ('Nhập','Xuất','Điều chỉnh') then raise exception 'Unsupported movement type' using errcode='22023'; end if;
  if v_qty<=0 or v_before<>v_item.quantity or v_after<>v_before+v_delta or abs(v_delta)<>v_qty or v_after<0 then
    raise exception 'Invalid movement quantity or balance snapshot' using errcode='22023';
  end if;
  if v_type='Nhập' and (v_delta<=0 or v_counted is not null) then raise exception 'Invalid stock-in movement' using errcode='22023'; end if;
  if v_type='Xuất' and (v_delta>=0 or v_counted is not null) then raise exception 'Invalid stock-out movement' using errcode='22023'; end if;
  if v_type='Điều chỉnh' and (v_delta=0 or v_counted is null or v_counted<>v_after) then
    raise exception 'Counted quantity must equal adjusted stock balance' using errcode='22023';
  end if;
  v_movement_type:=case v_type when 'Nhập' then 'in' when 'Xuất' then 'out' else 'adjustment' end;

  insert into public.inventory_movements (
    id,organization_id,item_id,movement_date,movement_type,quantity,quantity_delta,
    balance_before,balance_after,counted_quantity,reason,note,performed_by,actor_user_id,linked_asset_id,mutation_id
  ) values (
    (p_movement->>'id')::uuid,p_organization_id,p_item_id,
    coalesce(nullif(p_movement->>'date','')::date,current_date),v_movement_type,v_qty,v_delta,
    v_before,v_after,v_counted,
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