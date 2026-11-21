-- 008: Cloud equipment records and safe Local-first transfer/edit primitives.
-- Images remain Local-only until a reviewed Storage feature is implemented.

create table public.assets (
 id uuid primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
 code text not null, name text not null, category text not null,
 brand text not null default '', model text not null default '', serial text not null default '',
 location text not null default '', commissioned_at date, power text not null default '',
 cycle text not null default '', cycle_started_at date,
 transferred_from_other_facility boolean not null default false,
 status text not null default 'Đang hoạt động', notes text not null default '',
 archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by_user_id uuid references auth.users(id) on delete set null, created_by_label text,
 unique(organization_id,id), unique(organization_id,code),
 check(char_length(btrim(code))>0),check(char_length(btrim(name))>0),check(char_length(btrim(category))>0),
 check(status in ('Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý'))
);
create index assets_org_category_idx on public.assets(organization_id,category);
create index assets_org_status_idx on public.assets(organization_id,status);
create index assets_org_location_idx on public.assets(organization_id,location);
alter table public.assets enable row level security;
create policy assets_select_member on public.assets for select to authenticated using(private.is_org_member(organization_id));
revoke insert,update,delete on public.assets from anon,authenticated;
grant select on public.assets to authenticated;

create table public.asset_import_receipts (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 mutation_id uuid not null, asset_id uuid not null,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 payload jsonb not null,result_snapshot jsonb not null,applied_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,mutation_id),
 foreign key(organization_id,asset_id) references public.assets(organization_id,id) on delete restrict
);
alter table public.asset_import_receipts enable row level security;
revoke all on public.asset_import_receipts from anon,authenticated;

create table public.asset_edit_locks (
 organization_id uuid not null,asset_id uuid not null,
 holder_user_id uuid not null references auth.users(id) on delete cascade,
 holder_device_id text not null,holder_label text not null,lock_token uuid not null,
 acquired_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 primary key(organization_id,asset_id),
 foreign key(organization_id,asset_id) references public.assets(organization_id,id) on delete cascade,
 check(expires_at>acquired_at)
);
alter table public.asset_edit_locks enable row level security;
revoke all on public.asset_edit_locks from anon,authenticated;

create table public.asset_mutation_receipts (
 organization_id uuid not null,mutation_id uuid not null,asset_id uuid not null,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 expected_cloud_updated_at timestamptz not null,request_payload jsonb not null,
 result_snapshot jsonb not null,applied_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,mutation_id),
 foreign key(organization_id,asset_id) references public.assets(organization_id,id) on delete restrict
);
alter table public.asset_mutation_receipts enable row level security;
revoke all on public.asset_mutation_receipts from anon,authenticated;

