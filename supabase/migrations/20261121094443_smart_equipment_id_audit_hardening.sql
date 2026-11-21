-- Smart Equipment ID safety hardening: immutable Local UUID and group-change audit.

begin;

create unique index if not exists asset_id_sequence_reservations_asset_id_unique
on private.asset_id_sequence_reservations (organization_id, asset_id)
where asset_id is not null;

create table if not exists private.asset_group_change_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  old_category text not null,
  new_category text not null,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text,
  foreign key (organization_id, asset_id)
    references public.assets(organization_id, id) on delete restrict
);

alter table private.asset_group_change_history enable row level security;
revoke all on table private.asset_group_change_history from public, anon, authenticated;

create or replace function private.log_asset_group_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
begin
  if new.category is distinct from old.category then
    insert into private.asset_group_change_history (
      organization_id, asset_id, old_category, new_category, changed_by_user_id
    ) values (
      old.organization_id, old.id, old.category, new.category, auth.uid()
    );
  end if;
  return new;
end;
$function$;

revoke all on function private.log_asset_group_change() from public, anon, authenticated;

drop trigger if exists assets_log_group_change on public.assets;
create trigger assets_log_group_change
after update on public.assets
for each row
when (old.category is distinct from new.category)
execute function private.log_asset_group_change();

commit;