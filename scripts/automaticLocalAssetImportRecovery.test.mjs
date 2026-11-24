import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('committed import recovery verifies the exact actor-owned UUID receipt before creating a Cloud link', async () => {
  const cloud = await read('../src/lib/cloudAssets.ts')
  const helper = cloud.slice(
    cloud.indexOf('async function recoverCommittedImportWithChangedLocalSnapshot'),
    cloud.indexOf('export type LocalAssetImportSyncResult')
  )
  assert.match(helper, /rpc\('verify_cloud_asset_import_receipt'/)
  assert.match(helper, /verification\?\.verified!==true/)
  assert.match(helper, /verification\.asset\.asset_key!==attempted\.code/)
  assert.match(helper, /receipt_updated_at/)
  assert.match(helper, /status:samePayload\?'linked':'conflict'/)
  assert.match(helper, /status:'conflict',attempts:0/)
  assert.match(helper, /lastSyncedLocalUpdatedAt:samePayload\?latest\.updatedAt:receiptUpdatedAt/)
  assert.match(helper, /latest\.updatedAt!==current\.updatedAt/)
  assert.doesNotMatch(helper, /row\.id===attempted\.id/)
})

test('unverified receipt recovery remains retryable and does not link by management code alone', async () => {
  const cloud = await read('../src/lib/cloudAssets.ts')
  const queue = cloud.slice(
    cloud.indexOf('export async function syncPendingLocalAssetImports'),
    cloud.indexOf('export async function downloadCloudAsset')
  )
  assert.match(queue, /recoverCommittedImportWithChangedLocalSnapshot/)
  assert.match(queue, /status:'pending',failureKind:'transient'/)
  assert.match(queue, /chưa xác minh được để tạo liên kết an toàn/)
  assert.match(queue, /Import mutation ID reused with different request/)
})

test('receipt verification RPC is scoped to authenticated actor, organization permission, and exact asset UUID', async () => {
  const migrations = await Promise.all([
    read('../supabase/migrations/20261124042123_verify_cloud_asset_import_receipt.sql'),
    read('../supabase/migrations/20261124042150_verify_cloud_asset_import_receipt_timestamp.sql'),
    read('../supabase/migrations/20261124042230_move_import_receipt_verifier_private.sql')
  ])
  for(const migration of migrations){
    assert.match(migration, /create or replace function private\.verify_cloud_asset_import_receipt/i)
    assert.match(migration, /create or replace function public\.verify_cloud_asset_import_receipt[\s\S]*?security invoker/i)
    assert.doesNotMatch(migration, /create or replace function public\.verify_cloud_asset_import_receipt[\s\S]*?security definer/i)
  }
  const migration = migrations[2]
  assert.match(migration, /security definer/i)
  assert.match(migration, /set search_path = ''/i)
  assert.match(migration, /set row_security = off/i)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /private\.has_org_permission\(p_organization_id,'assets\.create'\)/)
  assert.match(migration, /private\.has_org_permission\(p_organization_id,'assets\.import'\)/)
  assert.match(migration, /v_receipt\.asset_id<>p_asset_id/)
  assert.match(migration, /v_receipt\.actor_user_id<>v_actor/)
  assert.match(migration, /to_jsonb\(v_asset\)-'id'/)
  assert.match(migration, /create or replace function public\.verify_cloud_asset_import_receipt[\s\S]*?security invoker/i)
  assert.match(migration, /revoke all on function private\.verify_cloud_asset_import_receipt\(uuid,uuid,uuid\) from public,anon/i)
  assert.match(migration, /grant execute on function private\.verify_cloud_asset_import_receipt\(uuid,uuid,uuid\) to authenticated/i)
  assert.match(migration, /revoke all on function public\.verify_cloud_asset_import_receipt\(uuid,uuid,uuid\) from public,anon/i)
})

test('mutation receipt reuse race is consistently classified as a visible conflict, not an endless retry', async () => {
  const cloud = await read('../src/lib/cloudAssets.ts')
  const message = 'Import mutation ID reused with different request'
  assert.ok(cloud.includes(message))
  assert.match(cloud, /status:permanent\?\( \/already exists\|different Cloud content\|UUID already\|does not match\|Import mutation ID reused with different request/)
  assert.match(cloud, /if\(permanent&&\/already exists\|different Cloud content\|UUID already\|does not match\|Import mutation ID reused with different request/)
})

test('regular Local asset saves request immediate sync after the IndexedDB write', async () => {
  const app = await read('../src/App.tsx')
  const saveStart = app.lastIndexOf('const groupChanged=Boolean(previous&&isAdmin&&previous.category!==value.category)')
  const saveEnd = app.indexOf('const addImages', saveStart)
  assert.ok(saveStart >= 0 && saveEnd > saveStart)
  const saveFlow = app.slice(saveStart, saveEnd)
  assert.match(saveFlow, /await db\.assets\.put\(value\)[\s\S]*?requestSync\(\)[\s\S]*?await recordAssetHistory\(previous,value\)/)
})
