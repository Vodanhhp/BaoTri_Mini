create index if not exists checklist_definitions_archived_by_idx
  on public.checklist_definitions (archived_by);
create index if not exists checklist_tasks_cancelled_by_idx
  on public.checklist_tasks (cancelled_by);
create index if not exists checklist_results_template_asset_fk_idx
  on public.checklist_results (organization_id, template_id, asset_id);
create index if not exists checklist_results_version_template_asset_fk_idx
  on public.checklist_results (organization_id, template_version_id, template_id, asset_id, template_version);
create index if not exists checklist_template_versions_template_asset_fk_idx
  on public.checklist_template_versions (organization_id, template_id, asset_id);
create index if not exists maintenance_logs_checklist_result_fk_idx
  on public.maintenance_logs (organization_id, checklist_result_id);
