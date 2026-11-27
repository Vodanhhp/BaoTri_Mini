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
  assert.match(app, /canManage=\{localPreview\|\|canManageChecklist\}/)
  assert.match(app, /canExecute=\{localPreview\|\|canExecuteChecklist\}/)
  assert.match(panel, /if\(!canManage\)return/)
  assert.match(panel, /if\(!running\|\|!canExecuteHere\)return/)
})

test('failed inspection cannot be recorded as pass and requires repair decision', () => {
  assert.match(panel, /outcome:failed\?'Không đạt':passed\?'Đạt':'Bỏ qua'/)
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


test('Checklist reports support day, week, month, quarter and year periods and export the filtered result set', () => {
  assert.match(panel, /const \[reportPeriod,setReportPeriod\]=useState/)
  assert.match(panel, /const \[reportAnchorDate,setReportAnchorDate\]=useState\(dateOnly\(\)\)/)
  assert.match(panel, /const reportRange=useMemo\(/)
  assert.match(panel, /const reportEndDate=useMemo\(/)
  assert.match(panel, /const reportRuns=useMemo\(/)
  assert.match(panel, /checklistLocalDateKey\(new Date\(item\.completedAt\)\)/)
  assert.match(panel, /\{value:'year',label:'Năm'\}/)
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
test('scheduled Checklist tasks are grouped into current day, week, month, quarter, and year tabs from the start of each period',()=>{assert.match(panel,/checklistPeriodRange/);assert.match(panel,/const periodTasks=tasks\.filter/);assert.match(panel,/item\.dueDate>=periodRange\.start&&item\.dueDate<periodRange\.end/);assert.match(panel,/currentMs-new Date\(item\.dueAt\)\.getTime\(\)<CHECKLIST_GRACE_PERIOD_MS/);assert.match(panel,/workPeriod==='day'/);assert.match(panel,/workPeriod==='week'/);assert.match(panel,/workPeriod==='month'/);assert.match(panel,/workPeriod==='quarter'/);assert.match(panel,/workPeriod==='year'/);assert.doesNotMatch(panel,/Lịch sắp tới/);assert.doesNotMatch(panel,/upcomingTasks/)})

test('period tabs only show tasks and missed counts for the matching Checklist cycle',()=>{
  assert.match(panel,/periodFrequency:Record<typeof workPeriod,ChecklistFrequency>=\{day:'Hàng ngày',week:'Hàng tuần',month:'Hàng tháng',quarter:'Hàng quý',year:'Hàng năm'\}/)
  assert.match(panel,/item\.frequency===selectedFrequency&&\(item\.status==='Chờ thực hiện'\|\|item\.status==='Đang thực hiện'\)/)
  assert.match(panel,/item\.frequency===selectedFrequency&&item\.status==='Không Checklist'/)
  assert.match(panel,/year:'Hàng năm'/)
})


test('Checklist suggestions and starter groups are collapsed behind explicit buttons',()=>{assert.match(panel,/Xem gợi ý thiết bị/);assert.match(panel,/Cấu hình nhóm mẫu/);assert.match(panel,/showSuggestions&&suggestions\.filter[\s\S]*?\.map/);assert.match(panel,/showStarterGroups&&<div className="checklist-category-grid"/)});
test('Disabling a Checklist removes all uncompleted tasks even when their due time has passed',()=>{assert.match(schedule,/!activeIds\.has\(task\.checklistId\)/);assert.match(schedule,/task\.status!=='Hoàn thành'&&task\.status!=='Không Checklist'/);assert.doesNotMatch(panel,/openEdit\(definition\)/)});


test('Checklist templates remain manageable when disabled and can be edited from the management tab',()=>{
  assert.ok(panel.includes('<h2>Quản lý mẫu Checklist</h2>'))
  assert.match(panel,/visibleDefinitions=definitions\.filter\(item=>Boolean\(item\.archivedAt\)===showArchivedDefinitions/)
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
  assert.doesNotMatch(panel,/openEdit\(definition\)/)
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
  assert.match(panel,/Mẫu lưu trữ không sinh lượt mới/)
  assert.match(panel,/Tạm ngừng lịch/)
  assert.match(panel,/Tiếp tục lịch/)
})


test('Checklist Excel export uses the shared BAOTRI report workbook format',()=>{
  assert.match(panel,/import \{ downloadExcelReport \} from '\.\/lib\/excelExport'/)
  assert.match(panel,/await downloadExcelReport\(rows,'bao-cao-checklist\.xlsx'/)
  assert.match(panel,/BÁO CÁO CHECKLIST/)
  assert.match(panel,/organizationName\)/)
  assert.doesNotMatch(panel,/new ExcelJS\.Workbook/)
})

test('newly activated recurring Checklists still show the current occurrence within the 24-hour grace period',()=>{
  assert.match(schedule,/candidate\.getTime\(\)>=anchor\.getTime\(\)-CHECKLIST_GRACE_PERIOD_MS/)
  assert.match(schedule,/Date\.now\(\)-first\.getTime\(\)>=CHECKLIST_GRACE_PERIOD_MS/)
  assert.match(schedule,/Date\.now\(\)-candidate\.getTime\(\)>=CHECKLIST_GRACE_PERIOD_MS/)
})


test('Checklist overview contains no edit action; all template edits live in Builder',()=>{
  const overview=panel.split("{tab==='builder'&&<>")[0]
  assert.doesNotMatch(overview,/Sửa nội dung/)
  assert.match(panel,/tab==='builder'/)
  assert.match(panel,/onClick=\{\(\)=>openEdit\(item\)\}>Sửa nội dung/)
})

test('Checklist Builder offers extensive target-specific suggestions and custom editable questions',()=>{
  for(const key of ['pump','compressor','motor','generator','electrical','water','fire','infrastructure','generalEquipment','generalArea']) assert.match(panel,new RegExp(key+':\\['))
  assert.match(panel,/checklistSuggestionSet\(targetKind,suggestionAsset,category,target\)/)
  assert.match(panel,/selectedSuggestionLabels\.includes\(item\)/)
  assert.match(panel,/addSelectedSuggestions/)
  assert.match(panel,/Thêm nội dung kiểm tra riêng/)
  assert.match(panel,/onClick=\{\(\)=>setQuestionText\(current=>\{const lines=current\?current\.split\('\\n'\):\[''\];lines\.splice\(index,1\);return lines\.join\('\\n'\)\}\)\}>Xóa/)
  assert.equal(panel.includes('>Làm mới</button>'),false)
})


test('Checklist print action is available in Reports only, not History',()=>{
  const history=panel.split("{tab==='history'&&")[1]?.split("{tab==='reports'&&")[0]||''
  const reports=panel.split("{tab==='reports'&&")[1]||''
  assert.doesNotMatch(history,/In A4|In phiếu A4|setPrintingRun\(row\)/)
  assert.match(reports,/Phiếu Checklist/)
  assert.match(reports,/onClick=\{\(\)=>setPrintingRun\(row\)\}>In phiếu A4/)
  assert.match(panel,/window\.requestAnimationFrame\(\(\)=>window\.print\(\)\)/)
  assert.match(panel,/addEventListener\('afterprint'/)
  assert.match(panel,/removeEventListener\('afterprint'/)
})

test('Checklist selected-suggestion action uses compact separated styling',()=>{
  assert.match(panel,/className="soft-btn checklist-add-selected-btn"/)
  assert.match(css,/checklist-suggestion-actions/)
  assert.match(css,/checklist-add-selected-btn/)
  assert.match(css,/padding:7px 12px/)
})


test('every equipment Checklist automatically includes four mandatory locked common checks',async()=>{
 const source=panel
 assert.match(source,/const MANDATORY_EQUIPMENT_CHECKS = \[/)
 assert.match(source,/4 NỘI DUNG BẮT BUỘC CHO THIẾT BỊ/)
 assert.match(source,/targetKind==='equipment'\?\[\.\.\.MANDATORY_EQUIPMENT_CHECKS,\.\.\.optionalQuestions\]:optionalQuestions/)
 assert.match(source,/filter\(label=>!MANDATORY_EQUIPMENT_CHECKS\.some/)
 assert.match(source,/không thể sửa hoặc xóa/)
 assert.match(source,/window\.requestAnimationFrame\(\(\)=>window\.requestAnimationFrame\(\(\)=>window\.print\(\)\)\)/)
})

test('Checklist print uses the equipment A4 print-sheet wrapper and full structured form',async()=>{
 const source=panel
 const styles=css
 assert.match(source,/className="checklist-print-sheet"/)
 assert.match(source,/className="asset-print-report equipment-print-report checklist-print-report"/)
 for(const label of ['I. THÔNG TIN KIỂM TRA','II. NỘI DUNG VÀ KẾT QUẢ KIỂM TRA','Ghi chú / thông số đo','Người xác nhận','Mã phiếu'])assert.ok(source.includes(label),label)
 assert.ok(styles.includes('#root .app-shell .checklist-print-sheet *{visibility:visible!important}'))
 assert.ok(styles.includes('#root .app-shell .checklist-workspace>.checklist-print-sheet{display:block!important;visibility:visible!important'))
 assert.match(styles,/\.checklist-print-sheet \.checklist-print-table thead\{display:table-header-group\}/)
 assert.match(styles,/\.checklist-print-sheet \.checklist-print-table thead\{display:table-header-group\}/)
})


test('system Checklist starter templates have at least five meaningful criteria and a third Bỏ qua answer',()=>{
  const categoryBlock=panel.split('const CATEGORIES:')[1]?.split('const CATEGORY_LABEL')[0]||''
  for(const key of ["infrastructure","electrical","water","fire"]){
    const entry=categoryBlock.split("key:'"+key+"'")[1]?.split("},")[0]||''
    assert.ok((entry.match(/\?'/g)||[]).length>=5, key+' must have at least five criteria')
  }
  assert.match(panel,/Mẫu Checklist theo hệ thống phải có tối thiểu 5 tiêu chí kiểm tra/)
  assert.match(panel,/\['Đạt','Không đạt','Bỏ qua'\]/)
  assert.match(db,/'Bỏ qua'/)
  assert.match(panel,/answer\.result==='Bỏ qua'\|\|answer\.result==='Không áp dụng'/)
})

test('Checklist manual execution is available on PC when authorized and online, but remains locked offline',()=>{
  assert.match(panel,/const canExecuteHere=canExecute&&canManage&&isOnline/)
  assert.doesNotMatch(panel,/const canExecuteHere=[^\\n]*isPcPlatform/)
  assert.match(panel,/window\.addEventListener\('offline',updateOnline\)/)
  assert.match(panel,/disabled=\{!canExecuteHere\}/)
  assert.match(panel,/Checklist có thể thực hiện thủ công trên PC và điện thoại/)
  assert.match(panel,/Mất kết nối Internet\. Các thao tác thực hiện Checklist đã bị khóa/)
  assert.match(panel,/const runManagementAction=async/)
  assert.match(panel,/setError\(cause instanceof Error\?cause\.message:String\(cause\)\);setSavingRun\(false\);await refresh\(\);return/)
})


test('Admin is warned before legacy local Checklist data is hidden by the Cloud source switch',()=>{
  assert.match(panel,/db\.checklistRuns\.where\('organizationId'\)\.equals\(organizationId\)\.count\(\)/)
  assert.match(panel,/Phát hiện dữ liệu Checklist cũ chỉ lưu trên trình duyệt này/)
  assert.match(panel,/chưa được chuyển lên Cloud/)
  assert.match(panel,/Không xóa dữ liệu trình duyệt/)
})

test('Checklist Cloud is the live organization source and execution writes use server RPCs',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  assert.match(panel,/loadChecklistCloud\(supabase,organizationId,canManage,ensureCloudSchedule\)/)
  assert.match(panel,/saveChecklistDefinition\(supabase,organizationId/)
  assert.match(panel,/completeChecklistTask\(supabase,organizationId/)
  assert.match(panel,/completeChecklistManualRun\(supabase,organizationId/)
  assert.match(cloud,/checklist_save_definition/)
  assert.match(cloud,/checklist_ensure_occurrences/)
  assert.match(cloud,/checklist_claim_task/)
  assert.match(cloud,/checklist_complete_task/)
  assert.match(cloud,/navigator\.onLine/ )
  assert.match(cloud,/minimumDueAt,true/)
  assert.match(cloud,/order\('id',\{ascending:true\}\)/)
  assert.match(cloud,/range\(offset,offset\+PAGE_SIZE-1\)/)
  assert.match(cloud,/Date\.now\(\)-366\*86400000/)
})



test('Cloud recurrence generation covers old daily, weekly, monthly, quarterly and yearly schedules within the supported window',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  assert.match(cloud,/function calendarDayDistance/)
  assert.match(cloud,/const cutoff=new Date\(Date\.now\(\)-366\*86400000\)/)
  assert.match(cloud,/calendarDayDistance\(first,cutoff\)/)
  assert.match(cloud,/const monthDelta=\(cutoff\.getFullYear\(\)-anchor\.getFullYear\(\)\)\*12/)
  assert.match(cloud,/Math\.floor\(monthDelta\/3\)-1/)
  assert.match(cloud,/for\(let d=first;d<=end;index\+\+,d=addMonths\(anchor,index\*3,time\)\)/)
})

test('Equipment QR lookup uses the target identity captured by each task version',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  const panel=await readFile(new URL('../src/ChecklistPanel.tsx',import.meta.url),'utf8')
  const db=await readFile(new URL('../src/db.ts',import.meta.url),'utf8')
  const migration=await readFile(new URL('../docs/drafts/20261126225000_checklist_task_snapshot_target_identity.sql',import.meta.url),'utf8')
  assert.match(migration,/'targetAssetId',v_definition\.target_asset_id/)
  assert.match(cloud,/targetAssetId:String\(snapshot\.targetAssetId\|\|snapshot\.target_asset_id\|\|definition\?\.targetAssetId\)/)
  assert.match(panel,/targetAssetId:task\.definitionSnapshot\.targetAssetId/)
  assert.match(db,/targetAssetId\?: string/)
})

test('Manual Checklist saves are idempotent across a timed-out response and retry',async()=>{
  const panel=await readFile(new URL('../src/ChecklistPanel.tsx',import.meta.url),'utf8')
  const migration=await readFile(new URL('../docs/drafts/20261126227000_checklist_manual_run_idempotency_persist_run_id.sql',import.meta.url),'utf8')
  assert.match(panel,/run_id:runningRunId/)
  assert.match(panel,/disabled=\{!canExecuteHere\|\|savingRun\}/)
  assert.match(migration,/v_run_id uuid:=coalesce\(nullif\(p_payload->>'run_id',''\)::uuid,gen_random_uuid\(\)\)/)
  assert.match(migration,/select \* into v_existing from public\.checklist_runs where id=v_run_id/)
  assert.match(migration,/id,organization_id,definition_id,task_id/)
  assert.match(migration,/v_run_id,p_organization_id,v_definition\.id,null/)
})

test('QR scanner stops camera streams and pending animation loops when restarted or closed',async()=>{
  const scanner=await readFile(new URL('../src/ChecklistQrScanner.tsx',import.meta.url),'utf8')
  assert.match(scanner,/const activeRef=useRef\(false\)/)
  assert.match(scanner,/activeRef\.current=false/)
  assert.match(scanner,/streamRef\.current\?\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/)
  assert.match(scanner,/if\(!activeRef\.current\)\{stream\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\);return\}/)
})

test('Cloud template RPC refuses retired equipment as a target',async()=>{
  const migration=await readFile(new URL('../docs/drafts/20261126230000_checklist_equipment_target_must_be_active.sql',import.meta.url),'utf8')
  assert.match(migration,/a\.status<>'Thanh lý'/)
  assert.match(panel,/asset\.status!=='Thanh lý'/)
})

test('Checklist templates can be archived and restored without deleting history',async()=>{
  const migration=await readFile(new URL('../docs/drafts/20261126231000_checklist_template_soft_archive.sql',import.meta.url),'utf8')
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  const types=await readFile(new URL('../src/db.ts',import.meta.url),'utf8')
  assert.match(migration,/ADD COLUMN archived_at timestamptz/)
  assert.match(migration,/ADD COLUMN cancelled_at timestamptz/)
  assert.match(migration,/private\.archive_checklist_definition/)
  assert.match(migration,/private\.restore_checklist_definition/)
  assert.match(migration,/checklist_definition_versions/)
  assert.match(migration,/status='Đang thực hiện'/)
  assert.match(cloud,/checklist_archive_definition/)
  assert.match(cloud,/checklist_restore_definition/)
  assert.match(cloud,/!def\.archivedAt&&def\.enabled/)
  assert.match(cloud,/minimumDueAt,true/)
  assert.match(types,/archivedAt\?: string/)
  assert.match(types,/cancelledAt\?: string/)
  assert.match(panel,/Mẫu đã lưu trữ/)
  assert.match(panel,/Lưu trữ mẫu/)
  assert.match(panel,/Khôi phục mẫu/)
  assert.match(panel,/Lịch sử và kết quả cũ vẫn được giữ/)
})

test('Cloud template RPC rejects malformed or duplicate Checklist question identities',async()=>{
  const migration=await readFile(new URL('../docs/drafts/20261126229000_checklist_definition_question_validation.sql',import.meta.url),'utf8')
  assert.match(migration,/jsonb_array_elements\(v_questions\)/)
  assert.match(migration,/count\(distinct q->>'id'\)/)
  assert.match(migration,/jsonb_typeof\(q->'required'\)<>'boolean'/)
  assert.match(migration,/char_length\(q->>'label'\)>1000/)
})

test('Equipment Checklist manual RPC is enabled while completed task history uses the immutable task snapshot',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261127050000_checklist_allow_manual_equipment_execution.sql',import.meta.url),'utf8')
  assert.doesNotMatch(migration,/v_definition\.target_kind='equipment'/)
  assert.doesNotMatch(migration,/phải được mở từ lượt công việc sau khi quét QR/)
  assert.match(migration,/v_definition\.questions/)
  assert.match(migration,/v_run_id uuid:=coalesce\(nullif\(p_payload->>'run_id',''\)::uuid,gen_random_uuid\(\)\)/)
  assert.match(migration,/v_definition\.id,null/)
})

test('Equipment Checklist can be executed manually on PC and mobile while QR scanning is temporarily disabled',async()=>{
  assert.doesNotMatch(panel,/ChecklistQrScanner/)
  assert.doesNotMatch(panel,/Quét QR thiết bị/)
  assert.match(panel,/Checklist có thể thực hiện thủ công trên PC và điện thoại/)
  assert.match(panel,/!groupTask&&directAllowed/)
  assert.match(panel,/Thực hiện thủ công/ )
  assert.match(panel,/const canExecuteHere=canExecute&&canManage&&isOnline/)
})

test('Equipment and system Checklist tasks both use the manual execution flow',async()=>{
  assert.doesNotMatch(panel,/handleQrDetected/)
  assert.doesNotMatch(panel,/ChecklistQrScanner/)
  assert.match(panel,/!groupTask&&directAllowed/)
  assert.match(panel,/Thực hiện thủ công/ )
  assert.match(panel,/const beginTask=async\(task:ChecklistTask,item:ChecklistDefinition\)/)
})

test('phase-one Checklist assignment remains Admin-only in UI and server RPC',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  const scannerPanel=panel
  const guards=await readFile(new URL('../docs/drafts/20261126205000_checklist_phase_one_admin_only_guards.sql',import.meta.url),'utf8')
  assert.match(guards,/not private\.has_org_role\(p_organization_id,'admin'\)/)
  assert.match(guards,/assignee.*Admin/)
  assert.match(scannerPanel,/value="Admin" readOnly/)
  assert.match(scannerPanel,/assignee:organizationId==='local-preview'\?assignee:'Admin'/)
  assert.match(cloud,/checklist_save_definition/)
  assert.match(cloud,/checklist_claim_task/)
})


test('Checklist Không đạt creates a real linked Cloud maintenance request idempotently',async()=>{
  const panel=await readFile(new URL('../src/ChecklistPanel.tsx',import.meta.url),'utf8')
  const cloud=await readFile(new URL('../src/lib/maintenanceCloud.ts',import.meta.url),'utf8')
  const migration=await readFile(new URL('../supabase/migrations/20261126162954_checklist_to_cloud_maintenance_requests.sql',import.meta.url),'utf8')
  assert.match(panel,/createMaintenanceRequestFromChecklist\(supabase,organizationId,savedCloudRunId\)/)
  assert.match(panel,/Tạo Phiếu yêu cầu từ Checklist này/)
  assert.match(cloud,/maintenance_create_request_from_checklist/)
  assert.match(migration,/maintenance_requests_checklist_run_unique/)
  assert.match(migration,/maintenance_request_id=v_request\.id/)
  assert.match(migration,/private\.has_org_permission\(p_organization_id,'maintenance\.create'\)/)
})

test('Cloud maintenance requests and scheduled tasks are tenant-scoped, audited and reported by period',async()=>{
  const panel=await readFile(new URL('../src/MaintenancePanel.tsx',import.meta.url),'utf8')
  const cloud=await readFile(new URL('../src/lib/maintenanceCloud.ts',import.meta.url),'utf8')
  const report=await readFile(new URL('../src/ReportsPanel.tsx',import.meta.url),'utf8')
  const tableMigration=await readFile(new URL('../supabase/migrations/20261126162954_checklist_to_cloud_maintenance_requests.sql',import.meta.url),'utf8')
  const requestMigration=await readFile(new URL('../supabase/migrations/20261126163024_maintenance_request_cloud_rpcs.sql',import.meta.url),'utf8')
  const scheduleMigration=await readFile(new URL('../supabase/migrations/20261126163513_maintenance_schedule_cloud_rpcs.sql',import.meta.url),'utf8')
  assert.match(panel,/loadMaintenanceRequests\(supabaseClient,organizationId\)/)
  assert.match(panel,/saveMaintenanceRequest\(supabaseClient,organizationId,value/)
  assert.match(panel,/completeMaintenanceRequest\(supabaseClient,organizationId,row\.id/)
  assert.match(cloud,/maintenance_request_events/)
  assert.match(cloud,/maintenance_task_events/)
  assert.match(tableMigration,/alter table public\.maintenance_requests enable row level security/)
  assert.match(requestMigration,/maintenance_complete_request/)
  assert.match(scheduleMigration,/maintenance_update_task_status/)
  assert.match(report,/requestsCreatedInPeriod/)
  assert.match(report,/requestsCompletedInPeriod/)
  assert.match(report,/overdueMaintenanceRequests/)
  assert.match(report,/scheduledTasksInPeriod/)
})

test('Checklist execution remains permission-gated in the UI and Admin-guarded by server RPCs on every platform',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261126150817_checklist_phase_one_admin_only_guards.sql',import.meta.url),'utf8')
  assert.match(panel,/const canExecuteHere=canExecute&&canManage&&isOnline/)
  assert.doesNotMatch(panel,/const canExecuteHere=[^\\n]*isPcPlatform/)
  assert.match(app,/canManageChecklist=Boolean\(currentOrganization\?\.permissions\.includes\('checklist\.template\.manage'\)\)/)
  assert.match(app,/canExecuteChecklist=Boolean\(currentOrganization\?\.permissions\.includes\('checklist\.result\.create'\)\)/)
  assert.match(app,/canViewChecklist=Boolean\(currentOrganization\?\.permissions\.includes\('checklist\.view'\)\)/)
  assert.match(migration,/private\.has_org_role\(p_organization_id,'admin'\)/)
})
test('Checklist repair-request controls require maintenance.create permission',()=>{
  assert.match(app,/canCreateMaintenance=Boolean\(currentOrganization\?\.permissions\.includes\('maintenance\.create'\)\)/)
  assert.match(app,/canCreateMaintenance=\{localPreview\|\|canCreateMaintenance\}/)
  assert.match(panel,/if\(!canCreateMaintenance\|\|!supabase\|\|organizationId==='local-preview'/)
  assert.match(panel,/Tài khoản chưa có quyền tạo Phiếu yêu cầu/)
  assert.match(panel,/canCreateMaintenance&&!row\.maintenanceRequestId/)
})
test('Checklist missed-task reports load the selected historical period beyond the 366-day overview window',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  assert.match(cloud,/loadChecklistTasksForReport/)
  assert.match(cloud,/maximumDueAt/)
  assert.match(cloud,/new Date\(startDate\+'T00:00:00\+07:00'\)/)
  assert.match(panel,/reportTasksLoading/)
  assert.match(panel,/reportTasks\.filter\(item=>item\.status==='Không Checklist'/)
  assert.match(panel,/loadChecklistTasksForReport\(supabase,organizationId,reportRange\.start,reportRange\.end\)/)
})

test('Cloud Checklist status reflects the 24-hour missed-task rule even without an Admin refresh',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  assert.match(cloud,/GRACE_MS/)
  assert.match(cloud,/\['Chờ thực hiện','Đang thực hiện'\]\.includes\(String\(row\.status\)\)/)
  assert.match(cloud,/\?\s*'Không Checklist':row\.status/)
})


test('Legacy Checklist discovery inventories every Local organization scope, including local-preview, without modifying records',()=>{
  for(const table of ['checklistCategorySettings','checklistDefinitions','checklistRuns','checklistTasks']){
    assert.match(panel,new RegExp(table+"\\.orderBy\\('organizationId'\\)\\.uniqueKeys\\(\\)"))
    assert.match(panel,new RegExp(table+"\\.where\\('organizationId'\\)\\.equals\\(scope\\)\\.count\\(\\)"))
  }
  assert.match(panel,/legacyLocalScopes/)
  assert.match(panel,/scope\.organizationId==='local-preview'/)
  assert.match(panel,/chưa có dữ liệu nào được nhập, sửa hoặc xóa/)
})

test('Checklist release action requires the same execution permission and online guard in UI and handler',()=>{
  assert.match(panel,/const releaseTask=async\(taskId:string\)=>\{\s*if\(!canExecuteHere\)return/)
  assert.match(panel,/disabled=\{!canExecuteHere\} onClick=\{\(\)=>void releaseTask\(task\.id\)/)
})

test('QR scanner resets camera-ready UI when camera startup or detector initialization fails',async()=>{
  const scanner=await readFile(new URL('../src/ChecklistQrScanner.tsx',import.meta.url),'utf8')
  const catchStart=scanner.indexOf('}catch(cause){')
  assert.ok(catchStart>=0)
  assert.ok(scanner.slice(catchStart).includes('setCameraReady(false)'))
})

test('Cloud recurrence uses the configured execution time instead of silently falling back to 09:00',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  assert.ok(cloud.includes("match=/^(\\d{2}):(\\d{2})$/.exec(time)"))
  assert.ok(!cloud.includes("match=/^(\\\\d{2}):(\\\\d{2})$/.exec(time)"))
})

test('Archived Checklist task rows survive schedule refresh and template edits while new active occurrences can reuse the same due date',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261127032548_checklist_preserve_archived_task_history.sql',import.meta.url),'utf8')
  assert.match(migration,/create unique index if not exists checklist_tasks_active_definition_due_date_uidx[\s\S]*?where cancelled_at is null/i)
  assert.match(migration,/on conflict\(organization_id,definition_id,due_date\) where cancelled_at is null do nothing/i)
  assert.match(migration,/and t\.cancelled_at is null/)
  assert.match(migration,/and cancelled_at is null/)
  assert.match(migration,/a\.status<>'Thanh lý'/)
})

test('Scheduled Checklist completion reuses one stable run ID so a timed-out Cloud response can be retried safely',()=>{
  assert.match(panel,/setRunningRunId\(uid\(\)\)/)
  assert.match(panel,/run_id:runningRunId/)
  const migration=readFile(new URL('../supabase/migrations/20261127032700_checklist_task_run_idempotency.sql',import.meta.url),'utf8')
  return migration.then(sql=>{
    assert.match(sql,/v_run_id uuid:=coalesce\(nullif\(p_payload->>'run_id',''\)::uuid,gen_random_uuid\(\)\)/)
    assert.match(sql,/v_task\.run_id is distinct from v_run_id/)
    assert.match(sql,/return jsonb_build_object\([\s\S]*?'run_id',v_existing\.id/)
  })
})

test('Failed historical equipment Checklist retains its original asset target after the template is edited',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  assert.match(cloud,/function mapRun\(row: Row, organizationId: string, events: Row\[\], tasks: ChecklistTask\[\]\)/)
  assert.match(cloud,/task\?\.definitionSnapshot\.targetAssetId\?\{targetAssetId:task\.definitionSnapshot\.targetAssetId\}/)
  assert.match(panel,/Boolean\(row\.targetAssetId\)/)
  assert.doesNotMatch(panel,/Boolean\(definitions\.find\(item=>item\.id===row\.checklistId\)\?\.targetAssetId\)/)
})
 
test('equipment Checklist resolves the canonical Cloud asset UUID from the stable equipment code',async()=>{
  const cloud=await readFile(new URL('../src/lib/checklistCloud.ts',import.meta.url),'utf8')
  assert.match(db,/targetAssetCode\?: string/)
  assert.match(panel,/targetAssetCode:selectedAsset\?\.code/)
  assert.match(panel,/asset\.code===editing\?\.targetAssetCode/)
  assert.match(cloud,/loadDefinitionAssetCodes/)
  assert.match(cloud,/\.select\('id,code'\)\.eq\('organization_id',organizationId\)\.in\('id',ids\)/)
  assert.match(cloud,/\.eq\('code',definition\.targetAssetCode\)/)
  assert.match(cloud,/target_asset_id:cloudTargetAssetId/)
})
