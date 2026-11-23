import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('cloud mutation anchor helper locks the organization-scoped asset row and is private', async () => {
  const migration = await read('../supabase/migrations/20261122124403_add_cloud_asset_lock_anchor.sql')
  assert.match(migration, /create or replace function private\\.lock_asset_anchor\\(\\s*p_organization_id uuid,\\s*p_asset_id uuid\\s*\\) returns void/i)
  assert.match(migration, /from public\\.assets a[\\s\\S]*?where a\\.organization_id = p_organization_id[\\s\\S]*?and a\\.id = p_asset_id[\\s\\S]*?for update/i)
  assert.match(migration, /if not found then[\\s\\S]*?errcode = 'P0002'/i)
  assert.match(migration, /revoke all on function private\\.lock_asset_anchor\\(uuid, uuid\\) from public, anon, authenticated/i)
})

test('historical mutation migration uses canonical actor_user_id receipt column', async () => {
  const migration = await read('../supabase/migrations/20261122125135_fix_asset_mutation_receipt_actor_column.sql')
  assert.match(migration, /v_receipt\\.actor_user_id\\s*<>\\s*auth\\.uid\\(\\)/i)
  assert.match(migration, /asset_mutation_receipts\\([\\s\\S]*?actor_user_id/i)
  assert.doesNotMatch(migration, /applied_by_user_id/i)
})

test('later canonical migration preserves the stricter role guard and Luu kho status', async () => {
  const migration = await read('../supabase/migrations/20261122210000_asset_activity_history.sql')
  assert.match(migration, /is_org_admin[\\s\\S]*is_org_technician[\\s\\S]*assets\\.update/i)
  assert.match(migration, /'Lưu kho'/)
  assert.match(migration, /lock_asset_anchor/)
})
