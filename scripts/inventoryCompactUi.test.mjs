import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../src/InventoryPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

test('inventory workspace uses compact page hierarchy and Local storage context', () => {
  assert.match(panel, /className="inventory-page-heading"/)
  assert.match(panel, /className="inventory-storage-pill"/)
  assert.match(panel, /Lưu tại thiết bị Local/)
  assert.doesNotMatch(panel, /className="welcome inventory-welcome"/)
})

test('inventory row actions are grouped in a single accessible disclosure menu', () => {
  assert.match(panel, /<details className="inventory-action-menu">/)
  assert.match(panel, /<summary>Thao tác/)
  assert.match(panel, /openMovement\(item,'Nhập'\)/)
  assert.match(panel, /openMovement\(item,'Xuất'\)/)
  assert.match(panel, /openMovement\(item,'Điều chỉnh'\)/)
  assert.match(panel, /openEdit\(item\)/)
  assert.match(panel, /archiveItem\(item\)/)
})

test('inventory styles define compact responsive hierarchy and action menu', () => {
  assert.match(css, /\.inventory-page-heading/)
  assert.match(css, /\.inventory-stat-card/)
  assert.match(css, /\.inventory-action-menu/)
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.inventory-page-heading/)
})

test('inventory action menu layering is scoped to the material list table only', () => {
  assert.match(css, /\.inventory-workspace > \.panel:has\(\.inventory-desktop-table\)[\s\S]*?\.inventory-desktop-table:has\(\.inventory-action-menu\[open\]\)\{[\s\S]*?overflow:visible/)
  assert.match(css, /\.inventory-workspace > \.panel:has\(\.inventory-desktop-table\)[\s\S]*?\.inventory-action-menu>div\{[\s\S]*?z-index:3/)
  assert.doesNotMatch(css, /\.inventory-desktop-table tbody tr:has\(\.inventory-action-menu\[open\]\)/)
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
