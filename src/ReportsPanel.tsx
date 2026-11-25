import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, FileSpreadsheet, ShieldAlert } from 'lucide-react'
import { db, type Asset, type InventoryItem, type InventoryMovement, type MaintenanceRequest, type MaintenanceTask, type MaintenanceHistory } from './db'
import { downloadExcelReport } from './lib/excelExport'

type Period = 'Ngày' | 'Tuần' | 'Tháng' | 'Quý' | 'Năm'
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
  if (period === 'Ngày') { start = new Date(date); end = new Date(date) }
  else if (period === 'Tuần') {
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
  if (period === 'Ngày') return 'Ngày ' + format(range.startDate)
  if (period === 'Tuần') return 'Tuần ' + format(range.startDate) + ' – ' + format(range.endDate)
  if (period === 'Tháng') return 'Tháng ' + range.startDate.slice(5, 7) + '/' + range.startDate.slice(0, 4)
  if (period === 'Quý') return 'Quý ' + (Math.floor((Number(range.startDate.slice(5, 7)) - 1) / 3) + 1) + '/' + range.startDate.slice(0, 4)
  return 'Năm ' + range.startDate.slice(0, 4)
}

const dateLabel = (value?: string) => value ? new Date(value.slice(0, 10) + 'T00:00:00').toLocaleDateString('vi-VN') : '—'
const dateTimeLabel = (value?: string) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'
const localDateKey = (value: string) => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)); const part = (type: string) => parts.find(item => item.type === type)?.value || ''; return part('year') + '-' + part('month') + '-' + part('day') }
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' đ'

