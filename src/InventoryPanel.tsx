import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { type InventoryItem, type InventoryMovement } from './db'
import { Download, Package } from 'lucide-react'
import type { OrganizationEquipmentCatalogRecord } from './lib/smartEquipmentIdClient'
import OrganizationPlanSummary from './OrganizationPlanSummary'
import {
  archiveInventoryItem, createInventoryItem, listInventoryItems, listInventoryMovements,
  postInventoryMovement, adjustInventoryCount, updateInventoryItemMetadata,
  type InventoryActor, type InventoryItemInput, listInventoryGroups, createInventoryGroup
} from './lib/inventory'

type Props = {
  organizationId: string
  organizationName: string
  userId?: string
  userLabel: string
  userRoleLabel: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canAdjust: boolean
  canDelete: boolean
  canExport: boolean
  isAdmin: boolean
  equipmentCatalog: OrganizationEquipmentCatalogRecord | null
  equipmentCatalogLoading: boolean
  equipmentCatalogError: string
}

type FormMode = 'create' | 'edit' | null
type MovementMode = 'Nhập' | 'Xuất' | 'Điều chỉnh' | null

const emptyForm = (): InventoryItemInput => ({
  code: '', name: '', group: 'Vật tư điện', unit: 'Cái', partNumber: '', size: '',
  openingQuantity: 0, minQuantity: 0, location: '', supplier: '', unitPrice: 0
})
const units = ['Cái','Con','Bộ','Chiếc','Mét','m','mm','Kg','g','Lít','ml','Cuộn','Chai','Hộp','Túi','Thùng','Tấm','Ống','Viên','Đôi','Bao','Thanh','Can']
const defaultGroups = ['Vật tư điện','Linh kiện điện tử','Cơ khí','Khí nén','Điện lạnh','Dầu mỡ bôi trơn','Vòng bi - bạc đạn','Phớt - gioăng','Vật tư đường ống','Vật tư tiêu hao','Vật tư hàn cắt','Dây cáp điện','Khác']
const numberText = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
const moneyText = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ'

