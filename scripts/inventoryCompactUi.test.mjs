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

test('inventory action menu is not clipped by its table frame', () => {
  assert.match(css, /\.inventory-desktop-table\{[\s\S]*?overflow:visible/)
  assert.match(css, /\.inventory-desktop-table tbody tr:has\(\.inventory-action-menu\[open\]\)/)
  assert.match(css, /\.inventory-action-menu>div\{[\s\S]*?z-index:30/)
})

test('modal and action-dialog close buttons share one consistent size', () => {
  assert.match(css, /\.modal-head>\.icon-btn,[\s\S]*?\.platform-action-head>\.icon-btn\{[\s\S]*?width:36px;[\s\S]*?height:36px;[\s\S]*?min-height:36px/)
})
