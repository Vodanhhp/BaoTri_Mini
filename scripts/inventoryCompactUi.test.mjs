import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../src/InventoryPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

test('inventory workspace uses compact page hierarchy and Local storage context', () => {
  assert.match(panel, /className="welcome inventory-welcome"/)
  assert.match(panel, /className="inventory-storage-pill"/)
  assert.match(panel, /Lưu tại thiết bị Local/)
  assert.match(panel, /Tự đồng bộ Cloud khi có mạng/)
  assert.match(panel, /Chỉ dùng trên thiết bị này/)
  assert.doesNotMatch(panel, /Cloud chưa bật/)
  assert.doesNotMatch(panel, /className="inventory-page-heading"/)
})

test('inventory row actions are grouped in a single accessible disclosure menu', () => {
  assert.match(panel, /<details className="inventory-action-menu">/)
  assert.match(panel, /<summary>Thao tác/)
  assert.match(panel, /currentTarget\.closest\('details'\)\?\.removeAttribute\('open'\);openMovement\(item,'Nhập'\)/)
  assert.match(panel, /currentTarget\.closest\('details'\)\?\.removeAttribute\('open'\);openMovement\(item,'Xuất'\)/)
  assert.match(panel, /currentTarget\.closest\('details'\)\?\.removeAttribute\('open'\);openMovement\(item,'Điều chỉnh'\)/)
  assert.match(panel, /currentTarget\.closest\('details'\)\?\.removeAttribute\('open'\);openEdit\(item\)/)
  assert.match(panel, /currentTarget\.closest\('details'\)\?\.removeAttribute\('open'\);void archiveItem\(item\)/)
})

test('inventory styles define compact responsive hierarchy and action menu', () => {
  assert.match(css, /\.inventory-page-heading/)
  assert.match(css, /\.inventory-stat-card/)
  assert.match(css, /\.inventory-action-menu/)
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.inventory-page-heading/)
})

test('inventory action menu layering is scoped to the material list table only', () => {
  assert.match(css, /\.inventory-catalog-panel > \.inventory-catalog-wrap:has\(\.inventory-action-menu\[open\]\)[\s\S]*?overflow:visible/)
  assert.match(css, /\.inventory-catalog-panel \.inventory-action-menu>div\{[\s\S]*?z-index:3/)
  assert.doesNotMatch(css, /\.inventory-workspace > \.panel:has\(\.inventory-desktop-table\)/)
})

test('modal and action-dialog close buttons share one consistent frame and glyph size', () => {
  assert.match(css, /\.modal-head>\.icon-btn,[\s\S]*?\.platform-action-head>\.icon-btn\{[\s\S]*?width:36px;[\s\S]*?height:36px;[\s\S]*?font-size:22px/)
  assert.match(css, /\.modal-head>\.icon-btn svg,[\s\S]*?\.platform-action-head>\.icon-btn svg\{[\s\S]*?width:18px!important;[\s\S]*?height:18px!important/)
})


test('inventory catalog table has explicit column proportions and isolated menu overflow scope', () => {
  assert.match(panel, /className="panel inventory-catalog-panel"/)
  assert.match(panel, /inventory-desktop-table inventory-catalog-wrap/)
  assert.match(panel, /inventory-catalog-table/)
  assert.match(panel, /<colgroup>[\s\S]*col-material[\s\S]*col-actions/)
  assert.match(css, /\.inventory-catalog-table \.col-material\{width:22%\}/)
  assert.match(css, /\.inventory-catalog-table \.col-actions\{width:18%\}/)
  assert.match(css, /\.inventory-catalog-panel > \.inventory-catalog-wrap:has\(\.inventory-action-menu\[open\]\)/)
  assert.doesNotMatch(css, /\.inventory-workspace > \.panel:has\(\.inventory-desktop-table\)/)
})


test('inventory movement history uses compact fixed columns instead of the wide table minimum', () => {
  assert.match(panel, /inventory-history-wrap/)
  assert.match(panel, /inventory-history-table/)
  assert.match(panel, /history-date[\s\S]*history-user/)
  assert.match(css, /\.inventory-history-table\{[\s\S]*?min-width:0!important;[\s\S]*?table-layout:fixed/)
  assert.match(css, /\.inventory-history-table \.history-reason\{width:17%\}/)
  assert.match(css, /\.inventory-history-table :is\(th,td\)[\s\S]*?padding:7px 8px/)
})

test('mobile hamburger toggle is hidden on desktop despite generic icon button styles', () => {
  assert.match(css, /@media\(min-width:681px\)[\s\S]*?\.topbar>\.mobile-menu-toggle\{display:none!important\}/)
})


test('inventory catalog prioritizes material name and shows code as secondary text on desktop and mobile', () => {
  assert.match(panel, /<td><button type="button" className="inventory-name-link" onClick={\(\)=>setSelected\(item\)}><b>\{item\.name\}<\/b><small>\{item\.code\}<\/small><\/button><\/td>/)
  assert.match(panel, /className="inventory-name-link" onClick=\{\(\)=>setSelected\(item\)\}><b>\{item\.name\}<\/b><small>\{item\.code\}<\/small><\/button>/)
  assert.match(css, /inventory-catalog-table \.inventory-name-link b\{font-size:13px/)
  assert.match(css, /inventory-catalog-table \.inventory-name-link small\{font-size:10px/)
  assert.match(css, /inventory-mobile-card-head \.inventory-name-link b\{font-size:13px/)
  assert.match(css, /inventory-mobile-card-head \.inventory-name-link small\{font-size:10px/)
})


test('inventory action menu and mobile actions expose a printable A4 material sheet with complete movement history', () => {
  assert.match(panel, /setPrintItem\(item\)/)
  assert.match(panel, /PHIẾU THÔNG TIN VẬT TƯ/)
  assert.match(panel, /printItem\.partNumber/)
  assert.match(panel, /printItem\.size/)
  assert.match(panel, /printItem\.supplier/)
  assert.match(panel, /printItem\.archivedAt/)
  assert.match(panel, /movement\.balanceBefore/)
  assert.match(panel, /movement\.balanceAfter/)
  assert.match(panel, /movement\.performedBy/)
  assert.match(panel, /Kiểm kê \/ điều chỉnh/)
  assert.match(css, /@page\{size:A4 portrait/)
  assert.match(css, /inventory-print-history thead\{display:table-header-group\}/)
  assert.match(css, /inventory-print-history tr\{break-inside:avoid/)
})


test('inventory print sheet gives the date-time column room and identifies organization and print requester', () => {
  assert.match(panel, /organizationName: string/)
  assert.match(panel, /userRoleLabel: string/)
  assert.match(panel, /organizationName\|\|'ĐƠN VỊ \/ DOANH NGHIỆP'/)
  assert.match(panel, /Người yêu cầu in:/)
  assert.match(panel, /userRoleLabel.*userLabel/)
  assert.match(css, /inventory-print-history th:nth-child\(2\)\{width:14%\}/)
  assert.match(css, /inventory-print-history th:nth-child\(3\)\{width:16%\}/)
  assert.match(css, /inventory-print-history th:nth-child\(5\),\.inventory-print-history th:nth-child\(6\)\{width:9%\}/)
  assert.match(css, /inventory-print-history td:nth-child\(2\)\{white-space:normal/)
  assert.match(css, /inventory-print-footer strong\{align-self:flex-end/)
  assert.match(css, /inventory-print-footer\{display:flex;flex-direction:column;align-items:stretch;gap:12px/)
})
