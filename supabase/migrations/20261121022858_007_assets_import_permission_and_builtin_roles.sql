-- BAOTRI Mini (new project): restore the import permission and seed
-- the three built-in roles/permission grants for every organization.

insert into public.permissions (code, module, action, description)
values (
  'assets.import',
  'assets',
  'import',
  'Nhập hồ sơ thiết bị đã có từ dữ liệu Local, giữ nguyên UUID và mã quản lý'
)
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

create or replace function private.seed_builtin_roles_for_org(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id
  ) then
    raise exception 'Organization does not exist.';
  end if;

  insert into public.roles (organization_id, code, name, description, is_system)
  values
    (p_organization_id, 'admin', 'Admin', 'Quản trị toàn bộ doanh nghiệp', true),
    (p_organization_id, 'technician', 'Kỹ thuật viên', 'Thực hiện nghiệp vụ kỹ thuật', true),
    (p_organization_id, 'viewer', 'Người xem', 'Chỉ xem dữ liệu được phép', true)
  on conflict (organization_id, code) do nothing;

  -- Admin receives the complete permission catalog.
  insert into public.role_permissions (organization_id, role_id, permission_code)
  select p_organization_id, r.id, p.code
  from public.roles r
  cross join public.permissions p
  where r.organization_id = p_organization_id
    and r.code = 'admin'
  on conflict do nothing;

  -- Technician: operational read/write, no administration or destructive deletes.
  insert into public.role_permissions (organization_id, role_id, permission_code)
  select p_organization_id, r.id, p.code
  from public.roles r
  join public.permissions p on p.code in (
    'dashboard.view',
    'assets.view', 'assets.create', 'assets.update',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
    'maintenance.view', 'maintenance.create', 'maintenance.update',
    'checklist.view', 'checklist.result.create',
    'logs.view', 'logs.create',
    'reports.view', 'settings.view'
  )
  where r.organization_id = p_organization_id
    and r.code = 'technician'
  on conflict do nothing;

  -- Viewer uses an explicit allowlist matching the previous system.
  insert into public.role_permissions (organization_id, role_id, permission_code)
  select p_organization_id, r.id, p.code
  from public.roles r
  join public.permissions p on p.code in (
    'assets.view',
    'checklist.view',
    'dashboard.view',
    'inventory.view',
    'logs.view',
    'maintenance.view',
    'reports.view',
    'roles.view',
    'settings.view',
    'users.view'
  )
  where r.organization_id = p_organization_id
    and r.code = 'viewer'
  on conflict do nothing;
end;
$$;

create or replace function private.seed_builtin_roles_after_org_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_builtin_roles_for_org(new.id);
  return new;
end;
$$;

revoke all on function private.seed_builtin_roles_for_org(uuid) from public, anon, authenticated;
revoke all on function private.seed_builtin_roles_after_org_insert() from public, anon, authenticated;

drop trigger if exists seed_builtin_roles_on_org_created on public.organizations;
create trigger seed_builtin_roles_on_org_created
after insert on public.organizations
for each row execute function private.seed_builtin_roles_after_org_insert();

-- Backfill organizations that existed before this migration.
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform private.seed_builtin_roles_for_org(v_org_id);
  end loop;
end;
$$;
