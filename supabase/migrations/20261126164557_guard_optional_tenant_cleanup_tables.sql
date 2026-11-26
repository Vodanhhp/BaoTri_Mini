create or replace function private.delete_organization_rows_if_table_exists(p_table_name text,p_organization_id uuid)
returns integer language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_table regclass;v_count integer:=0;
begin
 if p_table_name !~ '^(public|private)\\.[a-z][a-z0-9_]*$' then raise exception 'Invalid organization cleanup table name.';end if;
 v_table:=to_regclass(p_table_name);
 if v_table is null then return 0;end if;
 execute format('delete from %s where organization_id=$1',v_table) using p_organization_id;
 get diagnostics v_count=row_count;
 return v_count;
end;$$;
revoke all on function private.delete_organization_rows_if_table_exists(text,uuid) from public,anon,authenticated;

create or replace function private.platform_delete_organization(p_organization_id uuid,p_confirm_name text)
returns jsonb language plpgsql security definer set search_path='' set row_security='off'
as $$
declare
 v_name text;v_import_receipts integer:=0;v_mutation_receipts integer:=0;v_locks integer:=0;
 v_group_history integer:=0;v_activity_history integer:=0;v_catalog_history integer:=0;v_equipment_catalog integer:=0;
 v_id_reservations integer:=0;v_id_sequences integer:=0;v_plan_history integer:=0;v_plan_requests integer:=0;v_seed_runs integer:=0;
 v_maintenance_requests integer:=0;v_maintenance_tasks integer:=0;v_checklist_runs integer:=0;v_checklist_tasks integer:=0;v_checklist_definitions integer:=0;
 v_members integer:=0;v_roles integer:=0;
begin
 select o.name into v_name from public.organizations o where o.id=p_organization_id for update;
 if v_name is null then raise exception 'Không tìm thấy tổ chức hoặc tổ chức đã bị xóa.';end if;
 if btrim(coalesce(p_confirm_name,'')) is distinct from v_name then raise exception 'Tên xác nhận không khớp với tên tổ chức.';end if;

 v_import_receipts:=private.delete_organization_rows_if_table_exists('public.asset_import_receipts',p_organization_id);
 v_mutation_receipts:=private.delete_organization_rows_if_table_exists('public.asset_mutation_receipts',p_organization_id);
 v_locks:=private.delete_organization_rows_if_table_exists('public.asset_edit_locks',p_organization_id);
 v_group_history:=private.delete_organization_rows_if_table_exists('private.asset_group_change_history',p_organization_id);
 v_activity_history:=private.delete_organization_rows_if_table_exists('public.asset_activity_history',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.maintenance_logs',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.maintenance_plans',p_organization_id);

 if to_regclass('public.checklist_runs') is not null and to_regclass('public.checklist_tasks') is not null then
  execute 'update public.checklist_runs set maintenance_request_id=null where organization_id=$1' using p_organization_id;
  execute 'update public.checklist_tasks set run_id=null where organization_id=$1' using p_organization_id;
 end if;
 perform private.delete_organization_rows_if_table_exists('public.maintenance_request_events',p_organization_id);
 v_maintenance_requests:=private.delete_organization_rows_if_table_exists('public.maintenance_requests',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.maintenance_task_events',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.checklist_task_events',p_organization_id);
 v_checklist_runs:=private.delete_organization_rows_if_table_exists('public.checklist_runs',p_organization_id);
 v_checklist_tasks:=private.delete_organization_rows_if_table_exists('public.checklist_tasks',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.checklist_definition_versions',p_organization_id);
 v_checklist_definitions:=private.delete_organization_rows_if_table_exists('public.checklist_definitions',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.checklist_category_settings',p_organization_id);
 v_maintenance_tasks:=private.delete_organization_rows_if_table_exists('public.maintenance_tasks',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.checklist_results',p_organization_id);
 perform private.delete_organization_rows_if_table_exists('public.checklist_templates',p_organization_id);

 v_catalog_history:=private.delete_organization_rows_if_table_exists('public.organization_equipment_catalog_history',p_organization_id);
 delete from public.assets where organization_id=p_organization_id;
 v_id_reservations:=private.delete_organization_rows_if_table_exists('private.asset_id_sequence_reservations',p_organization_id);
 v_id_sequences:=private.delete_organization_rows_if_table_exists('private.asset_id_sequences',p_organization_id);
 v_equipment_catalog:=private.delete_organization_rows_if_table_exists('public.organization_equipment_catalog',p_organization_id);
 v_plan_history:=private.delete_organization_rows_if_table_exists('private.organization_plan_change_history',p_organization_id);
 v_plan_requests:=private.delete_organization_rows_if_table_exists('private.organization_plan_change_requests',p_organization_id);
 v_seed_runs:=private.delete_organization_rows_if_table_exists('private.platform_data_seed_runs',p_organization_id);
 v_members:=private.delete_organization_rows_if_table_exists('public.organization_members',p_organization_id);
 v_roles:=private.delete_organization_rows_if_table_exists('public.roles',p_organization_id);
 delete from public.organizations where id=p_organization_id;
 return jsonb_build_object('ok',true,'organization_name',v_name,'deleted',jsonb_build_object(
  'asset_import_receipts',v_import_receipts,'asset_mutation_receipts',v_mutation_receipts,'asset_edit_locks',v_locks,
  'asset_group_change_history',v_group_history,'asset_activity_history',v_activity_history,
  'organization_equipment_catalog_history',v_catalog_history,'organization_equipment_catalog',v_equipment_catalog,
  'asset_id_sequence_reservations',v_id_reservations,'asset_id_sequences',v_id_sequences,'platform_data_seed_runs',v_seed_runs,
  'maintenance_requests',v_maintenance_requests,'maintenance_tasks',v_maintenance_tasks,'checklist_runs',v_checklist_runs,
  'checklist_tasks',v_checklist_tasks,'checklist_definitions',v_checklist_definitions,
  'organization_plan_change_history',v_plan_history,'organization_plan_change_requests',v_plan_requests,
  'organization_members',v_members,'roles',v_roles,'organizations',1));
end;$$;
revoke all on function private.platform_delete_organization(uuid,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.platform_delete_organization(uuid,text) to service_role;