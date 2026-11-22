-- Append-only equipment activity history. No image payloads are stored here.
begin;

create or replace function private.is_org_technician(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off as $function$
  select auth.uid() is not null and exists(
    select 1 from public.organization_members m
    join public.member_roles mr on mr.organization_id=m.organization_id and mr.member_id=m.id
    join public.roles r on r.organization_id=mr.organization_id and r.id=mr.role_id
    where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active'
      and lower(r.code) in ('ktv','technician','maintenance_technician')
  );
$function$;
revoke all on function private.is_org_technician(uuid) from public,anon;
grant execute on function private.is_org_technician(uuid) to authenticated;

create table if not exists public.asset_activity_history (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null references public.assets(id) on delete restrict,
  asset_code text not null,
  event_type text not null check (event_type in ('created','updated','status_changed','archived','restored','deleted')),
  summary text not null,
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes)='array'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_label text not null default '',
  occurred_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists asset_activity_history_asset_time_idx
  on public.asset_activity_history(organization_id,asset_code,occurred_at desc);

alter table public.asset_activity_history enable row level security;
drop policy if exists asset_activity_history_select_member on public.asset_activity_history;
create policy asset_activity_history_select_member on public.asset_activity_history
  for select to authenticated
  using (private.has_org_permission(organization_id,'assets.view'));

revoke all on public.asset_activity_history from public,anon,authenticated;
grant select on public.asset_activity_history to authenticated;

create or replace function public.record_cloud_asset_history_event(
  p_organization_id uuid,
  p_event_id uuid,
  p_asset_code text,
  p_event_type text,
  p_summary text,
  p_changes jsonb,
  p_actor_label text,
  p_occurred_at timestamptz
) returns boolean
language plpgsql security definer set search_path='' set row_security=off as $function$
declare v_uid uuid:=auth.uid(); v_asset_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_event_id is null or p_asset_code is null or p_summary is null or p_changes is null
     or jsonb_typeof(p_changes)<>'array' or p_occurred_at is null then
    raise exception 'Invalid equipment history event' using errcode='22023';
  end if;
  if p_event_type not in ('created','updated','status_changed','archived','restored','deleted') then
    raise exception 'Unsupported equipment history event' using errcode='22023';
  end if;
  if p_event_type='created' then
    if not (private.is_org_admin(p_organization_id) or private.is_org_technician(p_organization_id)) or not private.has_org_permission(p_organization_id,'assets.create') then raise exception 'Missing assets.create permission' using errcode='42501'; end if;
  elsif p_event_type='deleted' then
    if not private.is_org_admin(p_organization_id) or not private.has_org_permission(p_organization_id,'assets.delete') then raise exception 'Admin role required' using errcode='42501'; end if;
  else
    if not (private.is_org_admin(p_organization_id) or private.is_org_technician(p_organization_id)) or not private.has_org_permission(p_organization_id,'assets.update') then raise exception 'Missing assets.update permission' using errcode='42501'; end if;
  end if;
  select a.id into v_asset_id from public.assets a
    where a.organization_id=p_organization_id and a.code=p_asset_code;
  if not found then raise exception 'Equipment not found in organization' using errcode='P0002'; end if;
  insert into public.asset_activity_history(
    id,organization_id,asset_id,asset_code,event_type,summary,changes,actor_user_id,actor_label,occurred_at
  ) values (
    p_event_id,p_organization_id,v_asset_id,p_asset_code,p_event_type,p_summary,p_changes,v_uid,
    left(coalesce(p_actor_label,''),160),p_occurred_at
  ) on conflict (id) do nothing;
  return true;
end;
$function$;

revoke all on function public.record_cloud_asset_history_event(uuid,uuid,text,text,text,jsonb,text,timestamptz) from public,anon;
grant execute on function public.record_cloud_asset_history_event(uuid,uuid,text,text,text,jsonb,text,timestamptz) to authenticated;

create or replace function public.list_cloud_asset_history(
  p_organization_id uuid,p_asset_code text,p_limit integer default 100
) returns jsonb
language plpgsql security definer set search_path='' set row_security=off as $function$
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id,'assets.view') then
    raise exception 'Missing assets.view permission' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',h.id,'asset_code',h.asset_code,'event_type',h.event_type,'summary',h.summary,
      'changes',h.changes,'actor_user_id',h.actor_user_id,'actor_label',h.actor_label,
      'occurred_at',h.occurred_at
    ) order by h.occurred_at desc)
    from (
      select * from public.asset_activity_history
      where organization_id=p_organization_id and asset_code=p_asset_code
      order by occurred_at desc limit greatest(1,least(coalesce(p_limit,100),200))
    ) h
  ),'[]'::jsonb);
end;
$function$;

revoke all on function public.list_cloud_asset_history(uuid,text,integer) from public,anon;
grant execute on function public.list_cloud_asset_history(uuid,text,integer) to authenticated;

commit;
