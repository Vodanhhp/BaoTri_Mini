-- Auditable, approval-based organization legal/display name changes.
begin;

create table private.organization_name_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  old_name text not null,
  requested_name text not null,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_user_id uuid references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  requester_note text not null default '',
  review_note text not null default '',
  requested_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  constraint organization_name_change_old_length check (char_length(old_name) between 1 and 160),
  constraint organization_name_change_new_length check (char_length(requested_name) between 1 and 160),
  constraint organization_name_change_note_length check (char_length(requester_note) <= 1000),
  constraint organization_name_change_review_note_length check (char_length(review_note) <= 1000)
);

create index organization_name_change_org_history_idx
  on private.organization_name_change_requests (organization_id, requested_at desc);
create unique index organization_name_change_one_pending_per_org
  on private.organization_name_change_requests (organization_id)
  where status = 'pending';

alter table private.organization_name_change_requests enable row level security;
revoke all on table private.organization_name_change_requests from public, anon, authenticated;

create or replace function public.create_organization_name_change_request(
  p_organization_id uuid,
  p_requester_user_id uuid,
  p_requested_name text,
  p_requester_note text default ''
) returns jsonb
language plpgsql security definer
set search_path = '' set row_security = off
as $$
declare
  v_org public.organizations;
  v_name text := btrim(coalesce(p_requested_name,''));
  v_request private.organization_name_change_requests;
begin
  if p_organization_id is null or p_requester_user_id is null then
    raise exception 'Thiếu thông tin doanh nghiệp hoặc người gửi.' using errcode='22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 160 then
    raise exception 'Tên doanh nghiệp phải có từ 2 đến 160 ký tự.' using errcode='22023';
  end if;
  select * into v_org from public.organizations
   where id=p_organization_id for update;
  if not found then raise exception 'Không tìm thấy doanh nghiệp.' using errcode='P0002'; end if;
  if v_org.status <> 'active' then raise exception 'Doanh nghiệp đang tạm ngưng.' using errcode='55000'; end if;
  if not exists (
    select 1 from public.organization_members m
     where m.organization_id=p_organization_id and m.user_id=p_requester_user_id
       and m.role='admin' and m.status='active'
  ) then raise exception 'Chỉ Admin đang hoạt động của doanh nghiệp mới được gửi yêu cầu.' using errcode='42501'; end if;
  if lower(btrim(v_org.name))=lower(v_name) then
    raise exception 'Tên mới không khác tên doanh nghiệp hiện tại.' using errcode='22023';
  end if;
  insert into private.organization_name_change_requests(
    organization_id,old_name,requested_name,requester_user_id,requester_note
  ) values (
    p_organization_id,v_org.name,v_name,p_requester_user_id,left(btrim(coalesce(p_requester_note,'')),1000)
  ) returning * into v_request;
  return jsonb_build_object('id',v_request.id,'status',v_request.status,'old_name',v_request.old_name,
    'requested_name',v_request.requested_name,'requested_at',v_request.requested_at);
exception when unique_violation then
  raise exception 'Doanh nghiệp đang có yêu cầu đổi tên chờ xử lý.' using errcode='23505';
end;
$$;

create or replace function public.list_organization_name_change_requests(p_organization_id uuid default null)
returns jsonb
language sql security definer stable
set search_path = '' set row_security = off
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'organization_id',r.organization_id,'organization_name',o.name,
    'old_name',r.old_name,'requested_name',r.requested_name,
    'requester_user_id',r.requester_user_id,'requester_email',u.email,
    'reviewer_user_id',r.reviewer_user_id,'status',r.status,
    'requester_note',r.requester_note,'review_note',r.review_note,
    'requested_at',r.requested_at,'reviewed_at',r.reviewed_at
  ) order by r.requested_at desc),'[]'::jsonb)
  from private.organization_name_change_requests r
  join public.organizations o on o.id=r.organization_id
  left join auth.users u on u.id=r.requester_user_id
  where p_organization_id is null or r.organization_id=p_organization_id;
$$;

create or replace function public.review_organization_name_change_request(
  p_request_id uuid,
  p_reviewer_user_id uuid,
  p_decision text,
  p_review_note text default ''
) returns jsonb
language plpgsql security definer
set search_path = '' set row_security = off
as $$
declare
  v_request private.organization_name_change_requests;
begin
  if p_reviewer_user_id is null or p_decision not in ('approve','reject') then
    raise exception 'Thông tin xử lý yêu cầu không hợp lệ.' using errcode='22023';
  end if;
  if p_decision='reject' and length(btrim(coalesce(p_review_note,'')))=0 then
    raise exception 'Bắt buộc nhập lý do từ chối.' using errcode='22023';
  end if;
  select * into v_request from private.organization_name_change_requests
   where id=p_request_id for update;
  if not found then raise exception 'Không tìm thấy yêu cầu đổi tên.' using errcode='P0002'; end if;
  if v_request.status <> 'pending' then
    raise exception 'Yêu cầu đã được xử lý.' using errcode='55000';
  end if;
  if p_decision='approve' then
    update public.organizations set name=v_request.requested_name
     where id=v_request.organization_id;
  end if;
  update private.organization_name_change_requests
     set status=case when p_decision='approve' then 'approved' else 'rejected' end,
         reviewer_user_id=p_reviewer_user_id,reviewed_at=clock_timestamp(),
         review_note=left(btrim(coalesce(p_review_note,'')),1000)
   where id=p_request_id;
  return jsonb_build_object('status',case when p_decision='approve' then 'approved' else 'rejected' end,
    'request_id',p_request_id,'organization_id',v_request.organization_id,
    'old_name',v_request.old_name,'new_name',v_request.requested_name);
end;
$$;

revoke all on function public.create_organization_name_change_request(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.list_organization_name_change_requests(uuid) from public, anon, authenticated;
revoke all on function public.review_organization_name_change_request(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_organization_name_change_request(uuid,uuid,text,text) to service_role;
grant execute on function public.list_organization_name_change_requests(uuid) to service_role;
grant execute on function public.review_organization_name_change_request(uuid,uuid,text,text) to service_role;

commit;