-- Explicit Local-to-Cloud import: never regenerates UUID/code, never overwrites
-- existing Cloud rows, validates a closed payload shape, and is retry-safe.
create or replace function public.import_asset_preserving_identity(p_organization_id uuid,p_id uuid,p_code text,p_asset jsonb,p_mutation_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_actor uuid:=auth.uid();v_input public.assets;v_payload jsonb;v_existing public.assets;v_result jsonb;v_receipt public.asset_import_receipts;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not private.has_org_permission(p_organization_id,'assets.import') then raise exception 'Missing assets.import permission' using errcode='42501';end if;
 if p_id is null or p_mutation_id is null or nullif(btrim(p_code),'') is null or p_asset is null or jsonb_typeof(p_asset)<>'object' then raise exception 'Invalid import identity or payload' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_asset) k where k not in ('name','category','brand','model','serial','location','commissioned_at','power','cycle','cycle_started_at','transferred_from_other_facility','status','notes','archived_at','created_at','updated_at','created_by_user_id','created_by_label')) then raise exception 'Import payload contains unsupported fields' using errcode='22023';end if;
 if jsonb_typeof(p_asset->'name')<>'string' or jsonb_typeof(p_asset->'category')<>'string' or jsonb_typeof(p_asset->'status')<>'string' or jsonb_typeof(p_asset->'transferred_from_other_facility')<>'boolean' or jsonb_typeof(p_asset->'created_at')<>'string' or jsonb_typeof(p_asset->'updated_at')<>'string' then raise exception 'Import payload missing required fields or invalid types' using errcode='22023';end if;
 v_input:=jsonb_populate_record(null::public.assets,jsonb_build_object(
 'id',p_id,'organization_id',p_organization_id,'code',p_code,'name',trim(p_asset->>'name'),'category',trim(p_asset->>'category'),
 'brand',coalesce(p_asset->>'brand',''),'model',coalesce(p_asset->>'model',''),'serial',coalesce(p_asset->>'serial',''),'location',coalesce(p_asset->>'location',''),
 'commissioned_at',nullif(p_asset->>'commissioned_at',''),'power',coalesce(p_asset->>'power',''),'cycle',coalesce(p_asset->>'cycle',''),
 'cycle_started_at',nullif(p_asset->>'cycle_started_at',''),'transferred_from_other_facility',coalesce((p_asset->>'transferred_from_other_facility')::boolean,false),
 'status',p_asset->>'status','notes',coalesce(p_asset->>'notes',''),'archived_at',nullif(p_asset->>'archived_at',''),
 'created_at',p_asset->>'created_at','updated_at',p_asset->>'updated_at','created_by_user_id',nullif(p_asset->>'created_by_user_id',''),
 'created_by_label',p_asset->>'created_by_label'));
 if nullif(trim(v_input.name),'') is null or nullif(trim(v_input.category),'') is null or v_input.status not in ('Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý') then raise exception 'Invalid name, category or status' using errcode='22023';end if;
 v_payload:=to_jsonb(v_input);
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_mutation_id::text,0));
 select * into v_receipt from public.asset_import_receipts where organization_id=p_organization_id and mutation_id=p_mutation_id;
 if found then
  if v_receipt.actor_user_id<>v_actor or v_receipt.asset_id<>p_id or v_receipt.payload<>v_payload then raise exception 'Import mutation ID reused with different request' using errcode='23505';end if;
  return jsonb_build_object('asset',v_receipt.result_snapshot,'already_present',true);
 end if;
 select * into v_existing from public.assets where organization_id=p_organization_id and id=p_id for update;
 if found then
  if to_jsonb(v_existing)<>v_payload then raise exception 'Asset UUID exists with different Cloud content' using errcode='23505';end if;
  v_result:=jsonb_build_object('asset',to_jsonb(v_existing),'already_present',true);
 else
  if exists(select 1 from public.assets where organization_id=p_organization_id and code=p_code) then raise exception 'Management code already exists in Cloud' using errcode='23505';end if;
  insert into public.assets(id,organization_id,code,name,category,brand,model,serial,location,commissioned_at,power,cycle,cycle_started_at,transferred_from_other_facility,status,notes,archived_at,created_at,updated_at,created_by_user_id,created_by_label)
  values(v_input.id,v_input.organization_id,v_input.code,v_input.name,v_input.category,v_input.brand,v_input.model,v_input.serial,v_input.location,v_input.commissioned_at,v_input.power,v_input.cycle,v_input.cycle_started_at,v_input.transferred_from_other_facility,v_input.status,v_input.notes,v_input.archived_at,v_input.created_at,v_input.updated_at,v_input.created_by_user_id,v_input.created_by_label)
  returning * into v_existing;
  v_result:=jsonb_build_object('asset',to_jsonb(v_existing),'already_present',false);
 end if;
 insert into public.asset_import_receipts(organization_id,mutation_id,asset_id,actor_user_id,payload,result_snapshot) values(p_organization_id,p_mutation_id,p_id,v_actor,v_payload,v_result->'asset');
 return v_result;
end;$$;
revoke all on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid) to authenticated;