export default function ReportsPanel({ organizationId, assets, canViewAssets, canViewInventory, canExport }: Props) {
  const [period, setPeriod] = useState<Period>('Tháng')
  const [anchorDate, setAnchorDate] = useState(() => { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') })
  const [search, setSearch] = useState('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    if (!organizationId) {
      setInventory([])
      setMovements([])
      setRequests([])
      setTasks([])
      setMaintenanceHistory([])
      return () => { active = false }
    }
    setLoadError('')
    void Promise.all([
      db.inventoryItems.where('organizationId').equals(organizationId).toArray(),
      db.inventoryMovements.where('organizationId').equals(organizationId).toArray(),
      db.maintenanceRequests.where('organizationId').equals(organizationId).toArray(),
      db.maintenanceTasks.where('organizationId').equals(organizationId).toArray(),
      db.maintenanceHistory.where('organizationId').equals(organizationId).toArray()
    ]).then(([items, rows, work, scheduledTasks, historyRows]) => {
      if (!active) return
      setInventory(items.filter(item => !item.archivedAt))
      setMovements(rows)
      setRequests(work)
      setTasks(scheduledTasks)
      setMaintenanceHistory(historyRows)
    }).catch(error => {
      if (!active) return
      setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu báo cáo từ Local.')
      setInventory([])
      setMovements([])
      setRequests([])
      setTasks([])
      setMaintenanceHistory([])
    })
    return () => { active = false }
  }, [organizationId])

  const range = useMemo(() => periodRange(period, anchorDate), [period, anchorDate])
  const query = search.trim().toLocaleLowerCase('vi')
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

  const deviceActivities = useMemo(() => {
    const completedRequestRows = requests.filter(row => row.status === 'Hoàn thành').map(row => {
      const event = maintenanceHistory
        .filter(item => item.recordType === 'request' && item.recordId === row.id && item.eventType === 'completed')
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
      const occurredAt = row.completedAt || event?.occurredAt || row.updatedAt
      const asset = assets.find(item => item.id === row.assetId)
      return {
        id: 'request-' + row.id, occurredAt, assetCode: asset?.code || '—',
        assetName: asset?.name || 'Thiết bị không còn trong danh mục',
        activityType: row.kind, description: row.description || '—',
        detail: [row.readings && 'Thông số: ' + row.readings, row.parts && 'Vật tư: ' + row.parts].filter(Boolean).join(' · '),
        performer: event?.actorLabel || row.performedBy || '—',
        result: row.result || 'Chưa ghi nhận'
      }
    })
    const completedTaskRows = tasks.filter(row => row.status === 'Hoàn thành').map(row => {
      const completionEvent = maintenanceHistory
        .filter(item => item.recordType === 'task' && item.recordId === row.id && item.eventType === 'status_changed')
        .filter(item => {
          try { return JSON.parse(item.afterSnapshot || '{}').status === 'Hoàn thành' } catch { return false }
        })
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
      const occurredAt = row.completedAt || completionEvent?.occurredAt || row.updatedAt
      const asset = assets.find(item => item.id === row.assetId)
      return {
        id: 'task-' + row.id, occurredAt, assetCode: asset?.code || '—',
        assetName: asset?.name || 'Thiết bị không còn trong danh mục',
        activityType: 'Bảo dưỡng định kỳ', description: row.title || '—',
        detail: [row.checklist && 'Các bước: ' + row.checklist, row.readings && 'Thông số: ' + row.readings, row.notes && 'Ghi chú: ' + row.notes].filter(Boolean).join(' · '),
        performer: completionEvent?.actorLabel || '—', result: 'Hoàn thành'
      }
    })
    return [...completedRequestRows, ...completedTaskRows]
      .filter(row => row.occurredAt && localDateKey(row.occurredAt) >= range.startDate && localDateKey(row.occurredAt) <= range.endDate)
      .filter(row => (row.assetCode + ' ' + row.assetName + ' ' + row.activityType + ' ' + row.description + ' ' + row.detail + ' ' + row.performer + ' ' + row.result).toLocaleLowerCase('vi').includes(query))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }, [requests, tasks, maintenanceHistory, assets, range, query])
  const exportDeviceActivities = () => downloadExcelReport(deviceActivities.map(row => ({
    'Ngày giờ thực hiện': dateTimeLabel(row.occurredAt),
    'Mã thiết bị': row.assetCode,
    'Tên thiết bị': row.assetName,
    'Loại hoạt động': row.activityType,
    'Nội dung công việc': row.description,
    'Chi tiết / thông số': row.detail,
    'Người thực hiện': row.performer,
    'Kết quả': row.result
  })), 'bao-cao-tinh-trang-thiet-bi-' + range.startDate + '.xlsx', 'BÁO CÁO TÌNH TRẠNG THIẾT BỊ · ' + rangeLabel(period, range).toLocaleUpperCase('vi'), 'Hoạt động thiết bị', ['Ngày giờ thực hiện','Mã thiết bị','Tên thiết bị','Loại hoạt động','Nội dung công việc','Chi tiết / thông số','Người thực hiện','Kết quả'], 'landscape')

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
        {(['Ngày','Tuần','Tháng','Quý','Năm'] as Period[]).map(value => <button type="button" role="tab" aria-selected={period === value} key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value}</button>)}
      </div>
      <div className="report-period-toolbar">
        <div className="plan-period-picker">
          {period === 'Ngày' && <label className="plan-period-control"><span>Chọn ngày</span><input type="date" value={anchorDate} onChange={event => event.target.value && setAnchorDate(event.target.value)}/></label>}
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
      <div className="panel-head"><div><h2>Tình trạng thiết bị</h2><p>{rangeLabel(period, range)} · chỉ hiển thị thiết bị có hoạt động bảo dưỡng, sửa chữa hoặc công việc định kỳ hoàn thành trong kỳ</p></div>{canExport && <button type="button" className="soft-btn" onClick={() => void exportDeviceActivities()}><Download size={16}/> Xuất Excel</button>}</div>
      <div className="report-summary"><span><b>{new Set(deviceActivities.map(row => row.assetCode)).size}</b> thiết bị có hoạt động</span><span><b>{deviceActivities.filter(row => row.activityType === 'Bảo dưỡng').length}</b> lượt bảo dưỡng</span><span><b>{deviceActivities.filter(row => row.activityType === 'Sửa chữa').length}</b> lượt sửa chữa</span><span><b>{deviceActivities.filter(row => row.activityType === 'Bảo dưỡng định kỳ').length}</b> lượt công việc định kỳ</span></div>
      <div className="table-wrap reports-table-wrap"><table className="period-report-table"><thead><tr><th>Ngày giờ</th><th>Thiết bị</th><th>Hoạt động</th><th>Nội dung / chi tiết</th><th>Người thực hiện</th><th>Kết quả</th></tr></thead><tbody>
        {deviceActivities.map(row => <tr key={row.id}><td>{dateTimeLabel(row.occurredAt)}</td><td><b>{row.assetCode}</b><small>{row.assetName}</small></td><td>{row.activityType}</td><td>{row.description}{row.detail && <small>{row.detail}</small>}</td><td>{row.performer}</td><td>{row.result}</td></tr>)}
      </tbody></table>{deviceActivities.length === 0 && <div className="empty">Không có hoạt động bảo dưỡng, sửa chữa hoặc công việc định kỳ hoàn thành trong kỳ báo cáo này.</div>}</div>
    </section>}

    <div className="panel report-note"><ShieldAlert/><div><b>Lưu ý nguồn dữ liệu</b><p>Báo cáo công việc lấy từ Phiếu YC đã hoàn thành. Báo cáo tình trạng thiết bị chỉ liệt kê Phiếu YC và công việc định kỳ đã hoàn thành trong kỳ; thời gian lấy từ thời điểm hoàn thành và người thực hiện từ lịch sử thao tác (hoặc trường người hoàn thành). Các bước công việc định kỳ hiện là nội dung checklist mô tả, chưa phải Checklist độc lập có kết quả từng hạng mục. Vật tư đã dùng được tính từ giao dịch Xuất kho; tồn kho là số hiện tại. Nội dung vật tư ghi tự do trong Phiếu YC không được cộng vào số lượng xuất kho. Báo cáo phản ánh dữ liệu Local của tổ chức đang chọn.</p></div></div>
    {!canExport && <div className="footnote"><FileSpreadsheet size={14}/> Tài khoản chỉ có quyền xem; chức năng xuất Excel không khả dụng.</div>}
  </div>
}
