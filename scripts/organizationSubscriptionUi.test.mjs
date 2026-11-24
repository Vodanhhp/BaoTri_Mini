import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('organization subscription history tables use compact responsive columns', async () => {
  const source = await read('../src/PlanChangePanels.tsx')
  const namePanel = await read('../src/OrganizationNameChangePanels.tsx')
  const css = await read('../src/style.css')
  assert.match(source, /reset-history-table-wrap/)
  assert.match(source, /reset-history-table/)
  assert.match(source, /plan-history-heading/)
  assert.match(source, /organization-change-grid/)
  assert.match(source, /OrganizationNameChangePanel/)
  assert.match(namePanel, /Gửi yêu cầu đổi tên/)
  assert.match(namePanel, /Tên hiện tại vẫn được giữ nguyên/)
  const section = css.slice(css.lastIndexOf('compact organization subscription and request history'))
  assert.match(section, /width:100%!important;min-width:0!important;table-layout:fixed!important/)
  assert.match(section, /reset-history-table th:nth-child\(4\)[\s\S]*width:44%/)
  assert.match(section, /plan-history-table th:nth-child\(3\)[\s\S]*width:37%/)
  assert.match(section, /organization-reset-request-section/)
  assert.match(section, /organization-change-grid/)
  assert.ok(section.includes('grid-template-columns:repeat(2,minmax(0,1fr))'))
  assert.match(section, /@media\(max-width:680px\)[\s\S]*reset-history-table\{min-width:0!important\}/)
})

test('subscription layout changes preserve request workflow handlers and warnings', async () => {
  const source = await read('../src/PlanChangePanels.tsx')
  assert.match(source, /action:'submit',organizationId,requestedPlanCode:targetPlan/)
  assert.match(source, /action:'submit',organizationId,note:note\.trim\(\)/)
  assert.match(source, /Tôi hiểu Reset là thao tác không thể hoàn tác/)
  assert.match(source, /Không có dữ liệu nào bị xóa khi gửi yêu cầu/)
  const namePanel = await read('../src/OrganizationNameChangePanels.tsx')
  assert.match(namePanel, /action:'submit',organizationId,requestedName:cleanName/)
})