export default function InventoryPanel(props: Props) {
  const { organizationId, userId, userLabel, canView, canCreate, canUpdate, canAdjust, canDelete, canExport, isAdmin, equipmentCatalog, equipmentCatalogLoading, equipmentCatalogError } = props
  const actor: InventoryActor = { organizationId, userId, label: userLabel, canCreate, canUpdate, canAdjust, canDelete, isAdmin }
  const [items, setItems] = useState<InventoryItem[]>([])
  const [customGroups, setCustomGroups] = useState<string[]>([])
  const [groupCreateOpen, setGroupCreateOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [stockFilter, setStockFilter] = useState<'all'|'low'>('all')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [form, setForm] = useState<InventoryItemInput>(emptyForm())
  const [movementMode, setMovementMode] = useState<MovementMode>(null)
  const [movementQuantity, setMovementQuantity] = useState('1')
  const [movementReason, setMovementReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [printItem, setPrintItem] = useState<InventoryItem | null>(null)

  const refresh = useCallback(async () => {
    if (!organizationId || !canView) return
    const [nextItems, nextMovements] = await Promise.all([
      listInventoryItems(organizationId, includeArchived),
      listInventoryMovements(organizationId)
    ])
    setItems(nextItems)
    setMovements(nextMovements)
    window.dispatchEvent(new Event('baotri:inventory-updated'))
    setSelected(current => current ? nextItems.find(item => item.id === current.id) ?? null : null)
  }, [organizationId, canView, includeArchived])

  useEffect(() => {
    void refresh().catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu kho vật tư.'))
    const onFocus = () => { void refresh().catch(() => undefined) }
    window.addEventListener('focus', onFocus)
    window.addEventListener('baotri:inventory-updated', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('baotri:inventory-updated', onFocus)
    }
  }, [refresh])

  useEffect(() => {
    let active = true
    if (!organizationId || !canView) { setCustomGroups([]); return }
    void listInventoryGroups(organizationId).then(rows => {
      if (active) setCustomGroups(rows.map(row => row.name))
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không tải được danh mục nhóm vật tư.')
    })
    return () => { active = false }
  }, [organizationId, canView])

  useEffect(() => {
    if (!printItem) return
    const timer = window.setTimeout(() => window.print(), 120)
    const onAfterPrint = () => setPrintItem(null)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [printItem])

  const visibleItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi')
    return items.filter(item => {
      const matchesText = !q || [item.code,item.name,item.group,item.partNumber,item.size,item.location,item.supplier]
        .join(' ').toLocaleLowerCase('vi').includes(q)
      const matchesGroup = !groupFilter || item.group === groupFilter
      const matchesStock = stockFilter === 'all' || item.quantity <= item.minQuantity
      return matchesText && matchesGroup && matchesStock
    })
  }, [items, query, groupFilter, stockFilter])

  const availableGroups = useMemo(() => [...new Set([...defaultGroups, ...customGroups, ...items.map(item => item.group)])].sort((a,b)=>a.localeCompare(b,'vi')), [customGroups, items])

  const lowStockCount = items.filter(item => item.quantity <= item.minQuantity).length
  const stockValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const selectedMovements = selected
    ? movements.filter(movement => movement.itemId === selected.id)
    : movements.slice(0, 20)

  const exportInventory = async () => {
    if(!canExport)return
    if(visibleItems.length===0){setNotice('Không có vật tư trong danh sách hiện tại để xuất Excel.');return}
    try{
      setError('')
      const {downloadExcelReport}=await import('./lib/excelExport')
      const headers=['Mã vật tư','Tên vật tư','Nhóm vật tư','Mã phụ tùng','Kích cỡ / quy cách','Đơn vị tính','Tồn hiện tại','Tồn tối thiểu','Tình trạng tồn','Đơn giá','Giá trị tồn','Vị trí lưu kho','Nhà cung cấp','Trạng thái hồ sơ','Ngày tạo','Cập nhật lần cuối']
      const rows=visibleItems.map(item=>({
        'Mã vật tư':item.code,'Tên vật tư':item.name,'Nhóm vật tư':item.group,
        'Mã phụ tùng':item.partNumber||'','Kích cỡ / quy cách':item.size||'','Đơn vị tính':item.unit,
        'Tồn hiện tại':item.quantity,'Tồn tối thiểu':item.minQuantity,
        'Tình trạng tồn':item.archivedAt?'Đã lưu trữ':item.quantity<=item.minQuantity?'Sắp hết':'Đủ tồn',
        'Đơn giá':item.unitPrice,'Giá trị tồn':item.quantity*item.unitPrice,
        'Vị trí lưu kho':item.location||'','Nhà cung cấp':item.supplier||'',
        'Trạng thái hồ sơ':item.archivedAt?'Đã lưu trữ':'Đang theo dõi',
        'Ngày tạo':new Date(item.createdAt).toLocaleDateString('vi-VN'),
        'Cập nhật lần cuối':new Date(item.updatedAt).toLocaleDateString('vi-VN')
      }))
      await downloadExcelReport(rows,'ton-kho-vat-tu.xlsx','BÁO CÁO TỒN KHO VẬT TƯ','Tồn kho vật tư',headers,'landscape')
      setNotice('Đã xuất '+rows.length+' vật tư ra Excel.')
    }catch(cause){setError('Xuất Excel vật tư thất bại: '+(cause instanceof Error?cause.message:String(cause)))}
  }


  const openCreate = () => {
    setError(''); setGroupCreateOpen(false); setNewGroupName('')
    setForm(emptyForm())
    setFormMode('create')
  }
  const openEdit = (item: InventoryItem) => {
    setError(''); setGroupCreateOpen(false); setNewGroupName('')
    setSelected(item)
    setForm({
      code: item.code, name: item.name, group: item.group, unit: item.unit,
      partNumber: item.partNumber ?? '', size: item.size ?? '', minQuantity: item.minQuantity,
      location: item.location, supplier: item.supplier, unitPrice: item.unitPrice
    })
    setFormMode('edit')
  }
  const openMovement = (item: InventoryItem, mode: Exclude<MovementMode,null>) => {
    setSelected(item)
    setMovementMode(mode)
    setMovementQuantity(mode === 'Điều chỉnh' ? String(item.quantity) : '1')
    setMovementReason('')
    setError('')
  }

  const saveNewGroup = async () => {
    if (busy || !canCreate) return
    setBusy(true); setError('')
    try {
      const created = await createInventoryGroup(actor, newGroupName)
      setCustomGroups(current => [...new Set([...current, created.name])].sort((a,b)=>a.localeCompare(b,'vi')))
      setForm(current => ({ ...current, group: created.name }))
      setNewGroupName('')
      setGroupCreateOpen(false)
      setNotice('Đã thêm nhóm vật tư mới trên thiết bị này.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể thêm nhóm vật tư.')
    } finally { setBusy(false) }
  }

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      if (formMode === 'create') {
        await createInventoryItem(actor, form)
        setNotice('Đã thêm vật tư tại Local.')
      } else if (formMode === 'edit' && selected) {
        const { openingQuantity: _ignored, ...metadata } = form
        await updateInventoryItemMetadata(actor, selected.id, selected.updatedAt, metadata)
        setNotice('Đã cập nhật thông tin vật tư tại Local.')
      }
      setFormMode(null)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu vật tư.')
    } finally { setBusy(false) }
  }

  const saveMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !movementMode || busy) return
    setBusy(true); setError('')
    try {
      const quantity = Number(movementQuantity)
      if (movementMode === 'Điều chỉnh') {
        const result = await adjustInventoryCount(actor, selected.id, quantity, movementReason)
        setNotice(result.status === 'no_change'
          ? 'Số kiểm kê bằng số tồn hiện tại; không tạo giao dịch.'
          : 'Đã ghi nhận điều chỉnh tồn kho tại Local.')
      } else {
        await postInventoryMovement(actor, selected.id, movementMode, quantity, movementReason)
        setNotice(`Đã ghi nhận ${movementMode.toLocaleLowerCase('vi')} kho tại Local.`)
      }
      setMovementMode(null)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể ghi nhận giao dịch kho.')
    } finally { setBusy(false) }
  }

  const archiveItem = async (item: InventoryItem) => {
    if (!canDelete || !isAdmin) return
    if (!window.confirm(`Lưu trữ vật tư "${item.name}"? Lịch sử nhập xuất vẫn được giữ lại.`)) return
    setBusy(true); setError('')
    try {
      await archiveInventoryItem(actor, item.id)
      setNotice('Đã lưu trữ vật tư tại Local.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu trữ vật tư.')
    } finally { setBusy(false) }
  }

  if (!canView) return <section className="panel"><div className="panel-head"><div><h2>Kho vật tư</h2><p>Tài khoản chưa được cấp quyền inventory.view.</p></div></div></section>

  return <div className="inventory-workspace">
    <section className="welcome inventory-welcome">
      <div>
        <div className="eyebrow">BAOTRI MINI · KHO VẬT TƯ</div>
        <h2>Quản lý vật tư tập trung</h2>
        <p>Quản lý danh mục, nhập – xuất – kiểm kê và theo dõi tồn tối thiểu.</p>
        {organizationId&&<OrganizationPlanSummary catalog={equipmentCatalog} loading={equipmentCatalogLoading} error={equipmentCatalogError}/>}
      </div>
      <div className="inventory-welcome-side"><div className="welcome-icon"><Package size={38}/></div><div className="inventory-storage-pill"><span aria-hidden="true">●</span> Lưu tại thiết bị Local <i>·</i> {organizationId==='local-preview'?'Chỉ dùng trên thiết bị này':'Tự đồng bộ Cloud khi có mạng'}</div></div>
    </section>

    <div className="stat-grid inventory-stats">
      <div className="stat-card inventory-stat-card"><div><small>Tổng vật tư</small><strong>{items.length}</strong><span>Đang theo dõi</span></div></div>
      <div className="stat-card inventory-stat-card"><div><small>Sắp hết hàng</small><strong>{lowStockCount}</strong><span>Đạt hoặc dưới mức tối thiểu</span></div></div>
      <div className="stat-card inventory-stat-card"><div><small>Giá trị tồn ước tính</small><strong>{moneyText(stockValue)}</strong><span>Theo đơn giá đã khai báo</span></div></div>
    </div>

    {notice && <div className="auth-note inventory-notice">{notice}<button type="button" className="text-btn" onClick={()=>setNotice('')}>Đóng</button></div>}
    {error && !formMode && !movementMode && <div className="auth-error inventory-error">{error}</div>}

    <section className="panel inventory-catalog-panel">
      <div className="panel-head">
        <div><h2>Danh mục vật tư</h2><p>Thông tin và số lượng tồn hiện tại. Số tồn chỉ thay đổi qua giao dịch kho.</p></div>
        <div className="top-actions">
          {canExport&&<button type="button" className="soft-btn" disabled={busy} onClick={()=>void exportInventory()}><Download size={16}/> Xuất Excel</button>}
          <button type="button" className={includeArchived?'soft-btn active':'soft-btn'} onClick={()=>setIncludeArchived(value=>!value)}>{includeArchived?'Ẩn vật tư lưu trữ':'Xem vật tư lưu trữ'}</button>
          {canCreate && <button type="button" className="primary-btn" onClick={openCreate}>+ Thêm vật tư</button>}
        </div>
      </div>
      <div className="inventory-filters">
        <label className="searchbar"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tìm mã, tên, nhóm, quy cách, vị trí…"/></label>
        <label className="field"><span>Nhóm vật tư</span><select value={groupFilter} onChange={event=>setGroupFilter(event.target.value)}><option value="">Tất cả nhóm</option>{[...new Set(items.map(item=>item.group))].sort((a,b)=>a.localeCompare(b,'vi')).map(group=><option key={group}>{group}</option>)}</select></label>
        <label className="field"><span>Tình trạng tồn</span><select value={stockFilter} onChange={event=>setStockFilter(event.target.value as 'all'|'low')}><option value="all">Tất cả</option><option value="low">Sắp hết hàng</option></select></label>
      </div>
      <div className="asset-result-count">Hiển thị {visibleItems.length}/{items.length} vật tư</div>
      <div className="table-wrap table-standard-wrap inventory-desktop-table inventory-catalog-wrap">
        <table className="table-standard inventory-catalog-table"><colgroup><col className="col-material"/><col className="col-group"/><col className="col-stock"/><col className="col-min-stock"/><col className="col-location"/><col className="col-status"/><col className="col-actions"/></colgroup><thead><tr><th>Mã / Tên vật tư</th><th>Nhóm</th><th>Tồn kho</th><th>Tồn tối thiểu</th><th>Vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {visibleItems.map(item=><tr key={item.id} className={item.archivedAt?'inventory-archived-row':''}>
              <td><button type="button" className="inventory-name-link" onClick={()=>setSelected(item)}><b>{item.name}</b><small>{item.code}</small></button></td>
              <td>{item.group}</td>
              <td><b>{numberText(item.quantity)} {item.unit}</b></td>
              <td>{numberText(item.minQuantity)} {item.unit}</td>
              <td>{item.location||'—'}</td>
              <td><span className={'status '+(item.archivedAt?'gray':item.quantity<=item.minQuantity?'red':'green')}>{item.archivedAt?'Đã lưu trữ':item.quantity<=item.minQuantity?'Sắp hết':'Đủ tồn'}</span></td>
              <td className="inventory-actions-cell">
                <details className="inventory-action-menu">
                  <summary>Thao tác <span aria-hidden="true">⌄</span></summary>
                  <div>
                    <button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');setPrintItem(item)}}>In phiếu</button>
                    {canAdjust&&!item.archivedAt&&<><button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');openMovement(item,'Nhập')}}>Nhập kho</button><button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');openMovement(item,'Xuất')}}>Xuất kho</button><button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');openMovement(item,'Điều chỉnh')}}>Kiểm kê / điều chỉnh</button></>}
                    {canUpdate&&!item.archivedAt&&<button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');openEdit(item)}}>Sửa thông tin</button>}
                    {canDelete&&isAdmin&&!item.archivedAt&&<button type="button" className="danger" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void archiveItem(item)}}>Lưu trữ vật tư</button>}
                    {item.archivedAt&&<span className="inventory-action-muted">Vật tư đã lưu trữ</span>}
                  </div>
                </details>
              </td>
            </tr>)}
            {visibleItems.length===0&&<tr><td colSpan={7}><div className="table-empty-state">Chưa có vật tư phù hợp. {canCreate?'Bạn có thể thêm vật tư mới.':''}</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="inventory-mobile-list" aria-label="Danh mục vật tư dạng thẻ">
        {visibleItems.map(item=><article key={item.id} className={`inventory-mobile-card ${item.archivedAt?'inventory-archived-row':''}`}>
          <div className="inventory-mobile-card-head">
            <button type="button" className="inventory-name-link" onClick={()=>setSelected(item)}><b>{item.name}</b><small>{item.code}</small></button>
            <span className={'status '+(item.archivedAt?'gray':item.quantity<=item.minQuantity?'red':'green')}>{item.archivedAt?'Đã lưu trữ':item.quantity<=item.minQuantity?'Sắp hết':'Đủ tồn'}</span>
          </div>
          <div className="inventory-mobile-meta">{item.group}{item.location?' · '+item.location:''}</div>
          <div className="inventory-mobile-quantities">
            <div><small>Tồn kho</small><strong>{numberText(item.quantity)} {item.unit}</strong></div>
            <div><small>Tồn tối thiểu</small><strong>{numberText(item.minQuantity)} {item.unit}</strong></div>
          </div>
          <div className="inventory-mobile-actions">
            <button type="button" className="soft-btn" onClick={()=>setPrintItem(item)}>In phiếu</button>
            {canAdjust&&!item.archivedAt&&<><button type="button" className="soft-btn" onClick={()=>openMovement(item,'Nhập')}>Nhập</button><button type="button" className="soft-btn" onClick={()=>openMovement(item,'Xuất')}>Xuất</button><button type="button" className="soft-btn" onClick={()=>openMovement(item,'Điều chỉnh')}>Kiểm kê</button></>}
            {canUpdate&&!item.archivedAt&&<button type="button" className="soft-btn" onClick={()=>openEdit(item)}>Sửa</button>}
            {canDelete&&isAdmin&&!item.archivedAt&&<button type="button" className="soft-btn danger" onClick={()=>void archiveItem(item)}>Lưu trữ</button>}
          </div>
        </article>)}
        {visibleItems.length===0&&<div className="table-empty-state">Chưa có vật tư phù hợp. {canCreate?'Bạn có thể thêm vật tư mới.':''}</div>}
      </div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>{selected?'Lịch sử vật tư: '+selected.name:'Lịch sử giao dịch kho gần đây'}</h2><p>Giao dịch được lưu append-only; không có thao tác sửa hoặc xóa phiếu đã ghi.</p></div>{selected&&<button type="button" className="soft-btn" onClick={()=>setSelected(null)}>Xem tất cả</button>}</div>
      <div className="table-wrap table-standard-wrap inventory-desktop-table inventory-history-wrap">
        <table className="table-standard inventory-history-table"><colgroup><col className="history-date"/><col className="history-code"/><col className="history-type"/><col className="history-quantity"/><col className="history-before"/><col className="history-after"/><col className="history-reason"/><col className="history-user"/></colgroup><thead><tr><th>Ngày</th><th>Mã vật tư</th><th>Loại</th><th>Số lượng</th><th>Tồn trước</th><th>Tồn sau</th><th>Lý do</th><th>Người thực hiện</th></tr></thead>
          <tbody>{selectedMovements.map(movement=>{
            const item=items.find(row=>row.id===movement.itemId)
            return <tr key={movement.id}>
              <td>{new Date(movement.date+'T00:00:00').toLocaleDateString('vi-VN')}</td>
              <td>{item?.code||'—'}</td>
              <td><span className={'status '+(movement.type==='Nhập'?'green':movement.type==='Xuất'?'orange':'gray')}>{movement.type}</span></td>
              <td>{numberText(movement.quantity)} {item?.unit||''}</td>
              <td>{numberText(movement.balanceBefore)}</td>
              <td>{numberText(movement.balanceAfter)}</td>
              <td>{movement.reason||'—'}</td>
              <td>{movement.performedBy||'—'}</td>
            </tr>
          })}{selectedMovements.length===0&&<tr><td colSpan={8}><div className="table-empty-state">Chưa có giao dịch kho.</div></td></tr>}</tbody>
        </table>
      </div>
      <div className="inventory-mobile-list inventory-movement-list" aria-label="Lịch sử giao dịch dạng thẻ">
        {selectedMovements.map(movement=>{
          const item=items.find(row=>row.id===movement.itemId)
          return <article key={movement.id} className="inventory-mobile-card inventory-movement-card">
            <div className="inventory-mobile-card-head">
              <strong>{item?.code||'Vật tư không còn trong danh mục'}</strong>
              <span className={'status '+(movement.type==='Nhập'?'green':movement.type==='Xuất'?'orange':'gray')}>{movement.type}</span>
            </div>
            {item&&<div className="inventory-mobile-meta">{item.name}</div>}
            <div className="inventory-mobile-meta">{new Date(movement.date+'T00:00:00').toLocaleDateString('vi-VN')}</div>
            <div className="inventory-mobile-quantities">
              <div><small>Số lượng</small><strong>{numberText(movement.quantity)} {item?.unit||''}</strong></div>
              <div><small>Tồn trước → sau</small><strong>{numberText(movement.balanceBefore)} → {numberText(movement.balanceAfter)}</strong></div>
            </div>
            <div className="inventory-mobile-detail"><small>Lý do</small><span>{movement.reason||'—'}</span></div>
            <div className="inventory-mobile-detail"><small>Người thực hiện</small><span>{movement.performedBy||'—'}</span></div>
          </article>
        })}
        {selectedMovements.length===0&&<div className="table-empty-state">Chưa có giao dịch kho.</div>}
      </div>
    </section>

    {formMode&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setFormMode(null)}}>
      <section className="modal inventory-modal">
        <div className="modal-head"><div><div className="eyebrow">KHO VẬT TƯ</div><h2>{formMode==='create'?'Thêm vật tư':'Sửa thông tin vật tư'}</h2></div><button type="button" className="icon-btn" onClick={()=>setFormMode(null)}>×</button></div>
        <form className="form-grid" onSubmit={saveItem}>
          <div className="form-hint full-field">Số lượng tồn được quản lý riêng qua Nhập, Xuất hoặc Kiểm kê; biểu mẫu này chỉ lưu thông tin vật tư.</div>
          <div className="form-hint full-field">{formMode==='create'?'Mã vật tư sẽ được hệ thống tự cấp theo thứ tự VT-001, VT-002…':'Mã vật tư: '+form.code+' · Mã quản lý tự động, không chỉnh sửa.'}</div>
          <label className="field full-field">Tên vật tư *<input required autoFocus value={form.name} onChange={event=>setForm(value=>({...value,name:event.target.value}))} placeholder="Ví dụ: Cảm biến tiệm cận, vòng bi 6204…"/></label>
          <label className="field">Nhóm vật tư<select value={form.group} onChange={event=>{if(event.target.value==='__add_group__'){setGroupCreateOpen(true);setNewGroupName('')}else setForm(value=>({...value,group:event.target.value}))}}>{availableGroups.map(group=><option key={group}>{group}</option>)}{canCreate&&<option value="__add_group__">＋ Thêm nhóm mới…</option>}</select></label>
          <label className="field">Đơn vị tính<select value={form.unit} onChange={event=>setForm(value=>({...value,unit:event.target.value}))}>{units.map(unit=><option key={unit}>{unit}</option>)}</select></label>
          {groupCreateOpen&&<div className="field full-field inventory-add-group"><span>Nhóm mới</span><div className="top-actions"><input value={newGroupName} maxLength={60} onChange={event=>setNewGroupName(event.target.value)} placeholder="Nhập tên nhóm vật tư"/><button type="button" className="soft-btn" disabled={busy||!newGroupName.trim()} onClick={()=>void saveNewGroup()}>Lưu nhóm</button><button type="button" className="text-btn" onClick={()=>{setGroupCreateOpen(false);setNewGroupName('')}}>Hủy</button></div></div>}
          <label className="field">Mã phụ tùng<input value={form.partNumber??''} onChange={event=>setForm(value=>({...value,partNumber:event.target.value}))} placeholder="Mã hãng / mã tương đương"/></label>
          <label className="field">Kích cỡ / thông số<input value={form.size??''} onChange={event=>setForm(value=>({...value,size:event.target.value}))} placeholder="Quy cách, kích thước…"/></label>
          <label className="field">Tồn tối thiểu<input type="number" min="0" step="any" disabled={!isAdmin} value={form.minQuantity} onChange={event=>setForm(value=>({...value,minQuantity:Number(event.target.value)}))}/>{!isAdmin&&<small>Chỉ Admin được thay đổi mức tồn tối thiểu.</small>}</label>
          <details className="inventory-extra-fields full-field"><summary>Thông tin bổ sung (không bắt buộc)</summary><div className="form-grid">
            <label className="field">Vị trí lưu kho<input value={form.location??''} onChange={event=>setForm(value=>({...value,location:event.target.value}))}/></label>
            <label className="field">Nhà cung cấp<input value={form.supplier??''} onChange={event=>setForm(value=>({...value,supplier:event.target.value}))}/></label>
            <label className="field">Đơn giá<input type="number" min="0" step="any" value={form.unitPrice} onChange={event=>setForm(value=>({...value,unitPrice:Number(event.target.value)}))}/></label>
          </div></details>
          {error&&<div className="auth-error full-field">{error}</div>}
          <div className="modal-actions"><button type="button" className="soft-btn" disabled={busy} onClick={()=>setFormMode(null)}>Hủy</button><button type="submit" className="primary-btn" disabled={busy}>{busy?'Đang lưu…':'Lưu vật tư'}</button></div>
        </form>
      </section>
    </div>}

    {printItem&&<section className="inventory-print-sheet" aria-label="Phiếu thông tin vật tư">
      <header className="inventory-print-header">
        <div className="inventory-print-brand"><strong>{organizationName||'ĐƠN VỊ / DOANH NGHIỆP'}</strong><span>BAOTRI MINI · PHIẾU THÔNG TIN VẬT TƯ</span></div>
        <small>Ngày in: {new Date().toLocaleString('vi-VN')}</small>
      </header>
      <h1>{printItem.name}</h1>
      <p className="inventory-print-code">Mã vật tư: <b>{printItem.code}</b></p>
      <h2>1. Thông tin vật tư</h2>
      <table className="inventory-print-info"><tbody>
        <tr><th>Tên vật tư</th><td>{printItem.name}</td><th>Mã vật tư</th><td>{printItem.code}</td></tr>
        <tr><th>Nhóm vật tư</th><td>{printItem.group||'—'}</td><th>Đơn vị tính</th><td>{printItem.unit||'—'}</td></tr>
        <tr><th>Mã phụ tùng</th><td>{printItem.partNumber||'—'}</td><th>Kích cỡ / quy cách</th><td>{printItem.size||'—'}</td></tr>
        <tr><th>Số lượng tồn</th><td><b>{numberText(printItem.quantity)} {printItem.unit}</b></td><th>Tồn tối thiểu</th><td>{numberText(printItem.minQuantity)} {printItem.unit}</td></tr>
        <tr><th>Đơn giá</th><td>{moneyText(printItem.unitPrice)}</td><th>Giá trị tồn</th><td>{moneyText(printItem.quantity*printItem.unitPrice)}</td></tr>
        <tr><th>Vị trí lưu kho</th><td>{printItem.location||'—'}</td><th>Nhà cung cấp</th><td>{printItem.supplier||'—'}</td></tr>
        <tr><th>Trạng thái</th><td>{printItem.archivedAt?'Đã lưu trữ':'Đang hoạt động'}</td><th>Ngày tạo</th><td>{new Date(printItem.createdAt).toLocaleString('vi-VN')}</td></tr>
        <tr><th>Người tạo</th><td>{printItem.createdByLabel||'—'}</td><th>Cập nhật lần cuối</th><td>{new Date(printItem.updatedAt).toLocaleString('vi-VN')}</td></tr>
        {printItem.archivedAt&&<tr><th>Thời điểm lưu trữ</th><td colSpan={3}>{new Date(printItem.archivedAt).toLocaleString('vi-VN')}</td></tr>}
      </tbody></table>
      <h2>2. Lịch sử nhập – xuất – điều chỉnh</h2>
      <table className="inventory-print-history">
        <thead><tr><th>STT</th><th>Ngày giờ</th><th>Nghiệp vụ</th><th>Số lượng</th><th>Tồn trước</th><th>Tồn sau</th><th>Lý do / ghi chú</th><th>Người thực hiện</th></tr></thead>
        <tbody>
          {movements.filter(movement=>movement.itemId===printItem.id).slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map((movement,index)=><tr key={movement.id}>
            <td>{index+1}</td><td>{new Date(movement.createdAt).toLocaleString('vi-VN')}</td>
            <td>{movement.type==='Điều chỉnh'?'Kiểm kê / điều chỉnh':movement.type==='Nhập'?'Nhập kho':'Xuất kho'}</td>
            <td>{movement.type==='Điều chỉnh'?numberText(movement.countedQuantity??movement.balanceAfter)+' '+printItem.unit:numberText(movement.quantity)+' '+printItem.unit}</td>
            <td>{numberText(movement.balanceBefore)}</td><td>{numberText(movement.balanceAfter)}</td>
            <td>{movement.reason||movement.note||'—'}</td><td>{movement.performedBy||'—'}</td>
          </tr>)}
          {printItem.archivedAt&&<tr><td>{movements.filter(movement=>movement.itemId===printItem.id).length+1}</td><td>{new Date(printItem.archivedAt).toLocaleString('vi-VN')}</td><td>Lưu trữ vật tư</td><td>—</td><td>{numberText(printItem.quantity)}</td><td>{numberText(printItem.quantity)}</td><td>Đưa vật tư vào trạng thái lưu trữ</td><td>—</td></tr>}
          {movements.every(movement=>movement.itemId!==printItem.id)&&!printItem.archivedAt&&<tr><td colSpan={8}>Chưa có giao dịch kho.</td></tr>}
        </tbody>
      </table>
      <footer className="inventory-print-footer"><span>Phiếu được trích xuất từ dữ liệu kho vật tư BAOTRI MINI.</span><strong>Người yêu cầu in: {userRoleLabel} — {userLabel}</strong></footer>
    </section>}

    {movementMode&&selected&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setMovementMode(null)}}>
      <section className="modal inventory-modal">
        <div className="modal-head"><div><div className="eyebrow">KHO VẬT TƯ · {selected.code}</div><h2>{movementMode==='Điều chỉnh'?'Kiểm kê / Điều chỉnh tồn':movementMode+' kho'}</h2><p>{selected.name} · Tồn hiện tại: {numberText(selected.quantity)} {selected.unit}</p></div><button type="button" className="icon-btn" onClick={()=>setMovementMode(null)}>×</button></div>
        <form className="form-grid" onSubmit={saveMovement}>
          <label className="field full-field">{movementMode==='Điều chỉnh'?'Số lượng thực tế sau kiểm kê':'Số lượng '+movementMode.toLocaleLowerCase('vi')}<input autoFocus type="number" min={movementMode==='Điều chỉnh'?'0':'0.000001'} step="any" required value={movementQuantity} onChange={event=>setMovementQuantity(event.target.value)}/></label>
          {movementMode==='Điều chỉnh'&&<div className="form-hint full-field">Hệ thống tự tính chênh lệch so với tồn hiện tại. Nếu không chênh lệch, sẽ không tạo giao dịch.</div>}
          <label className="field full-field">Lý do / ghi chú *<textarea required rows={3} value={movementReason} onChange={event=>setMovementReason(event.target.value)} placeholder="Nhập lý do giao dịch hoặc nội dung kiểm kê…"/></label>
          {error&&<div className="auth-error full-field">{error}</div>}
          <div className="modal-actions"><button type="button" className="soft-btn" disabled={busy} onClick={()=>setMovementMode(null)}>Hủy</button><button type="submit" className="primary-btn" disabled={busy}>{busy?'Đang ghi…':'Xác nhận giao dịch'}</button></div>
        </form>
      </section>
    </div>}
  </div>
}
