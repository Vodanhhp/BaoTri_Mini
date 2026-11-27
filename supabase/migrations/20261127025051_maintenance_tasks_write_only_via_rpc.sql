revoke insert, update, delete on table public.maintenance_tasks from anon, authenticated;
grant select on table public.maintenance_tasks to authenticated;

comment on table public.maintenance_tasks is
  'Maintenance schedule records. Authenticated clients read directly; all writes must use tenant-checked RPCs so maintenance_task_events history cannot be bypassed.';
