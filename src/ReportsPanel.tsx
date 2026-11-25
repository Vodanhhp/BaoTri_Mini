import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, FileSpreadsheet, ShieldAlert } from 'lucide-react'
import { db, type Asset, type InventoryItem, type InventoryMovement, type MaintenanceRequest } from './db'
import { downloadExcelReport } from './lib/excelExport'

type Period = 'Tuần' | 'Tháng' | 'Quý' | 'Năm'
type Props = {
  organizationId: string
  assets: Asset[]
  canViewAssets: boolean
  canViewInventory: boolean
  canExport: boolean
}

function periodRange(period: Period, anchor: string) {
  const date = new Date(anchor.slice(0, 10) + 'T00:00:00.000Z')
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  let start: Date
  let end: Date
  if (period === 'Tuần') {
    start = new Date(date)
    start.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
    end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
  } else if (period === 'Tháng') {
    start = new Date(Date.UTC(year, month, 1))
    end = new Date(Date.UTC(year, month + 1, 0))
  } else if (period === 'Quý') {
    const firstMonth = Math.floor(month / 3) * 3
    start = new Date(Date.UTC(year, firstMonth, 1))
    end = new Date(Date.UTC(year, firstMonth + 3, 0))
  } else {
    start = new Date(Date.UTC(year, 0, 1))
    end = new Date(Date.UTC(year, 11, 31))
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

function rangeLabel(period: Period, range: { startDate: string; endDate: string }) {
  const format = (value: string) => new Date(value + 'T00:00:00').toLocaleDateString('vi-VN')
  if (period === 'Tuần') return 'Tuần ' + format(range.startDate) + ' – ' + format(range.endDate)
  if (period === 'Tháng') return 'Tháng ' + range.startDate.slice(5, 7) + '/' + range.startDate.slice(0, 4)
  if (period === 'Quý') return 'Quý ' + (Math.floor((Number(range.startDate.slice(5, 7)) - 1) / 3) + 1) + '/' + range.startDate.slice(0, 4)
  return 'Năm ' + range.startDate.slice(0, 4)
}

const dateLabel = (value?: string) => value ? new Date(value.slice(0, 10) + 'T00:00:00').toLocaleDateString('vi-VN') : '—'
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' đ'

export default function ReportsPanel({ organizationId, assets, canViewAssets, canViewInventory, canExport }: Props) {
  const [period, setPeriod] = useState<Period>('Tháng')
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().slice(0, 10))
  const [search, setSearch] = useState('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    if (!organizationId) {
      setInventory([])
      setMovements([])
      setRequests([])
      return () => { active = false }
    }
    setLoadError('')
    void Promise.all([
      db.inventoryItems.where('organizationId').equals(organizationId).toArray(),
      db.inventoryMovements.where('organizationId').equals(organizationId).toArray(),
      db.maintenanceRequests.where('organizationId').equals(organizationId).toArray()
    ]).then(([items, rows, work]) => {
      if (!active) return
      setInventory(items.filter(item => !item.archivedAt))
      setMovements(rows)
      setRequests(work)
    }).catch(error => {
      if (!active) return
      setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu báo cáo từ Local.')
      setInventory([])
      setMovements([])
      setRequests([])
    })
    return () => { active = false }
  }, [organizationId])

  const range = useMemo(() => periodRange(period, anchorDate), [period, anchorDate])
  const query = search.trim().toLocaleLowerCase('vi')
  const visibleAssets = useMemo(() => assets.filter(asset => !asset.archivedAt && !asset.deletedAt), [assets])
  const brokenAssets = useMemo(() => visibleAssets.filter(asset => asset.status === 'Đang sửa chữa'), [visibleAssets])
  const completedRequests = useMemo(() => requests
    .filter(row => row.status === 'Hoàn thành')
    .filter(row => {
      const completedDate = (row.completedAt || row.updatedAt || row.requestDate).slice(0, 10)
      return completedDate >= range.startDate && completedDate <= range.endDate
    })
    .filter(row => {
      const asset = assets.find(item => item.id === row.assetId)
      return (row.kind + ' ' + row.description + ' ' + (asset?.code || '') + ' ' + (asset?.name || '') + ' ' + row.performedBy).toLocaleLowerCase('vi').includes(query)
    })
    .sort((a, b) => (b.completedAt || b.updatedAt).localeCompare(a.completedAt || a.updatedAt)), [requests, range, query, assets])
  const materialUsage = useMemo(() => {
    const grouped = new Map<string, { itemId: string; quantity: number; transactions: number }>()
    for (const movement of movements) {
      if (movement.type !== 'Xuất' || movement.date < range.startDate || movement.date > range.endDate) continue
      const row = grouped.get(movement.itemId) || { itemId: movement.itemId, quantity: 0, transactions: 0 }
      row.quantity += movement.quantity
      row.transactions += 1
      grouped.set(movement.itemId, row)
    }
    return [...grouped.values()].map(row => {
      const item = inventory.find(value => value.id === row.itemId)
      return { ...row, item }
    }).filter(row => ((row.item?.code || '') + ' ' + (row.item?.name || '') + ' ' + (row.item?.group || '')).toLocaleLowerCase('vi').includes(query))
      .sort((a, b) => (a.item?.name || a.itemId).localeCompare(b.item?.name || b.itemId, 'vi'))
  }, [movements, inventory, range, query])

  const exportWork = () => downloadExcelReport(completedRequests.map(row => {
    const asset = assets.find(item => item.id === row.assetId)
    return {
      'Ngày hoàn thành': dateLabel(row.completedAt || row.updatedAt),
      'Mã thiết bị': asset?.code || '',
      'Tên thiết bị': asset?.name || 'Thiết bị không còn trong danh mục',
      'Loại công việc': row.kind,
      'Nội dung đã thực hiện': row.description,
      'Vật tư ghi trên phiếu': row.parts || '',
      'Người thực hiện': row.performedBy || '',
      'Kết quả': row.result || ''
    }
  }), 'bao-cao-cong-viec-' + range.startDate + '.xlsx', 'BÁO CÁO CÔNG VIỆC BẢO TRÌ · ' + rangeLabel(period, range).toLocaleUpperCase('vi'), 'Công việc bảo trì', ['Ngày hoàn thành','Mã thiết bị','Tên thiết bị','Loại công việc','Nội dung đã thực hiện','Vật tư ghi trên phiếu','Người thực hiện','Kết quả'], 'landscape')

  const exportMaterials = () => downloadExcelReport(materialUsage.map(row => ({
    'Mã vật tư': row.item?.code || 'Không còn trong danh mục',
    'Tên vật tư': row.item?.name || row.itemId,
    'Nhóm vật tư': row.item?.group || '',
    'ĐVT': row.item?.unit || '',
    'Số lượng xuất trong kỳ': row.quantity,
    'Số lượt xuất': row.transactions,
    'Tồn kho hiện tại': row.item?.quantity ?? '—',
    'Vị trí lưu kho': row.item?.location || ''
  })), 'bao-cao-vat-tu-' + range.startDate + '.xlsx', 'BÁO CÁO SỬ DỤNG VẬT TƯ · ' + rangeLabel(period, range).toLocaleUpperCase('vi'), 'Vật tư sử dụng', ['Mã vật tư','Tên vật tư','Nhóm vật tư','ĐVT','Số lượng xuất trong kỳ','Số lượt xuất','Tồn kho hiện tại','Vị trí lưu kho'], 'landscape')

  const exportAssets = () => downloadExcelReport(visibleAssets.map(asset => ({
    'Mã thiết bị': asset.code,
    'Tên thiết bị': asset.name,
    'Nhóm thiết bị': asset.category,
    'Vị trí': asset.location,
    'Tình trạng hiện tại': asset.status,
    'Ngày cập nhật': dateLabel(asset.updatedAt)
  })), 'bao-cao-tinh-trang-thiet-bi-' + new Date().toISOString().slice(0, 10) + '.xlsx', 'BÁO CÁO TÌNH TRẠNG THIẾT BỊ · ' + dateLabel(new Date().toISOString()), 'Tình trạng thiết bị', ['Mã thiết bị','Tên thiết bị','Nhóm thiết bị','Vị trí','Tình trạng hiện tại','Ngày cập nhật'], 'landscape')

  return <div className="reports-dashboard">
    <section className="panel report-period-panel">
      <div className="panel-head"><div><h2>Báo cáo hoạt động thực tế</h2><p>Thống kê phiếu đã hoàn thành và vật tư đã xuất kho; không tính kế hoạch dự kiến.</p></div><BarChart3/></div>
      <div className="report-period-tabs" role="tablist" aria-label="Kỳ báo cáo">
        {(['Tuần','Tháng','Quý','Năm'] as Period[]).map(value => <button type="button" role="tab" aria-selected={period === value} key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value}</button>)}
      </div>
      <div className="report-period-toolbar">
        <div className="plan-period-picker">
          {period === 'Tuần' && <label className="plan-period-control"><span>Chọn ngày trong tuần</span><input type="date" value={anchorDate} onChange={event => event.target.value && setAnchorDate(event.target.value)}/></label>}
          {period === 'Tháng' && <label className="plan-period-control"><span>Chọn tháng</span><input type="month" value={anchorDate.slice(0, 7)} onChange={event => event.target.value && setAnchorDate(event.target.value + '-01')}/></label>}
          {period === 'Quý' && <><label className="plan-period-control"><span>Năm</span><select value={anchorDate.slice(0, 4)} onChange={event => setAnchorDate(event.target.value + '-' + anchorDate.slice(5, 7) + '-01')}>{Array.from({length: 101}, (_, index) => String(2000 + index)).map(year => <option key={year}>{year}</option>)}</select></label><label className="plan-period-control"><span>Quý</span><select value={Math.floor((Number(anchorDate.slice(5, 7)) - 1) / 3) + 1} onChange={event => setAnchorDate(anchorDate.slice(0, 4) + '-' + String((Number(event.target.value) - 1) * 3 + 1).padStart(2, '0') + '-01')}>{[1,2,3,4].map(value => <option key={value} value={value}>Quý {value}</option>)}</select></label></>}
          {period === 'Năm' && <label className="plan-period-control"><span>Chọn năm</span><select value={anchorDate.slice(0, 4)} onChange={event => setAnchorDate(event.target.value + '-01-01')}>{Array.from({length: 101}, (_, index) => String(2000 + index)).map(year => <option key={year}>{year}</option>)}</select></label>}
        </div>
        <b className="plan-period-range">{rangeLabel(period, range)}</b>
      </div>
      <label className="report-search"><span>Tìm trong báo cáo</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên thiết bị, mã thiết bị, nội dung, vật tư..."/></label>
    </section>

    {loadError && <section className="panel report-note"><ShieldAlert/><div><b>Không tải được dữ liệu báo cáo</b><p>{loadError}</p></div></section>}

    {canViewAssets && <section className="panel report-data-panel">
      <div className="panel-head"><div><h2>Công việc bảo trì, bảo dưỡng, sửa chữa</h2><p>{rangeLabel(period, range)} · chỉ tính Phiếu YC đã hoàn thành theo ngày hoàn thành</p></div>{canExport && <button type="button" className="soft-btn" onClick={() => void exportWork()}><Download size={16}/> Xuất Excel</button>}</div>
      <div className="report-summary"><span><b>{completedRequests.length}</b> phiếu đã hoàn thành</span><span><b>{completedRequests.filter(row => row.kind === 'Bảo dưỡng').length}</b> bảo dưỡng</span><span><b>{completedRequests.filter(row => row.kind === 'Sửa chữa').length}</b> sửa chữa</span></div>
      <div className="table-wrap reports-table-wrap"><table className="period-report-table"><thead><tr><th>Ngày hoàn thành</th><th>Thiết bị</th><th>Loại công việc</th><th>Nội dung đã thực hiện</th><th>Vật tư ghi trên phiếu</th><th>Người thực hiện</th></tr></thead><tbody>
        {completedRequests.map(row => { const asset = assets.find(item => item.id === row.assetId); return <tr key={row.id}><td>{dateLabel(row.completedAt || row.updatedAt)}</td><td><b>{asset?.code || '—'}</b><small>{asset?.name || 'Thiết bị không còn trong danh mục'}</small></td><td>{row.kind}</td><td>{row.description || '—'}</td><td>{row.parts || '—'}</td><td>{row.performedBy || '—'}</td></tr> })}
      </tbody></table>{completedRequests.length === 0 && <div className="empty">Không có Phiếu YC hoàn thành trong kỳ báo cáo này.</div>}</div>
    </section>}

    {canViewInventory && <section className="panel report-data-panel">
      <div className="panel-head"><div><h2>Vật tư đã xuất và tồn kho hiện tại</h2><p>{rangeLabel(period, range)} · số lượng sử dụng tính từ giao dịch Xuất kho</p></div>{canExport && <button type="button" className="soft-btn" onClick={() => void exportMaterials()}><Download size={16}/> Xuất Excel</button>}</div>
      <div className="report-summary"><span><b>{materialUsage.length}</b> loại vật tư đã xuất</span><span><b>{materialUsage.reduce((sum, row) => sum + row.transactions, 0)}</b> lượt xuất kho</span></div>
      <div className="table-wrap reports-table-wrap"><table className="period-report-table"><thead><tr><th>Vật tư</th><th>Nhóm</th><th>Đã xuất trong kỳ</th><th>Tồn kho hiện tại</th><th>Vị trí</th></tr></thead><tbody>
        {materialUsage.map(row => <tr key={row.itemId}><td><b>{row.item?.code || '—'}</b><small>{row.item?.name || 'Vật tư không còn trong danh mục'}</small></td><td>{row.item?.group || '—'}</td><td><b>{row.quantity} {row.item?.unit || ''}</b><small>{row.transactions} lượt xuất</small></td><td><b>{row.item ? row.item.quantity + ' ' + row.item.unit : '—'}</b></td><td>{row.item?.location || '—'}</td></tr>)}
      </tbody></table>{materialUsage.length === 0 && <div className="empty">Không có giao dịch xuất kho trong kỳ báo cáo này.</div>}</div>
    </section>}

    {canViewAssets && <section className="panel report-data-panel">
      <div className="panel-head"><div><h2>Tình trạng thiết bị hiện tại</h2><p>Ảnh chụp hiện tại, không thay đổi theo kỳ thời gian đã chọn</p></div>{canExport && <button type="button" className="soft-btn" onClick={() => void exportAssets()}><Download size={16}/> Xuất Excel</button>}</div>
      <div className="report-summary"><span><b>{visibleAssets.length}</b> tổng thiết bị</span><span><b>{visibleAssets.filter(asset => asset.status === 'Đang hoạt động').length}</b> đang hoạt động</span><span className="report-summary-alert"><b>{brokenAssets.length}</b> đang sửa chữa</span><span><b>{visibleAssets.filter(asset => asset.status === 'Lưu kho').length}</b> lưu kho</span><span><b>{visibleAssets.filter(asset => asset.status === 'Ngừng sử dụng').length}</b> ngừng sử dụng</span><span><b>{visibleAssets.filter(asset => asset.status === 'Thanh lý').length}</b> thanh lý</span></div>
      <div className="table-wrap reports-table-wrap"><table className="period-report-table"><thead><tr><th>Mã thiết bị hỏng / đang sửa</th><th>Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Tình trạng</th></tr></thead><tbody>
        {brokenAssets.map(asset => <tr key={asset.id}><td><b>{asset.code}</b></td><td>{asset.name}</td><td>{asset.category || '—'}</td><td>{asset.location || '—'}</td><td><span className="status orange">{asset.status}</span></td></tr>)}
      </tbody></table>{brokenAssets.length === 0 && <div className="empty">Hiện không có thiết bị nào được đánh dấu Đang sửa chữa.</div>}</div>
    </section>}

    <div className="panel report-note"><ShieldAlert/><div><b>Lưu ý nguồn dữ liệu</b><p>Báo cáo công việc lấy từ Phiếu YC đã hoàn thành. Vật tư đã dùng được tính từ giao dịch Xuất kho; tồn kho là số hiện tại. Nội dung vật tư ghi tự do trong Phiếu YC không được cộng vào số lượng xuất kho. Báo cáo phản ánh dữ liệu Local của tổ chức đang chọn.</p></div></div>
    {!canExport && <div className="footnote"><FileSpreadsheet size={14}/> Tài khoản chỉ có quyền xem; chức năng xuất Excel không khả dụng.</div>}
  </div>
}
