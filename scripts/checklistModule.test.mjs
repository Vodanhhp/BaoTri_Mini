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
  assert.match(app, /Kiểm tra định kỳ/)
  assert.match(panel, /Mở Checklist/)
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

test('optional daily suggestions can be executed but never create scheduled overdue tasks', () => {
  assert.match(panel, /Công việc nên làm hôm nay/)
  assert.match(panel, /Bỏ qua không bị tính quá hạn/)
  assert.match(panel, /frequency:'Linh hoạt'/)
  assert.match(panel, /Thực hiện ngay/)
  assert.match(schedule, /item\.frequency !== 'Linh hoạt'/)
})


test('Checklist execution time is configurable and future task snapshots use it', () => {
  assert.match(db, /executionTime\?: string/)
  assert.match(panel, /Giờ thực hiện/)
  assert.match(panel, /type="time"/)
  assert.match(panel, /executionTime!==\(editing\.executionTime\|\|'09:00'\)/)
  assert.match(schedule, /atExecutionTime\(anchor, executionTime\)/)
  assert.match(schedule, /executionTime, assignee: definition\.assignee/)
  assert.match(schedule, /currentById\.get\(task\.checklistId\)!\.executionTime/)
  assert.match(schedule, /task\.executionTime \|\| '09:00'/)
})


test('group-assigned Checklist tasks can be claimed, worked, and returned with an event trail', () => {
  assert.match(db, /claimedBy\?: string/)
  assert.match(db, /assignmentEvents\?: Array/)
  assert.match(db, /'Hủy thực hiện'/)
  assert.match(panel, /startsWith\('nhóm'\)/)
  assert.match(panel, /const claimTask=async/)
  assert.match(panel, /const releaseTask=async/)
  assert.match(panel, /Nhận việc/)
  assert.match(panel, /Trả lại nhóm/)
  assert.match(panel, /Đang xử lý bởi/)
  assert.match(panel, /Chỉ người được giao hoặc Admin thực hiện/)
  assert.match(schedule, /item\.status !== 'Đang thực hiện'/)
})


test('assignment events remain visible after an inspection is completed', () => {
  assert.match(db, /assignmentHistory\?: Array/)
  assert.match(panel, /assignmentHistory:taskSnapshot\?\.assignmentEvents\|\|\[\]/)
  assert.match(panel, /Lịch sử phân công/)
  assert.match(panel, /row\.assignmentHistory\.map/)
})
