-- Extend the existing approved organization reset to include the complete inventory domain.
-- No reset is executed by this migration; it only changes the approved reset workflow.
begin;

alter table private.organization_asset_reset_requests
  add column if not exists inventory_items_deleted bigint not null default 0,
  add column if not exists inventory_movements_deleted bigint not null default 0,
  add column if not exists inventory_mutation_receipts_deleted bigint not null default 0,
  add column if not exists inventory_sync_events_deleted bigint not null default 0;

alter table private.organization_asset_reset_approval_requests
  add column if not exists cloud_inventory_items_at_request bigint not null default 0,
  add column if not exists cloud_inventory_movements_at_request bigint not null default 0,
  add column if not exists inventory_items_deleted bigint,
  add column if not exists inventory_movements_deleted bigint,
  add column if not exists inventory_mutation_receipts_deleted bigint,
  add column if not exists inventory_sync_events_deleted bigint;

-- Serialize inventory writes with the organization row lock used by reset.
-- An in-flight write finishes before reset; writes cannot interleave with the purge transaction.
create or replace function private.lock_inventory_write_to_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform 1 from public.organizations
   where id = new.organization_id
   for key share;
  if not found then
    raise exception 'Inventory organization not found' using errcode = 'P0002';
  end if;
  return new;
end;
$function$;

drop trigger if exists inventory_items_organization_write_lock on public.inventory_items;
create trigger inventory_items_organization_write_lock
before insert or update on public.inventory_items
for each row execute function private.lock_inventory_write_to_organization();

drop trigger if exists inventory_movements_organization_write_lock on public.inventory_movements;
create trigger inventory_movements_organization_write_lock
before insert or update on public.inventory_movements
for each row execute function private.lock_inventory_write_to_organization();

revoke all on function private.lock_inventory_write_to_organization() from public, anon, authenticated;

