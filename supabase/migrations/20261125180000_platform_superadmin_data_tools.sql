-- Superadmin-only tenant data seeding. The Edge Function verifies PLATFORM_OWNER_EMAIL
-- and calls this RPC with the service-role key; the browser never receives that key.
create table if not exists private.platform_data_seed_runs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_label text not null default 'Superadmin',
  plan_code text not null check (plan_code in ('A','B','C','D')),
  asset_count integer not null default 0 check (asset_count between 0 and 30),
  inventory_count integer not null default 0 check (inventory_count between 0 and 30),
  asset_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(asset_ids)='array'),
  inventory_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(inventory_ids)='array'),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

revoke all on table private.platform_data_seed_runs from public, anon, authenticated;
grant select, insert on table private.platform_data_seed_runs to service_role;

create or replace function public.platform_seed_organization_data(
  p_run_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_assets jsonb,
  p_inventory_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_plan text;
  v_snapshot jsonb;
  v_source_version text;
  v_max_devices integer;
  v_current_count bigint;
  v_asset jsonb;
  v_item jsonb;
  v_dictionary jsonb;
  v_group jsonb;
  v_group_code text;
  v_group_name text;
  v_equipment_code text;
  v_sequence bigint;
  v_site_code text;
  v_month_year text;
  v_code text;
  v_item_id uuid;
  v_asset_id uuid;
  v_mutation_id uuid;
  v_now timestamptz;
  v_commissioned date;
  v_normalized text;
  v_asset_ids jsonb := '[]'::jsonb;
  v_inventory_ids jsonb := '[]'::jsonb;
  v_asset_codes jsonb := '[]'::jsonb;
  v_inventory_codes jsonb := '[]'::jsonb;
  v_index integer := 0;
  v_label text := 'Superadmin';
  v_run_exists boolean;
  v_result jsonb;
  v_inventory_sequence bigint;
  v_inventory_response jsonb;
begin
  if p_run_id is null or p_organization_id is null or p_actor_user_id is null then
    raise exception 'Run, organization and actor IDs are required.' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users u where u.id=p_actor_user_id and u.email_confirmed_at is not null) then
    raise exception 'Verified Superadmin actor was not found.' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_assets,'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_inventory_items,'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_assets)>30 or jsonb_array_length(p_inventory_items)>30
     or (jsonb_array_length(p_assets)=0 and jsonb_array_length(p_inventory_items)=0) then
    raise exception 'Provide 1–30 assets and/or 1–30 inventory items.' using errcode='22023';
  end if;

  select exists(select 1 from private.platform_data_seed_runs r where r.id=p_run_id) into v_run_exists;
  if v_run_exists then
    select result into v_result from private.platform_data_seed_runs
      where id=p_run_id and organization_id=p_organization_id and actor_user_id=p_actor_user_id;
    if not found then raise exception 'Seed run ID is already used by a different organization or actor.' using errcode='23505'; end if;
    return v_result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text, 0));
  select exists(select 1 from private.platform_data_seed_runs r where r.id=p_run_id) into v_run_exists;
  if v_run_exists then
    select result into v_result from private.platform_data_seed_runs
      where id=p_run_id and organization_id=p_organization_id and actor_user_id=p_actor_user_id;
    if not found then raise exception 'Seed run ID is already used by a different organization or actor.' using errcode='23505'; end if;
    return v_result;
  end if;

  select c.plan_code,c.snapshot,c.source_data_version,
         nullif(c.snapshot#>>'{plan,maxDevices}','')::integer
    into v_plan,v_snapshot,v_source_version,v_max_devices
  from public.organization_equipment_catalog c
  where c.organization_id=p_organization_id
  for update;
  if not found or v_plan not in ('A','B','C','D') then
    raise exception 'Organization Plan snapshot is missing or invalid.' using errcode='22023';
  end if;
  if not exists(select 1 from public.organizations o where o.id=p_organization_id and o.status='active') then
    raise exception 'Target organization is missing or suspended.' using errcode='22023';
  end if;

  select count(*) into v_current_count from public.assets a where a.organization_id=p_organization_id;
  v_current_count:=v_current_count+(
    select count(*) from private.asset_id_sequence_reservations r
    where r.organization_id=p_organization_id and r.status in ('reserved','confirmed')
      and (r.asset_id is null or not exists(
        select 1 from public.assets a where a.organization_id=r.organization_id and a.id=r.asset_id
      ))
  );
  if v_max_devices is not null and v_current_count+jsonb_array_length(p_assets)>v_max_devices then
    raise exception 'Plan % capacity exceeded: % existing + % requested > %.',v_plan,v_current_count,jsonb_array_length(p_assets),v_max_devices using errcode='22023';
  end if;

  for v_asset in select value from jsonb_array_elements(p_assets) loop
    v_index:=v_index+1;
    v_now:=clock_timestamp();
    v_asset_id:=coalesce(nullif(v_asset->>'id','')::uuid,gen_random_uuid());
    v_equipment_code:=regexp_replace(upper(coalesce(v_asset->>'equipmentCode','')),'[^A-Z0-9]','','g');
    if v_equipment_code !~ '^[A-Z0-9]{2,4}$' then
      raise exception 'Invalid equipment short code at row %.',v_index using errcode='22023';
    end if;
    select d into v_dictionary from jsonb_array_elements(v_snapshot->'equipmentDictionary') d
      where regexp_replace(upper(coalesce(d->>'shortCode','')),'[^A-Z0-9]','','g')=v_equipment_code limit 1;
    if v_dictionary is null then raise exception 'Equipment code % is not in this organization catalog.',v_equipment_code using errcode='22023'; end if;

    v_group_code:=regexp_replace(upper(coalesce(v_asset->>'groupCode','')),'[^A-Z0-9]','','g');
    v_group_name:=coalesce(nullif(btrim(v_asset->>'category'),''),'Thiết bị chung');
    if v_plan='A' then
      v_group_code:='';
      v_group:=null;
    else
      if v_group_code !~ '^[A-Z0-9]{2,4}$' then raise exception 'Plan % requires a valid equipment group at row %.',v_plan,v_index using errcode='22023'; end if;
      select g into v_group from jsonb_array_elements(v_snapshot->'equipmentGroups') g
        where regexp_replace(upper(coalesce(g->>'code','')),'[^A-Z0-9]','','g')=v_group_code limit 1;
      if v_group is null then raise exception 'Equipment group % is not in the organization snapshot.',v_group_code using errcode='22023'; end if;
      if (case coalesce(v_group->>'availableFromPlan','B') when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 99 end)
         > (case v_plan when 'A' then 1 when 'B' then 2 when 'C' then 3 else 4 end) then
        raise exception 'Equipment group % is not available on Plan %.',v_group_code,v_plan using errcode='42501';
      end if;
      v_group_name:=coalesce(nullif(v_group->>'name',''),v_group_name);
    end if;

    v_site_code:='';
    v_month_year:=null;
    v_commissioned:=nullif(v_asset->>'commissionedAt','')::date;
    if v_plan in ('C','D') then
      v_site_code:=coalesce(nullif(v_asset->>'siteCode',''),'00');
      if v_site_code !~ '^[0-9]{2}$' or v_commissioned is null then
        raise exception 'Plan % requires a 2-digit site code and commissioning date at row %.',v_plan,v_index using errcode='22023';
      end if;
      v_month_year:=to_char(v_commissioned,'MMYY');
    end if;

    insert into private.asset_id_sequences(organization_id,plan_code,equipment_code,group_code,site_code,last_value)
    values(p_organization_id,v_plan,v_equipment_code,v_group_code,v_site_code,1)
    on conflict(organization_id,plan_code,equipment_code,group_code,site_code)
    do update set last_value=private.asset_id_sequences.last_value+1,updated_at=clock_timestamp()
    returning last_value into v_sequence;

    v_code:=case when v_plan='A' then v_equipment_code||'-'||lpad(v_sequence::text,3,'0')
      when v_plan='B' then v_equipment_code||'-'||v_group_code||'-'||lpad(v_sequence::text,3,'0')
      else v_equipment_code||'-'||v_group_code||'-'||v_site_code||'-'||lpad(v_sequence::text,3,'0')||'-'||v_month_year end;
    if exists(select 1 from public.assets a where a.organization_id=p_organization_id and a.code=v_code) then
      raise exception 'Generated equipment code already exists: %.',v_code using errcode='23505';
    end if;
    v_normalized:=coalesce(nullif(btrim(v_asset->>'normalizedNameAtCreation'),''),lower(regexp_replace(translate(coalesce(v_asset->>'name',''),'Đđ','Dd'),'[^a-zA-Z0-9]+',' ','g')));
    if nullif(btrim(v_asset->>'name'),'') is null or nullif(btrim(v_normalized),'') is null then raise exception 'Equipment name and normalized name are required at row %.',v_index using errcode='22023'; end if;

    insert into public.assets(
      id,organization_id,code,name,category,brand,model,serial,location,commissioned_at,power,cycle,
      transferred_from_other_facility,status,notes,created_by_user_id,created_by_label,
      original_name,normalized_name_at_creation,equipment_type_code,group_code_at_creation,
      site_code_at_creation,id_components_snapshot
    ) values (
      v_asset_id,p_organization_id,v_code,btrim(v_asset->>'name'),v_group_name,
      coalesce(v_asset->>'brand',''),coalesce(v_asset->>'model',''),coalesce(v_asset->>'serial',''),
      coalesce(v_asset->>'location',''),v_commissioned,coalesce(v_asset->>'power',''),
      coalesce(v_asset->>'cycle',''),false,'Đang hoạt động',
      coalesce(v_asset->>'notes','Tạo dữ liệu thử nghiệm bởi Superadmin.'),
      p_actor_user_id,v_label,btrim(v_asset->>'name'),v_normalized,v_equipment_code,
      nullif(v_group_code,''),nullif(v_site_code,''),
      jsonb_build_object('plan',v_plan,'equipment_code',v_equipment_code,
        'group_code',nullif(v_group_code,''),'site_code',nullif(v_site_code,''),
        'reservation_id',coalesce(nullif(v_asset->>'reservationId','')::uuid,gen_random_uuid()),
        'sequence',v_sequence,'month_year',v_month_year,
        'standard_equipment_name',coalesce(v_dictionary->>'standardName',btrim(v_asset->>'name')),
        'group_name_at_creation',v_group_name,'source_data_version',v_source_version,'issued_at',v_now)
    );

    insert into private.asset_id_sequence_reservations(
      organization_id,reservation_id,actor_user_id,plan_code,equipment_code,group_code,site_code,
      sequence_value,month_year,status,asset_id,equipment_id,confirmed_at,original_name,
      normalized_name_at_creation,equipment_type_code,id_components_snapshot,source_data_version,group_name_at_creation
    ) values (
      p_organization_id,coalesce(nullif(v_asset->>'reservationId','')::uuid,gen_random_uuid()),
      p_actor_user_id,v_plan,v_equipment_code,v_group_code,v_site_code,v_sequence,v_month_year,
      'confirmed',v_asset_id,v_code,v_now,btrim(v_asset->>'name'),v_normalized,v_equipment_code,
      (select a.id_components_snapshot from public.assets a where a.id=v_asset_id),v_source_version,v_group_name
    );

    insert into public.asset_activity_history(id,organization_id,asset_id,asset_code,event_type,summary,changes,actor_user_id,actor_label,occurred_at)
    values(gen_random_uuid(),p_organization_id,v_asset_id,v_code,'created','Tạo hồ sơ thử nghiệm bởi Superadmin.','[]'::jsonb,p_actor_user_id,v_label,v_now);

    v_asset_ids:=v_asset_ids||jsonb_build_array(v_asset_id);
    v_asset_codes:=v_asset_codes||jsonb_build_array(v_code);
  end loop;

  select coalesce(max((regexp_match(i.code,'^VT-([0-9]+)
    v_index:=v_index+1;
    if nullif(btrim(v_item->>'name'),'') is null or nullif(btrim(v_item->>'unit'),'') is null then
      raise exception 'Inventory name and unit are required at row %.',v_index using errcode='22023';
    end if;
    v_code:='VT-'||lpad(v_inventory_sequence::text,3,'0');
    while exists(select 1 from public.inventory_items i where i.organization_id=p_organization_id and i.code_normalized=upper(v_code)) loop
      v_inventory_sequence:=v_inventory_sequence+1;
      v_code:='VT-'||lpad(v_inventory_sequence::text,3,'0');
    end loop;
    v_item_id:=coalesce(nullif(v_item->>'id','')::uuid,gen_random_uuid());
    v_mutation_id:=coalesce(nullif(v_item->>'mutationId','')::uuid,gen_random_uuid());
    insert into public.inventory_items(
      id,organization_id,code,code_normalized,name,item_group,unit,part_number,size,quantity,min_quantity,
      location,supplier,unit_price,created_by_user_id,created_by_label
    ) values (
      v_item_id,p_organization_id,v_code,upper(v_code),btrim(v_item->>'name'),
      coalesce(nullif(btrim(v_item->>'group'),''),'Khác'),btrim(v_item->>'unit'),
      nullif(btrim(v_item->>'partNumber'),''),nullif(btrim(v_item->>'size'),''),
      0,coalesce(nullif(v_item->>'minQuantity','')::numeric,0),
      coalesce(v_item->>'location',''),coalesce(v_item->>'supplier',''),
      coalesce(nullif(v_item->>'unitPrice','')::numeric,0),p_actor_user_id,v_label
    );
    v_inventory_response:=jsonb_build_object(
      'item',(select to_jsonb(i) from public.inventory_items i where i.id=v_item_id),
      'movement',null,'applied_at',clock_timestamp()
    );
    perform private.record_inventory_sync_event(p_organization_id,v_mutation_id,'item_upsert',v_item_id,
      v_inventory_response->'item',null);
    insert into private.inventory_mutation_receipts(organization_id,mutation_id,item_id,operation,response)
    values(p_organization_id,v_mutation_id,v_item_id,'create',v_inventory_response);
    v_inventory_ids:=v_inventory_ids||jsonb_build_array(v_item_id);
    v_inventory_codes:=v_inventory_codes||jsonb_build_array(v_code);
  end loop;

  v_result:=jsonb_build_object('runId',p_run_id,'organizationId',p_organization_id,'planCode',v_plan,
    'assetsCreated',jsonb_array_length(p_assets),'inventoryCreated',jsonb_array_length(p_inventory_items),
    'assetCodes',v_asset_codes,'inventoryCodes',v_inventory_codes,'createdBy',v_label);

  insert into private.platform_data_seed_runs(
    id,organization_id,actor_user_id,actor_label,plan_code,asset_count,inventory_count,asset_ids,inventory_ids,result
  ) values (
    p_run_id,p_organization_id,p_actor_user_id,v_label,v_plan,jsonb_array_length(p_assets),
    jsonb_array_length(p_inventory_items),
    (select coalesce(jsonb_agg(jsonb_build_object('id',v_asset_ids->i,'code',v_asset_codes->i)),'[]'::jsonb)
      from generate_series(0,jsonb_array_length(v_asset_ids)-1) i),
    (select coalesce(jsonb_agg(jsonb_build_object('id',v_inventory_ids->i,'code',v_inventory_codes->i)),'[]'::jsonb)
      from generate_series(0,jsonb_array_length(v_inventory_ids)-1) i),
    v_result
  );

  return v_result;
end;
$function$;

revoke all on function public.platform_seed_organization_data(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.platform_seed_organization_data(uuid,uuid,uuid,jsonb,jsonb) to service_role;
,'i'))[1]::bigint),0)+1
    into v_inventory_sequence
  from public.inventory_items i where i.organization_id=p_organization_id;

  v_index:=0;
  for v_item in select value from jsonb_array_elements(p_inventory_items) loop
    v_index:=v_index+1;
    if nullif(btrim(v_item->>'name'),'') is null or nullif(btrim(v_item->>'unit'),'') is null then
      raise exception 'Inventory name and unit are required at row %.',v_index using errcode='22023';
    end if;
    v_code:='VT-'||lpad(v_index::text,3,'0');
    while exists(select 1 from public.inventory_items i where i.organization_id=p_organization_id and i.code_normalized=upper(v_code)) loop
      v_index:=v_index+1;
      v_code:='VT-'||lpad(v_index::text,3,'0');
    end loop;
    v_item_id:=coalesce(nullif(v_item->>'id','')::uuid,gen_random_uuid());
    v_mutation_id:=coalesce(nullif(v_item->>'mutationId','')::uuid,gen_random_uuid());
    insert into public.inventory_items(
      id,organization_id,code,code_normalized,name,item_group,unit,part_number,size,quantity,min_quantity,
      location,supplier,unit_price,created_by_user_id,created_by_label
    ) values (
      v_item_id,p_organization_id,v_code,upper(v_code),btrim(v_item->>'name'),
      coalesce(nullif(btrim(v_item->>'group'),''),'Khác'),btrim(v_item->>'unit'),
      nullif(btrim(v_item->>'partNumber'),''),nullif(btrim(v_item->>'size'),''),
      0,coalesce(nullif(v_item->>'minQuantity','')::numeric,0),
      coalesce(v_item->>'location',''),coalesce(v_item->>'supplier',''),
      coalesce(nullif(v_item->>'unitPrice','')::numeric,0),p_actor_user_id,v_label
    );
    perform private.record_inventory_sync_event(p_organization_id,v_mutation_id,'item_upsert',v_item_id,
      (select to_jsonb(i) from public.inventory_items i where i.id=v_item_id),null);
    v_inventory_ids:=v_inventory_ids||jsonb_build_array(v_item_id);
    v_inventory_codes:=v_inventory_codes||jsonb_build_array(v_code);
  end loop;

  v_result:=jsonb_build_object('runId',p_run_id,'organizationId',p_organization_id,'planCode',v_plan,
    'assetsCreated',jsonb_array_length(p_assets),'inventoryCreated',jsonb_array_length(p_inventory_items),
    'assetCodes',v_asset_codes,'inventoryCodes',v_inventory_codes,'createdBy',v_label);

  insert into private.platform_data_seed_runs(
    id,organization_id,actor_user_id,actor_label,plan_code,asset_count,inventory_count,asset_ids,inventory_ids,result
  ) values (
    p_run_id,p_organization_id,p_actor_user_id,v_label,v_plan,jsonb_array_length(p_assets),
    jsonb_array_length(p_inventory_items),
    (select coalesce(jsonb_agg(jsonb_build_object('id',v_asset_ids->i,'code',v_asset_codes->i)),'[]'::jsonb)
      from generate_series(0,jsonb_array_length(v_asset_ids)-1) i),
    (select coalesce(jsonb_agg(jsonb_build_object('id',v_inventory_ids->i,'code',v_inventory_codes->i)),'[]'::jsonb)
      from generate_series(0,jsonb_array_length(v_inventory_ids)-1) i),
    v_result
  );

  return v_result;
end;
$function$;

revoke all on function public.platform_seed_organization_data(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.platform_seed_organization_data(uuid,uuid,uuid,jsonb,jsonb) to service_role;
