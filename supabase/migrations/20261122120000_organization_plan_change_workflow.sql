-- Organization Plan change requests and audited, atomic Plan transitions.
-- Existing equipment IDs, equipment rows, and sequence reservations are intentionally untouched.

begin;

create table if not exists private.organization_plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id),
  current_plan_code text not null check (current_plan_code in ('A','B','C','D')),
  requested_plan_code text not null check (requested_plan_code in ('A','B','C','D')),
  request_note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text not null default '',
  applied_catalog_version text,
  constraint organization_plan_change_different_plan check (current_plan_code <> requested_plan_code)
);

create unique index if not exists organization_plan_change_one_pending_per_org
  on private.organization_plan_change_requests(organization_id)
  where status = 'pending';

create index if not exists organization_plan_change_requests_status_time
  on private.organization_plan_change_requests(status, requested_at desc);

create table if not exists private.organization_plan_change_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references private.organization_plan_change_requests(id),
  organization_id uuid not null references public.organizations(id),
  previous_plan_code text not null check (previous_plan_code in ('A','B','C','D')),
  new_plan_code text not null check (new_plan_code in ('A','B','C','D')),
  requested_by_user_id uuid not null references auth.users(id),
  approved_by_user_id uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  catalog_version text not null,
  request_note text not null default '',
  review_note text not null default ''
);

alter table private.organization_plan_change_requests enable row level security;
alter table private.organization_plan_change_history enable row level security;
revoke all on table private.organization_plan_change_requests from public, anon, authenticated, service_role;
revoke all on table private.organization_plan_change_history from public, anon, authenticated, service_role;
grant usage on schema private to service_role;

create or replace function private.create_organization_plan_change_request(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_requested_plan_code text,
  p_request_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_current_plan text;
  v_org_status text;
  v_request private.organization_plan_change_requests;
  v_target text := upper(btrim(coalesce(p_requested_plan_code,'')));
begin
  if p_organization_id is null or p_actor_user_id is null then
    raise exception 'Organization and actor are required' using errcode='22023';
  end if;
  if v_target not in ('A','B','C','D') then
    raise exception 'A valid Plan A, B, C or D is required' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=p_actor_user_id
      and m.role='admin'
      and m.status='active'
  ) then
    raise exception 'Only an active organization Admin may request a Plan change' using errcode='42501';
  end if;
  select o.status into v_org_status from public.organizations o where o.id=p_organization_id;
  if v_org_status is distinct from 'active' then
    raise exception 'A suspended or unavailable organization cannot request a Plan change' using errcode='42501';
  end if;
  select c.plan_code into v_current_plan
  from public.organization_equipment_catalog c
  where c.organization_id=p_organization_id
  for update;
  if v_current_plan is null then
    raise exception 'Organization Plan and Catalog Snapshot have not been initialized' using errcode='55000';
  end if;
  if v_current_plan=v_target then
    raise exception 'The requested Plan is already active' using errcode='22023';
  end if;
  insert into private.organization_plan_change_requests(
    organization_id,requested_by_user_id,current_plan_code,requested_plan_code,request_note
  ) values (
    p_organization_id,p_actor_user_id,v_current_plan,v_target,left(btrim(coalesce(p_request_note,'')),1000)
  ) returning * into v_request;
  return jsonb_build_object(
    'id',v_request.id,'organization_id',v_request.organization_id,
    'current_plan_code',v_request.current_plan_code,'requested_plan_code',v_request.requested_plan_code,
    'request_note',v_request.request_note,'status',v_request.status,'requested_at',v_request.requested_at
  );
exception
  when unique_violation then
    raise exception 'This organization already has a pending Plan change request' using errcode='23505';
end;
$function$;

create or replace function private.list_organization_plan_change_requests(
  p_organization_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = ''
set row_security = off
as $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',r.id,'organization_id',r.organization_id,'organization_name',o.name,
      'current_plan_code',r.current_plan_code,'requested_plan_code',r.requested_plan_code,
      'request_note',r.request_note,'status',r.status,'requested_at',r.requested_at,
      'requested_by_user_id',r.requested_by_user_id,
      'requested_by_email',u.email,'requested_by_name',p.display_name,
      'reviewed_by_user_id',r.reviewed_by_user_id,'reviewed_at',r.reviewed_at,
      'review_note',r.review_note,'applied_catalog_version',r.applied_catalog_version
    ) order by case when r.status='pending' then 0 else 1 end, r.requested_at desc
  ),'[]'::jsonb)
  from private.organization_plan_change_requests r
  join public.organizations o on o.id=r.organization_id
  join auth.users u on u.id=r.requested_by_user_id
  left join public.profiles p on p.id=r.requested_by_user_id
  where p_organization_id is null or r.organization_id=p_organization_id;
