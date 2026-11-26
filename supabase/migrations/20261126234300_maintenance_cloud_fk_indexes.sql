create index if not exists checklist_runs_org_maintenance_request_idx
 on public.checklist_runs(organization_id,maintenance_request_id)
 where maintenance_request_id is not null;
create index if not exists maintenance_requests_org_asset_idx
 on public.maintenance_requests(organization_id,asset_id);
create index if not exists maintenance_requests_requested_by_user_idx
 on public.maintenance_requests(requested_by_user_id)
 where requested_by_user_id is not null;
create index if not exists maintenance_request_events_actor_idx
 on public.maintenance_request_events(actor_user_id)
 where actor_user_id is not null;
create index if not exists maintenance_task_events_actor_idx
 on public.maintenance_task_events(actor_user_id)
 where actor_user_id is not null;