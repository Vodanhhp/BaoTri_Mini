import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dateTime = read('src/lib/dateTime.ts')

test('Vietnam date/time helpers pin every formatter to Asia/Ho_Chi_Minh', () => {
  assert.match(dateTime, /VIETNAM_TIME_ZONE = 'Asia\/Ho_Chi_Minh'/)
  assert.equal((dateTime.match(/timeZone: VIETNAM_TIME_ZONE/g) || []).length, 3)
  assert.match(dateTime, /T00:00:00\+07:00/)
  assert.match(dateTime, /hourCycle: 'h23'/)
})

test('date-only values and today limits use Vietnam calendar dates', () => {
  assert.match(dateTime, /export function todayVNDateInput/)
  assert.match(read('src/AccountProfilePanel.tsx'), /todayVNDateInput\(\)/)
  assert.doesNotMatch(read('src/AccountProfilePanel.tsx'), /toISOString\(\)\.slice\(0,10\)/)
  assert.match(read('src/App.tsx'), /formatDateVN/)
})

test('date/time displays across equipment, inventory, cloud and admin screens use shared Vietnam formatters', () => {
  for (const path of [
    'src/App.tsx',
    'src/InventoryPanel.tsx',
    'src/CloudAssetsPanel.tsx',
    'src/OrganizationMembersPanel.tsx',
    'src/PlatformAdminPanel.tsx',
    'src/PlanChangePanels.tsx',
    'src/lib/cloudAssets.ts',
    'src/lib/excelExport.ts',
  ]) {
    const source = read(path)
    assert.match(source, /formatDate(?:Time)?VN/, path + ' must use Vietnam date/time helpers')
    assert.doesNotMatch(source, /toLocaleDateString\('vi-VN'\)|toLocaleString\('vi-VN'\)/, path + ' must not rely on the device timezone')
  }
})


test('inventory movement calendar date is always derived from Vietnam timezone', () => {
  const inventory = read('src/lib/inventory.ts')
  assert.match(inventory, /import \{ todayVNDateInput \} from '\.\/dateTime'/)
  assert.match(inventory, /function localDate\(\): string \{\s*return todayVNDateInput\(\)\s*\}/)
  assert.doesNotMatch(inventory, /date\.getFullYear\(\)|date\.getMonth\(\)|date\.getDate\(\)/)
})

test('equipment archived/deleted timestamps are formatted as instants, not truncated UTC dates', () => {
  const app = read('src/App.tsx')
  assert.doesNotMatch(app, /(?:archivedAt|deletedAt)\.slice\(0,\s*10\)/)
  assert.match(app, /dateText\(asset\.archivedAt\)/)
  assert.match(app, /dateText\(asset\.deletedAt\)/)
  assert.match(app, /dateText\(detailAsset\.archivedAt\)/)
})
