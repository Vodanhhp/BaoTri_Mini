-- Selective Reset scopes: equipment, inventory and Checklist generations are independent.
begin;
drop function if exists public.create_organization_asset_reset_request(uuid,uuid,text);
alter table private.organization_asset_reset_state add column if not exists inventory_generation bigint not null default 0 check(inventory_generation>=0), add column if not exists checklist_generation bigint not null default 0 check(checklist_generation>=0);
alter table private.organization_asset_reset_devices add column if not exists acknowledged_inventory_generation bigint not null default 0, add column if not exists acknowledged_checklist_generation bigint not null default 0;
alter table private.organization_asset_reset_requests add column if not exists inventory_items_deleted bigint not null default 0, add column if not exists inventory_movements_deleted bigint not null default 0, add column if not exists inventory_mutation_receipts_deleted bigint not null default 0, add column if not exists inventory_sync_events_deleted bigint not null default 0, add column if not exists checklist_templates_deleted bigint not null default 0, add column if not exists checklist_versions_deleted bigint not null default 0, add column if not exists checklist_results_deleted bigint not null default 0;
alter table private.organization_asset_reset_approval_requests add column if not exists reset_assets boolean not null default true, add column if not exists reset_inventory boolean not null default true, add column if not exists reset_checklist boolean not null default true, add column if not exists cloud_checklist_templates_at_request bigint not null default 0, add column if not exists cloud_checklist_results_at_request bigint not null default 0, add column if not exists checklist_templates_deleted bigint, add column if not exists checklist_versions_deleted bigint, add column if not exists checklist_results_deleted bigint;
create unique index if not exists organization_asset_reset_one_open_request_per_org on private.organization_asset_reset_approval_requests(organization_id) where status in('pending','approved');
CREATE OR REPLACE FUNCTION public.acknowledge_organization_asset_reset(p_organization_id uuid, p_device_id text, p_generation bigint, p_inventory_generation bigint DEFAULT 0, p_checklist_generation bigint DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_actor uuid:=auth.uid();v_a bigint;v_i bigint;v_c bigint;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 select generation,inventory_generation,checklist_generation into v_a,v_i,v_c from private.organization_asset_reset_state where organization_id=p_organization_id for share;
 if not found then raise exception 'Reset generation is not initialized' using errcode='P0002';end if;
 if p_generation is distinct from v_a or p_inventory_generation is distinct from v_i or p_checklist_generation is distinct from v_c then raise exception 'Local reset generation is stale; refresh before acknowledging' using errcode='40001';end if;
 update private.organization_asset_reset_devices set acknowledged_generation=p_generation,acknowledged_inventory_generation=p_inventory_generation,acknowledged_checklist_generation=p_checklist_generation,
 local_asset_count=case when p_generation>acknowledged_generation then 0 else local_asset_count end,last_seen_at=clock_timestamp(),updated_at=clock_timestamp()
 where organization_id=p_organization_id and device_id=p_device_id and user_id=v_actor;
 if not found then raise exception 'Device registration not found for this user' using errcode='P0002';end if;return true;
end $function$


CREATE OR REPLACE FUNCTION public.create_organization_asset_reset_request(p_organization_id uuid, p_requester_user_id uuid, p_request_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.create_organization_asset_reset_request(p_organization_id uuid, p_requester_user_id uuid, p_request_note text DEFAULT ''::text, p_reset_assets boolean DEFAULT false, p_reset_inventory boolean DEFAULT false, p_reset_checklist boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_status text;v_role text;v_member text;v_a bigint;v_i bigint;v_m bigint;v_ct bigint:=0;v_cr bigint:=0;v_d bigint;v_req private.organization_asset_reset_approval_requests;
begin
 if p_requester_user_id is null then raise exception 'Requester is required' using errcode='22023';end if;
 if not(coalesce(p_reset_assets,false) or coalesce(p_reset_inventory,false) or coalesce(p_reset_checklist,false)) then raise exception 'Phải chọn ít nhất một phạm vi Reset.' using errcode='22023';end if;
 select status into v_status from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Không tìm thấy tổ chức.' using errcode='P0002';end if;
 select role,status into v_role,v_member from public.organization_members where organization_id=p_organization_id and user_id=p_requester_user_id limit 1;
 if v_role is distinct from 'admin' or v_member is distinct from 'active' then raise exception 'Chỉ Admin đang hoạt động của doanh nghiệp mới được gửi yêu cầu Reset.' using errcode='42501';end if;
 if v_status is distinct from 'active' then raise exception 'Tổ chức đang tạm ngưng; không thể gửi yêu cầu Reset.' using errcode='55000';end if;
 select count(*) into v_a from public.assets where organization_id=p_organization_id;
 select count(*) into v_i from public.inventory_items where organization_id=p_organization_id;
 select count(*) into v_m from public.inventory_movements where organization_id=p_organization_id;
 select count(*) into v_d from private.organization_asset_reset_devices where organization_id=p_organization_id;
 if to_regclass('public.checklist_templates') is not null then execute 'select count(*) from public.checklist_templates where organization_id=$1' into v_ct using p_organization_id;end if;
 if to_regclass('public.checklist_results') is not null then execute 'select count(*) from public.checklist_results where organization_id=$1' into v_cr using p_organization_id;end if;
 insert into private.organization_asset_reset_approval_requests(organization_id,requester_user_id,requester_note,reset_assets,reset_inventory,reset_checklist,cloud_assets_at_request,cloud_inventory_items_at_request,cloud_inventory_movements_at_request,cloud_checklist_templates_at_request,cloud_checklist_results_at_request,registered_devices_at_request)
 values(p_organization_id,p_requester_user_id,left(coalesce(p_request_note,''),1000),p_reset_assets,p_reset_inventory,p_reset_checklist,v_a,v_i,v_m,v_ct,v_cr,v_d) returning * into v_req;
 return jsonb_build_object('id',v_req.id,'organization_id',v_req.organization_id,'status',v_req.status,'requested_at',v_req.requested_at,'reset_assets',v_req.reset_assets,'reset_inventory',v_req.reset_inventory,'reset_checklist',v_req.reset_checklist);
exception when unique_violation then raise exception 'Tổ chức đang có yêu cầu Reset chờ xử lý. Hãy chờ Superadmin duyệt hoặc từ chối.' using errcode='23505';
end $function$


CREATE OR REPLACE FUNCTION public.list_organization_asset_reset_requests(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'organization_id',r.organization_id,'requester_user_id',r.requester_user_id,'requester_email',u.email,'requester_note',r.requester_note,'reset_assets',r.reset_assets,'reset_inventory',r.reset_inventory,'reset_checklist',r.reset_checklist,'cloud_assets_at_request',r.cloud_assets_at_request,'cloud_inventory_items_at_request',r.cloud_inventory_items_at_request,'cloud_inventory_movements_at_request',r.cloud_inventory_movements_at_request,'cloud_checklist_templates_at_request',r.cloud_checklist_templates_at_request,'cloud_checklist_results_at_request',r.cloud_checklist_results_at_request,'registered_devices_at_request',r.registered_devices_at_request,'status',r.status,'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,'review_note',r.review_note,'executed_at',r.executed_at,'reset_generation',r.reset_generation,'assets_deleted',r.assets_deleted,'inventory_items_deleted',r.inventory_items_deleted,'inventory_movements_deleted',r.inventory_movements_deleted,'checklist_templates_deleted',r.checklist_templates_deleted,'checklist_versions_deleted',r.checklist_versions_deleted,'checklist_results_deleted',r.checklist_results_deleted,'execution_error',r.execution_error) order by r.requested_at desc),'[]'::jsonb)
 from private.organization_asset_reset_approval_requests r left join auth.users u on u.id=r.requester_user_id where r.organization_id=p_organization_id
$function$


CREATE OR REPLACE FUNCTION public.list_platform_organization_asset_reset_requests()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'organization_id',r.organization_id,'organization_name',o.name,'requester_user_id',r.requester_user_id,'requester_email',u.email,'requester_note',r.requester_note,'reset_assets',r.reset_assets,'reset_inventory',r.reset_inventory,'reset_checklist',r.reset_checklist,'cloud_assets_at_request',r.cloud_assets_at_request,'cloud_inventory_items_at_request',r.cloud_inventory_items_at_request,'cloud_inventory_movements_at_request',r.cloud_inventory_movements_at_request,'cloud_checklist_templates_at_request',r.cloud_checklist_templates_at_request,'cloud_checklist_results_at_request',r.cloud_checklist_results_at_request,'registered_devices_at_request',r.registered_devices_at_request,'status',r.status,'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,'review_note',r.review_note,'executed_at',r.executed_at,'reviewer_user_id',r.reviewed_by_user_id,'reset_generation',r.reset_generation,'assets_deleted',r.assets_deleted,'inventory_items_deleted',r.inventory_items_deleted,'inventory_movements_deleted',r.inventory_movements_deleted,'checklist_templates_deleted',r.checklist_templates_deleted,'checklist_versions_deleted',r.checklist_versions_deleted,'checklist_results_deleted',r.checklist_results_deleted,'execution_error',r.execution_error) order by r.requested_at desc),'[]'::jsonb)
 from private.organization_asset_reset_approval_requests r join public.organizations o on o.id=r.organization_id left join auth.users u on u.id=r.requester_user_id
$function$


CREATE OR REPLACE FUNCTION public.platform_reset_organization_assets(p_organization_id uuid, p_request_id uuid, p_actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_req private.organization_asset_reset_approval_requests;v_old private.organization_asset_reset_requests;v_gen bigint;v_a bigint:=0;v_ir bigint:=0;v_mr bigint:=0;v_l bigint:=0;v_i bigint:=0;v_m bigint:=0;v_r bigint:=0;v_e bigint:=0;v_ct bigint:=0;v_cv bigint:=0;v_cr bigint:=0;v_n bigint:=0;
begin
 if p_organization_id is null or p_request_id is null or p_actor_user_id is null then raise exception 'Organization, request and actor are required' using errcode='22023';end if;
 perform 1 from public.organizations where id=p_organization_id for update;if not found then raise exception 'Organization not found' using errcode='P0002';end if;
 select * into v_req from private.organization_asset_reset_approval_requests where organization_id=p_organization_id and request_id=p_request_id for update;
 if not found then raise exception 'Approved reset request not found' using errcode='P0002';end if;
 select * into v_old from private.organization_asset_reset_requests where organization_id=p_organization_id and request_id=p_request_id;
 if found then return jsonb_build_object('ok',true,'already_applied',true,'generation',v_old.generation,'assets_deleted',v_old.assets_deleted,'inventory_items_deleted',v_old.inventory_items_deleted,'inventory_movements_deleted',v_old.inventory_movements_deleted,'checklist_templates_deleted',v_old.checklist_templates_deleted,'checklist_versions_deleted',v_old.checklist_versions_deleted,'checklist_results_deleted',v_old.checklist_results_deleted);end if;
 insert into private.organization_asset_reset_state(organization_id) values(p_organization_id) on conflict do nothing;
 select generation into v_gen from private.organization_asset_reset_state where organization_id=p_organization_id for update;
 if v_req.reset_assets then
  update private.organization_asset_reset_state set generation=generation+1,reset_at=clock_timestamp(),updated_at=clock_timestamp() where organization_id=p_organization_id returning generation into v_gen;
  update public.asset_activity_history set asset_id=null where organization_id=p_organization_id and asset_id is not null;
  update private.asset_group_change_history set asset_id=null where organization_id=p_organization_id and asset_id is not null;
  delete from public.asset_import_receipts where organization_id=p_organization_id;get diagnostics v_ir=row_count;
  delete from public.asset_mutation_receipts where organization_id=p_organization_id;get diagnostics v_mr=row_count;
  delete from public.asset_edit_locks where organization_id=p_organization_id;get diagnostics v_l=row_count;
  update private.asset_id_sequence_reservations set status='released',asset_id=null,equipment_id=null,released_at=clock_timestamp() where organization_id=p_organization_id and status='reserved';
  delete from public.assets where organization_id=p_organization_id;get diagnostics v_a=row_count;
 end if;
 if v_req.reset_inventory then
  update private.organization_asset_reset_state set inventory_generation=inventory_generation+1,updated_at=clock_timestamp() where organization_id=p_organization_id;
  select count(*) into v_i from public.inventory_items where organization_id=p_organization_id;select count(*) into v_m from public.inventory_movements where organization_id=p_organization_id;
  delete from public.inventory_movements where organization_id=p_organization_id;delete from public.inventory_items where organization_id=p_organization_id;
  delete from private.inventory_mutation_receipts where organization_id=p_organization_id;get diagnostics v_r=row_count;
  delete from private.inventory_sync_events where organization_id=p_organization_id;get diagnostics v_e=row_count;
 end if;
 if v_req.reset_checklist then
  update private.organization_asset_reset_state set checklist_generation=checklist_generation+1,updated_at=clock_timestamp() where organization_id=p_organization_id;
  if to_regclass('public.checklist_results') is not null then execute 'delete from public.checklist_results where organization_id=$1' using p_organization_id;get diagnostics v_cr=row_count;end if;
  if to_regclass('public.checklist_template_versions') is not null then execute 'delete from public.checklist_template_versions where organization_id=$1' using p_organization_id;get diagnostics v_cv=row_count;end if;
  if to_regclass('public.checklist_templates') is not null then execute 'delete from public.checklist_templates where organization_id=$1' using p_organization_id;get diagnostics v_ct=row_count;end if;
 end if;
 insert into private.organization_asset_reset_requests(organization_id,request_id,generation,actor_user_id,assets_deleted,import_receipts_deleted,mutation_receipts_deleted,edit_locks_deleted,inventory_items_deleted,inventory_movements_deleted,inventory_mutation_receipts_deleted,inventory_sync_events_deleted,checklist_templates_deleted,checklist_versions_deleted,checklist_results_deleted)
 values(p_organization_id,p_request_id,v_gen,p_actor_user_id,v_a,v_ir,v_mr,v_l,v_i,v_m,v_r,v_e,v_ct,v_cv,v_cr);
 select count(*) into v_n from private.organization_asset_reset_devices d join private.organization_asset_reset_state s on s.organization_id=d.organization_id where d.organization_id=p_organization_id and (d.acknowledged_generation<s.generation or d.acknowledged_inventory_generation<s.inventory_generation or d.acknowledged_checklist_generation<s.checklist_generation);
 return jsonb_build_object('ok',true,'already_applied',false,'generation',v_gen,'assets_deleted',v_a,'inventory_items_deleted',v_i,'inventory_movements_deleted',v_m,'inventory_mutation_receipts_deleted',v_r,'inventory_sync_events_deleted',v_e,'checklist_templates_deleted',v_ct,'checklist_versions_deleted',v_cv,'checklist_results_deleted',v_cr,'pending_devices',v_n,'reset_assets',v_req.reset_assets,'reset_inventory',v_req.reset_inventory,'reset_checklist',v_req.reset_checklist);
end $function$


CREATE OR REPLACE FUNCTION public.register_organization_asset_reset_device(p_organization_id uuid, p_device_id text, p_platform_label text, p_local_asset_count integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_actor uuid:=auth.uid();v_a bigint;v_i bigint;v_c bigint;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if nullif(btrim(p_device_id),'') is null or char_length(p_device_id)>160 then raise exception 'Invalid device identifier' using errcode='22023';end if;
 if not coalesce(private.is_org_member(p_organization_id),false) and not exists(select 1 from private.organization_asset_reset_devices d where d.organization_id=p_organization_id and d.device_id=p_device_id and d.user_id=v_actor) then raise exception 'Active organization membership or prior device registration required' using errcode='42501';end if;
 if coalesce(p_local_asset_count,0)<0 then raise exception 'Invalid Local asset count' using errcode='22023';end if;
 insert into private.organization_asset_reset_state(organization_id) values(p_organization_id) on conflict do nothing;
 select generation,inventory_generation,checklist_generation into v_a,v_i,v_c from private.organization_asset_reset_state where organization_id=p_organization_id for share;
 insert into private.organization_asset_reset_devices(organization_id,device_id,user_id,platform_label,last_seen_at,local_asset_count,updated_at)
 values(p_organization_id,p_device_id,v_actor,coalesce(nullif(btrim(p_platform_label),''),'Thiết bị'),clock_timestamp(),greatest(coalesce(p_local_asset_count,0),0),clock_timestamp())
 on conflict(organization_id,device_id) do update set user_id=excluded.user_id,platform_label=excluded.platform_label,last_seen_at=clock_timestamp(),local_asset_count=excluded.local_asset_count,updated_at=clock_timestamp();
 return jsonb_build_object('organization_id',p_organization_id,'generation',v_a,'inventory_generation',v_i,'checklist_generation',v_c);
end $function$


CREATE OR REPLACE FUNCTION public.review_organization_asset_reset_request(p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_review_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_req private.organization_asset_reset_approval_requests;v_reset jsonb;v_err text;
begin
 if p_reviewer_user_id is null then raise exception 'Reviewer is required' using errcode='22023';end if;
 if p_decision not in('approve','reject') then raise exception 'Decision is invalid' using errcode='22023';end if;
 if p_decision='reject' and length(btrim(coalesce(p_review_note,'')))=0 then raise exception 'A rejection reason is required' using errcode='22023';end if;
 select * into v_req from private.organization_asset_reset_approval_requests where id=p_request_id for update;if not found then raise exception 'Không tìm thấy yêu cầu Reset.' using errcode='P0002';end if;
 if v_req.status<>'pending' then raise exception 'Yêu cầu đã được xử lý hoặc không còn ở trạng thái chờ duyệt.' using errcode='55000';end if;
 if p_decision='reject' then update private.organization_asset_reset_approval_requests set status='rejected',reviewed_by_user_id=p_reviewer_user_id,reviewed_at=clock_timestamp(),review_note=left(coalesce(p_review_note,''),1000) where id=p_request_id;return jsonb_build_object('status','rejected','request_id',p_request_id);end if;
 update private.organization_asset_reset_approval_requests set status='approved',reviewed_by_user_id=p_reviewer_user_id,reviewed_at=clock_timestamp(),review_note=left(coalesce(p_review_note,''),1000) where id=p_request_id;
 begin
  v_reset:=public.platform_reset_organization_assets(v_req.organization_id,v_req.request_id,p_reviewer_user_id);
  update private.organization_asset_reset_approval_requests set status='executed',executed_at=clock_timestamp(),reset_generation=nullif(v_reset->>'generation','')::bigint,
   assets_deleted=nullif(v_reset->>'assets_deleted','')::bigint,inventory_items_deleted=nullif(v_reset->>'inventory_items_deleted','')::bigint,inventory_movements_deleted=nullif(v_reset->>'inventory_movements_deleted','')::bigint,
   inventory_mutation_receipts_deleted=nullif(v_reset->>'inventory_mutation_receipts_deleted','')::bigint,inventory_sync_events_deleted=nullif(v_reset->>'inventory_sync_events_deleted','')::bigint,
   checklist_templates_deleted=nullif(v_reset->>'checklist_templates_deleted','')::bigint,checklist_versions_deleted=nullif(v_reset->>'checklist_versions_deleted','')::bigint,checklist_results_deleted=nullif(v_reset->>'checklist_results_deleted','')::bigint,execution_error=null where id=p_request_id;
  return jsonb_build_object('status','executed','request_id',p_request_id,'reset',v_reset);
 exception when others then get stacked diagnostics v_err=message_text;update private.organization_asset_reset_approval_requests set status='failed',execution_error=left(v_err,1000) where id=p_request_id;return jsonb_build_object('status','failed','request_id',p_request_id,'error',v_err);
 end;
end $function$


revoke all on function public.create_organization_asset_reset_request(uuid,uuid,text,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function public.list_organization_asset_reset_requests(uuid) from public,anon,authenticated;
revoke all on function public.list_platform_organization_asset_reset_requests() from public,anon,authenticated;
revoke all on function public.review_organization_asset_reset_request(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.platform_reset_organization_assets(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.acknowledge_organization_asset_reset(uuid,text,bigint,bigint,bigint) from public,anon;
grant execute on function public.acknowledge_organization_asset_reset(uuid,text,bigint,bigint,bigint) to authenticated;
grant execute on function public.create_organization_asset_reset_request(uuid,uuid,text,boolean,boolean,boolean) to service_role;
grant execute on function public.list_organization_asset_reset_requests(uuid) to service_role;
grant execute on function public.list_platform_organization_asset_reset_requests() to service_role;
grant execute on function public.review_organization_asset_reset_request(uuid,uuid,text,text) to service_role;
grant execute on function public.platform_reset_organization_assets(uuid,uuid,uuid) to service_role;
commit;
