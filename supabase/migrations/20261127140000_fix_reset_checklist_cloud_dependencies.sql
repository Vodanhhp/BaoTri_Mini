-- Make selective Reset compatible with the Cloud Checklist data model.
-- Checklist and maintenance history are removed/detached only when their scope is selected.
begin;

alter table private.organization_asset_reset_requests
  add column if not exists checklist_definitions_deleted bigint not null default 0,
  add column if not exists checklist_runs_deleted bigint not null default 0,
  add column if not exists checklist_tasks_deleted bigint not null default 0,
  add column if not exists checklist_task_events_deleted bigint not null default 0,
  add column if not exists checklist_definition_versions_deleted bigint not null default 0;

alter table private.organization_asset_reset_approval_requests
  add column if not exists cloud_checklist_definitions_at_request bigint not null default 0,
  add column if not exists cloud_checklist_definition_versions_at_request bigint not null default 0,
  add column if not exists cloud_checklist_runs_at_request bigint not null default 0,
  add column if not exists cloud_checklist_tasks_at_request bigint not null default 0,
  add column if not exists cloud_checklist_task_events_at_request bigint not null default 0,
  add column if not exists checklist_definitions_deleted bigint,
  add column if not exists checklist_definition_versions_deleted bigint,
  add column if not exists checklist_runs_deleted bigint,
  add column if not exists checklist_tasks_deleted bigint,
  add column if not exists checklist_task_events_deleted bigint;