-- Lease is tied to user+browser/device. Expired leases can be replaced.
create or replace function public.acquire_asset_edit_lock(p_organization_id uuid,p_asset_id uuid,p_device_id text,p_holder_label text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_actor uuid:=auth.uid();v_lock public.asset_edit_locks;v_token uuid;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not private.has_org_permission(p_organization_id,'assets.update') then raise exception 'Missing assets.update permission' using errcode='42501';end if;
 if nullif(trim(p_device_id),'') is null then raise exception 'Device identifier required' using errcode='22023';end if;
 perform 1 from public.assets where organization_id=p_organization_id and id=p_asset_id for update;
 if not found then raise exception 'Asset not found' using errcode='P0002';end if;
 select * into v_lock from public.asset_edit_locks where organization_id=p_organization_id and asset_id=p_asset_id for update;
 if found and v_lock.expires_at>clock_timestamp() then
  if v_lock.holder_user_id=v_actor and v_lock.holder_device_id=p_device_id then
   update public.asset_edit_locks set expires_at=clock_timestamp()+interval '75 seconds' where organization_id=p_organization_id and asset_id=p_asset_id returning * into v_lock;
   return jsonb_build_object('acquired',true,'lock_token',v_lock.lock_token,'asset_id',p_asset_id,'holder_user_id',v_actor,'holder_device_id',p_device_id,'holder_label',v_lock.holder_label,'acquired_at',v_lock.acquired_at,'expires_at',v_lock.expires_at);
  end if;
  return jsonb_build_object('acquired',false,'asset_id',p_asset_id,'holder_user_id',v_lock.holder_user_id,'holder_device_id',v_lock.holder_device_id,'holder_label',v_lock.holder_label,'acquired_at',v_lock.acquired_at,'expires_at',v_lock.expires_at);
 end if;
 v_token:=gen_random_uuid();
 insert into public.asset_edit_locks(organization_id,asset_id,holder_user_id,holder_device_id,holder_label,lock_token,expires_at)
 values(p_organization_id,p_asset_id,v_actor,p_device_id,coalesce(nullif(trim(p_holder_label),''),'Thiết bị'),v_token,clock_timestamp()+interval '75 seconds')
 on conflict(organization_id,asset_id) do update set holder_user_id=excluded.holder_user_id,holder_device_id=excluded.holder_device_id,holder_label=excluded.holder_label,lock_token=excluded.lock_token,acquired_at=clock_timestamp(),expires_at=excluded.expires_at returning * into v_lock;
 return jsonb_build_object('acquired',true,'lock_token',v_lock.lock_token,'asset_id',p_asset_id,'holder_user_id',v_actor,'holder_device_id',p_device_id,'holder_label',v_lock.holder_label,'acquired_at',v_lock.acquired_at,'expires_at',v_lock.expires_at);
end;$$;
revoke all on function public.acquire_asset_edit_lock(uuid,uuid,text,text) from public,anon;
grant execute on function public.acquire_asset_edit_lock(uuid,uuid,text,text) to authenticated;

create or replace function public.heartbeat_asset_edit_lock(p_organization_id uuid,p_asset_id uuid,p_lock_token uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_lock public.asset_edit_locks;
begin
 update public.asset_edit_locks set expires_at=clock_timestamp()+interval '75 seconds' where organization_id=p_organization_id and asset_id=p_asset_id and holder_user_id=auth.uid() and lock_token=p_lock_token and expires_at>clock_timestamp() returning * into v_lock;
 return jsonb_build_object('renewed',found,'expires_at',v_lock.expires_at);
end;$$;
revoke all on function public.heartbeat_asset_edit_lock(uuid,uuid,uuid) from public,anon;
grant execute on function public.heartbeat_asset_edit_lock(uuid,uuid,uuid) to authenticated;

create or replace function public.release_asset_edit_lock(p_organization_id uuid,p_asset_id uuid,p_lock_token uuid)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
begin
 delete from public.asset_edit_locks where organization_id=p_organization_id and asset_id=p_asset_id and holder_user_id=auth.uid() and lock_token=p_lock_token;
 return found;
end;$$;
revoke all on function public.release_asset_edit_lock(uuid,uuid,uuid) from public,anon;
grant execute on function public.release_asset_edit_lock(uuid,uuid,uuid) to authenticated;

create or replace function public.list_asset_edit_locks(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
begin
 if auth.uid() is null or not private.is_org_member(p_organization_id) then raise exception 'Active membership required' using errcode='42501';end if;
 delete from public.asset_edit_locks where organization_id=p_organization_id and expires_at<=clock_timestamp();
 return coalesce((select jsonb_agg(jsonb_build_object('asset_id',asset_id,'holder_user_id',holder_user_id,'holder_device_id',holder_device_id,'holder_label',holder_label,'acquired_at',acquired_at,'expires_at',expires_at)) from public.asset_edit_locks where organization_id=p_organization_id),'[]'::jsonb);
end;$$;
revoke all on function public.list_asset_edit_locks(uuid) from public,anon;
grant execute on function public.list_asset_edit_locks(uuid) to authenticated;

-- Mutations use lease token, optimistic Cloud timestamp and a receipt. Retry
-- with the same mutation UUID recovers a response lost after commit.
create or replace function public.apply_asset_mutation_with_lock(p_organization_id uuid,p_asset_id uuid,p_lock_token uuid,p_mutation_id uuid,p_expected_cloud_updated_at timestamptz,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_actor uuid:=auth.uid();v_lock public.asset_edit_locks;v_asset public.assets;v_receipt public.asset_mutation_receipts;v_input public.assets;v_snapshot jsonb;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not private.has_org_permission(p_organization_id,'assets.update') then raise exception 'Missing assets.update permission' using errcode='42501';end if;
 if p_mutation_id is null or p_expected_cloud_updated_at is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid mutation payload' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('name','brand','model','serial','location','commissioned_at','power','cycle','cycle_started_at','transferred_from_other_facility','status','notes','archived_at')) then raise exception 'Unsupported mutation field' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_mutation_id::text,0));
 select * into v_receipt from public.asset_mutation_receipts where organization_id=p_organization_id and mutation_id=p_mutation_id;
 if found then
  if v_receipt.actor_user_id<>v_actor or v_receipt.asset_id<>p_asset_id or v_receipt.expected_cloud_updated_at<>p_expected_cloud_updated_at or v_receipt.request_payload<>p_payload then raise exception 'Mutation ID reused with different request' using errcode='23505';end if;
  return jsonb_build_object('already_applied',true,'asset',v_receipt.result_snapshot,'applied_at',v_receipt.applied_at);
 end if;
 select * into v_lock from public.asset_edit_locks where organization_id=p_organization_id and asset_id=p_asset_id for update;
 if not found or v_lock.holder_user_id<>v_actor or v_lock.lock_token<>p_lock_token or v_lock.expires_at<=clock_timestamp() then raise exception 'Edit lease missing, expired or not owned' using errcode='55000';end if;
 select * into v_asset from public.assets where organization_id=p_organization_id and id=p_asset_id for update;
 if not found then raise exception 'Asset not found' using errcode='P0002';end if;
 if v_asset.updated_at<>p_expected_cloud_updated_at then raise exception 'Cloud version changed; refresh and resolve manually' using errcode='40001';end if;
 v_input:=jsonb_populate_record(null::public.assets,p_payload);
 if nullif(trim(v_input.name),'') is null or v_input.status not in ('Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý') then raise exception 'Invalid required asset values' using errcode='22023';end if;
 update public.assets set name=trim(v_input.name),brand=coalesce(v_input.brand,''),model=coalesce(v_input.model,''),serial=coalesce(v_input.serial,''),location=coalesce(v_input.location,''),commissioned_at=v_input.commissioned_at,power=coalesce(v_input.power,''),cycle=coalesce(v_input.cycle,''),cycle_started_at=v_input.cycle_started_at,transferred_from_other_facility=coalesce(v_input.transferred_from_other_facility,false),status=v_input.status,notes=coalesce(v_input.notes,''),archived_at=v_input.archived_at,updated_at=clock_timestamp() where organization_id=p_organization_id and id=p_asset_id returning * into v_asset;
 v_snapshot:=to_jsonb(v_asset);
 insert into public.asset_mutation_receipts(organization_id,mutation_id,asset_id,actor_user_id,expected_cloud_updated_at,request_payload,result_snapshot) values(p_organization_id,p_mutation_id,p_asset_id,v_actor,p_expected_cloud_updated_at,p_payload,v_snapshot) returning * into v_receipt;
 return jsonb_build_object('already_applied',false,'asset',v_snapshot,'applied_at',v_receipt.applied_at);
end;$$;
revoke all on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
