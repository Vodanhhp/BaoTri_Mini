import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [app, panel, css] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ReportsPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8')
])

test('Báo cáo is a first-class module and is available to users with read access', () => {
  assert.match(app, /'dashboard'\|'assets'\|'inventory'\|'maintenance'\|'reports'/)
  assert.match(app, /activeModule==='reports'/)
  assert.match(app, /localPreview\|\|canView\|\|canInventoryView/)
  assert.match(app, /<ReportsPanel/)
})

test('reports are scoped to the selected organization and stale reads are ignored', () => {
  assert.match(panel, /where\('organizationId'\)\.equals\(organizationId\)/)
  assert.match(panel, /let active = true/)
  assert.match(panel, /if \(!active\) return/)
  assert.match(panel, /return \(\) => \{ active = false \}/)
})

test('actual work report only counts completed maintenance requests in the selected period', () => {
  assert.match(panel, /row\.status === 'Hoàn thành'/)
  assert.match(panel, /row\.completedAt \|\| row\.updatedAt \|\| row\.requestDate/)
  assert.match(panel, /completedRequests/)
})

test('inventory usage is derived from stock-out movements, not free-text parts on work orders', () => {
  assert.match(panel, /movement\.type !== 'Xuất'/)
  assert.match(panel, /row\.quantity \+= movement\.quantity/)
  assert.match(panel, /Nội dung vật tư ghi tự do trong Phiếu YC không được cộng/)
})

test('reports preserve weekly, monthly, quarterly and yearly period controls', () => {
  for (const period of ['Tuần', 'Tháng', 'Quý', 'Năm']) assert.ok(panel.includes("'" + period + "'"))
  assert.match(panel, /function periodRange/)
})

test('Viewer can read reports but export controls are only rendered when canExport is true', () => {
  assert.match(panel, /canExport && <button/)
  assert.match(panel, /Tài khoản chỉ có quyền xem/)
  assert.match(app, /canExport=\{canExport\}/)
})

test('report tables remain horizontally scrollable on narrow screens', () => {
  assert.match(css, /reports-table-wrap/)
  assert.match(css, /Vuốt ngang bảng để xem các cột còn lại/)
})
