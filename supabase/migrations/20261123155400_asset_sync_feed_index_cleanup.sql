-- Remove redundant duplicate index; the primary key already indexes (organization_id, sequence).
begin;
drop index if exists private.asset_sync_events_org_sequence_idx;
commit;
