import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const cloud = readFileSync(new URL('../src/lib/inventoryCloud.ts', import.meta.url), 'utf8')
const local = readFileSync(new URL('../src/lib/inventory.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const design = readFileSync(new URL('../docs/INVENTORY_CLOUD_SYNC_DESIGN.md', import.meta.url), 'utf8')

test('Inventory Cloud writes are routed through the reviewed RPC contract only', () => {
  for (const rpc of [
    'create_inventory_item',
    'update_inventory_item_metadata',
    'apply_inventory_movement',
    'archive_inventory_item',
    'list_inventory_sync_changes'
  ]) assert.match(cloud, new RegExp(rpc))
  assert.doesNotMatch(cloud, /\.from\(['"]inventory_(items|movements)['"]\)/)
})

test('Cloud mutation ordering uses the latest link version, not stale queued timestamps', () => {
  assert.match(cloud, /pending\.sort\(\(a, b\) => a\.createdAt\.localeCompare\(b\.createdAt\)\)/)
  assert.match(cloud, /const expectedCloudUpdatedAt = link\?\.cloudUpdatedAt/)
  assert.match(cloud, /if \(link\?\.status === CONFLICT \|\| mutation\.status === 'conflict'\)/)
})

test('remote events preserve pending Local state and retain a conflict snapshot', () => {
  assert.match(cloud, /Cloud có thay đổi trong khi thiết bị còn mutation Local chưa đồng bộ/)
  assert.match(cloud, /conflictSnapshot/)
  assert.match(cloud, /for \(const mutation of pending\)[\s\S]*?status: 'conflict'/)
})

test('feed parsing checks tenant, monotonic sequence, event type and cursor contract', () => {
  assert.match(cloud, /eventOrganization !== organizationId/)
  assert.match(cloud, /eventSequence <= afterSequence \|\| eventSequence <= previousSequence/)
  assert.match(cloud, /!\['item_upsert', 'item_archive', 'movement_append'\]/)
  assert.match(cloud, /row\.has_more/)
  assert.match(cloud, /nextCursor !== items\[items\.length - 1\]\.sequence/)
})

test('Local inventory writes request the shared sync scheduler after commit', () => {
  assert.match(local, /import \{ requestSync \} from '\.\/syncEngine'/)
  assert.equal((local.match(/requestSync\(\)/g) ?? []).length, 5)
  assert.match(app, /syncInventoryCloud\(client,organizationId/)
  assert.match(app, /context\.permissions\.includes\('inventory\.view'\)/)
})

test('Cloud contract preserves server-side permissions, idempotency and append-only movements', () => {
  assert.match(design, /private\.has_org_permission/)
  assert.match(design, /private\.has_org_role\(organization_id,'admin'\)/)
  assert.match(design, /mutation UUID is stable across retries|Every Local mutation UUID is stable across retries/)
  assert.match(design, /No update\/delete endpoint/)
  assert.match(design, /SECURITY INVOKER/)
})
