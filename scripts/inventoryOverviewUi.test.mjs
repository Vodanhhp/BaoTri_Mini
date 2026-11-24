import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('overview combines equipment and inventory summaries and reserves a future checklist section', async () => {
  const app = await read('../src/App.tsx')
  assert.match(app, /useState<'dashboard'\|'assets'\|'inventory'>\('dashboard'\)/)
  assert.match(app, /setActiveModule\('dashboard'\)/)
  assert.match(app, /Vật tư đang theo dõi/)
  assert.match(app, /Sắp hết hàng/)
  assert.match(app, /Đang sửa chữa/)
  assert.match(app, /Checklist & công việc bảo trì/)
  assert.match(app, /baotri:inventory-updated/)
})

test('inventory form auto-generates item codes and allows organization-scoped custom groups', async () => {
  const panel = await read('../src/InventoryPanel.tsx')
  assert.match(panel, /Mã vật tư sẽ được hệ thống tự cấp theo thứ tự VT-001, VT-002/)
  assert.doesNotMatch(panel, /Mã vật tư \*<input/)
  assert.doesNotMatch(panel, /Tồn đầu kỳ<input/)
  assert.match(panel, /＋ Thêm nhóm mới/)
  assert.match(panel, /createInventoryGroup\(actor, newGroupName\)/)
  assert.match(panel, /Thông tin bổ sung \(không bắt buộc\)/)
})

test('inventory has mobile card layouts for items and movement history while retaining desktop tables', async () => {
  const panel = await read('../src/InventoryPanel.tsx')
  const css = await read('../src/style.css')
  assert.match(panel, /inventory-mobile-list/)
  assert.match(panel, /inventory-mobile-card/)
  assert.match(panel, /inventory-movement-list/)
  assert.match(panel, /Tồn trước → sau/)
  assert.match(panel, /inventory-desktop-table/)
  assert.match(css, /\.inventory-desktop-table\{display:none\}/)
  assert.match(css, /\.inventory-mobile-list\{display:grid;gap:9px\}/)
  assert.match(css, /width:calc\(100vw - 24px\)/)
  assert.match(css, /max-height:calc\(100dvh - 24px\)/)
})
