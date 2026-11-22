import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Cloud mutation migration restores the private asset anchor row lock', async () => {
  const migration = await read('../supabase/migrations/20261122124403_add_cloud_asset_lock_anchor.sql')
  const source = await read('../supabase/migrations/20261121024405_010_private_cloud_sync_rpc_wrappers.sql')

  assert.match(migration, /create or replace function private\.lock_asset_anchor\(\s*p_organization_id uuid,\s*p_asset_id uuid\s*\) returns void/i)
  assert.match(migration, /from public\.assets a[\s\S]*?where a\.organization_id = p_organization_id[\s\S]*?and a\.id = p_asset_id[\s\S]*?for update/i)
  assert.match(migration, /if not found then[\s\S]*?errcode = 'P0002'/i)
  assert.match(migration, /revoke all on function private\.lock_asset_anchor\(uuid, uuid\) from public, anon, authenticated/i)
  assert.match(source, /alter function public\.apply_asset_mutation_with_lock\([\s\S]*?set schema private/i)
})
