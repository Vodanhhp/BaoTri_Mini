import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Smart ID edits verify durable Local ownership before releasing a reservation', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const start = app.indexOf('const updateSmartDraft=')
  const end = app.indexOf('\n\n  const closeEditor=', start)
  assert.ok(start >= 0 && end > start)
  const update = app.slice(start, end)

  const localCheck = update.indexOf('persistedAsset=await db.assets.get(currentEditing.id)')
  const release = update.indexOf('releaseSmartEquipmentIdReservation(supabase,organizationId,reservationId)')
  assert.ok(localCheck >= 0 && release > localCheck, 'Local persistence must be checked before Cloud release')

  const persistedGuard = update.indexOf('if(persistedAsset||currentEditing.idReservationStatus===\'confirmed\')')
  assert.ok(persistedGuard > localCheck && persistedGuard < release, 'Saved or confirmed reservations must never be released')

  assert.match(update, /Không xác minh được thiết bị đã lưu Local[\s\S]*?không giải phóng reservation/)
  assert.match(update, /Số thứ tự đã được Cloud xác nhận[\s\S]*?không thể giải phóng hoặc tái sử dụng/)
  assert.match(update, /Thiết bị đã được lưu tại Local nhưng số thứ tự chưa xác nhận hoàn tất/)
  assert.match(update, /if\(!supabase\|\|!organizationId\)[\s\S]*?Thông tin chưa được thay đổi/)
  assert.match(update, /idReservationId:undefined,idReservationStatus:undefined/)
})

test('unpersisted drafts release only after an explicit Cloud acknowledgement', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const start = app.indexOf('const updateSmartDraft=')
  const end = app.indexOf('\n\n  const closeEditor=', start)
  const update = app.slice(start, end)
  assert.match(update, /await releaseSmartEquipmentIdReservation\(supabase,organizationId,reservationId\)[\s\S]*?await db\.assetDrafts\.delete\(currentEditing\.id\)/)
  assert.match(update, /catch\(cause\)[\s\S]*?Chưa giải phóng được số thứ tự chưa sử dụng[\s\S]*?return/)
})
