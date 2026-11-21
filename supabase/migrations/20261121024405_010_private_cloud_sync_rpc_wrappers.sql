-- Move privileged implementation functions out of the exposed API schema.
-- Public RPC wrappers remain SECURITY INVOKER and delegate to private checked functions.
alter function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) set schema private;
alter function public.acquire_asset_edit_lock(uuid,uuid,text,text) set schema private;
alter function public.heartbeat_asset_edit_lock(uuid,uuid,uuid) set schema private;
alter function public.release_asset_edit_lock(uuid,uuid,uuid) set schema private;
alter function public.list_asset_edit_locks(uuid) set schema private;
alter function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) set schema private;
grant usage on schema private to authenticated;
grant execute on function private.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) to authenticated;
grant execute on function private.acquire_asset_edit_lock(uuid,uuid,text,text) to authenticated;
grant execute on function private.heartbeat_asset_edit_lock(uuid,uuid,uuid) to authenticated;
grant execute on function private.release_asset_edit_lock(uuid,uuid,uuid) to authenticated;
grant execute on function private.list_asset_edit_locks(uuid) to authenticated;
grant execute on function private.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
create function public.import_asset_preserving_identity(p_organization_id uuid,p_id uuid,p_code text,p_asset jsonb,p_mutation_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.import_asset_preserving_identity(p_organization_id,p_id,p_code,p_asset,p_mutation_id); $$;
create function public.acquire_asset_edit_lock(p_organization_id uuid,p_asset_id uuid,p_device_id text,p_holder_label text)
returns jsonb language sql security invoker set search_path='' as $$ select private.acquire_asset_edit_lock(p_organization_id,p_asset_id,p_device_id,p_holder_label); $$;
create function public.heartbeat_asset_edit_lock(p_organization_id uuid,p_asset_id uuid,p_lock_token uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.heartbeat_asset_edit_lock(p_organization_id,p_asset_id,p_lock_token); $$;
create function public.release_asset_edit_lock(p_organization_id uuid,p_asset_id uuid,p_lock_token uuid)
returns boolean language sql security invoker set search_path='' as $$ select private.release_asset_edit_lock(p_organization_id,p_asset_id,p_lock_token); $$;
create function public.list_asset_edit_locks(p_organization_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.list_asset_edit_locks(p_organization_id); $$;
create function public.apply_asset_mutation_with_lock(p_organization_id uuid,p_asset_id uuid,p_lock_token uuid,p_mutation_id uuid,p_expected_cloud_updated_at timestamptz,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.apply_asset_mutation_with_lock(p_organization_id,p_asset_id,p_lock_token,p_mutation_id,p_expected_cloud_updated_at,p_payload); $$;
revoke all on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) from public,anon;
revoke all on function public.acquire_asset_edit_lock(uuid,uuid,text,text) from public,anon;
revoke all on function public.heartbeat_asset_edit_lock(uuid,uuid,uuid) from public,anon;
revoke all on function public.release_asset_edit_lock(uuid,uuid,uuid) from public,anon;
revoke all on function public.list_asset_edit_locks(uuid) from public,anon;
revoke all on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) to authenticated;
grant execute on function public.acquire_asset_edit_lock(uuid,uuid,text,text) to authenticated;
grant execute on function public.heartbeat_asset_edit_lock(uuid,uuid,uuid) to authenticated;
grant execute on function public.release_asset_edit_lock(uuid,uuid,uuid) to authenticated;
grant execute on function public.list_asset_edit_locks(uuid) to authenticated;
grant execute on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
create policy asset_edit_locks_deny_direct on public.asset_edit_locks for all to authenticated using(false) with check(false);
create policy asset_import_receipts_deny_direct on public.asset_import_receipts for all to authenticated using(false) with check(false);
create policy asset_mutation_receipts_deny_direct on public.asset_mutation_receipts for all to authenticated using(false) with check(false);