import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('equipment category and location filters follow the currently selected list', () => {
  assert.match(app, /const currentViewAssets = useMemo\(\(\) => assets\.filter\(a => Boolean\(a\.deletedAt\) === showDeleted && \(showDeleted \|\| Boolean\(a\.archivedAt\) === showArchived\)/)
  assert.match(app, /new Set\(currentViewAssets\.map\(a => a\.category\)/)
  assert.match(app, /new Set\(currentViewAssets\.map\(a => a\.location\)/)
})

test('archived count excludes soft-deleted equipment', () => {
  assert.match(app, /assets\.filter\(item=>Boolean\(item\.archivedAt\)&&!item\.deletedAt\)\.length/)
})

test('deleted equipment detail is labeled deleted and cannot offer editing', () => {
  assert.match(app, /detailAsset\.deletedAt\?'ĐÃ XÓA':detailAsset\.archivedAt\?'Lưu kho'/)
  assert.match(app, /!detailAsset\.deletedAt&&\(localPreview\|\|canUpdate\).*Chỉnh sửa hồ sơ/)
  assert.match(app, /detailAsset\.deletedAt\?'Thiết bị đã xóa; không thể bổ sung ảnh\.'/)
})

test('equipment table displays a useful empty state for every list mode', () => {
  assert.match(app, /visibleAssets\.length===0&&<tr><td colSpan=\{6\}><div className="table-empty-state">/)
  assert.match(app, /Không tìm thấy thiết bị phù hợp với điều kiện lọc\./)
  assert.match(app, /Chưa có thiết bị nào trong danh sách đã xóa\./)
  assert.match(app, /Chưa có thiết bị nào trong Lưu kho\./)
})