create or replace function public.platform_reset_organization_assets(
  p_organization_id uuid,
  p_request_id uuid,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
  v_existing private.organization_asset_reset_requests;
  v_assets bigint := 0;
  v_imports bigint := 0;
  v_mutations bigint := 0;
  v_locks bigint := 0;
  v_inventory_items bigint := 0;
  v_inventory_movements bigint := 0;
  v_inventory_receipts bigint := 0;
  v_inventory_events bigint := 0;
  v_pending_devices bigint := 0;
begin
  if p_organization_id is null or p_request_id is null or p_actor_user_id is null then
    raise exception 'Organization, request and actor are required' using errcode = '22023';
  end if;

  perform 1 from public.organizations
   where id = p_organization_id
   for update;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  insert into private.organization_asset_reset_state (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;

  select generation into v_generation
    from private.organization_asset_reset_state
   where organization_id = p_organization_id
   for update;

  select * into v_existing
    from private.organization_asset_reset_requests
   where organization_id = p_organization_id
     and request_id = p_request_id;

  if found then
    select count(*) into v_pending_devices
      from private.organization_asset_reset_devices
     where organization_id = p_organization_id
       and acknowledged_generation < v_existing.generation;
    return jsonb_build_object(
      'ok', true, 'already_applied', true,
      'organization_id', p_organization_id,
      'generation', v_existing.generation,
      'assets_deleted', v_existing.assets_deleted,
      'import_receipts_deleted', v_existing.import_receipts_deleted,
      'mutation_receipts_deleted', v_existing.mutation_receipts_deleted,
      'edit_locks_deleted', v_existing.edit_locks_deleted,
      'inventory_items_deleted', v_existing.inventory_items_deleted,
      'inventory_movements_deleted', v_existing.inventory_movements_deleted,
      'inventory_mutation_receipts_deleted', v_existing.inventory_mutation_receipts_deleted,
      'inventory_sync_events_deleted', v_existing.inventory_sync_events_deleted,
      'pending_devices', v_pending_devices
    );
  end if;

  v_generation := v_generation + 1;

  update private.organization_asset_reset_state
     set generation = v_generation,
         reset_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where organization_id = p_organization_id;

  update public.asset_activity_history
     set asset_id = null
   where organization_id = p_organization_id
     and asset_id is not null;

  update private.asset_group_change_history
     set asset_id = null
   where organization_id = p_organization_id
     and asset_id is not null;

  delete from public.asset_import_receipts
   where organization_id = p_organization_id;
  get diagnostics v_imports = row_count;

  delete from public.asset_mutation_receipts
   where organization_id = p_organization_id;
  get diagnostics v_mutations = row_count;

  delete from public.asset_edit_locks
   where organization_id = p_organization_id;
  get diagnostics v_locks = row_count;

  -- Retain equipment ID reservation history and sequence counters; release only unfinished reservations.
  update private.asset_id_sequence_reservations
     set status = 'released',
         asset_id = null,
         equipment_id = null,
         released_at = clock_timestamp()
   where organization_id = p_organization_id
     and status = 'reserved';

  delete from public.assets
   where organization_id = p_organization_id;
  get diagnostics v_assets = row_count;

  -- Inventory is a complete wipe: stock items, all stock movements, retry receipts and feed events.
  -- Count movements before deleting them; no inventory history is retained.
  select count(*) into v_inventory_items
    from public.inventory_items where organization_id = p_organization_id;
  select count(*) into v_inventory_movements
    from public.inventory_movements where organization_id = p_organization_id;

  delete from public.inventory_movements
   where organization_id = p_organization_id;
  delete from public.inventory_items
   where organization_id = p_organization_id;

  delete from private.inventory_mutation_receipts
   where organization_id = p_organization_id;
  get diagnostics v_inventory_receipts = row_count;

  delete from private.inventory_sync_events
   where organization_id = p_organization_id;
  get diagnostics v_inventory_events = row_count;

  insert into private.organization_asset_reset_requests (
    organization_id, request_id, generation, actor_user_id,
    assets_deleted, import_receipts_deleted, mutation_receipts_deleted, edit_locks_deleted,
    inventory_items_deleted, inventory_movements_deleted,
    inventory_mutation_receipts_deleted, inventory_sync_events_deleted
  ) values (
    p_organization_id, p_request_id, v_generation, p_actor_user_id,
    v_assets, v_imports, v_mutations, v_locks,
    v_inventory_items, v_inventory_movements, v_inventory_receipts, v_inventory_events
  );

  select count(*) into v_pending_devices
    from private.organization_asset_reset_devices
   where organization_id = p_organization_id
     and acknowledged_generation < v_generation;

  return jsonb_build_object(
    'ok', true, 'already_applied', false,
    'organization_id', p_organization_id,
    'generation', v_generation,
    'assets_deleted', v_assets,
    'import_receipts_deleted', v_imports,
    'mutation_receipts_deleted', v_mutations,
    'edit_locks_deleted', v_locks,
    'inventory_items_deleted', v_inventory_items,
    'inventory_movements_deleted', v_inventory_movements,
    'inventory_mutation_receipts_deleted', v_inventory_receipts,
    'inventory_sync_events_deleted', v_inventory_events,
    'pending_devices', v_pending_devices
  );
end;
$function$;

create or replace function public.create_organization_asset_reset_request(
  p_organization_id uuid,
  p_requester_user_id uuid,
  p_request_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_org_status text;
  v_role text;
  v_member_status text;
  v_assets bigint;
  v_inventory_items bigint;
  v_inventory_movements bigint;
  v_devices bigint;
  v_request private.organization_asset_reset_approval_requests;
begin
  if p_requester_user_id is null then
    raise exception 'Requester is required' using errcode='22023';
  end if;
  select o.status into v_org_status
    from public.organizations o where o.id=p_organization_id for update;
  if not found then raise exception 'Không tìm thấy tổ chức.' using errcode='P0002'; end if;
  select m.role,m.status into v_role,v_member_status
    from public.organization_members m
   where m.organization_id=p_organization_id and m.user_id=p_requester_user_id
   limit 1;
  if v_role is distinct from 'admin' or v_member_status is distinct from 'active' then
    raise exception 'Chỉ Admin đang hoạt động của doanh nghiệp mới được gửi yêu cầu Reset.' using errcode='42501';
  end if;
  if v_org_status is distinct from 'active' then
    raise exception 'Tổ chức đang tạm ngưng; không thể gửi yêu cầu Reset.' using errcode='55000';
  end if;

  select count(*) into v_assets from public.assets a where a.organization_id=p_organization_id;
  select count(*) into v_inventory_items from public.inventory_items i where i.organization_id=p_organization_id;
  select count(*) into v_inventory_movements from public.inventory_movements m where m.organization_id=p_organization_id;
  select count(*) into v_devices from private.organization_asset_reset_devices d where d.organization_id=p_organization_id;

  insert into private.organization_asset_reset_approval_requests(
    organization_id,requester_user_id,requester_note,cloud_assets_at_request,
    registered_devices_at_request,cloud_inventory_items_at_request,cloud_inventory_movements_at_request
  ) values (
    p_organization_id,p_requester_user_id,left(coalesce(p_request_note,''),1000),
    v_assets,v_devices,v_inventory_items,v_inventory_movements
  ) returning * into v_request;

  return jsonb_build_object(
    'id',v_request.id,'organization_id',v_request.organization_id,'status',v_request.status,
    'requested_at',v_request.requested_at,'cloud_assets_at_request',v_request.cloud_assets_at_request,
    'cloud_inventory_items_at_request',v_request.cloud_inventory_items_at_request,
    'cloud_inventory_movements_at_request',v_request.cloud_inventory_movements_at_request,
    'registered_devices_at_request',v_request.registered_devices_at_request
  );
exception when unique_violation then
  raise exception 'Tổ chức đang có yêu cầu Reset chờ xử lý. Hãy chờ Superadmin duyệt hoặc từ chối.' using errcode='23505';
end;
$function$;

create or replace function public.list_organization_asset_reset_requests(p_organization_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
set row_security = off
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'organization_id',r.organization_id,'requester_user_id',r.requester_user_id,
    'requester_email',u.email,'requester_note',r.requester_note,'status',r.status,
    'cloud_assets_at_request',r.cloud_assets_at_request,
    'cloud_inventory_items_at_request',r.cloud_inventory_items_at_request,
    'cloud_inventory_movements_at_request',r.cloud_inventory_movements_at_request,
    'registered_devices_at_request',r.registered_devices_at_request,
    'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,
    'review_note',r.review_note,'executed_at',r.executed_at,
    'reset_generation',r.reset_generation,'assets_deleted',r.assets_deleted,
    'inventory_items_deleted',r.inventory_items_deleted,
    'inventory_movements_deleted',r.inventory_movements_deleted,
    'inventory_mutation_receipts_deleted',r.inventory_mutation_receipts_deleted,
    'inventory_sync_events_deleted',r.inventory_sync_events_deleted,
    'execution_error',r.execution_error
  ) order by r.requested_at desc),'[]'::jsonb)
  from private.organization_asset_reset_approval_requests r
  left join auth.users u on u.id=r.requester_user_id
  where r.organization_id=p_organization_id;
$function$;

create or replace function public.list_platform_organization_asset_reset_requests()
returns jsonb
language sql
security definer
set search_path = ''
set row_security = off
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'organization_id',r.organization_id,'organization_name',o.name,
    'requester_user_id',r.requester_user_id,'requester_email',u.email,
    'requester_note',r.requester_note,'status',r.status,
    'cloud_assets_at_request',r.cloud_assets_at_request,
    'cloud_inventory_items_at_request',r.cloud_inventory_items_at_request,
    'cloud_inventory_movements_at_request',r.cloud_inventory_movements_at_request,
    'registered_devices_at_request',r.registered_devices_at_request,
    'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,
    'review_note',r.review_note,'executed_at',r.executed_at,
    'reviewer_user_id',r.reviewed_by_user_id,
    'reset_generation',r.reset_generation,'assets_deleted',r.assets_deleted,
    'inventory_items_deleted',r.inventory_items_deleted,
    'inventory_movements_deleted',r.inventory_movements_deleted,
    'inventory_mutation_receipts_deleted',r.inventory_mutation_receipts_deleted,
    'inventory_sync_events_deleted',r.inventory_sync_events_deleted,
    'execution_error',r.execution_error
  ) order by r.requested_at desc),'[]'::jsonb)
  from private.organization_asset_reset_approval_requests r
  join public.organizations o on o.id=r.organization_id
  left join auth.users u on u.id=r.requester_user_id;
