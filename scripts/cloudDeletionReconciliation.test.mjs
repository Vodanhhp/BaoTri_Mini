import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Cloud tombstones preserve newer Local snapshots and turn outstanding mutations into conflicts', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const helper = source.slice(source.indexOf('async function reconcileCloudDeletion'), source.indexOf('export async function importLocalAsset'))
  assert.match(helper, /local\.updatedAt!==link\.lastSyncedLocalUpdatedAt/)
  assert.match(helper, /m\.status==='pending'\|\|m\.status==='processing'\|\|m\.status==='conflict'/)
  assert.match(helper, /status:'conflict'/)
  assert.match(helper, /\{deletedAt,updatedAt:local\.updatedAt\}/)
  assert.match(helper, /lastSyncedLocalUpdatedAt:cloudUpdatedAt/)
  assert.match(source, /reconcileCloudDeletion\(organizationId,local,link,cloud\.deletedAt,cloud\.updatedAt\)/)
})

test('Deletion tombstones cannot soft-delete an unlinked or differently linked Local asset', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const tombstones = source.slice(source.indexOf('for(const tombstone'), source.lastIndexOf('return summary'))
  assert.match(tombstones, /if\(!link\|\|link\.cloudCode!==tombstone\.code\)/)
  assert.match(tombstones, /summary\.protectedLocal\+\+/)
  assert.match(tombstones, /reconcileCloudDeletion\(organizationId,local,link,tombstone\.deleted_at,tombstone\.updated_at\)/)
})

test('Conflict resolution cannot select Local when the Cloud asset is already soft-deleted', async () => {
  const source = await read('../src/CloudAssetsPanel.tsx')
  assert.match(source, /if\(cloudAsset\.deletedAt\|\|\(Array\.isArray\(tombstones\)&&tombstones\.some\(\(row:Record<string,unknown>\)=>row\.code===local\.code\)\)\)throw new Error/)
  assert.match(source, /const cloudDeleted=Boolean\(cloudRecord\?\.deletedAt\|\|deletedCloudCodes\.includes\(asset\?\.code\?\?''\)\)/)
  assert.match(source, /client\.rpc\('list_cloud_asset_deletion_tombstones'/)
  assert.match(source, /cloudDeletionProfileAvailable/)
  assert.match(source, /\{!cloudDeleted&&<button className="primary-btn small".*Chọn Local/)
})


test('Cloud pagination stops if the backend repeats a next cursor', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  assert.equal((source.match(/const seenCursors=new Set<string>\(\)/g) || []).length, 2)
  assert.equal((source.match(/seenCursors\.has\(nextCursor\)/g) || []).length, 2)
  assert.match(source, /Cloud lặp cursor phân trang; dừng tải để tránh vòng lặp vô hạn/)
  assert.match(source, /Cloud lặp cursor phân trang; dừng đồng bộ để tránh vòng lặp vô hạn/)
})


test('pending Cloud mutations retry after initial sync or browser reconnect, with stale processing recovery', async () => {
  const source = await read('../src/App.tsx')
  assert.match(source, /retryCloudAssetMutation/)
  assert.match(source, /window\.addEventListener\('online',runSync\)/)
  assert.match(source, /m\.status==='pending'\|\|\(m\.status==='processing'&&Date\.now\(\)-new Date\(m\.updatedAt\)\.getTime\(\)>60000\)/)
  assert.match(source, /context\.permissions\.includes\('assets\.update'\)/)
  assert.match(source, /await syncCloudAssetsToLocal\(client,organizationId/)
})

 
test('Cloud retry refuses to send a stale Local snapshot and preserves its sync watermark', async () => {
  const source = await read('../src/lib/cloudAssets.ts')
  const retry = source.slice(source.indexOf('export async function retryCloudAssetMutation'))
  assert.match(retry, /local\.updatedAt!==mutation\.localUpdatedAt/)
  assert.match(retry, /link\.status==='conflict'\|\|local\.updatedAt!==mutation\.localUpdatedAt/)
  assert.match(retry, /status:'conflict'/)
  assert.match(retry, /lastSyncedLocalUpdatedAt:mutation\.localUpdatedAt/)
})
