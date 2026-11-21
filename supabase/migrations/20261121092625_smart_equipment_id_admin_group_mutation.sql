-- Extend the locked Cloud mutation RPC with an Admin-only current-group field.
-- Legacy pending payloads without category remain valid and preserve the Cloud category.

create or replace function public.apply_asset_mutation_with_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_receipt public.asset_mutation_receipts;
  v_lock public.asset_edit_locks;
  v_asset public.assets;
  v_input public.assets;
  v_snapshot jsonb;
  v_applied_at timestamptz;
  v_required_keys text[] := array[
    'name', 'brand', 'model', 'serial', 'location',
    'commissioned_at', 'power', 'cycle', 'cycle_started_at',
    'transferred_from_other_facility', 'status', 'notes', 'archived_at'
  ];
  v_allowed_keys text[];
begin
  v_allowed_keys := v_required_keys || array['category'];

  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_organization_id is null or p_asset_id is null or p_lock_token is null
     or p_mutation_id is null or p_expected_cloud_updated_at is null then
    raise exception 'Organization, asset, lease, mutation and expected version are required' using errcode = '22023';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_payload) is distinct from 'object'
     or not (p_payload ?& v_required_keys)
     or (p_payload - v_allowed_keys) <> '{}'::jsonb then
    raise exception 'Asset mutation payload has missing or unsupported fields' using errcode = '22023';
  end if;
  if p_payload ? 'category' and pg_catalog.jsonb_typeof(p_payload -> 'category') not in ('string','null') then
    raise exception 'Invalid current equipment group field' using errcode = '22023';
  end if;

  perform private.lock_asset_anchor(p_organization_id, p_asset_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_mutation_id::text, 0)
  );

  select * into v_receipt from public.asset_mutation_receipts r
  where r.organization_id=p_organization_id and r.mutation_id=p_mutation_id;
  if found then
    if v_receipt.applied_by_user_id<>auth.uid() or v_receipt.asset_id<>p_asset_id then
      raise exception 'Mutation receipt belongs to another user or asset' using errcode = '42501';
    end if;
    if v_receipt.expected_cloud_updated_at<>p_expected_cloud_updated_at or v_receipt.request_payload<>p_payload then
      raise exception 'Mutation ID was already used with a different request' using errcode = '22023';
    end if;
    return jsonb_build_object('already_applied',true,'asset',v_receipt.result_snapshot,'applied_at',v_receipt.applied_at);
  end if;

  select * into v_lock from public.asset_edit_locks l
  where l.organization_id=p_organization_id and l.asset_id=p_asset_id for update;

  select * into v_receipt from public.asset_mutation_receipts r
  where r.organization_id=p_organization_id and r.mutation_id=p_mutation_id;
  if found then
    if v_receipt.applied_by_user_id<>auth.uid() or v_receipt.asset_id<>p_asset_id then
      raise exception 'Mutation receipt belongs to another user or asset' using errcode = '42501';
    end if;
    if v_receipt.expected_cloud_updated_at<>p_expected_cloud_updated_at or v_receipt.request_payload<>p_payload then
      raise exception 'Mutation ID was already used with a different request' using errcode = '22023';
    end if;
    return jsonb_build_object('already_applied',true,'asset',v_receipt.result_snapshot,'applied_at',v_receipt.applied_at);
  end if;

  if v_lock.organization_id is null then raise exception 'Asset edit lease is missing' using errcode = '55000'; end if;
  if v_lock.holder_user_id<>auth.uid() or v_lock.lock_token<>p_lock_token or v_lock.expires_at<=clock_timestamp() then
    raise exception 'Asset edit lease is not owned or has expired' using errcode = '55000';
  end if;

  select * into v_asset from public.assets a
  where a.organization_id=p_organization_id and a.id=p_asset_id for update;
  if not found then raise exception 'Asset not found in this organization' using errcode = 'P0002'; end if;
  if v_asset.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Cloud asset version changed; manual conflict resolution is required' using errcode = '40001';
  end if;

  v_input := pg_catalog.jsonb_populate_record(null::public.assets,p_payload);
  if nullif(btrim(v_input.name),'') is null then raise exception 'Asset name is required' using errcode = '22023'; end if;
  if v_input.status is null or v_input.status not in ('Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý') then
    raise exception 'Unsupported asset status' using errcode = '22023';
  end if;
  if p_payload ? 'category' and nullif(btrim(coalesce(v_input.category,'')),'') is null then
    raise exception 'Current equipment group cannot be blank' using errcode = '22023';
  end if;
  if p_payload ? 'category' and btrim(v_input.category) is distinct from v_asset.category
     and not public.has_org_permission(p_organization_id,'settings.manage') then
    raise exception 'Only an organization Admin may change the current equipment group' using errcode = '42501';
  end if;

  update public.assets a
  set category=case when p_payload ? 'category'
        then coalesce(nullif(btrim(v_input.category),''),v_asset.category) else v_asset.category end,
      name=btrim(v_input.name),
      brand=coalesce(v_input.brand,''),
      model=coalesce(v_input.model,''),
      serial=coalesce(v_input.serial,''),
      location=coalesce(v_input.location,''),
      commissioned_at=v_input.commissioned_at,
      power=coalesce(v_input.power,''),
      cycle=coalesce(v_input.cycle,''),
      cycle_started_at=v_input.cycle_started_at,
      transferred_from_other_facility=coalesce(v_input.transferred_from_other_facility,false),
      status=v_input.status,
      notes=coalesce(v_input.notes,''),
      archived_at=v_input.archived_at,
      updated_at=clock_timestamp()
  where a.organization_id=p_organization_id and a.id=p_asset_id
  returning * into v_asset;

  v_snapshot:=to_jsonb(v_asset);
  v_applied_at:=clock_timestamp();
  insert into public.asset_mutation_receipts(
    organization_id,mutation_id,asset_id,applied_by_user_id,
    expected_cloud_updated_at,request_payload,result_snapshot,applied_at
  ) values(
    p_organization_id,p_mutation_id,p_asset_id,auth.uid(),
    p_expected_cloud_updated_at,p_payload,v_snapshot,v_applied_at
  );
  return jsonb_build_object('already_applied',false,'asset',v_snapshot,'applied_at',v_applied_at);
end;
$function$;

revoke all on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
