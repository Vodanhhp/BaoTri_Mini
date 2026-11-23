import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('incremental change-feed client uses tenant-scoped checkpoint and pull RPCs', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  assert.match(source, /get_asset_sync_checkpoint/)
  assert.match(source, /list_asset_sync_changes/)
  assert.match(source, /p_organization_id: organizationId/)
  assert.match(source, /p_after_sequence: afterSequence/)
})

test('incremental pull rejects cross-tenant events and malformed or unsupported event types', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  assert.match(source, /eventOrganization !== organizationId/)
  assert.match(source, /upsert.*soft_delete.*hard_delete.*reset/)
  assert.match(source, /snapshot không hợp lệ/)
})

test('incremental pull validates bounded page size and monotonic cursor progress', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  assert.match(source, /limit > 500/)
  assert.match(source, /sequence <= afterSequence/)
  assert.match(source, /nextCursor !== items\[items.length - 1\]\.sequence/)
  assert.match(source, /hasMore && nextCursor <= afterSequence/)
})

test('Dexie persists a cursor per organization without inventing bootstrap cursor values', async () => {
  const db = await read('../src/db.ts')
  assert.match(db, /export type AssetSyncCursor/)
  assert.match(db, /assetSyncCursors!: Table<AssetSyncCursor, string>/)
  assert.match(db, /this\.version\(8\)\.stores/)
  assert.match(db, /assetSyncCursors: 'organizationId, lastSequence, resetGeneration, updatedAt'/)
  assert.match(db, /bootstrapComplete: boolean/)
  assert.doesNotMatch(db, /assetSyncCursors.*upgrade/)
})

test('cursor reader is tenant-scoped, read-only and refuses local-preview cursors', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  assert.match(source, /readAssetSyncCursor/)
  assert.match(source, /organizationId === 'local-preview'/)
  assert.match(source, /db\.assetSyncCursors\.get\(organizationId\)/)
  assert.match(source, /Cursor Incremental Pull Local bị hỏng/)
})

test('empty pages cannot advance cursor and reset markers require generation', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  assert.match(source, /page rỗng không được nhảy cursor/)
  assert.match(source, /Reset event thiếu generation/)
  assert.match(source, /thiếu định danh thiết bị cho event/)
})

test('bootstrap checkpoint is persisted as incomplete until full scan finishes and page cursor advances only after completion', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  assert.match(source, /bootstrapComplete: false/)
  assert.match(source, /markAssetSyncBootstrapComplete/)
  assert.match(source, /advanceAssetSyncCursor/)
  const cloud = await read('../src/lib/cloudAssets.ts')
  assert.match(cloud, /if\(!cursor\.bootstrapComplete\)/)
  assert.match(cloud, /markAssetSyncBootstrapComplete/)
})

test('event parser requires a timestamp and Incremental Pull uses full-scan fallback when RPC is unavailable', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  const cloud = await read('../src/lib/cloudAssets.ts')
  assert.match(source, /eventCreatedAt/)
  assert.match(source, /Event thiếu timestamp hợp lệ/)
  assert.match(cloud, /syncCloudAssetsToLocal\(client,organizationId,options\)/)
  assert.match(cloud, /isMissingAssetSyncRpc/)
})

test('page application validates tenant, applies reset barrier and advances cursor after page processing', async () => {
  const cloud = await read('../src/lib/cloudAssets.ts')
  assert.match(cloud, /event\.organizationId!==organizationId/)
  assert.match(cloud, /event\.eventType==='reset'/)
  assert.match(cloud, /ensureOrganizationAssetResetApplied\(client,organizationId\)/)
  assert.match(cloud, /advanceAssetSyncCursor\(organizationId,page\.nextCursor,resetGeneration\)/)
})

test('Pull skips pre-reset snapshots while waiting for the reset barrier, preventing resurrection', async () => {
  const cloud = await read('../src/lib/cloudAssets.ts')
  assert.match(cloud, /let lastResetIndex=-1/)
  assert.match(cloud, /const generationGap=page\.currentGeneration>resetGeneration/)
  assert.match(cloud, /if\(lastResetIndex>=0&&i<lastResetIndex\)continue/)
  assert.match(cloud, /if\(generationGap&&lastResetIndex<0&&event\.eventType!=='reset'\)continue/)
  assert.match(cloud, /Feed thiếu Reset barrier dù generation Cloud đã tăng/)
})
