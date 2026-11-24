-- Tenant Admin requests a legal/business display-name change; only the verified platform owner applies it.
-- No organization name changes occur when a request is submitted.

begin;

create table if not exists private.organization_name_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id),
  current_name text not null,
  requested_name text not null,
  request_note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text not null default '',
  constraint organization_name_change_different_name check (current_name <> requested_name),
  constraint organization_name_change_name_length check (
    char_length(btrim(current_name)) between 2 and 160
    and char_length(btrim(requested_name)) between 2 and 160
  )
);

create unique index if not exists organization_name_change_one_pending_per_org
  on private.organization_name_change_requests(organization_id)
  where status='pending';

create index if not exists organization_name_change_requests_status_time
  on private.organization_name_change_requests(status,requested_at desc);

create table if not exists private.organization_name_change_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references private.organization_name_change_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  previous_name text not null,
  new_name text not null,
  requested_by_user_id uuid not null references auth.users(id),
  approved_by_user_id uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  request_note text not null default '',
  review_note text not null default ''
);

alter table private.organization_name_change_requests enable row level security;
alter table private.organization_name_change_history enable row level security;
revoke all on table private.organization_name_change_requests from public,anon,authenticated,service_role;
revoke all on table private.organization_name_change_history from public,anon,authenticated,service_role;
grant usage on schema private to service_role;

create or replace function private.create_organization_name_change_request(
  p_organization_id uuid,p_actor_user_id uuid,p_requested_name text,p_request_note text default ''
)
returns jsonb
language plpgsql security definer
set search_path='' set row_security=off
as $function$
declare
  v_current_name text;
  v_requested_name text:=btrim(coalesce(p_requested_name,''));
  v_status text;
  v_request private.organization_name_change_requests;
begin
  if p_organization_id is null or p_actor_user_id is null then
    raise exception 'Organization and requester are required' using errcode='22023';
  end if;
  if char_length(v_requested_name) not between 2 and 160 then
    raise exception 'Tên doanh nghiệp mới phải có từ 2 đến 160 ký tự.' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=p_actor_user_id
      and m.role='admin' and m.status='active'
  ) then
    raise exception 'Only an active organization Admin may request a name change' using errcode='42501';
  end if;
  select o.name,o.status into v_current_name,v_status
  from public.organizations o where o.id=p_organization_id for update;
  if not found then raise exception 'Organization not found' using errcode='P0002'; end if;
  if v_status is distinct from 'active' then
    raise exception 'Doanh nghiệp đang tạm ngưng hoặc không khả dụng.' using errcode='42501';
  end if;
  if lower(v_current_name)=lower(v_requested_name) then
    raise exception 'Tên mới không được trùng tên hiện tại.' using errcode='22023';
  end if;
  insert into private.organization_name_change_requests(
    organization_id,requested_by_user_id,current_name,requested_name,request_note
  ) values (
    p_organization_id,p_actor_user_id,v_current_name,v_requested_name,left(btrim(coalesce(p_request_note,'')),1000)
  ) returning * into v_request;
  return jsonb_build_object(
    'id',v_request.id,'organization_id',v_request.organization_id,
    'current_name',v_request.current_name,'requested_name',v_request.requested_name,
    'request_note',v_request.request_note,'status',v_request.status,'requested_at',v_request.requested_at
  );
exception
  when unique_violation then
    raise exception 'Doanh nghiệp đã có một yêu cầu đổi tên đang chờ duyệt.' using errcode='23505';
end;
$function$;

create or replace function private.list_organization_name_change_requests(p_organization_id uuid default null)
returns jsonb
language sql security definer
set search_path='' set row_security=off
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'organization_id',r.organization_id,'organization_name',o.name,
    'current_name',r.current_name,'requested_name',r.requested_name,'request_note',r.request_note,
    'status',r.status,'requested_at',r.requested_at,'requested_by_user_id',r.requested_by_user_id,
    'requested_by_email',u.email,'requested_by_name',p.display_name,
    'reviewed_by_user_id',r.reviewed_by_user_id,'reviewed_at',r.reviewed_at,'review_note',r.review_note
  ) order by case when r.status='pending' then 0 else 1 end,r.requested_at desc),'[]'::jsonb)
  from private.organization_name_change_requests r
  join public.organizations o on o.id=r.organization_id
  join auth.users u on u.id=r.requested_by_user_id
  left join public.profiles p on p.id=r.requested_by_user_id
  where p_organization_id is null or r.organization_id=p_organization_id;
$function$;

