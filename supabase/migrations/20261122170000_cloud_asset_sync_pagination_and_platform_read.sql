-- Tenant-scoped, keyset-paginated Cloud asset reads for member sync and Platform Super Admin.
begin;

-- Tighten the legacy non-paginated endpoint too; clients are migrated to the page API below.
create or replace function public.list_cloud_assets(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null or not private.has_org_permission(p_organization_id, 'assets.view') then
    raise exception 'Missing assets.view permission for this organization' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
    (to_jsonb(a) - 'id') || jsonb_build_object('asset_key',a.code)
    order by a.name,a.code
  ),'[]'::jsonb) into v_result
  from public.assets a where a.organization_id=p_organization_id;
  return v_result;
end;
$function$;

create or replace function public.list_cloud_assets_page(
  p_organization_id uuid,
  p_after_code text default null,
  p_page_size integer default 100,
  p_platform_admin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_email_confirmed_at timestamptz;
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 100), 100));
  v_items jsonb;
  v_has_more boolean;
  v_next_cursor text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_platform_admin then
    select lower(u.email), u.email_confirmed_at
      into v_email, v_email_confirmed_at
    from auth.users u where u.id = v_uid;

    if v_email is distinct from 'tuanluongpham1980@gmail.com'
       or v_email_confirmed_at is null then
      raise exception 'Platform Super Admin verification failed' using errcode = '42501';
    end if;
  elsif not private.has_org_permission(p_organization_id, 'assets.view') then
    raise exception 'Missing assets.view permission for this organization' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.status = 'active'
  ) then
    raise exception 'Active organization not found' using errcode = 'P0002';
  end if;

  with page_rows as (
    select a.*
    from public.assets a
    where a.organization_id = p_organization_id
      and (p_after_code is null or a.code > p_after_code)
    order by a.code
    limit v_page_size + 1
  ),
  numbered as (
    select p.*, row_number() over (order by p.code) as rn
    from page_rows p
  )
  select
    coalesce(jsonb_agg(
      (to_jsonb(n) - 'id' - 'rn') || jsonb_build_object('asset_key', n.code)
      order by n.code
    ) filter (where n.rn <= v_page_size), '[]'::jsonb),
    count(*) > v_page_size,
    max(n.code) filter (where n.rn <= v_page_size)
  into v_items, v_has_more, v_next_cursor
  from numbered n;

  return jsonb_build_object(
    'items', v_items,
    'has_more', coalesce(v_has_more, false),
    'next_cursor', v_next_cursor
  );
end;
$function$;

revoke all on function public.list_cloud_assets_page(uuid,text,integer,boolean) from public, anon;
grant execute on function public.list_cloud_assets_page(uuid,text,integer,boolean) to authenticated;

commit;
