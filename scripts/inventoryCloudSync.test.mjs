import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/lib/inventoryCloud.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20261124125830_inventory_local_cloud_sync.sql', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/InventoryPanel.tsx', import.meta.url), 'utf8')

test('inventory Cloud sync is enabled only through the shared sync engine for organization sessions', () => {
  assert.match(app, /const INVENTORY_CLOUD_SYNC_ENABLED = true/)
  assert.match(app, /if\(canViewInventory&&INVENTORY_CLOUD_SYNC_ENABLED\)/)
  assert.match(app, /syncInventoryCloud\(client,organizationId/)
  assert.match(cloud, /pushPendingInventoryMutations\(client, organizationId, permissions, shouldContinue\)/)
  assert.match(cloud, /pullInventoryChanges\(client, organizationId, shouldContinue\)/)
  assert.match(cloud, /Local preview/)
})

test('inventory Cloud contract includes idempotent writes, optimistic concurrency and incremental pull', () => {
  for (const rpc of [
    'create_inventory_item',
    'update_inventory_item_metadata',
    'apply_inventory_movement',
    'archive_inventory_item',
    'list_inventory_sync_changes'
  ]) {
    assert.match(migration, new RegExp('function public\\.' + rpc + '\\('))
  }
  assert.match(migration, /inventory_mutation_receipts/)
  assert.match(migration, /inventory_sync_events/)
  assert.match(migration, /p_expected_cloud_updated_at/)
  assert.match(migration, /private\.has_org_permission\(p_organization_id,'inventory\.view'\)/)
  assert.match(migration, /enable row level security/)
})

test('inventory workspace communicates Local-first storage with automatic Cloud sync', () => {
  assert.match(panel, /Lưu tại thiết bị Local/)
  assert.match(panel, /Tự đồng bộ Cloud khi có mạng/)
  assert.doesNotMatch(panel, /Cloud chưa bật/)
})
