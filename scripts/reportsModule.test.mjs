import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [app, panel, css] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ReportsPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8')
])

test('Báo cáo is a first-class module and is available to users with read access', () => {
  assert.match(app, /'dashboard'\|'assets'\|'inventory'\|'maintenance'\|'checklist'\|'reports'/)
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

test('inventory report aggregates stock-in and stock-out movements separately by selected period', () => {
  assert.match(panel, /movement\.type === 'Nhập'/)
  assert.match(panel, /movement\.type === 'Xuất'/)
  assert.match(panel, /inboundQuantity/)
  assert.match(panel, /outboundQuantity/)
  assert.match(panel, /inboundTransactions/)
  assert.match(panel, /outboundTransactions/)
  assert.match(panel, /Báo cáo nhập – xuất vật tư/)
  assert.match(panel, /exportMaterials/)
  assert.match(panel, /Nội dung vật tư ghi tự do trong Phiếu YC không được cộng/)
})

test('inventory report keeps opening balance and stock-count adjustments separate from normal in/out', () => {
  assert.match(panel, /movement\.reason\.trim\(\)\.toLocaleLowerCase\('vi'\) === 'tồn đầu kỳ'/)
  assert.match(panel, /openingQuantity/)
  assert.match(panel, /movement\.type === 'Điều chỉnh'/)
  assert.match(panel, /adjustmentQuantity/)
  assert.match(panel, /điều chỉnh không cộng vào tổng nhập\/xuất/)
})

test('reports preserve weekly, monthly, quarterly and yearly period controls', () => {
  for (const period of ['Ngày', 'Tuần', 'Tháng', 'Quý', 'Năm']) assert.ok(panel.includes("'" + period + "'"))
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


test('equipment status report is a period activity report, not a snapshot of every asset', () => {
  assert.ok(panel.includes('<h2>Tình trạng thiết bị</h2>'))
  assert.match(panel, /deviceActivities/)
  assert.match(panel, /Không có hoạt động bảo dưỡng, sửa chữa hoặc công việc định kỳ hoàn thành/)
  assert.doesNotMatch(panel, /Tình trạng thiết bị hiện tại/)
  assert.doesNotMatch(panel, /brokenAssets/)
})

test('equipment activity report includes completed maintenance requests and completed periodic checklist tasks', () => {
  assert.match(panel, /requests\.filter\(row => row\.status === 'Hoàn thành'\)/)
  assert.match(panel, /tasks\.filter\(row => row\.status === 'Hoàn thành'\)/)
  assert.match(panel, /maintenanceHistory/)
  assert.match(panel, /event\?\.actorLabel \|\| row\.performedBy/)
  assert.match(panel, /completionEvent\?\.actorLabel/)
  assert.match(panel, /row\.checklist/)
})

test('equipment activity report shows timestamp, performer and outcome in the UI and Excel export', () => {
  for (const field of ['Ngày giờ thực hiện', 'Người thực hiện', 'Kết quả']) assert.ok(panel.includes(field))
  assert.match(panel, /dateTimeLabel\(row\.occurredAt\)/)
  assert.match(panel, /exportDeviceActivities/)
  assert.ok(panel.includes('Asia/Ho_Chi_Minh'))
})

test('equipment activity report filters by selected period and search query', () => {
  assert.match(panel, /localDateKey\(row\.occurredAt\) >= range\.startDate/)
  assert.match(panel, /localDateKey\(row\.occurredAt\) <= range\.endDate/)
  assert.match(panel, /\.includes\(query\)/)
})

test('standalone checklist data is not fabricated when no checklist module exists', () => {
  assert.match(panel, /chưa phải Checklist độc lập/)
})


test('maintenance report separates created, completed, open and overdue work for all five report periods', () => {
  assert.match(panel,/loadMaintenanceRequests\(supabaseClient,organizationId\)/)
  assert.match(panel,/requestsCreatedInPeriod/)
  assert.match(panel,/requestsCompletedInPeriod/)
  assert.match(panel,/openMaintenanceRequests/)
  assert.match(panel,/overdueMaintenanceRequests/)
  assert.match(panel,/scheduledTasksInPeriod/)
  assert.match(panel,/\['Ngày','Tuần','Tháng','Quý','Năm'\]/)
  assert.match(panel,/Báo cáo bảo trì – sửa chữa/)
  assert.match(panel,/Công việc bảo dưỡng định kỳ/)
})

test('maintenance Cloud loading failures do not blank the existing inventory report', () => {
  assert.match(panel,/db\.inventoryItems\.where\('organizationId'\)/)
  assert.match(panel,/db\.inventoryMovements\.where\('organizationId'\)/)
  assert.match(panel,/Không tải được dữ liệu báo cáo bảo trì/)
  assert.match(panel,/Phiếu yêu cầu và lịch bảo dưỡng lấy từ Cloud/)
})
