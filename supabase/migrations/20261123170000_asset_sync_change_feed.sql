-- Durable tenant-scoped Cloud change feed for Incremental Pull.
-- Feed is private; clients access only the checked RPC wrappers.
begin;

create table private.asset_sync_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

create table private.asset_sync_events (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence bigint not null check (sequence > 0),
  event_type text not null check (event_type in ('upsert','soft_delete','hard_delete','reset')),
  asset_id uuid,
  asset_code text,
  asset_updated_at timestamptz,
  reset_generation bigint,
  snapshot jsonb check (snapshot is null or jsonb_typeof(snapshot)='object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, sequence),
  check ((event_type='reset' and asset_id is null and asset_code is null and snapshot is null and reset_generation is not null)
      or (event_type<>'reset' and asset_id is not null and asset_code is not null))
);
create index asset_sync_events_org_sequence_idx
  on private.asset_sync_events (organization_id, sequence);

alter table private.asset_sync_counters enable row level security;
alter table private.asset_sync_events enable row level security;
revoke all on private.asset_sync_counters from public, anon, authenticated;
revoke all on private.asset_sync_events from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Allocate per-organization sequence values while holding that org's counter row lock.
-- This preserves commit order for a tenant: the next transaction cannot allocate
-- a higher sequence until the transaction holding the current sequence commits.
create function private.append_asset_sync_event(
  p_organization_id uuid,
  p_event_type text,
  p_asset_id uuid,
  p_asset_code text,
  p_asset_updated_at timestamptz,
  p_reset_generation bigint,
  p_snapshot jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_sequence bigint;
begin
  if p_organization_id is null or p_event_type not in ('upsert','soft_delete','hard_delete','reset') then
    raise exception 'Invalid asset sync event' using errcode='22023';
  end if;

  insert into private.asset_sync_counters(organization_id,last_sequence)
  values(p_organization_id,1)
  on conflict(organization_id) do update
    set last_sequence=private.asset_sync_counters.last_sequence+1,
        updated_at=clock_timestamp()
  returning last_sequence into v_sequence;

  insert into private.asset_sync_events(
    organization_id,sequence,event_type,asset_id,asset_code,asset_updated_at,
    reset_generation,snapshot
  ) values (
    p_organization_id,v_sequence,p_event_type,p_asset_id,p_asset_code,
    p_asset_updated_at,p_reset_generation,p_snapshot
  );
  return v_sequence;
end;
$function$;
revoke all on function private.append_asset_sync_event(uuid,text,uuid,text,timestamptz,bigint,jsonb) from public,anon,authenticated;

create function private.capture_asset_sync_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_generation bigint;
  v_event_type text;
  v_snapshot jsonb;
begin
  if current_setting('app.asset_sync_suppress_asset_events',true)='on' then
    return coalesce(new,old);
  end if;

  if tg_op='DELETE' then
    select coalesce(generation,0) into v_generation
      from private.organization_asset_reset_state
     where organization_id=old.organization_id;
    perform private.append_asset_sync_event(
      old.organization_id,'hard_delete',old.id,old.code,old.updated_at,
      coalesce(v_generation,0),null
    );
    return old;
  end if;

  select coalesce(generation,0) into v_generation
    from private.organization_asset_reset_state
   where organization_id=new.organization_id;

  if tg_op='INSERT' then
    v_event_type:=case when new.deleted_at is null then 'upsert' else 'soft_delete' end;
  elsif new.deleted_at is not null then
    v_event_type:='soft_delete';
  else
    v_event_type:='upsert';
  end if;

  v_snapshot:=(to_jsonb(new)-'id')||jsonb_build_object('asset_key',new.code);
  perform private.append_asset_sync_event(
    new.organization_id,v_event_type,new.id,new.code,new.updated_at,
    coalesce(v_generation,0),v_snapshot
  );
  return new;
end;
$function$;
revoke all on function private.capture_asset_sync_event() from public,anon,authenticated;

create trigger assets_capture_sync_event
after insert or update or delete on public.assets
for each row execute function private.capture_asset_sync_event();

create function private.capture_asset_reset_sync_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
begin
  if new.generation is distinct from old.generation then
    perform private.append_asset_sync_event(
      new.organization_id,'reset',null,null,null,new.generation,null
    );
  end if;
  return new;
end;
$function$;
revoke all on function private.capture_asset_reset_sync_event() from public,anon,authenticated;

create trigger organization_asset_reset_state_capture_sync_event
after update of generation on private.organization_asset_reset_state
for each row execute function private.capture_asset_reset_sync_event();

-- Checkpoint reads sequence + reset generation in one statement snapshot.
create function private.get_asset_sync_checkpoint(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_uid uuid:=auth.uid();
  v_checkpoint jsonb;
begin
  if v_uid is null or not private.has_org_permission(p_organization_id,'assets.view') then
    raise exception 'Missing assets.view permission for this organization' using errcode='42501';
  end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then
    raise exception 'Active organization not found' using errcode='P0002';
  end if;
  select jsonb_build_object(
    'last_sequence',coalesce(c.last_sequence,0),
    'reset_generation',coalesce(r.generation,0)
  ) into v_checkpoint
  from public.organizations o
  left join private.asset_sync_counters c on c.organization_id=o.id
  left join private.organization_asset_reset_state r on r.organization_id=o.id
  where o.id=p_organization_id and o.status='active';
  return v_checkpoint;
end;
$function$;

create function private.list_asset_sync_changes(
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

revoke all on function private.get_asset_sync_checkpoint(uuid) from public,anon,authenticated;
revoke all on function private.list_asset_sync_changes(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function private.get_asset_sync_checkpoint(uuid) to authenticated;
grant execute on function private.list_asset_sync_changes(uuid,bigint,integer) to authenticated;

create function public.get_asset_sync_checkpoint(p_organization_id uuid)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.get_asset_sync_checkpoint(p_organization_id); $function$;

create function public.list_asset_sync_changes(
  p_organization_id uuid,p_after_sequence bigint,p_limit integer default 200
) returns jsonb language sql security invoker set search_path=''
as $function$ select private.list_asset_sync_changes(p_organization_id,p_after_sequence,p_limit); $function$;

revoke all on function public.get_asset_sync_checkpoint(uuid) from public,anon;
revoke all on function public.list_asset_sync_changes(uuid,bigint,integer) from public,anon;
grant execute on function public.get_asset_sync_checkpoint(uuid) to authenticated;
grant execute on function public.list_asset_sync_changes(uuid,bigint,integer) to authenticated;

-- Emit one reset barrier and suppress per-asset DELETE events for the reset transaction.
create or replace function public.platform_reset_organization_assets(
  p_organization_id uuid,p_request_id uuid,p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $function$
declare
  v_generation bigint;
  v_existing private.organization_asset_reset_requests;
  v_assets bigint:=0;
  v_imports bigint:=0;
  v_mutations bigint:=0;
  v_locks bigint:=0;
  v_pending_devices bigint:=0;
begin
  if p_organization_id is null or p_request_id is null or p_actor_user_id is null then
    raise exception 'Organization, request and actor are required' using errcode='22023';
  end if;
  perform 1 from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'Organization not found' using errcode='P0002';end if;
  insert into private.organization_asset_reset_state(organization_id)
  values(p_organization_id) on conflict(organization_id) do nothing;
  select generation into v_generation from private.organization_asset_reset_state
   where organization_id=p_organization_id for update;
  select * into v_existing from private.organization_asset_reset_requests
   where organization_id=p_organization_id and request_id=p_request_id;
  if found then
    select count(*) into v_pending_devices from private.organization_asset_reset_devices
     where organization_id=p_organization_id and acknowledged_generation<v_existing.generation;
    return jsonb_build_object(
      'ok',true,'already_applied',true,'organization_id',p_organization_id,
      'generation',v_existing.generation,'assets_deleted',v_existing.assets_deleted,
      'import_receipts_deleted',v_existing.import_receipts_deleted,
      'mutation_receipts_deleted',v_existing.mutation_receipts_deleted,
      'edit_locks_deleted',v_existing.edit_locks_deleted,'pending_devices',v_pending_devices
    );
  end if;

  v_generation:=v_generation+1;
  update private.organization_asset_reset_state
   set generation=v_generation,reset_at=clock_timestamp(),updated_at=clock_timestamp()
   where organization_id=p_organization_id;

  update public.asset_activity_history set asset_id=null
   where organization_id=p_organization_id and asset_id is not null;
  update private.asset_group_change_history set asset_id=null
   where organization_id=p_organization_id and asset_id is not null;
  delete from public.asset_import_receipts where organization_id=p_organization_id;
  get diagnostics v_imports=row_count;
  delete from public.asset_mutation_receipts where organization_id=p_organization_id;
  get diagnostics v_mutations=row_count;
  delete from public.asset_edit_locks where organization_id=p_organization_id;
  get diagnostics v_locks=row_count;

  update private.asset_id_sequence_reservations
   set status='released',asset_id=null,equipment_id=null,released_at=clock_timestamp()
   where organization_id=p_organization_id and status='reserved';

  perform set_config('app.asset_sync_suppress_asset_events','on',true);
  delete from public.assets where organization_id=p_organization_id;
  get diagnostics v_assets=row_count;
  perform set_config('app.asset_sync_suppress_asset_events','off',true);

  insert into private.organization_asset_reset_requests(
    organization_id,request_id,generation,actor_user_id,
    assets_deleted,import_receipts_deleted,mutation_receipts_deleted,edit_locks_deleted
  ) values(p_organization_id,p_request_id,v_generation,p_actor_user_id,
    v_assets,v_imports,v_mutations,v_locks);

  select count(*) into v_pending_devices from private.organization_asset_reset_devices
   where organization_id=p_organization_id and acknowledged_generation<v_generation;
  return jsonb_build_object(
    'ok',true,'already_applied',false,'organization_id',p_organization_id,
    'generation',v_generation,'assets_deleted',v_assets,
    'import_receipts_deleted',v_imports,'mutation_receipts_deleted',v_mutations,
    'edit_locks_deleted',v_locks,'pending_devices',v_pending_devices
  );
end;
$function$;

commit;
