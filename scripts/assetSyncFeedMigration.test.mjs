import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('change-feed migration keeps event and counter tables private with RLS and no direct client grants', async () => {
  const sql = await read('../supabase/migrations/20261123170000_asset_sync_change_feed.sql')
  assert.match(sql, /create table private\.asset_sync_counters/)
  assert.match(sql, /create table private\.asset_sync_events/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on private\.asset_sync_events from public, anon, authenticated/)
  assert.match(sql, /revoke all on private\.asset_sync_counters from public, anon, authenticated/)
})

test('feed sequence allocation is tenant-locked and commit ordered', async () => {
  const sql = await read('../supabase/migrations/20261123170000_asset_sync_change_feed.sql')
  assert.match(sql, /on conflict\(organization_id\) do update/)
  assert.match(sql, /last_sequence=private\.asset_sync_counters\.last_sequence\+1/)
  assert.match(sql, /primary key \(organization_id, sequence\)/)
})

test('asset triggers capture create, update, soft delete, restore and hard delete with safe snapshots', async () => {
  const sql = await read('../supabase/migrations/20261123170000_asset_sync_change_feed.sql')
  assert.match(sql, /after insert or update or delete on public\.assets/)
  assert.match(sql, /'hard_delete'/)
  assert.match(sql, /v_event_type:='soft_delete'/)
  assert.match(sql, /v_event_type:='upsert'/)
  assert.match(sql, /to_jsonb\(new\)-'id'/)
  assert.match(sql, /jsonb_build_object\('asset_key',new\.code\)/)
})

test('reset transaction emits one generation barrier and suppresses per-asset delete events', async () => {
  const sql = await read('../supabase/migrations/20261123170000_asset_sync_change_feed.sql')
  assert.match(sql, /after update of generation on private\.organization_asset_reset_state/)
  assert.match(sql, /'reset',null,null,null,new\.generation,null/)
  assert.match(sql, /set_config\('app\.asset_sync_suppress_asset_events','on',true\)/)
  assert.match(sql, /set_config\('app\.asset_sync_suppress_asset_events','off',true\)/)
})

test('checkpoint and pull RPCs enforce tenant assets.view permission and active organization', async () => {
  const sql = await read('../supabase/migrations/20261123170000_asset_sync_change_feed.sql')
  assert.match(sql, /private\.has_org_permission\(p_organization_id,'assets\.view'\)/)
  assert.match(sql, /status='active'/)
  assert.match(sql, /create function public\.get_asset_sync_checkpoint/)
  assert.match(sql, /create function public\.list_asset_sync_changes/)
  assert.match(sql, /grant execute on function public\.list_asset_sync_changes\(uuid,bigint,integer\) to authenticated/)
})

test('pull pages are bounded, cursor-stable and soft-deleted snapshots are permission-filtered', async () => {
  const sql = await read('../supabase/migrations/20261123170000_asset_sync_change_feed.sql')
  assert.match(sql, /least\(coalesce\(p_limit,200\),500\)/)
  assert.match(sql, /e\.sequence>p_after_sequence/)
  assert.match(sql, /coalesce\(v_next_cursor,p_after_sequence\)/)
  assert.match(sql, /case when n\.event_type='soft_delete' and not v_can_view_deleted then null else n\.snapshot end/)
})