-- The previous request counters are retained as compatibility aliases:
-- templates = definitions; results = completed Checklist runs.
create or replace function public.create_organization_asset_reset_request(
  p_organization_id uuid,
  p_requester_user_id uuid,
  p_request_note text default '',
  p_reset_assets boolean default false,
  p_reset_inventory boolean default false,
  p_reset_checklist boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_status text;
  v_role text;
  v_member text;
  v_assets bigint;
  v_inventory_items bigint;
  v_inventory_movements bigint;
  v_devices bigint;
  v_definitions bigint := 0;
  v_versions bigint := 0;
  v_runs bigint := 0;
  v_tasks bigint := 0;
  v_events bigint := 0;
  v_request private.organization_asset_reset_approval_requests;
begin
  if p_requester_user_id is null then
    raise exception 'Requester is required' using errcode='22023';
  end if;
  if not (coalesce(p_reset_assets,false) or coalesce(p_reset_inventory,false) or coalesce(p_reset_checklist,false)) then
    raise exception 'Phải chọn ít nhất một phạm vi Reset.' using errcode='22023';
  end if;

  select status into v_status from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'Không tìm thấy tổ chức.' using errcode='P0002'; end if;
  select role,status into v_role,v_member from public.organization_members
   where organization_id=p_organization_id and user_id=p_requester_user_id limit 1;
  if v_role is distinct from 'admin' or v_member is distinct from 'active' then
    raise exception 'Chỉ Admin đang hoạt động của doanh nghiệp mới được gửi yêu cầu Reset.' using errcode='42501';
  end if;
  if v_status is distinct from 'active' then
    raise exception 'Tổ chức đang tạm ngưng; không thể gửi yêu cầu Reset.' using errcode='55000';
  end if;

  select count(*) into v_assets from public.assets where organization_id=p_organization_id;
  select count(*) into v_inventory_items from public.inventory_items where organization_id=p_organization_id;
  select count(*) into v_inventory_movements from public.inventory_movements where organization_id=p_organization_id;
  select count(*) into v_devices from private.organization_asset_reset_devices where organization_id=p_organization_id;

  if to_regclass('public.checklist_definitions') is not null then
    execute 'select count(*) from public.checklist_definitions where organization_id=$1' into v_definitions using p_organization_id;
  end if;
  if to_regclass('public.checklist_definition_versions') is not null then
    execute 'select count(*) from public.checklist_definition_versions where organization_id=$1' into v_versions using p_organization_id;
  end if;
  if to_regclass('public.checklist_runs') is not null then
    execute 'select count(*) from public.checklist_runs where organization_id=$1' into v_runs using p_organization_id;
  end if;
  if to_regclass('public.checklist_tasks') is not null then
    execute 'select count(*) from public.checklist_tasks where organization_id=$1' into v_tasks using p_organization_id;
  end if;
  if to_regclass('public.checklist_task_events') is not null then
    execute 'select count(*) from public.checklist_task_events where organization_id=$1' into v_events using p_organization_id;
  end if;

  insert into private.organization_asset_reset_approval_requests(
    organization_id,requester_user_id,requester_note,
    reset_assets,reset_inventory,reset_checklist,
    cloud_assets_at_request,cloud_inventory_items_at_request,cloud_inventory_movements_at_request,
    cloud_checklist_templates_at_request,cloud_checklist_results_at_request,
    cloud_checklist_definitions_at_request,cloud_checklist_definition_versions_at_request,
    cloud_checklist_runs_at_request,cloud_checklist_tasks_at_request,cloud_checklist_task_events_at_request,
    registered_devices_at_request
  ) values (
    p_organization_id,p_requester_user_id,left(coalesce(p_request_note,''),1000),
    p_reset_assets,p_reset_inventory,p_reset_checklist,
    v_assets,v_inventory_items,v_inventory_movements,
    v_definitions,v_runs,v_definitions,v_versions,v_runs,v_tasks,v_events,v_devices
  ) returning * into v_request;

  return jsonb_build_object(
    'id',v_request.id,'organization_id',v_request.organization_id,'status',v_request.status,
    'requested_at',v_request.requested_at,'reset_assets',v_request.reset_assets,
    'reset_inventory',v_request.reset_inventory,'reset_checklist',v_request.reset_checklist,
    'cloud_assets_at_request',v_assets,'cloud_inventory_items_at_request',v_inventory_items,
    'cloud_inventory_movements_at_request',v_inventory_movements,
    'cloud_checklist_definitions_at_request',v_definitions,
    'cloud_checklist_definition_versions_at_request',v_versions,
    'cloud_checklist_runs_at_request',v_runs,'cloud_checklist_tasks_at_request',v_tasks,
    'cloud_checklist_task_events_at_request',v_events,
    'cloud_checklist_templates_at_request',v_definitions,'cloud_checklist_results_at_request',v_runs,
    'registered_devices_at_request',v_devices
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
    'requester_email',u.email,'requester_note',r.requester_note,
    'reset_assets',r.reset_assets,'reset_inventory',r.reset_inventory,'reset_checklist',r.reset_checklist,
    'cloud_assets_at_request',r.cloud_assets_at_request,
    'cloud_inventory_items_at_request',r.cloud_inventory_items_at_request,
    'cloud_inventory_movements_at_request',r.cloud_inventory_movements_at_request,
    'cloud_checklist_templates_at_request',r.cloud_checklist_templates_at_request,
    'cloud_checklist_results_at_request',r.cloud_checklist_results_at_request,
    'cloud_checklist_definitions_at_request',r.cloud_checklist_definitions_at_request,
    'cloud_checklist_definition_versions_at_request',r.cloud_checklist_definition_versions_at_request,
    'cloud_checklist_runs_at_request',r.cloud_checklist_runs_at_request,
    'cloud_checklist_tasks_at_request',r.cloud_checklist_tasks_at_request,
    'cloud_checklist_task_events_at_request',r.cloud_checklist_task_events_at_request,
    'registered_devices_at_request',r.registered_devices_at_request,
    'status',r.status,'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,
    'review_note',r.review_note,'executed_at',r.executed_at,'reset_generation',r.reset_generation,
    'assets_deleted',r.assets_deleted,'inventory_items_deleted',r.inventory_items_deleted,
    'inventory_movements_deleted',r.inventory_movements_deleted,
    'checklist_templates_deleted',r.checklist_templates_deleted,
    'checklist_versions_deleted',r.checklist_versions_deleted,
    'checklist_results_deleted',r.checklist_results_deleted,
    'checklist_definitions_deleted',r.checklist_definitions_deleted,
    'checklist_definition_versions_deleted',r.checklist_definition_versions_deleted,
    'checklist_runs_deleted',r.checklist_runs_deleted,
    'checklist_tasks_deleted',r.checklist_tasks_deleted,
    'checklist_task_events_deleted',r.checklist_task_events_deleted,
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
set row_security = 'off'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'organization_id',r.organization_id,'organization_name',o.name,
    'requester_user_id',r.requester_user_id,'requester_email',u.email,
    'requester_note',r.requester_note,
    'reset_assets',r.reset_assets,'reset_inventory',r.reset_inventory,'reset_checklist',r.reset_checklist,
    'cloud_assets_at_request',r.cloud_assets_at_request,
    'cloud_inventory_items_at_request',r.cloud_inventory_items_at_request,
    'cloud_inventory_movements_at_request',r.cloud_inventory_movements_at_request,
    'cloud_checklist_templates_at_request',r.cloud_checklist_templates_at_request,
    'cloud_checklist_results_at_request',r.cloud_checklist_results_at_request,
    'cloud_checklist_definitions_at_request',r.cloud_checklist_definitions_at_request,
    'cloud_checklist_definition_versions_at_request',r.cloud_checklist_definition_versions_at_request,
    'cloud_checklist_runs_at_request',r.cloud_checklist_runs_at_request,
    'cloud_checklist_tasks_at_request',r.cloud_checklist_tasks_at_request,
    'cloud_checklist_task_events_at_request',r.cloud_checklist_task_events_at_request,
    'registered_devices_at_request',r.registered_devices_at_request,
    'status',r.status,'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,
    'review_note',r.review_note,'executed_at',r.executed_at,
    'reviewer_user_id',r.reviewed_by_user_id,'reset_generation',r.reset_generation,
    'assets_deleted',r.assets_deleted,'inventory_items_deleted',r.inventory_items_deleted,
    'inventory_movements_deleted',r.inventory_movements_deleted,
    'inventory_mutation_receipts_deleted',r.inventory_mutation_receipts_deleted,
    'inventory_sync_events_deleted',r.inventory_sync_events_deleted,
    'checklist_templates_deleted',r.checklist_templates_deleted,
    'checklist_versions_deleted',r.checklist_versions_deleted,
    'checklist_results_deleted',r.checklist_results_deleted,
    'checklist_definitions_deleted',r.checklist_definitions_deleted,
    'checklist_definition_versions_deleted',r.checklist_definition_versions_deleted,
    'checklist_runs_deleted',r.checklist_runs_deleted,
    'checklist_tasks_deleted',r.checklist_tasks_deleted,
    'checklist_task_events_deleted',r.checklist_task_events_deleted,
    'execution_error',r.execution_error
  ) order by r.requested_at desc),'[]'::jsonb)
  from private.organization_asset_reset_approval_requests r
  join public.organizations o on o.id=r.organization_id
  left join auth.users u on u.id=r.requester_user_id;
