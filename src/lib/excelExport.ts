import { formatDateTimeVN } from './dateTime'

export type ExcelOrientation = 'portrait' | 'landscape'

function excelColumnName(column: number) {
  let value = column
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

export async function downloadExcelReport(
  rows: Record<string, string | number>[],
  filename: string,
  title: string,
  sheetName: string,
  headers: string[],
  orientation: ExcelOrientation = 'landscape',
  organizationName?: string
) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'BAOTRI'
  workbook.created = new Date()
  const worksheet = workbook.addWorksheet(sheetName)
  const headerNames = ['STT', ...headers]
  const bodyRows = rows.map((row, index) => [index + 1, ...headers.map(header => row[header] ?? '')])
  const preferredWidths: Record<string, number> = {
    'Ngày yêu cầu': 14,
    'Hạn hoàn thành': 14,
    'Ngày đến hạn': 14,
    'Mã thiết bị': 16,
    'Tên thiết bị': 24,
    'Loại yêu cầu': 16,
    'Nội dung': 32,
    'Thông số ban đầu': 25,
    'Thông số sau xử lý': 25,
    'Tình trạng sau xử lý': 28,
    'Vật tư / phụ tùng': 26,
    'Trạng thái': 16,
    'Kết quả': 22,
    'Người yêu cầu': 22,
    'Người hoàn thành': 22
  }
  const columnWidths = headerNames.map((header, column) => {
    const maxLength = Math.max(header.length, ...bodyRows.map(row => String(row[column] ?? '').split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0)))
    const maxWidth = orientation === 'portrait' ? 20 : 34
    const preferredWidth = preferredWidths[header]
    const calculatedWidth = Math.max(9, maxLength + 2)
    return column === 0 ? 6 : Math.min(maxWidth, preferredWidth ? Math.max(preferredWidth, Math.min(calculatedWidth, preferredWidth + 8)) : calculatedWidth)
  })
  worksheet.columns = columnWidths.map(width => ({ width }))

  const addBanner = (value: string, height: number, fill: string, fontColor: string, size: number, bold = false) => {
    const row = worksheet.addRow([value])
    worksheet.mergeCells(row.number, 1, row.number, headerNames.length)
    row.height = height
    const cell = row.getCell(1)
    cell.font = { name: 'Aptos', size, bold, color: { argb: fontColor } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  }

  addBanner(title, 32, 'FF155B4B', 'FFFFFFFF', 16, true)
  addBanner(organizationName?.trim() || 'BAOTRI · QUẢN LÝ BẢO TRÌ', 22, 'FFE6F2ED', 'FF155B4B', 10, true)
  addBanner(`Ngày xuất: ${formatDateTimeVN(new Date())}`, 20, 'FFF3F7F5', 'FF52645F', 10)
  addBanner(`Tổng số bản ghi: ${rows.length}`, 20, 'FFF3F7F5', 'FF52645F', 10)
  worksheet.addRow([])

  const headerRow = worksheet.addRow(headerNames)
  headerRow.height = 42
  headerRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF247763' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD6E4DF' } },
      bottom: { style: 'thin', color: { argb: 'FFD6E4DF' } },
      left: { style: 'thin', color: { argb: 'FFD6E4DF' } },
      right: { style: 'thin', color: { argb: 'FFD6E4DF' } }
    }
  })

  bodyRows.forEach((values, index) => {
    const row = worksheet.addRow(values)
    let maxLines = 1
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      const columnName = headerNames[column - 1]
      const text = String(cell.value ?? '')
      const isStatus = columnName.toLocaleLowerCase('vi').includes('trạng thái')
      const statusFill = isStatus
        ? text.includes('Chưa hoàn thành') ? 'FFFFF3DF' : text.includes('Hoàn thành') ? 'FFE7F4EC' : ''
        : ''
      cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF293B36' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill || (index % 2 === 0 ? 'FFFFFFFF' : 'FFF3F7F5') } }
      cell.alignment = { vertical: 'top', horizontal: column === 1 ? 'center' : typeof cell.value === 'number' ? 'right' : 'left', wrapText: true }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD6E4DF' } },
        left: { style: 'thin', color: { argb: 'FFD6E4DF' } },
        right: { style: 'thin', color: { argb: 'FFD6E4DF' } }
      }
      if (typeof cell.value === 'number') cell.numFmt = (columnName.includes('Đơn giá') || columnName.includes('Giá trị')) ? '#,##0 "₫"' : '#,##0.##'
      const lineCount = text.split(/\r?\n/).reduce((count, line) => count + Math.max(1, Math.ceil(line.length / Math.max(8, columnWidths[column - 1] - 2))), 0)
      maxLines = Math.max(maxLines, lineCount)
    })
    row.height = Math.min(120, Math.max(30, maxLines * 15))
  })

  worksheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, rows.length + 6), column: headerNames.length } }
  worksheet.views = [{ state: 'frozen', ySplit: 6 }]
  worksheet.properties.defaultRowHeight = 18
  worksheet.pageSetup = {
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${excelColumnName(headerNames.length)}${rows.length + 6}`,
    horizontalCentered: true,
    margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 }
  }
  worksheet.headerFooter.oddFooter = 'Trang &P / &N'
  const bytes = await workbook.xlsx.writeBuffer()
  const file = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
