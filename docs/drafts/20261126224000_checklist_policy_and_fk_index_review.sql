drop policy if exists checklist_category_settings_manage on public.checklist_category_settings;
create policy checklist_category_settings_insert on public.checklist_category_settings
 for insert to authenticated
 with check(private.has_org_permission(organization_id,'checklist.template.manage'));
create policy checklist_category_settings_update on public.checklist_category_settings
 for update to authenticated
 using(private.has_org_permission(organization_id,'checklist.template.manage'))
 with check(private.has_org_permission(organization_id,'checklist.template.manage'));
create policy checklist_category_settings_delete on public.checklist_category_settings
 for delete to authenticated
 using(private.has_org_permission(organization_id,'checklist.template.manage'));

drop policy if exists checklist_definitions_manage on public.checklist_definitions;
create policy checklist_definitions_insert on public.checklist_definitions
 for insert to authenticated
 with check(private.has_org_permission(organization_id,'checklist.template.manage'));
create policy checklist_definitions_update on public.checklist_definitions
 for update to authenticated
 using(private.has_org_permission(organization_id,'checklist.template.manage'))
 with check(private.has_org_permission(organization_id,'checklist.template.manage'));
create policy checklist_definitions_delete on public.checklist_definitions
 for delete to authenticated
 using(private.has_org_permission(organization_id,'checklist.template.manage'));

create index if not exists checklist_category_settings_updated_by_idx on public.checklist_category_settings(updated_by);
create index if not exists checklist_definition_versions_changed_by_idx on public.checklist_definition_versions(changed_by);
create index if not exists checklist_definitions_created_by_idx on public.checklist_definitions(created_by);
create index if not exists checklist_definitions_updated_by_idx on public.checklist_definitions(updated_by);
create index if not exists checklist_definitions_target_asset_idx on public.checklist_definitions(organization_id,target_asset_id);
create index if not exists checklist_runs_inspector_user_idx on public.checklist_runs(inspector_user_id);
create index if not exists checklist_runs_org_definition_idx on public.checklist_runs(organization_id,definition_id);
create index if not exists checklist_runs_org_task_idx on public.checklist_runs(organization_id,task_id);
create index if not exists checklist_task_events_actor_idx on public.checklist_task_events(actor_user_id);
create index if not exists checklist_tasks_claimed_by_idx on public.checklist_tasks(claimed_by_user_id);
create index if not exists checklist_tasks_org_run_idx on public.checklist_tasks(organization_id,run_id);