$function$;

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
  v_req private.organization_asset_reset_approval_requests;
  v_old private.organization_asset_reset_requests;
  v_gen bigint;
  v_assets bigint:=0; v_imports bigint:=0; v_mutations bigint:=0; v_locks bigint:=0;
  v_inventory_items bigint:=0; v_inventory_movements bigint:=0;
  v_inventory_receipts bigint:=0; v_inventory_events bigint:=0;
  v_definitions bigint:=0; v_versions bigint:=0; v_runs bigint:=0; v_tasks bigint:=0; v_task_events bigint:=0;
  v_pending_devices bigint:=0; v_blocking_tasks bigint:=0; v_linked_definitions bigint:=0;
begin
  if p_organization_id is null or p_request_id is null or p_actor_user_id is null then
    raise exception 'Organization, request and actor are required' using errcode='22023';
  end if;
  perform 1 from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'Organization not found' using errcode='P0002'; end if;

  select * into v_req from private.organization_asset_reset_approval_requests
   where organization_id=p_organization_id and request_id=p_request_id for update;
  if not found then raise exception 'Approved reset request not found' using errcode='P0002'; end if;

  select * into v_old from private.organization_asset_reset_requests
   where organization_id=p_organization_id and request_id=p_request_id;
  if found then
    return jsonb_build_object(
      'ok',true,'already_applied',true,'generation',v_old.generation,
      'assets_deleted',v_old.assets_deleted,'inventory_items_deleted',v_old.inventory_items_deleted,
      'inventory_movements_deleted',v_old.inventory_movements_deleted,
      'checklist_definitions_deleted',v_old.checklist_definitions_deleted,
      'checklist_definition_versions_deleted',v_old.checklist_definition_versions_deleted,
      'checklist_runs_deleted',v_old.checklist_runs_deleted,
      'checklist_tasks_deleted',v_old.checklist_tasks_deleted,
      'checklist_task_events_deleted',v_old.checklist_task_events_deleted
    );
  end if;

  -- Preflight before changing generations or deleting anything.
  if v_req.reset_assets and not v_req.reset_checklist then
    select count(*) into v_linked_definitions from public.checklist_definitions
     where organization_id=p_organization_id and target_asset_id is not null;
    if v_linked_definitions>0 then
      raise exception 'Không thể Reset thiết bị khi còn % mẫu Checklist đang gắn thiết bị. Hãy chọn thêm Reset Checklist hoặc xử lý các mẫu này trước.',
        v_linked_definitions using errcode='23503';
    end if;
  end if;
  if v_req.reset_assets then
    select count(*) into v_blocking_tasks from public.maintenance_tasks
     where organization_id=p_organization_id and asset_id is not null;
    if v_blocking_tasks>0 then
      raise exception 'Không thể Reset thiết bị vì còn % lịch bảo trì đang gắn thiết bị. Hãy xử lý lịch bảo trì trước.',
        v_blocking_tasks using errcode='23503';
    end if;
  end if;

  insert into private.organization_asset_reset_state(organization_id)
  values(p_organization_id) on conflict do nothing;
  select generation into v_gen from private.organization_asset_reset_state
   where organization_id=p_organization_id for update;

  -- Clear Checklist's circular and historical back-links before deleting its selected scope.
  if v_req.reset_checklist then
    update private.organization_asset_reset_state
       set checklist_generation=checklist_generation+1,updated_at=clock_timestamp()
     where organization_id=p_organization_id;

    update public.maintenance_requests set checklist_run_id=null
     where organization_id=p_organization_id and checklist_run_id is not null;
    update public.checklist_runs set maintenance_request_id=null
     where organization_id=p_organization_id and maintenance_request_id is not null;
    update public.checklist_tasks set run_id=null
     where organization_id=p_organization_id and run_id is not null;
    update public.checklist_runs set task_id=null
     where organization_id=p_organization_id and task_id is not null;

    delete from public.checklist_task_events where organization_id=p_organization_id;
    get diagnostics v_task_events=row_count;
    delete from public.checklist_tasks where organization_id=p_organization_id;
    get diagnostics v_tasks=row_count;
    delete from public.checklist_runs where organization_id=p_organization_id;
    get diagnostics v_runs=row_count;
    delete from public.checklist_definition_versions where organization_id=p_organization_id;
    get diagnostics v_versions=row_count;
    delete from public.checklist_definitions where organization_id=p_organization_id;
    get diagnostics v_definitions=row_count;
    delete from public.checklist_category_settings where organization_id=p_organization_id;
  end if;

  if v_req.reset_inventory then
    update private.organization_asset_reset_state
       set inventory_generation=inventory_generation+1,updated_at=clock_timestamp()
     where organization_id=p_organization_id;
    select count(*) into v_inventory_items from public.inventory_items where organization_id=p_organization_id;
    select count(*) into v_inventory_movements from public.inventory_movements where organization_id=p_organization_id;
    delete from public.inventory_movements where organization_id=p_organization_id;
    delete from public.inventory_items where organization_id=p_organization_id;
    delete from private.inventory_mutation_receipts where organization_id=p_organization_id;
    get diagnostics v_inventory_receipts=row_count;
    delete from private.inventory_sync_events where organization_id=p_organization_id;
    get diagnostics v_inventory_events=row_count;
  end if;

  if v_req.reset_assets then
    update private.organization_asset_reset_state
       set generation=generation+1,reset_at=clock_timestamp(),updated_at=clock_timestamp()
     where organization_id=p_organization_id returning generation into v_gen;
    update public.asset_activity_history set asset_id=null
     where organization_id=p_organization_id and asset_id is not null;
    update private.asset_group_change_history set asset_id=null
     where organization_id=p_organization_id and asset_id is not null;
    if to_regclass('public.asset_import_receipts') is not null then
      execute 'delete from public.asset_import_receipts where organization_id=$1' using p_organization_id;
      get diagnostics v_imports=row_count;
    end if;
    delete from public.asset_mutation_receipts where organization_id=p_organization_id;
    get diagnostics v_mutations=row_count;
    delete from public.asset_edit_locks where organization_id=p_organization_id;
    get diagnostics v_locks=row_count;
    update private.asset_id_sequence_reservations
       set status='released',asset_id=null,equipment_id=null,released_at=clock_timestamp()
     where organization_id=p_organization_id and status='reserved';

    -- Keep maintenance requests and their audit history. Convert their former asset target
    -- into a labelled system target so the request survives the equipment reset.
    update public.maintenance_requests r
       set asset_id=null,
           target_kind='system',
           target_label=left(coalesce(nullif(btrim(r.target_label),''),nullif(btrim(concat_ws(' ',a.name,nullif(a.code,''))),''),'Thiết bị đã được Reset'),240),
           target_location=coalesce(nullif(btrim(r.target_location),''),nullif(btrim(a.location),''),'')
      from public.assets a
     where r.organization_id=p_organization_id and r.asset_id=a.id
       and a.organization_id=p_organization_id;

    delete from public.assets where organization_id=p_organization_id;
    get diagnostics v_assets=row_count;
  end if;

  insert into private.organization_asset_reset_requests(
    organization_id,request_id,generation,actor_user_id,
    assets_deleted,import_receipts_deleted,mutation_receipts_deleted,edit_locks_deleted,
    inventory_items_deleted,inventory_movements_deleted,inventory_mutation_receipts_deleted,inventory_sync_events_deleted,
    checklist_templates_deleted,checklist_versions_deleted,checklist_results_deleted,
    checklist_definitions_deleted,checklist_definition_versions_deleted,
    checklist_runs_deleted,checklist_tasks_deleted,checklist_task_events_deleted
  ) values (
    p_organization_id,p_request_id,v_gen,p_actor_user_id,
    v_assets,v_imports,v_mutations,v_locks,
    v_inventory_items,v_inventory_movements,v_inventory_receipts,v_inventory_events,
    v_definitions,v_versions,v_runs,v_definitions,v_versions,v_runs,v_tasks,v_task_events
  );

  select count(*) into v_pending_devices from private.organization_asset_reset_devices d
   join private.organization_asset_reset_state s on s.organization_id=d.organization_id
   where d.organization_id=p_organization_id
     and (d.acknowledged_generation<s.generation
       or d.acknowledged_inventory_generation<s.inventory_generation
       or d.acknowledged_checklist_generation<s.checklist_generation);

  return jsonb_build_object(
    'ok',true,'already_applied',false,'generation',v_gen,
    'assets_deleted',v_assets,'import_receipts_deleted',v_imports,
    'mutation_receipts_deleted',v_mutations,'edit_locks_deleted',v_locks,
    'inventory_items_deleted',v_inventory_items,'inventory_movements_deleted',v_inventory_movements,
    'inventory_mutation_receipts_deleted',v_inventory_receipts,'inventory_sync_events_deleted',v_inventory_events,
    'checklist_definitions_deleted',v_definitions,'checklist_definition_versions_deleted',v_versions,
    'checklist_runs_deleted',v_runs,'checklist_tasks_deleted',v_tasks,'checklist_task_events_deleted',v_task_events,
    'checklist_templates_deleted',v_definitions,'checklist_versions_deleted',v_versions,'checklist_results_deleted',v_runs,
    'pending_devices',v_pending_devices,'reset_assets',v_req.reset_assets,
    'reset_inventory',v_req.reset_inventory,'reset_checklist',v_req.reset_checklist
  );
