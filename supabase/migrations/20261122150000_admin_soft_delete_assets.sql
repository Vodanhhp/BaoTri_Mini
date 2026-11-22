-- Admin-only soft delete for equipment. Preserve all asset and history rows.
begin;

create or replace function private.is_org_admin(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off as $function$
 select auth.uid() is not null and exists(
  select 1 from public.organization_members m
  join public.member_roles mr on mr.organization_id=m.organization_id and mr.member_id=m.id
  join public.roles r on r.organization_id=mr.organization_id and r.id=mr.role_id
  where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active' and r.code='admin'
 );
$function$;
revoke all on function private.is_org_admin(uuid) from public,anon;
grant execute on function private.is_org_admin(uuid) to authenticated;

alter table public.assets add column if not exists deleted_at timestamptz;
create index if not exists assets_org_deleted_code_idx on public.assets(organization_id,deleted_at,code) where deleted_at is not null;

-- Non-admins cannot read deleted equipment through direct table access.
drop policy if exists assets_select_member on public.assets;
create policy assets_select_member on public.assets for select to authenticated
using (private.is_org_member(organization_id) and (deleted_at is null or (private.is_org_admin(organization_id) and private.has_org_permission(organization_id,'assets.delete'))));

-- The paginated list remains tenant-scoped. Admin can view deleted records; other members cannot.
create or replace function public.list_cloud_assets_page(
  p_organization_id uuid,p_after_code text default null,p_page_size integer default 100,p_platform_admin boolean default false
) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $function$
declare
 v_uid uuid:=auth.uid();v_email text;v_email_confirmed_at timestamptz;
 v_page_size integer:=greatest(1,least(coalesce(p_page_size,100),100));v_items jsonb;v_has_more boolean;v_next_cursor text;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_platform_admin then
  select lower(u.email),u.email_confirmed_at into v_email,v_email_confirmed_at from auth.users u where u.id=v_uid;
  if v_email is distinct from 'tuanluongpham1980@gmail.com' or v_email_confirmed_at is null then raise exception 'Platform Super Admin verification failed' using errcode='42501';end if;
 elsif not private.has_org_permission(p_organization_id,'assets.view') then raise exception 'Missing assets.view permission for this organization' using errcode='42501';end if;
 if not exists(select 1 from public.organizations o where o.id=p_organization_id and o.status='active') then raise exception 'Active organization not found' using errcode='P0002';end if;
 with page_rows as (
  select a.* from public.assets a where a.organization_id=p_organization_id and (p_after_code is null or a.code>p_after_code)
   and (a.deleted_at is null or p_platform_admin or (private.is_org_admin(p_organization_id) and private.has_org_permission(p_organization_id,'assets.delete')))
  order by a.code limit v_page_size+1
 ), numbered as (select p.*,row_number() over(order by p.code) as rn from page_rows p)
 select coalesce(jsonb_agg((to_jsonb(n)-'id'-'rn')||jsonb_build_object('asset_key',n.code) order by n.code) filter(where n.rn<=v_page_size),'[]'::jsonb),
  count(*)>v_page_size,max(n.code) filter(where n.rn<=v_page_size) into v_items,v_has_more,v_next_cursor from numbered n;
 return jsonb_build_object('items',v_items,'has_more',coalesce(v_has_more,false),'next_cursor',v_next_cursor);
end;$function$;
revoke all on function public.list_cloud_assets_page(uuid,text,integer,boolean) from public,anon;
grant execute on function public.list_cloud_assets_page(uuid,text,integer,boolean) to authenticated;

-- KTV receives only deletion tombstones, never the deleted equipment profile. This lets Local hide cached rows.
create or replace function public.list_cloud_asset_deletion_tombstones(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $function$
begin
 if auth.uid() is null or not private.has_org_permission(p_organization_id,'assets.view') then raise exception 'Missing assets.view permission' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('code',a.code,'deleted_at',a.deleted_at,'updated_at',a.updated_at) order by a.code)
  from public.assets a where a.organization_id=p_organization_id and a.deleted_at is not null),'[]'::jsonb);
end;$function$;
revoke all on function public.list_cloud_asset_deletion_tombstones(uuid) from public,anon;
grant execute on function public.list_cloud_asset_deletion_tombstones(uuid) to authenticated;

