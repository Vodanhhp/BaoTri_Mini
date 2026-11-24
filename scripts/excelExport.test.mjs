import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
test('Excel workbook retains the legacy BAOTRI formatted report layout', async () => {
 const source=await read('../src/lib/excelExport.ts')
 assert.match(source,/addBanner\(title/);assert.match(source,/Ngày xuất:/);assert.match(source,/Tổng số bản ghi:/)
 assert.match(source,/worksheet\.autoFilter/);assert.match(source,/state: 'frozen', ySplit: 6/)
 assert.match(source,/orientation/);assert.match(source,/oddFooter = 'Trang &P \/ &N'/)
})
test('Excel headings are centered and column widths are more compact', async () => {
 const source=await read('../src/lib/excelExport.ts')
 assert.match(source,/horizontal: 'center', wrapText: true/)
 assert.match(source,/horizontal: 'center', wrapText: true/)
 assert.match(source,/orientation === 'portrait' \? 20 : 28/)
 assert.match(source,/Math\.max\(9, maxLength \+ 1\)/)
})
test('inventory export follows filtered items and includes quantity and stock value', async () => {
 const source=await read('../src/InventoryPanel.tsx')
 assert.match(source,/canExport&&<button[^]*?Xuất Excel/s);assert.match(source,/visibleItems\.map\(item=>/)
 assert.match(source,/'Tồn hiện tại':item\.quantity/);assert.match(source,/'Tồn tối thiểu':item\.minQuantity/)
 assert.match(source,/'Giá trị tồn':item\.quantity\*item\.unitPrice/)
})
test('asset export follows current filters and is restricted to Admin, KTV or Local Preview', async () => {
 const source=await read('../src/App.tsx')
 assert.match(source,/const canExport=Boolean\(localPreview\|\|currentOrganization\?\.isAdmin\|\|isKtv\)/)
 assert.match(source,/const rows=visibleAssets\.map\(asset=>/);assert.match(source,/'Ngày xóa mềm'/)
 assert.match(source,/'Chu kỳ bảo trì'/)
})
