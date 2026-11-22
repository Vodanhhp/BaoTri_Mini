import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('member-facing Cloud asset list uses the UUID-free RPC, not direct table SELECT', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  assert.match(source, /rpc\('list_cloud_assets'/)
  assert.doesNotMatch(source, /from\(['"]assets['"]\)\.select/)
  assert.match(source, /id: String\(row\.asset_key \?\? row\.code\)/)
})

test('Cloud locks and mutations resolve assets by immutable business code', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  for (const rpc of [
    'acquire_cloud_asset_edit_lock',
    'heartbeat_cloud_asset_edit_lock',
    'release_cloud_asset_edit_lock',
    'apply_cloud_asset_mutation_with_lock',
    'mirror_cloud_asset_group_change_history'
  ]) assert.ok(source.includes(rpc), `missing code-based RPC: ${rpc}`)
  assert.match(source, /p_asset_code:asset\.code/)
})

test('application contains no direct read of the protected assets table', async () => {
  const [app, panel] = await Promise.all([
    read('../src/App.tsx'),
    read('../src/CloudAssetsPanel.tsx')
  ])
  assert.doesNotMatch(app, /from\(['"]assets['"]\)\.select/)
  assert.doesNotMatch(panel, /from\(['"]assets['"]\)\.select/)
})

test('database migration revokes direct member SELECT and strips internal UUID from responses', async () => {
  const sql = await read('../supabase/migrations/20261121130000_cloud_asset_public_key_api.sql')
  assert.match(sql, /revoke all on table public\.assets from anon,authenticated/i)
  assert.match(sql, /to_jsonb\(a\) - 'id'/i)
  assert.match(sql, /v_asset-'id'/i)
  assert.match(sql, /grant execute on function public\.list_cloud_assets\(uuid\) to authenticated/i)
  assert.match(sql, /revoke all on function public\.list_asset_edit_locks\(uuid\) from public,anon,authenticated/i)
})
