import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Cloud asset status constraint includes Luu kho', async () => {
  const migration = await read('../supabase/migrations/20261123105735_allow_stored_asset_status_in_cloud.sql')
  assert.ok(migration.includes("'Lưu kho'::text"))
  assert.ok(migration.includes('alter table public.assets add constraint assets_status_check'))
})

test('Local to Cloud import accepts and preserves the Luu kho status', async () => {
  const migration = await read('../supabase/migrations/20261123105735_allow_stored_asset_status_in_cloud.sql')
  assert.ok(migration.includes("v_input.status not in ('Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý','Lưu kho')"))
  assert.ok(migration.includes("'archived_at',nullif(p_asset->>'archived_at','')"))
  assert.ok(migration.includes('private.import_asset_preserving_identity'))
})
