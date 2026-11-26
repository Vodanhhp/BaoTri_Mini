import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [app, panel, db, css, schedule] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ChecklistPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/db.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/checklistSchedule.ts', import.meta.url), 'utf8')
])

test('Checklist is a first-class module reachable from navigation and overview', () => {
  assert.match(app, /'dashboard'\|'assets'\|'inventory'\|'maintenance'\|'checklist'\|'reports'/)
  assert.match(app, /activeModule==='checklist'/)
  assert.match(app, /<ChecklistPanel/)
  assert.match(app, /Mở Checklist/)
})

test('four starter inspection groups are optional and disabled by default', () => {
  for (const label of ['Cơ sở hạ tầng','Hệ thống điện','Hệ thống nước','Phòng cháy chữa cháy']) assert.ok(panel.includes(label))
  assert.match(panel, /enabled:false/)
  assert.match(panel, /Bật nhóm/)
  assert.match(panel, /Tắt nhóm/)
})

test('Checklist records use organization scope and independent Dexie tables, not equipment history', () => {
  assert.match(db, /checklistCategorySettings!: Table/)
  assert.match(db, /checklistDefinitions!: Table/)
  assert.match(db, /checklistRuns!: Table/)
  assert.match(db, /this\.version\(13\)/)
  assert.match(panel, /checklistRuns\.where\('organizationId'\)\.equals\(organizationId\)/)
  assert.doesNotMatch(panel, /assetHistory|maintenanceHistory/)
  assert.doesNotMatch(panel, /assetId:/)
})

test('Viewer can inspect configuration and reports but cannot configure or execute', () => {
  assert.match(app, /canManage=\{localPreview\|\|Boolean\(currentOrganization\?\.isAdmin\)\}/)
  assert.match(app, /canExecute=\{localPreview\|\|canMutate\}/)
  assert.match(panel, /if\(!canManage\)return/)
  assert.match(panel, /if\(!running\|\|!canExecute\)return/)
})

test('failed inspection cannot be recorded as pass and requires repair decision', () => {
  assert.match(panel, /outcome:failed\?'Không đạt':'Đạt'/)
  assert.match(panel, /Có nội dung kiểm tra Không đạt/)
  assert.match(panel, /Lý do chưa tạo Phiếu yêu cầu/)
  assert.match(panel, /repairRequestCreated:failed&&repairCreated/)
})

test('Checklist keeps a snapshot of the checked questions and exposes history and reporting', () => {
  assert.match(panel, /checklistSnapshot:running\.questions\.map/)
  assert.match(panel, /Lịch sử kiểm tra/)
  assert.match(panel, /Báo cáo Checklist/)
  assert.match(panel, /exportExcel/)
  assert.match(panel, /writeBuffer/)
})

test('Checklist has responsive PC/mobile styling and printable history', () => {
  assert.match(css, /checklist-category-grid/)
  assert.match(css, /@media\(max-width:680px\)[\s\S]*checklist-category-grid/)
  assert.match(css, /@media print[\s\S]*checklist-history-row/)
})

test('recurring Checklist occurrences are stored independently and preserve each missed period', () => {
  assert.match(db, /checklistTasks!: Table/)
  assert.match(db, /this\.version\(14\)/)
  assert.match(schedule, /Hàng ngày/)
  assert.match(schedule, /Hàng tuần/)
  assert.match(schedule, /Hàng tháng/)
  assert.match(schedule, /Hàng quý/)
  assert.match(schedule, /Hàng năm/)
  assert.match(schedule, /status: dueAt\.getTime\(\) < current\.getTime\(\) \? 'Quá hạn' : 'Chờ thực hiện'/)
  assert.match(schedule, /scheduleStartedAt \|\| definition\.createdAt/)
  assert.match(schedule, /bulkDelete\(obsolete\.map/)
  assert.match(panel, /status:'Hoàn thành',completedAt:record\.completedAt,runId:record\.id/)
})

test('Dashboard shows period-based Checklist counts and does not treat flexible tasks as overdue', () => {
  assert.match(app, /<ChecklistDashboardSummary/)
  assert.match(panel, /Đến hạn hôm nay/)
  assert.match(panel, /Trong tuần/)
  assert.match(panel, /Trong tháng/)
  assert.match(panel, /Trong năm/)
  assert.match(schedule, /item\.frequency !== 'Linh hoạt'/)
})
