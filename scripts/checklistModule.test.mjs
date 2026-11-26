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
  assert.match(db, /targetAssetId\?: string/)
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
  assert.match(panel, /Lịch sử Checklist/)
  assert.match(panel, /Báo cáo Checklist/)
  assert.match(panel, /exportExcel/)
  assert.match(panel, /downloadExcelReport\(rows,'bao-cao-checklist\.xlsx'/)
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
  assert.match(schedule, /CHECKLIST_GRACE_PERIOD_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(schedule, /status:missed\?'Không Checklist':'Chờ thực hiện'/)
  assert.match(schedule, /status:'Không Checklist' as const/)
  assert.match(schedule, /definition\.scheduleStartedAt\|\|definition\.createdAt/)
  assert.match(schedule, /bulkDelete\(obsolete\.map/)
  assert.match(panel, /status:'Hoàn thành',completedAt:record\.completedAt,runId:record\.id/)
})

test('Dashboard shows period-based Checklist counts and does not treat flexible tasks as overdue', () => {
  assert.match(app, /<ChecklistDashboardSummary/)
  assert.match(panel, /Đến hạn cần làm/)
  assert.match(panel, /Không Checklist/)
  assert.match(panel, /Công việc \{selectedFrequency\.toLocaleLowerCase\('vi'\)\} trong kỳ/)
  assert.match(panel, /setWorkPeriod\('day'\)/)
  assert.match(panel, /setWorkPeriod\('week'\)/)
  assert.match(panel, /setWorkPeriod\('month'\)/)
  assert.match(panel, /setWorkPeriod\('quarter'\)/)
  assert.match(schedule, /item\.frequency!=='Linh hoạt'/)
})

test('optional daily suggestions can be executed but never create scheduled overdue tasks', () => {
  assert.match(panel, /Công việc nên làm hôm nay/)
  assert.match(panel, /Bỏ qua không bị tính quá hạn/)
  assert.match(panel, /frequency:'Linh hoạt'/)
  assert.match(panel, /Thực hiện ngay/)
  assert.match(schedule, /item\.frequency!=='Linh hoạt'/)
})


test('Checklist execution time is configurable and future task snapshots use it', () => {
  assert.match(db, /executionTime\?: string/)
  assert.match(panel, /Giờ thực hiện/)
  assert.match(panel, /type="time"/)
  assert.match(panel, /executionTime!==\(editing\.executionTime\|\|'09:00'\)/)
  assert.match(schedule, /atExecutionTime\(anchor,executionTime\)/)
  assert.match(schedule, /executionTime,assignee:definition\.assignee/)
  assert.match(schedule, /definition\.executionTime\|\|'09:00'/)
  assert.match(schedule, /task\.executionTime\|\|'09:00'/)
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
  assert.match(schedule, /task.status!=='Đang thực hiện'/)
})


test('assignment events remain visible after an inspection is completed', () => {
  assert.match(db, /assignmentHistory\?: Array/)
  assert.match(panel, /assignmentHistory:taskSnapshot\?\.assignmentEvents\|\|\[\]/)
  assert.match(panel, /Lịch sử phân công/)
  assert.match(panel, /row\.assignmentHistory\.map/)
})


test('future scheduled tasks refresh their snapshots after definition edits without deleting in-progress work', () => {
  assert.match(schedule, /definition.assignee!==task.assignee/)
  assert.match(schedule, /definition.title!==task.title/)
  assert.match(schedule, /JSON\.stringify\(definition\.questions\)!==JSON\.stringify\(task\.definitionSnapshot\.questions\)/)
  assert.match(schedule, /task.status!=='Đang thực hiện'/)
})


test('Checklist group claims are atomic and ownership uses stable user IDs, not display labels', () => {
  assert.match(db, /claimedByUserId\?: string/)
  assert.match(panel, /db\.transaction\('rw',db\.checklistTasks/)
  assert.match(panel, /claimedByUserId!==userId/)
  assert.match(panel, /claimedByUserId===userId/)
  assert.match(panel, /actorUserId:userId/)
  assert.match(panel, /Quyền nhận việc đã thay đổi/)
  assert.doesNotMatch(panel, /claimedBy!==userLabel/)
})


test('Checklist reports filter by local date range and Excel exports the filtered result set', () => {
  assert.match(panel, /const \[reportFrom,setReportFrom\]=useState\(''\)/)
  assert.match(panel, /const \[reportTo,setReportTo\]=useState\(''\)/)
  assert.match(panel, /const reportRuns=useMemo\(/)
  assert.match(panel, /checklistLocalDateKey\(new Date\(item\.completedAt\)\)/)
  assert.match(panel, /\.\.\.reportRuns\.map\(row=>\(/)
  assert.match(panel, /reportRuns\.map\(row=>/)
})

test('Checklist A4 print renders one selected result with answers and follow-up decision', () => {
  assert.match(panel, /setPrintingRun\(row\)/)
  assert.match(panel, /checklist-print-sheet/)
  assert.match(panel, /printingRun\.answers\.map/)
  assert.match(panel, /printingRun\.noRepairReason/)
  assert.match(panel, /window\.print\(\)/)
})

test('missed Checklist occurrences are red history records, not failed inspection results',()=>{assert.match(db,/'Không Checklist'/);assert.match(panel,/checklist-missed-history/);assert.match(panel,/Kết quả đã kiểm tra/);assert.match(panel,/Không thực hiện trong thời gian cho phép/);assert.match(panel,/reportMissedTasks/);assert.match(panel,/'Kết quả':'Không Checklist'/);assert.match(css,/checklist-missed-row/);assert.match(panel,/CHECKLIST_GRACE_PERIOD_MS/)})
test('scheduled Checklist tasks are grouped into current day, week, month, and quarter tabs from the start of each period',()=>{assert.match(panel,/checklistPeriodRange/);assert.match(panel,/const periodTasks=tasks\.filter/);assert.match(panel,/item\.dueDate>=periodRange\.start&&item\.dueDate<periodRange\.end/);assert.match(panel,/currentMs-new Date\(item\.dueAt\)\.getTime\(\)<CHECKLIST_GRACE_PERIOD_MS/);assert.match(panel,/workPeriod==='day'/);assert.match(panel,/workPeriod==='week'/);assert.match(panel,/workPeriod==='month'/);assert.match(panel,/workPeriod==='quarter'/);assert.doesNotMatch(panel,/Lịch sắp tới/);assert.doesNotMatch(panel,/upcomingTasks/)})

test('period tabs only show tasks and missed counts for the matching Checklist cycle',()=>{
  assert.match(panel,/periodFrequency:Record<typeof workPeriod,ChecklistFrequency>=\{day:'Hàng ngày',week:'Hàng tuần',month:'Hàng tháng',quarter:'Hàng quý'\}/)
  assert.match(panel,/item\.frequency===selectedFrequency&&\(item\.status==='Chờ thực hiện'\|\|item\.status==='Đang thực hiện'\)/)
  assert.match(panel,/item\.frequency===selectedFrequency&&item\.status==='Không Checklist'/)
  assert.match(panel,/Checklist Hàng năm xem trong Lịch sử và Báo cáo/)
})


test('Checklist suggestions and starter groups are collapsed behind explicit buttons',()=>{assert.match(panel,/Xem gợi ý thiết bị/);assert.match(panel,/Cấu hình nhóm mẫu/);assert.match(panel,/showSuggestions&&suggestions\.filter[\s\S]*?\.map/);assert.match(panel,/showStarterGroups&&<div className="checklist-category-grid"/)});
test('Disabling a Checklist removes all uncompleted tasks even when their due time has passed',()=>{assert.match(schedule,/!activeIds\.has\(task\.checklistId\)/);assert.match(schedule,/task\.status!=='Hoàn thành'&&task\.status!=='Không Checklist'/);assert.match(panel,/Sửa nội dung/);assert.match(panel,/openEdit\(definition\)/)});


test('Checklist templates remain manageable when disabled and can be edited from the management tab',()=>{
  assert.ok(panel.includes('<h2>Quản lý mẫu Checklist</h2>'))
  assert.match(panel,/definitions\.filter\(item=>!search\.trim\(\)/)
  assert.match(panel,/item\.enabled\?'Tạm ngừng lịch':'Tiếp tục lịch'/)
  assert.match(panel,/showBuilderForm&&<div className="checklist-modal-backdrop"/);assert.match(panel,/role="dialog" aria-modal="true"/)
  assert.match(panel,/Sửa nội dung Checklist/)
  assert.match(panel,/\+ Thêm nội dung kiểm tra/)
  assert.match(panel,/questionText\.split\('\\n'\)/)
})

test('recurring Checklist runs are launched from scheduled tasks; templates are edited in the management tab',()=>{
  assert.match(panel,/periodTasks\.map\(task=>/)
  assert.match(panel,/status:'Hoàn thành',completedAt:record\.completedAt/)
  assert.match(panel,/Quản lý mẫu Checklist/)
  assert.match(panel,/openEdit\(item\)/)
})


test('previously saved manual runs close their matching scheduled task within the same period and grace window',()=>{
  assert.match(schedule,/const sameSchedulePeriod=\(frequency:ChecklistFrequency,dueDate:string,completedAt:string\)/)
  assert.match(schedule,/run\.checklistId===task\.checklistId&&sameSchedulePeriod\(task\.frequency,task\.dueDate,run\.completedAt\)/)
  assert.match(schedule,/new Date\(run\.completedAt\)\.getTime\(\)<=dueMs\+CHECKLIST_GRACE_PERIOD_MS/)
  assert.match(schedule,/status:'Hoàn thành' as const,completedAt:matchingRun\.completedAt,runId:matchingRun\.id/)
})


test('Checklist overview has one optional suggestion area and template editing is managed in Builder',()=>{
  assert.equal((panel.match(/Công việc nên làm hôm nay/g)||[]).length,1)
  assert.equal((panel.match(/Gợi ý từ danh mục thiết bị/g)||[]).length,0)
  assert.match(panel,/Quản lý mẫu Checklist/)
  assert.match(panel,/onClick=\{\(\)=>openEdit\(item\)\}>Sửa nội dung/)
  assert.match(panel,/Cấu hình nhóm mẫu/)
  assert.match(panel,/showBuilderForm&&<div className="checklist-modal-backdrop"/)
  assert.ok(panel.includes("current?current+'\\n':''"))
  assert.match(panel,/lines\.splice\(index,1\)/)
})


test('Checklist can be created from an equipment record or from the module using the asset selector',()=>{
  assert.match(app,/checklistInitialAssetId/)
  assert.match(app,/Tạo Checklist cho thiết bị này/)
  assert.match(app,/initialAssetId=\{checklistInitialAssetId\}/)
  assert.match(panel,/activeEquipment=assets\.filter/)
  assert.match(panel,/Chọn thiết bị đã khai báo/)
  assert.match(panel,/targetAssetId/)
  assert.match(panel,/Chu kỳ Checklist được Admin chọn riêng, không lấy theo chu kỳ bảo trì/)
  assert.match(panel,/Hạ tầng \/ khu vực \/ hệ thống khác/)
  assert.doesNotMatch(panel,/\.cycle/)
  assert.doesNotMatch(panel,/cycleStartedAt/)
})

test('Checklist template editor opens in a separate accessible modal and explains schedule pause',()=>{
  assert.match(panel,/className="checklist-modal-backdrop"/)
  assert.match(panel,/className="checklist-editor-modal" role="dialog" aria-modal="true"/)
  assert.match(panel,/Trạng thái lịch là gì\?/)
  assert.match(panel,/không sinh lượt mới từ mẫu này/)
  assert.match(panel,/Tạm ngừng lịch/)
  assert.match(panel,/Tiếp tục lịch/)
})


test('Checklist Excel export uses the shared BAOTRI report workbook format',()=>{
  assert.match(panel,/import \{ downloadExcelReport \} from '\.\/lib\/excelExport'/)
  assert.match(panel,/await downloadExcelReport\(rows,'bao-cao-checklist\.xlsx'/)
  assert.match(panel,/BÁO CÁO KIỂM TRA ĐỊNH KỲ \(CHECKLIST\)/)
  assert.match(panel,/organizationName\)/)
  assert.doesNotMatch(panel,/new ExcelJS\.Workbook/)
})

test('newly activated recurring Checklists still show the current occurrence within the 24-hour grace period',()=>{
  assert.match(schedule,/candidate\.getTime\(\)>=anchor\.getTime\(\)-CHECKLIST_GRACE_PERIOD_MS/)
  assert.match(schedule,/Date\.now\(\)-first\.getTime\(\)>=CHECKLIST_GRACE_PERIOD_MS/)
  assert.match(schedule,/Date\.now\(\)-candidate\.getTime\(\)>=CHECKLIST_GRACE_PERIOD_MS/)
})
