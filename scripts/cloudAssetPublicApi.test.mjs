import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('member-facing Cloud asset list uses the paginated UUID-free RPC, not direct table SELECT', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  assert.match(source, /rpc\('list_cloud_assets_page'/)
  assert.doesNotMatch(source, /rpc\('list_cloud_assets'/)
  assert.match(source, /p_organization_id:organizationId,p_after_code:cursor,p_page_size:100,p_platform_admin:false/)
  assert.match(source, /id: String\(row\.asset_key \?\? row\.code\)/)
  assert.doesNotMatch(source, /from\(['"]assets['"]\)\.select/)
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

test('database migrations protect the assets table and expose the paginated UUID-free RPC', async () => {
  const [publicApi, paginationApi] = await Promise.all([
    read('../supabase/migrations/20261122032223_cloud_asset_public_key_api.sql'),
    read('../supabase/migrations/20261122055755_cloud_asset_sync_pagination_and_platform_read.sql')
  ])
  assert.match(publicApi, /revoke all on table public\.assets from anon,authenticated/i)
  assert.match(publicApi, /to_jsonb\(a\) - 'id'/i)
  assert.match(publicApi, /v_asset-'id'/i)
  assert.match(publicApi, /revoke all on function public\.list_asset_edit_locks\(uuid\) from public,anon,authenticated/i)
  assert.match(paginationApi, /create or replace function public\.list_cloud_assets_page\(/i)
  assert.match(paginationApi, /to_jsonb\(n\) - 'id' - 'rn'/i)
  assert.match(paginationApi, /revoke all on function public\.list_cloud_assets_page\(uuid,text,integer,boolean\) from public, anon/i)
  assert.match(paginationApi, /grant execute on function public\.list_cloud_assets_page\(uuid,text,integer,boolean\) to authenticated/i)
})

test('Cloud → Local download writes the asset and its link in one IndexedDB transaction', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const download = source.slice(source.indexOf('export async function downloadCloudAsset'), source.indexOf('export async function acquireCloudAssetLock'))
  assert.match(download, /db\.transaction\('rw',\s*\[db\.assets,\s*db\.assetCloudLinks\]/)
  assert.match(download, /await db\.assets\.put\(local\)/)
  assert.match(download, /await db\.assetCloudLinks\.put\(link\)/)
})
