-- Approval workflow for organization-wide asset reset.
-- The reset itself remains in platform_reset_organization_assets and is callable only by service_role.
begin;

create table if not exists private.organization_asset_reset_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  requester_note text not null default '',
  status text not null default 'pending'
    check (status in ('pending','approved','executed','rejected','failed')),
  cloud_assets_at_request bigint not null default 0 check (cloud_assets_at_request >= 0),
  registered_devices_at_request bigint not null default 0 check (registered_devices_at_request >= 0),
  request_id uuid not null default gen_random_uuid(),
  requested_at timestamptz not null default clock_timestamp(),
  reviewed_by_user_id uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text not null default '',
  executed_at timestamptz,
  reset_generation bigint,
  assets_deleted bigint,
  execution_error text,
  unique (organization_id, request_id)
);

create unique index if not exists organization_asset_reset_one_open_request_per_org
  on private.organization_asset_reset_approval_requests (organization_id)
  where status in ('pending','approved');

create index if not exists organization_asset_reset_requests_requested_at_idx
  on private.organization_asset_reset_approval_requests (requested_at desc);

alter table private.organization_asset_reset_approval_requests enable row level security;
revoke all on private.organization_asset_reset_approval_requests from public, anon, authenticated;
grant usage on schema private to service_role;

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
  select count(*) into v_devices from private.organization_asset_reset_devices d where d.organization_id=p_organization_id;

  insert into private.organization_asset_reset_approval_requests(
    organization_id,requester_user_id,requester_note,cloud_assets_at_request,registered_devices_at_request
  ) values (
    p_organization_id,p_requester_user_id,left(coalesce(p_request_note,''),1000),v_assets,v_devices
  ) returning * into v_request;

  return jsonb_build_object(
    'id',v_request.id,'organization_id',v_request.organization_id,'status',v_request.status,
    'requested_at',v_request.requested_at,'cloud_assets_at_request',v_request.cloud_assets_at_request,
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
    'registered_devices_at_request',r.registered_devices_at_request,
    'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,
    'review_note',r.review_note,'executed_at',r.executed_at,
    'reset_generation',r.reset_generation,'assets_deleted',r.assets_deleted,
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
    'registered_devices_at_request',r.registered_devices_at_request,
    'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,
    'review_note',r.review_note,'executed_at',r.executed_at,
    'reviewer_user_id',r.reviewed_by_user_id,
    'reset_generation',r.reset_generation,'assets_deleted',r.assets_deleted,
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

revoke all on function public.create_organization_asset_reset_request(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.list_organization_asset_reset_requests(uuid) from public,anon,authenticated;
revoke all on function public.list_platform_organization_asset_reset_requests() from public,anon,authenticated;
revoke all on function public.review_organization_asset_reset_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_organization_asset_reset_request(uuid,uuid,text) to service_role;
grant execute on function public.list_organization_asset_reset_requests(uuid) to service_role;
grant execute on function public.list_platform_organization_asset_reset_requests() to service_role;
grant execute on function public.review_organization_asset_reset_request(uuid,uuid,text,text) to service_role;

commit;
