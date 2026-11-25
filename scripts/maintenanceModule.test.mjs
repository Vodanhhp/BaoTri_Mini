import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('maintenance data is organization-scoped in Dexie without changing Cloud sync stores', async () => {
  const db = await read('../src/db.ts')
  assert.match(db, /export type MaintenanceRequest/)
  assert.match(db, /export type MaintenanceTask/)
  assert.match(db, /export type MaintenanceHistory/)
  assert.match(db, /this\.version\(12\)\.stores/)
  assert.match(db, /maintenanceRequests: 'id, organizationId, assetId, \[organizationId\+assetId\]/)
  assert.match(db, /maintenanceTasks: 'id, organizationId, assetId, \[organizationId\+assetId\]/)
  assert.match(db, /maintenanceHistory: 'id, organizationId, recordType, recordId/)
  assert.doesNotMatch(db, /maintenanceRequests.*syncQueue/)
})

test('maintenance request writes and status changes persist an audit event in the same transaction', async () => {
  const panel = await read('../src/MaintenancePanel.tsx')
  assert.match(panel, /db\.transaction\('rw',\[db\.maintenanceRequests,db\.maintenanceHistory\]/)
  assert.match(panel, /addHistory\('request',value\.id/)
  assert.match(panel, /addHistory\('request',row\.id,'completed'/)
  assert.match(panel, /requestedBy: userLabel/)
  assert.match(panel, /description\.trim\(\)/)
  assert.match(panel, /requestEditor\.assetId/)
})

test('maintenance module is read-only for Viewer and exposes pending requests in dashboard and equipment history', async () => {
  const app = await read('../src/App.tsx')
  const panel = await read('../src/MaintenancePanel.tsx')
  assert.match(app, /canManage=\{localPreview\|\|canMutate\}/)
  assert.match(app, /MaintenanceDashboardSummary/)
  assert.match(app, /MaintenanceAssetHistory/)
  assert.match(panel, /if\(!canView\)/)
  assert.match(panel, /if\(!requestEditor\|\|busy\|\|!canManage\)return/)
  assert.match(panel, /row\.status!=='Hoàn thành'/)
  assert.match(panel, /where\('\[organizationId\+assetId\]'\)/)
})

test('maintenance reload ignores stale IndexedDB reads after an organization switch', async () => {
  const panel = await read('../src/MaintenancePanel.tsx')
  assert.match(panel, /const reload = async \(isCurrent: \(\) => boolean = \(\) => true\)/)
  assert.match(panel, /if \(!isCurrent\(\)\) return/)
  assert.match(panel, /reload\(\(\)\s*=>\s*active\)/)
})

test('maintenance exports real XLSX workbooks instead of CSV files', async () => {
  const panel = await read('../src/MaintenancePanel.tsx')
  const packageJson = JSON.parse(await read('../package.json'))
  const exporter = await read('../src/lib/excelExport.ts')
  assert.match(panel, /downloadExcelReport/)
  assert.match(exporter, /workbook\.xlsx\.writeBuffer\(\)/)
  assert.match(exporter, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/)
  assert.match(exporter, /worksheet\.pageSetup/)
  assert.match(exporter, /worksheet\.headerFooter\.oddFooter/)
  assert.match(panel, /phieu-bao-duong-sua-chua\.xlsx/)
  assert.match(panel, /lich-bao-duong-dinh-ky\.xlsx/)
  assert.match(panel, /Xuất Excel/)
  assert.match(panel, /In phiếu/)
  assert.match(panel, /maintenance-print-sheet/)
  assert.match(panel, /maintenance-print-signatures/)
  assert.match(panel, /organizationName/)
  assert.doesNotMatch(panel, /Xuất CSV Excel|text\/csv|\.csv['"]/)
  assert.ok(packageJson.dependencies.exceljs, 'ExcelJS must be an installed runtime dependency')
  const styles = await read('../src/style.css')
  assert.match(styles, /@page\s*\{size:A4 portrait/)
  assert.match(styles, /\.maintenance-print-sheet,\.maintenance-print-sheet \*\s*\{visibility:visible/)
})


test('maintenance tables and actions remain usable on narrow mobile screens', async () => {
  const styles = await read('../src/style.css')
  assert.ok(styles.includes('min-width:1060px!important;\n  table-layout:auto!important;'))
  assert.ok(styles.includes('overflow-wrap:normal!important;\n  word-break:normal!important;'))
  assert.ok(styles.includes('grid-template-columns:repeat(2,minmax(0,1fr));'))
  assert.ok(styles.includes('Vuốt ngang bảng để xem các cột còn lại'))
})


test('a request cannot be completed without post-work readings and equipment condition', async () => {
  const db = await read('../src/db.ts')
  const panel = await read('../src/MaintenancePanel.tsx')
  assert.match(db, /completionReadings\?: string; conditionAfterRepair\?: string/)
  assert.match(panel, /const saveCompletion = async/)
  assert.match(panel, /if\(!performedBy\|\|!completionReadings\|\|!conditionAfterRepair\|\|!completionEditor\.result\)/)
  assert.match(panel, /Thông số sau sửa chữa \/ bảo dưỡng \*/)
  assert.match(panel, /Tình trạng thiết bị sau sửa chữa \/ bảo dưỡng \*/)
  assert.match(panel, /setCompletionEditor\(null\);await reload\(\)/)
  assert.match(panel, /completionReadings,conditionAfterRepair,completedAt:now\(\)/)
})
