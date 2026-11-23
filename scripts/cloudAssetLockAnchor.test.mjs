import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('cloud mutation anchor helper locks the organization-scoped asset row and is private', async () => {
  const migration = await read('../supabase/migrations/20261122124403_add_cloud_asset_lock_anchor.sql')
  assert.ok(migration.includes('create or replace function private.lock_asset_anchor('))
  assert.ok(migration.includes('where a.organization_id = p_organization_id'))
  assert.ok(migration.includes('and a.id = p_asset_id'))
  assert.ok(migration.includes('for update'))
  assert.ok(migration.includes("errcode = 'P0002'"))
  assert.ok(migration.includes('revoke all on function private.lock_asset_anchor(uuid, uuid) from public, anon, authenticated'))
})

test('historical mutation migration uses canonical actor_user_id receipt column', async () => {
  const migration = await read('../supabase/migrations/20261122125135_fix_asset_mutation_receipt_actor_column.sql')
  assert.ok(migration.includes('v_receipt.actor_user_id<>auth.uid()'))
  assert.ok(migration.includes('actor_user_id'))
  assert.ok(!migration.includes('applied_by_user_id'))
})

test('later canonical migration preserves the stricter role guard and Luu kho status', async () => {
  const migration = await read('../supabase/migrations/20261122210000_asset_activity_history.sql')
  assert.ok(migration.includes('private.is_org_admin(p_organization_id) or private.is_org_technician(p_organization_id)'))
  assert.ok(migration.includes("'Lưu kho'"))
  assert.ok(migration.includes('private.lock_asset_anchor'))
})
