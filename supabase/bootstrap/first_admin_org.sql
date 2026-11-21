-- Bootstrap the first organization and Admin account on BAOTRI-Mini-New.
-- IMPORTANT: Replace both placeholders before running. Run once only.
-- Create the first Auth user in Supabase Dashboard > Authentication > Users first.
-- The Auth trigger must create the matching public.profiles row.
-- Run this script in the Supabase SQL Editor on BAOTRI-Mini-New.

begin;

do $bootstrap$
declare
  v_admin_email text := 'REPLACE_WITH_ADMIN_EMAIL';
  v_organization_name text := 'REPLACE_WITH_ORGANIZATION_NAME';
  v_admin_user_id uuid;
  v_organization_id uuid;
  v_member_id uuid;
  v_admin_role_id uuid;
  v_roles_count integer;
  v_permissions_count integer;
  v_admin_grants integer;
  v_technician_grants integer;
  v_viewer_grants integer;
begin
  if v_admin_email like 'REPLACE_%' or v_organization_name like 'REPLACE_%' then
    raise exception 'Replace the email and organization-name placeholders before running.';
  end if;

  select u.id into strict v_admin_user_id
  from auth.users u
  where lower(u.email) = lower(v_admin_email)
    and u.email_confirmed_at is not null;

  if not exists (select 1 from public.profiles p where p.id = v_admin_user_id) then
    raise exception 'Auth user has no profile; check the Auth user trigger.';
  end if;

  if exists (
    select 1 from public.organizations o
    where o.created_by = v_admin_user_id
      and o.name = v_organization_name
  ) then
    raise exception 'This Admin/organization bootstrap already exists. Stop to avoid duplicates.';
  end if;

  insert into public.organizations (name, created_by)
  values (v_organization_name, v_admin_user_id)
  returning id into v_organization_id;

  -- Migration 007 automatically seeds the three system roles and grants.
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_organization_id, v_admin_user_id, 'admin', 'active')
  returning id into v_member_id;

  select r.id into strict v_admin_role_id
  from public.roles r
  where r.organization_id = v_organization_id
    and r.code = 'admin'
    and r.is_system
    and r.is_active;

  insert into public.member_roles (organization_id, member_id, role_id)
  values (v_organization_id, v_member_id, v_admin_role_id);

  select count(*) into v_roles_count
  from public.roles r
  where r.organization_id = v_organization_id and r.is_system;
  select count(*) into v_permissions_count from public.permissions;
  select count(*) into v_admin_grants
  from public.role_permissions rp
  where rp.organization_id = v_organization_id and rp.role_id = v_admin_role_id;
  select count(*) into v_technician_grants
  from public.role_permissions rp
  join public.roles r on r.organization_id=rp.organization_id and r.id=rp.role_id
  where rp.organization_id=v_organization_id and r.code='technician';
  select count(*) into v_viewer_grants
  from public.role_permissions rp
  join public.roles r on r.organization_id=rp.organization_id and r.id=rp.role_id
  where rp.organization_id=v_organization_id and r.code='viewer';

  if v_roles_count <> 3 or v_permissions_count <> 27
     or v_admin_grants <> 27 or v_technician_grants <> 17 or v_viewer_grants <> 10 then
    raise exception 'RBAC seed validation failed (roles %, permissions %, Admin %, Technician %, Viewer %).',
      v_roles_count, v_permissions_count, v_admin_grants, v_technician_grants, v_viewer_grants;
  end if;
end;
$bootstrap$;

commit;