end;
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
  select * into v_request from private.organization_asset_reset_approval_requests
   where id=p_request_id for update;
  if not found then raise exception 'Không tìm thấy yêu cầu Reset.' using errcode='P0002'; end if;
  if v_request.status<>'pending' then
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
    v_reset:=public.platform_reset_organization_assets(v_request.organization_id,v_request.request_id,p_reviewer_user_id);
    update private.organization_asset_reset_approval_requests
       set status='executed',executed_at=clock_timestamp(),
           reset_generation=nullif(v_reset->>'generation','')::bigint,
           assets_deleted=nullif(v_reset->>'assets_deleted','')::bigint,
           inventory_items_deleted=nullif(v_reset->>'inventory_items_deleted','')::bigint,
           inventory_movements_deleted=nullif(v_reset->>'inventory_movements_deleted','')::bigint,
           inventory_mutation_receipts_deleted=nullif(v_reset->>'inventory_mutation_receipts_deleted','')::bigint,
           inventory_sync_events_deleted=nullif(v_reset->>'inventory_sync_events_deleted','')::bigint,
           checklist_templates_deleted=nullif(v_reset->>'checklist_templates_deleted','')::bigint,
           checklist_versions_deleted=nullif(v_reset->>'checklist_versions_deleted','')::bigint,
           checklist_results_deleted=nullif(v_reset->>'checklist_results_deleted','')::bigint,
           checklist_definitions_deleted=nullif(v_reset->>'checklist_definitions_deleted','')::bigint,
           checklist_definition_versions_deleted=nullif(v_reset->>'checklist_definition_versions_deleted','')::bigint,
           checklist_runs_deleted=nullif(v_reset->>'checklist_runs_deleted','')::bigint,
           checklist_tasks_deleted=nullif(v_reset->>'checklist_tasks_deleted','')::bigint,
           checklist_task_events_deleted=nullif(v_reset->>'checklist_task_events_deleted','')::bigint,
           execution_error=null
     where id=p_request_id;
    return jsonb_build_object('status','executed','request_id',p_request_id,'reset',v_reset);
  exception when others then
    get stacked diagnostics v_error=message_text;
    update private.organization_asset_reset_approval_requests
       set status='failed',execution_error=left(v_error,1000)
     where id=p_request_id;
    return jsonb_build_object('status','failed','request_id',p_request_id,'error',v_error);
  end;
end;
$function$;

commit;
