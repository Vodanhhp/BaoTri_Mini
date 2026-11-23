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
  assert.doesNotMatch(db, /assetSyncCursors.*upgrade/)
})

test('cursor reader is tenant-scoped, read-only and refuses local-preview cursors', async () => {
  const source = await read('../src/lib/cloudAssetChanges.ts')
  assert.match(source, /readAssetSyncCursor/)
  assert.match(source, /organizationId === 'local-preview'/)
  assert.match(source, /db\.assetSyncCursors\.get\(organizationId\)/)
  assert.match(source, /Cursor Incremental Pull Local bị hỏng/)
})