$function$;

create or replace function private.review_organization_plan_change_request(
  p_request_id uuid,
  p_reviewer_user_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_request private.organization_plan_change_requests;
  v_catalog_row public.organization_equipment_catalog;
  v_standard jsonb;
  v_new_plan jsonb;
  v_groups jsonb;
  v_dictionary jsonb;
  v_industries jsonb;
  v_snapshot jsonb;
  v_version text;
  v_rank integer;
  v_result jsonb;
begin
  if p_request_id is null or p_reviewer_user_id is null then
    raise exception 'Request and reviewer are required' using errcode='22023';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Decision must be approve or reject' using errcode='22023';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id=p_reviewer_user_id
      and lower(u.email)='tuanluongpham1980@gmail.com'
      and u.email_confirmed_at is not null
  ) then
    raise exception 'Only the verified platform owner may review Plan changes' using errcode='42501';
  end if;

  select * into v_request
  from private.organization_plan_change_requests r
  where r.id=p_request_id
  for update;
  if not found then raise exception 'Plan change request not found' using errcode='P0002'; end if;
  if v_request.status <> 'pending' then
    raise exception 'This Plan change request has already been reviewed' using errcode='40001';
  end if;

  if p_decision='reject' then
    update private.organization_plan_change_requests
    set status='rejected',reviewed_by_user_id=p_reviewer_user_id,
        reviewed_at=clock_timestamp(),review_note=left(btrim(coalesce(p_review_note,'')),1000)
    where id=p_request_id;
    return jsonb_build_object('ok',true,'status','rejected','request_id',p_request_id);
  end if;

  select * into v_catalog_row
  from public.organization_equipment_catalog c
  where c.organization_id=v_request.organization_id
  for update;
  if not found then raise exception 'Organization Catalog Snapshot is missing' using errcode='55000'; end if;
  if v_catalog_row.plan_code <> v_request.current_plan_code then
    raise exception 'Organization Plan changed after this request was submitted; reload and reconcile before approval' using errcode='40001';
  end if;

  select c.catalog,c.data_version into v_standard,v_version
  from private.standard_equipment_catalog_versions c
  where c.is_current
  order by c.published_at desc
  limit 1;
  if v_standard is null then raise exception 'No current standard catalog is published' using errcode='55000'; end if;

  select p into v_new_plan
  from jsonb_array_elements(v_standard->'plans') p
  where p->>'id'=v_request.requested_plan_code
  limit 1;
  if v_new_plan is null then raise exception 'Requested Plan is not in the current standard catalog' using errcode='22023'; end if;
  v_rank := case v_request.requested_plan_code when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 end;

  -- Preserve every existing tenant catalog entry. Append newly available standard entries
  -- only when their stable code/name is not already present; never overwrite customer edits.
  select coalesce(v_catalog_row.snapshot->'equipmentGroups','[]'::jsonb) ||
    coalesce((
      select jsonb_agg(g order by x.ordinality)
      from jsonb_array_elements(v_standard->'equipmentGroups') with ordinality x(g,ordinality)
      where case coalesce(g->>'availableFromPlan','B')
        when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 99 end <= v_rank
        and not exists (
          select 1 from jsonb_array_elements(coalesce(v_catalog_row.snapshot->'equipmentGroups','[]'::jsonb)) old
          where upper(coalesce(old->>'code',''))=upper(coalesce(g->>'code',''))
        )
    ),'[]'::jsonb)
  into v_groups;

  select coalesce(v_catalog_row.snapshot->'equipmentDictionary','[]'::jsonb) ||
    coalesce((
      select jsonb_agg(
        case when nullif(d->>'suggestedGroup','') is not null and not exists (
          select 1 from jsonb_array_elements(v_groups) g
          where upper(coalesce(g->>'code',''))=upper(coalesce(d->>'suggestedGroup',''))
        ) then d-'suggestedGroup' else d end
        order by x.ordinality
      )
      from jsonb_array_elements(v_standard->'equipmentDictionary') with ordinality x(d,ordinality)
      where not exists (
        select 1 from jsonb_array_elements(coalesce(v_catalog_row.snapshot->'equipmentDictionary','[]'::jsonb)) old
        where upper(coalesce(old->>'shortCode',''))=upper(coalesce(d->>'shortCode',''))
      )
    ),'[]'::jsonb)
  into v_dictionary;

  select coalesce(v_catalog_row.snapshot->'industries','[]'::jsonb) ||
    coalesce((
      select jsonb_agg(i order by x.ordinality)
      from jsonb_array_elements(v_standard->'industries') with ordinality x(i,ordinality)
      where case coalesce(i->>'plan','A')
        when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 99 end <= v_rank
        and not exists (
          select 1 from jsonb_array_elements(coalesce(v_catalog_row.snapshot->'industries','[]'::jsonb)) old
          where upper(coalesce(old->>'code',''))=upper(coalesce(i->>'code',''))
        )
    ),'[]'::jsonb)
  into v_industries;

  v_snapshot := v_catalog_row.snapshot || jsonb_build_object(
    'dataVersion',v_version,
    'plan',v_new_plan,
    'plans',jsonb_build_array(v_new_plan),
    'equipmentGroups',v_groups,
    'equipmentDictionary',v_dictionary,
    'industries',v_industries,
    'idRules',coalesce(v_catalog_row.snapshot->'idRules','{}'::jsonb) ||
      jsonb_build_object('selectedPlan',v_standard->'idRules'->('PLAN_'||v_request.requested_plan_code))
  );

  update public.organization_equipment_catalog
  set plan_code=v_request.requested_plan_code,
      source_data_version=v_version,
      snapshot=v_snapshot,
      updated_at=clock_timestamp()
  where organization_id=v_request.organization_id;

  update private.organization_plan_change_requests
  set status='approved',reviewed_by_user_id=p_reviewer_user_id,
      reviewed_at=clock_timestamp(),review_note=left(btrim(coalesce(p_review_note,'')),1000),
      applied_catalog_version=v_version
  where id=p_request_id;

  insert into private.organization_plan_change_history(
    request_id,organization_id,previous_plan_code,new_plan_code,
    requested_by_user_id,approved_by_user_id,catalog_version,request_note,review_note
  ) values (
    p_request_id,v_request.organization_id,v_request.current_plan_code,v_request.requested_plan_code,
    v_request.requested_by_user_id,p_reviewer_user_id,v_version,v_request.request_note,
    left(btrim(coalesce(p_review_note,'')),1000)
  );

  return jsonb_build_object(
    'ok',true,'status','approved','request_id',p_request_id,
    'organization_id',v_request.organization_id,
    'previous_plan_code',v_request.current_plan_code,
    'new_plan_code',v_request.requested_plan_code,
    'catalog_version',v_version
  );
