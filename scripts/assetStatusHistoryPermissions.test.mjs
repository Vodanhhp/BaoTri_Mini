import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('equipment status includes archive and is changed through the guarded status control', async () => {
  const [db, app] = await Promise.all([read('../src/db.ts'), read('../src/App.tsx')])
  assert.match(db, /'Lưu kho'/)
  assert.match(app, /Thay đổi trạng thái/)
  assert.match(app, /selectedAssetStatus/)
  assert.match(app, /archivedAt:statusOverride==='Lưu kho'/)
  assert.match(app, /status:archived\?'Lưu kho'/)
})

test('viewer is read-only; only Admin and KTV receive equipment mutation capabilities', async () => {
  const app = await read('../src/App.tsx')
  assert.match(app, /\['ktv','technician','maintenance_technician'\]/)
  assert.match(app, /const canMutate=Boolean\(localPreview\|\|currentOrganization\?\.isAdmin\|\|isKtv\)/)
  assert.match(app, /if\(!localPreview&&!canMutate\)/)
  assert.match(app, /disabled=\{!canMutate\}/)
  assert.match(app, /canChangeStatus=Boolean\(localPreview\|\|\(canMutate&&currentOrganization\?\.permissions\.includes\('assets.update'\)\)\)/)
})

test('equipment activity history persists locally and uses append-only Cloud history RPCs', async () => {
  const [db, app, migration] = await Promise.all([
    read('../src/db.ts'), read('../src/App.tsx'), read('../supabase/migrations/20261122210000_asset_activity_history.sql')
  ])
  assert.match(db, /assetHistory!: Table<AssetHistory, string>/)
  assert.match(db, /assetHistory: 'id, organizationId, assetId/)
  assert.match(app, /recordAssetHistory/)
  assert.match(app, /list_cloud_asset_history/)
  assert.match(app, /record_cloud_asset_history_event/)
  assert.match(migration, /create table if not exists public\.asset_activity_history/i)
  assert.match(migration, /on delete restrict/i)
  assert.match(migration, /private\.has_org_permission\(p_organization_id,'assets.view'\)/)
  assert.match(migration, /private\.is_org_technician/)
  assert.match(migration, /private\.can_view_asset_history/)
  assert.match(migration, /v_input\.status not in \('Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý','Lưu kho'\)/)
  assert.match(migration, /lower\(r\.code\) in \('ktv','technician','maintenance_technician'\)/)
  assert.match(migration, /on conflict \(id\) do nothing/i)
  assert.match(migration, /left join public\.profiles p on p\.id=u\.id/)
  assert.match(migration, /clock_timestamp\(\)/)
})
