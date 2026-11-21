-- BAOTRI Mini (new project) - Migration 006: private authorization helpers.
-- Move security-definer membership and RBAC helpers out of the exposed public schema.
create schema if not exists private;
alter function public.is_org_member(uuid) set schema private;
alter function public.has_org_role(uuid,text) set schema private;
alter function public.has_org_permission(uuid,text) set schema private;
grant usage on schema private to authenticated;
revoke all on function private.is_org_member(uuid) from public,anon;
revoke all on function private.has_org_role(uuid,text) from public,anon;
revoke all on function private.has_org_permission(uuid,text) from public,anon;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid,text) to authenticated;
grant execute on function private.has_org_permission(uuid,text) to authenticated;
