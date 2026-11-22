import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('soft delete is a distinct Admin-only state and does not reuse archive', async () => {
  const [db, app, cloud, migration] = await Promise.all([
    read('../src/db.ts'), read('../src/App.tsx'), read('../src/lib/cloudAssets.ts'),
    read('../supabase/migrations/20261122150000_admin_soft_delete_assets.sql')
  ])
  assert.match(db, /deletedAt\?: string/)
  assert.match(app, /const canDelete=Boolean\(currentOrganization\?\.isAdmin\)/)
  assert.match(app, /Thiết bị đã xóa/)
  assert.match(app, /ĐÃ XÓA/)
  assert.match(app, /deleteAsset/)
  assert.match(cloud, /soft_delete_cloud_asset_with_lock/)
  assert.match(cloud, /list_cloud_asset_deletion_tombstones/)
  assert.match(migration, /add column if not exists deleted_at/i)
  assert.match(migration, /private\.is_org_admin/)
  assert.match(migration, /assets\.delete/)
  assert.match(migration, /list_cloud_asset_deletion_tombstones/)
  assert.doesNotMatch(migration, /delete\s+from\s+public\.assets/i)
})

test('deleted equipment remains available to Admin but hidden from non-Admin Cloud reads', async () => {
  const migration = await read('../supabase/migrations/20261122150000_admin_soft_delete_assets.sql')
  assert.match(migration, /deleted_at is null or p_platform_admin or \(private\.is_org_admin/i)
  assert.match(migration, /using \(private\.is_org_member\(organization_id\) and \(deleted_at is null or \(private\.is_org_admin/i)
  assert.match(migration, /jsonb_build_object\('code',a\.code,'deleted_at',a\.deleted_at,'updated_at',a\.updated_at\)/)
})
