import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Superadmin data tools are wired only into the platform admin workspace', () => {
  const panel = read('../src/PlatformAdminPanel.tsx')
  const tool = read('../src/PlatformDataToolsPanel.tsx')
  assert.match(panel, /PlatformDataToolsPanel/)
  assert.match(panel, /platform-data-tools/)
  assert.match(tool, /platform-data-tools/)
  assert.match(tool, /Chỉ Superadmin/)
  assert.match(tool, /30 thiết bị mẫu/)
  assert.match(tool, /30 vật tư mẫu/)
})

test('Superadmin data tools show tenant Plan and capacity before creation', () => {
  const tool = read('../src/PlatformDataToolsPanel.tsx')
  assert.match(tool, /action: 'preview'/)
  assert.match(tool, /remainingDevices/)
  assert.match(tool, /Không đủ hạn mức thiết bị/)
  assert.match(tool, /Plan \{preview\.planCode\}/)
})

test('Superadmin seed backend verifies the platform owner and uses idempotent server-side RPC', () => {
  const edge = read('../supabase/functions/platform-data-tools/index.ts')
  const migration = read('../supabase/migrations/20261125180000_platform_superadmin_data_tools.sql')
  assert.match(edge, /PLATFORM_OWNER_EMAIL/)
  assert.match(edge, /auth\.getUser\(token\)/)
  assert.match(edge, /platform_seed_organization_data/)
  assert.match(edge, /runId/)
  assert.doesNotMatch(migration, /auth\.role\(\)/)
  assert.ok(migration.includes('revoke all on function public.platform_seed_organization_data'))
  assert.ok(migration.includes('grant execute on function public.platform_seed_organization_data'))
  assert.match(migration, /platform_data_seed_runs/)
  assert.match(migration, /created_by_label/)
  assert.match(migration, /v_max_devices/)
  assert.match(migration, /asset_id_sequence_reservations/)
  assert.ok(migration.indexOf('insert into private.asset_id_sequence_reservations') < migration.indexOf('insert into public.assets'))
  assert.match(migration, /'reservation_id'/)
  assert.match(migration, /record_inventory_sync_event/)
  assert.match(migration, /inventory_mutation_receipts/)
  assert.match(edge, /normalizedNameAtCreation/)
})