$function$;

create or replace function public.review_organization_asset_reset_request(
  p_request_id uuid,
  p_reviewer_user_id uuid,
  p_decision text,
  p_review_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_request private.organization_asset_reset_approval_requests;
  v_reset jsonb;
  v_error text;
begin
  if p_reviewer_user_id is null then raise exception 'Reviewer is required' using errcode='22023'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Decision is invalid' using errcode='22023'; end if;
  if p_decision='reject' and length(btrim(coalesce(p_review_note,'')))=0 then
    raise exception 'A rejection reason is required' using errcode='22023';
  end if;

  select * into v_request
    from private.organization_asset_reset_approval_requests
   where id=p_request_id for update;
  if not found then raise exception 'Không tìm thấy yêu cầu Reset.' using errcode='P0002'; end if;
  if v_request.status <> 'pending' then
    raise exception 'Yêu cầu đã được xử lý hoặc không còn ở trạng thái chờ duyệt.' using errcode='55000';
  end if;

  if p_decision='reject' then
    update private.organization_asset_reset_approval_requests
       set status='rejected',reviewed_by_user_id=p_reviewer_user_id,
           reviewed_at=clock_timestamp(),review_note=left(coalesce(p_review_note,''),1000)
     where id=p_request_id;
    return jsonb_build_object('status','rejected','request_id',p_request_id);
  end if;

  update private.organization_asset_reset_approval_requests
     set status='approved',reviewed_by_user_id=p_reviewer_user_id,
         reviewed_at=clock_timestamp(),review_note=left(coalesce(p_review_note,''),1000)
   where id=p_request_id;

  begin
    v_reset := public.platform_reset_organization_assets(
      v_request.organization_id,v_request.request_id,p_reviewer_user_id
    );
    update private.organization_asset_reset_approval_requests
       set status='executed',executed_at=clock_timestamp(),
           reset_generation=nullif(v_reset->>'generation','')::bigint,
           assets_deleted=nullif(v_reset->>'assets_deleted','')::bigint,
           inventory_items_deleted=nullif(v_reset->>'inventory_items_deleted','')::bigint,
           inventory_movements_deleted=nullif(v_reset->>'inventory_movements_deleted','')::bigint,
           inventory_mutation_receipts_deleted=nullif(v_reset->>'inventory_mutation_receipts_deleted','')::bigint,
           inventory_sync_events_deleted=nullif(v_reset->>'inventory_sync_events_deleted','')::bigint,
           execution_error=null
     where id=p_request_id;
    return jsonb_build_object('status','executed','request_id',p_request_id,'reset',v_reset);
  exception when others then
    get stacked diagnostics v_error = message_text;
    update private.organization_asset_reset_approval_requests
       set status='failed',execution_error=left(v_error,1000)
     where id=p_request_id;
    return jsonb_build_object('status','failed','request_id',p_request_id,'error',v_error);
  end;
end;
$function$;

commit;
