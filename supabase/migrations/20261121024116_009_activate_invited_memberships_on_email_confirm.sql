create or replace function private.activate_invited_memberships_on_email_confirm()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.email_confirmed_at is null and new.email_confirmed_at is not null then
  update public.organization_members set status='active',updated_at=clock_timestamp()
  where user_id=new.id and status='invited';
 end if;
 return new;
end;$$;
revoke all on function private.activate_invited_memberships_on_email_confirm() from public,anon,authenticated;
drop trigger if exists activate_invited_memberships_on_email_confirm on auth.users;
create trigger activate_invited_memberships_on_email_confirm after update of email_confirmed_at on auth.users
for each row execute function private.activate_invited_memberships_on_email_confirm();