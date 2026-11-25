import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

test('equipment detail print uses the shared organization and document header standard', () => {
  assert.match(app, /equipment-print-org-name/)
  assert.match(app, /currentOrganization\?\.name\|\|'Đơn vị sử dụng'/)
  assert.match(app, /BAOTRI MINI · BẢNG IN CHI TIẾT THIẾT BỊ/)
  assert.match(app, /BẢNG IN CHI TIẾT THIẾT BỊ/)
  assert.match(app, /equipment-print-qr/)
})

test('equipment print includes the full equipment profile and audit history', () => {
  for (const field of ['Mã quản lý','Người thêm','Nhóm thiết bị','Vị trí lắp đặt','Hãng sản xuất','Model','Số serial','Công suất / thông số','Ngày đưa vào sử dụng','Chu kỳ bảo trì','Ngày lưu kho','Chuyển từ cơ sở khác','Ngày tạo hồ sơ','Cập nhật lần cuối']) {
    assert.ok(app.includes(field), `missing equipment field: ${field}`)
  }
  assert.match(app, /assetHistory\.slice\(\)\.sort/)
  assert.match(app, /entry\.changes/)
  assert.match(app, /entry\.actorLabel/)
  assert.match(app, /Người yêu cầu in:/)
})

test('equipment detail print includes maintenance, repair requests and completed periodic maintenance tasks for the selected asset', () => {
  assert.match(app, /db\.maintenanceRequests\.where\('\[organizationId\+assetId\]'\)/)
  assert.match(app, /db\.maintenanceTasks\.where\('\[organizationId\+assetId\]'\)/)
  assert.match(app, /row\.status==='Hoàn thành'/)
  assert.match(app, /III\. LỊCH SỬ BẢO TRÌ, BẢO DƯỠNG – SỬA CHỮA/)
  assert.match(app, /row\.completionReadings/)
  assert.match(app, /row\.conditionAfterRepair/)
  assert.match(app, /Chưa có lịch sử bảo trì, bảo dưỡng hoặc sửa chữa/)
  assert.match(css, /\.equipment-print-maintenance thead\s*\{\s*display:table-header-group;/)
})

test('equipment print follows the inventory A4 portrait and multipage table conventions', () => {
  assert.match(css, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*14mm;/)
  assert.match(css, /\.equipment-print-history thead\s*\{\s*display:\s*table-header-group;/)
  assert.match(css, /\.equipment-print-history tr\s*\{\s*break-inside:\s*avoid;page-break-inside:\s*avoid;/)
  assert.match(css, /\.equipment-print-footer strong\s*\{[^}]*align-self:flex-end/s)
  const widths = ['5','15','17','43','20'].map((value,index) => {
    const match = css.match(new RegExp('\\.equipment-print-history th:nth-child\\('+(index+1)+'\\)\\s*\\{width:'+value+'%;'))
    assert.ok(match, `missing history column width ${value}%`)
    return Number(value)
  })
  assert.equal(widths.reduce((sum,value)=>sum+value,0),100)
})

test('equipment QR sticker keeps the QR and prints only the device ID and name to its right', () => {
  assert.ok(app.includes('className="asset-sticker-info"'))
  assert.ok(app.includes('<strong>{detailAsset.code}</strong>'))
  assert.ok(app.includes('<strong>{displayAssetName(detailAsset)}</strong>'))
  assert.ok(!app.includes('<small>MÃ ID</small>'))
  assert.ok(!app.includes('<small>TÊN THIẾT BỊ</small>'))
  assert.ok(css.includes('.asset-sticker-info{width:27mm'))
  assert.ok(css.includes('.asset-sticker-info strong{') && css.includes('overflow-wrap:anywhere'))
})

test('equipment list does not show a duplicate archive action; status remains managed in the equipment detail/editor', () => {
  assert.ok(!app.includes('onClick={()=>void archiveAsset(asset)}'))
  assert.ok(!app.includes('const archiveAsset = async (asset: Asset) =>'))
  assert.ok(app.includes('Thay đổi trạng thái'))
  assert.ok(app.includes("value={editing.archivedAt?'Lưu kho':editing.status}"))
  assert.ok(app.includes('const restoreAsset = async (asset: Asset) =>'))
})
