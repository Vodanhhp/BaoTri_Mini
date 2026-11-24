-- Organization-scoped catalog dictionary audit.
-- Catalog writes remain protected by organization_equipment_catalog RLS (settings.manage).
-- This trigger records the before/after Snapshot without exposing direct INSERT access.

begin;

create table if not exists public.organization_equipment_catalog_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action = 'snapshot_updated'),
  old_snapshot jsonb not null,
  new_snapshot jsonb not null,
  old_updated_at timestamptz not null,
  new_updated_at timestamptz not null,
  changed_at timestamptz not null default clock_timestamp()
);

create index if not exists organization_equipment_catalog_history_org_changed_idx
  on public.organization_equipment_catalog_history (organization_id, changed_at desc);

alter table public.organization_equipment_catalog_history enable row level security;
revoke all on table public.organization_equipment_catalog_history from public, anon, authenticated;
grant select on table public.organization_equipment_catalog_history to authenticated;

create policy organization_equipment_catalog_history_admin_read
on public.organization_equipment_catalog_history
for select
to authenticated
using (private.has_org_permission(organization_id, 'settings.manage'));

create or replace function private.log_organization_equipment_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
begin
  if new.snapshot is distinct from old.snapshot then
    insert into public.organization_equipment_catalog_history (
      organization_id, actor_user_id, action,
      old_snapshot, new_snapshot, old_updated_at, new_updated_at
    ) values (
      new.organization_id, auth.uid(), 'snapshot_updated',
      old.snapshot, new.snapshot, old.updated_at, new.updated_at
    );
  end if;
  return new;
end;
$function$;

revoke all on function private.log_organization_equipment_catalog_change() from public, anon, authenticated;

drop trigger if exists organization_equipment_catalog_audit_snapshot
  on public.organization_equipment_catalog;
create trigger organization_equipment_catalog_audit_snapshot
after update of snapshot on public.organization_equipment_catalog
for each row
execute function private.log_organization_equipment_catalog_change();

commit;
