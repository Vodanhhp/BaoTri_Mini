-- Permit the explicit "Lưu kho" lifecycle state in Cloud assets and Local→Cloud imports.
-- The status is kept alongside archived_at so Local/Cloud lifecycle fields are preserved.
begin;

alter table public.assets drop constraint if exists assets_status_check;
alter table public.assets add constraint assets_status_check
  check (status = any (array['Đang hoạt động'::text,'Đang sửa chữa'::text,'Ngừng sử dụng'::text,'Thanh lý'::text,'Lưu kho'::text]));

CREATE OR REPLACE FUNCTION private.import_asset_preserving_identity(p_organization_id uuid, p_id uuid, p_code text, p_asset jsonb, p_mutation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
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
 if nullif(trim(v_input.name),'') is null or nullif(trim(v_input.category),'') is null or v_input.status not in ('Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý','Lưu kho') then raise exception 'Invalid name, category or status' using errcode='22023';end if;
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
end;$function$