create or replace function private.review_organization_name_change_request(
  p_request_id uuid,p_reviewer_user_id uuid,p_decision text,p_review_note text default ''
)
returns jsonb
language plpgsql security definer
set search_path='' set row_security=off
as $function$
declare
  v_request private.organization_name_change_requests;
  v_current_name text;
begin
  if p_request_id is null or p_reviewer_user_id is null then
    raise exception 'Request and reviewer are required' using errcode='22023';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Decision must be approve or reject' using errcode='22023';
  end if;
  -- The caller is the trusted Edge Function using service_role. It verifies the
  -- platform-owner allowlist and re-authenticates the password before this RPC.
  if not exists (
    select 1 from auth.users u where u.id=p_reviewer_user_id
      and u.email_confirmed_at is not null
  ) then
    raise exception 'Reviewer must be a confirmed Auth user' using errcode='42501';
  end if;

  select * into v_request from private.organization_name_change_requests
  where id=p_request_id for update;
  if not found then raise exception 'Name change request not found' using errcode='P0002'; end if;
  if v_request.status<>'pending' then
    raise exception 'This organization name change request has already been reviewed' using errcode='40001';
  end if;

  if p_decision='reject' then
    update private.organization_name_change_requests
    set status='rejected',reviewed_by_user_id=p_reviewer_user_id,
        reviewed_at=clock_timestamp(),review_note=left(btrim(coalesce(p_review_note,'')),1000)
    where id=p_request_id;
    return jsonb_build_object('ok',true,'status','rejected','request_id',p_request_id);
  end if;

  select name into v_current_name from public.organizations
  where id=v_request.organization_id for update;
  if not found then raise exception 'Organization no longer exists' using errcode='P0002'; end if;
  if v_current_name is distinct from v_request.current_name then
    raise exception 'Tên doanh nghiệp đã thay đổi sau khi gửi yêu cầu. Hãy tải lại và đối chiếu.' using errcode='40001';
  end if;

  update public.organizations set name=v_request.requested_name,updated_at=clock_timestamp()
  where id=v_request.organization_id;

  update private.organization_name_change_requests
  set status='approved',reviewed_by_user_id=p_reviewer_user_id,
      reviewed_at=clock_timestamp(),review_note=left(btrim(coalesce(p_review_note,'')),1000)
  where id=p_request_id;

  insert into private.organization_name_change_history(
    request_id,organization_id,previous_name,new_name,requested_by_user_id,
    approved_by_user_id,request_note,review_note
  ) values (
    p_request_id,v_request.organization_id,v_request.current_name,v_request.requested_name,
    v_request.requested_by_user_id,p_reviewer_user_id,v_request.request_note,
    left(btrim(coalesce(p_review_note,'')),1000)
  );

  return jsonb_build_object('ok',true,'status','approved','request_id',p_request_id,
    'organization_id',v_request.organization_id,'previous_name',v_request.current_name,
    'new_name',v_request.requested_name);
end;
$function$;

revoke all on function private.create_organization_name_change_request(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function private.list_organization_name_change_requests(uuid) from public,anon,authenticated,service_role;
revoke all on function private.review_organization_name_change_request(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.create_organization_name_change_request(uuid,uuid,text,text) to service_role;
grant execute on function private.list_organization_name_change_requests(uuid) to service_role;
grant execute on function private.review_organization_name_change_request(uuid,uuid,text,text) to service_role;

create or replace function public.create_organization_name_change_request(
  p_organization_id uuid,p_actor_user_id uuid,p_requested_name text,p_request_note text default ''
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.create_organization_name_change_request(p_organization_id,p_actor_user_id,p_requested_name,p_request_note); $function$;

create or replace function public.list_organization_name_change_requests(p_organization_id uuid default null)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.list_organization_name_change_requests(p_organization_id); $function$;

create or replace function public.review_organization_name_change_request(
  p_request_id uuid,p_reviewer_user_id uuid,p_decision text,p_review_note text default ''
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.review_organization_name_change_request(p_request_id,p_reviewer_user_id,p_decision,p_review_note); $function$;

revoke all on function public.create_organization_name_change_request(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.list_organization_name_change_requests(uuid) from public,anon,authenticated;
revoke all on function public.review_organization_name_change_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_organization_name_change_request(uuid,uuid,text,text) to service_role;
grant execute on function public.list_organization_name_change_requests(uuid) to service_role;
grant execute on function public.review_organization_name_change_request(uuid,uuid,text,text) to service_role;

comment on table private.organization_name_change_requests is
  'Organization Admin name-change requests. Access mediated by trusted Edge Functions; client table access is disabled.';
comment on table private.organization_name_change_history is
  'Audit trail of approved organization name changes; previous and new names remain traceable.';

commit;