end;
$function$;

revoke all on function private.create_organization_plan_change_request(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function private.list_organization_plan_change_requests(uuid) from public,anon,authenticated,service_role;
revoke all on function private.review_organization_plan_change_request(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.create_organization_plan_change_request(uuid,uuid,text,text) to service_role;
grant execute on function private.list_organization_plan_change_requests(uuid) to service_role;
grant execute on function private.review_organization_plan_change_request(uuid,uuid,text,text) to service_role;

create or replace function public.create_organization_plan_change_request(
  p_organization_id uuid,p_actor_user_id uuid,p_requested_plan_code text,p_request_note text default ''
)
returns jsonb language sql security invoker set search_path=''
as $function$
  select private.create_organization_plan_change_request(
    p_organization_id,p_actor_user_id,p_requested_plan_code,p_request_note
  );
$function$;

create or replace function public.list_organization_plan_change_requests(p_organization_id uuid default null)
returns jsonb language sql security invoker set search_path=''
as $function$
  select private.list_organization_plan_change_requests(p_organization_id);
$function$;

create or replace function public.review_organization_plan_change_request(
  p_request_id uuid,p_reviewer_user_id uuid,p_decision text,p_review_note text default ''
)
returns jsonb language sql security invoker set search_path=''
as $function$
  select private.review_organization_plan_change_request(
    p_request_id,p_reviewer_user_id,p_decision,p_review_note
  );
$function$;

revoke all on function public.create_organization_plan_change_request(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.list_organization_plan_change_requests(uuid) from public,anon,authenticated;
revoke all on function public.review_organization_plan_change_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_organization_plan_change_request(uuid,uuid,text,text) to service_role;
grant execute on function public.list_organization_plan_change_requests(uuid) to service_role;
grant execute on function public.review_organization_plan_change_request(uuid,uuid,text,text) to service_role;

comment on table private.organization_plan_change_requests is
  'Tenant Admin Plan change requests. Access is mediated by trusted Edge Functions; no client table access.';
comment on table private.organization_plan_change_history is
  'Immutable audit history for approved organization Plan changes. Existing equipment records and issued IDs are never rewritten.';

commit;