-- Admin-only, lock-protected, idempotent soft delete. It writes a receipt and never deletes asset/history rows.
create or replace function public.soft_delete_cloud_asset_with_lock(
 p_organization_id uuid,p_asset_code text,p_lock_token uuid,p_mutation_id uuid,p_expected_cloud_updated_at timestamptz,p_deleted_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $function$
declare v_actor uuid:=auth.uid();v_asset_id uuid;v_asset public.assets;v_lock public.asset_edit_locks;v_receipt public.asset_mutation_receipts;v_payload jsonb;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not private.has_org_permission(p_organization_id,'assets.delete') or not private.is_org_admin(p_organization_id) then raise exception 'Admin role required to delete equipment' using errcode='42501';end if;
 if p_mutation_id is null or p_expected_cloud_updated_at is null or p_deleted_at is null then raise exception 'Invalid delete request' using errcode='22023';end if;
 v_payload:=jsonb_build_object('deleted_at',p_deleted_at);
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_mutation_id::text,0));
 select * into v_receipt from public.asset_mutation_receipts where organization_id=p_organization_id and mutation_id=p_mutation_id;
 if found then
  if v_receipt.actor_user_id<>v_actor or v_receipt.expected_cloud_updated_at<>p_expected_cloud_updated_at or v_receipt.request_payload<>v_payload then raise exception 'Mutation ID reused with different request' using errcode='23505';end if;
  return jsonb_build_object('already_applied',true,'asset',(v_receipt.result_snapshot-'id')||jsonb_build_object('asset_key',p_asset_code),'applied_at',v_receipt.applied_at);
 end if;
 select id into v_asset_id from public.assets where organization_id=p_organization_id and code=p_asset_code for update;
 if not found then raise exception 'Asset not found' using errcode='P0002';end if;
 select * into v_lock from public.asset_edit_locks where organization_id=p_organization_id and asset_id=v_asset_id for update;
 if not found or v_lock.holder_user_id<>v_actor or v_lock.lock_token<>p_lock_token or v_lock.expires_at<=clock_timestamp() then raise exception 'Edit lease missing, expired or not owned' using errcode='55000';end if;
 select * into v_asset from public.assets where organization_id=p_organization_id and id=v_asset_id for update;
 if v_asset.deleted_at is not null then raise exception 'Asset is already deleted' using errcode='55000';end if;
 if v_asset.updated_at<>p_expected_cloud_updated_at then raise exception 'Cloud version changed; refresh and resolve manually' using errcode='40001';end if;
 update public.assets set deleted_at=p_deleted_at,updated_at=clock_timestamp() where organization_id=p_organization_id and id=v_asset_id returning * into v_asset;
 insert into public.asset_mutation_receipts(organization_id,mutation_id,asset_id,actor_user_id,expected_cloud_updated_at,request_payload,result_snapshot)
 values(p_organization_id,p_mutation_id,v_asset_id,v_actor,p_expected_cloud_updated_at,v_payload,to_jsonb(v_asset)) returning * into v_receipt;
 return jsonb_build_object('already_applied',false,'asset',(to_jsonb(v_asset)-'id')||jsonb_build_object('asset_key',p_asset_code),'applied_at',v_receipt.applied_at);
end;$function$;
revoke all on function public.soft_delete_cloud_asset_with_lock(uuid,text,uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.soft_delete_cloud_asset_with_lock(uuid,text,uuid,uuid,timestamptz,timestamptz) to authenticated;

-- Legacy list API also hides deleted assets from non-admin members.
create or replace function public.list_cloud_assets(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $function$
declare v_result jsonb;
begin
 if auth.uid() is null or not private.has_org_permission(p_organization_id,'assets.view') then raise exception 'Missing assets.view permission' using errcode='42501';end if;
 select coalesce(jsonb_agg((to_jsonb(a)-'id')||jsonb_build_object('asset_key',a.code) order by a.name,a.code),'[]'::jsonb) into v_result
 from public.assets a where a.organization_id=p_organization_id and (a.deleted_at is null or (private.is_org_admin(p_organization_id) and private.has_org_permission(p_organization_id,'assets.delete')));
 return v_result;
end;$function$;
revoke all on function public.list_cloud_assets(uuid) from public,anon;
grant execute on function public.list_cloud_assets(uuid) to authenticated;

commit;
