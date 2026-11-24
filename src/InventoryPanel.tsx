import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { type InventoryItem, type InventoryMovement } from './db'
import {
  archiveInventoryItem, createInventoryItem, listInventoryItems, listInventoryMovements,
  postInventoryMovement, adjustInventoryCount, updateInventoryItemMetadata,
  type InventoryActor, type InventoryItemInput
} from './lib/inventory'

type Props = {
  organizationId: string
  userId?: string
  userLabel: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canAdjust: boolean
  canDelete: boolean
  isAdmin: boolean
}

type FormMode = 'create' | 'edit' | null
type MovementMode = 'Nhập' | 'Xuất' | 'Điều chỉnh' | null

const emptyForm = (): InventoryItemInput => ({
  code: '', name: '', group: 'Vật tư điện', unit: 'Cái', partNumber: '', size: '',
  openingQuantity: 0, minQuantity: 0, location: '', supplier: '', unitPrice: 0
})
const units = ['Cái','Con','Bộ','Chiếc','Mét','m','mm','Kg','g','Lít','ml','Cuộn','Chai','Hộp','Túi','Thùng','Tấm','Ống','Viên','Đôi','Bao','Thanh','Can']
const groups = ['Vật tư điện','Linh kiện điện tử','Cơ khí','Khí nén','Điện lạnh','Dầu mỡ bôi trơn','Vòng bi - bạc đạn','Phớt - gioăng','Vật tư đường ống','Vật tư tiêu hao','Vật tư hàn cắt','Dây cáp điện','Khác']
const numberText = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
const moneyText = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ'

export default function InventoryPanel(props: Props) {
  const { organizationId, userId, userLabel, canView, canCreate, canUpdate, canAdjust, canDelete, isAdmin } = props
  const actor: InventoryActor = { organizationId, userId, label: userLabel, canCreate, canUpdate, canAdjust, canDelete, isAdmin }
  const [items, setItems] = useState<InventoryItem[]>([])
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

  const refresh = useCallback(async () => {
    if (!organizationId || !canView) return
    const [nextItems, nextMovements] = await Promise.all([
      listInventoryItems(organizationId, includeArchived),
      listInventoryMovements(organizationId)
    ])
    setItems(nextItems)
    setMovements(nextMovements)
    setSelected(current => current ? nextItems.find(item => item.id === current.id) ?? null : null)
  }, [organizationId, canView, includeArchived])

  useEffect(() => {
    void refresh().catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu kho vật tư.'))
    const onFocus = () => { void refresh().catch(() => undefined) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

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

  const lowStockCount = items.filter(item => item.quantity <= item.minQuantity).length
  const stockValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const selectedMovements = selected
    ? movements.filter(movement => movement.itemId === selected.id)
    : movements.slice(0, 20)

  const openCreate = () => {
    setError('')
    setForm(emptyForm())
    setFormMode('create')
  }
  const openEdit = (item: InventoryItem) => {
    setError('')
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
      <div><div className="eyebrow">BAOTRI MINI · KHO VẬT TƯ</div><h2>Quản lý vật tư bảo trì</h2><p>Theo dõi nhập – xuất – tồn, lịch sử giao dịch và cảnh báo tồn tối thiểu.</p></div>
      <div className="welcome-icon">▦</div>
    </section>

    <div className="stat-grid inventory-stats">
      <div className="stat-card"><div><small>Danh mục vật tư</small><strong>{items.length}</strong><span>Vật tư đang theo dõi tại Local</span></div></div>
      <div className="stat-card"><div><small>Sắp hết hàng</small><strong>{lowStockCount}</strong><span>Số tồn không vượt mức tối thiểu</span></div></div>
      <div className="stat-card"><div><small>Giá trị tồn ước tính</small><strong>{moneyText(stockValue)}</strong><span>Tính theo đơn giá đang khai báo</span></div></div>
    </div>

    {notice && <div className="auth-note inventory-notice">{notice}<button type="button" className="text-btn" onClick={()=>setNotice('')}>Đóng</button></div>}
    {error && !formMode && !movementMode && <div className="auth-error inventory-error">{error}</div>}

    <section className="panel">
      <div className="panel-head">
        <div><h2>Danh mục vật tư</h2><p>Thông tin vật tư và số lượng tồn hiện tại. Số tồn chỉ thay đổi qua giao dịch kho.</p></div>
        <div className="top-actions">
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
      <div className="table-wrap table-standard-wrap">
        <table className="table-standard"><thead><tr><th>Mã / Tên vật tư</th><th>Nhóm</th><th>Tồn kho</th><th>Tồn tối thiểu</th><th>Vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {visibleItems.map(item=><tr key={item.id} className={item.archivedAt?'inventory-archived-row':''}>
              <td><button type="button" className="inventory-name-link" onClick={()=>setSelected(item)}><b>{item.code}</b><small>{item.name}</small></button></td>
              <td>{item.group}</td>
              <td><b>{numberText(item.quantity)} {item.unit}</b></td>
              <td>{numberText(item.minQuantity)} {item.unit}</td>
              <td>{item.location||'—'}</td>
              <td><span className={'status '+(item.archivedAt?'gray':item.quantity<=item.minQuantity?'red':'green')}>{item.archivedAt?'Đã lưu trữ':item.quantity<=item.minQuantity?'Sắp hết':'Đủ tồn'}</span></td>
              <td className="actions">
                {canAdjust&&!item.archivedAt&&<><button type="button" className="text-btn" onClick={()=>openMovement(item,'Nhập')}>Nhập</button><button type="button" className="text-btn" onClick={()=>openMovement(item,'Xuất')}>Xuất</button><button type="button" className="text-btn" onClick={()=>openMovement(item,'Điều chỉnh')}>Kiểm kê</button></>}
                {canUpdate&&!item.archivedAt&&<button type="button" className="text-btn" onClick={()=>openEdit(item)}>Sửa</button>}
                {canDelete&&isAdmin&&!item.archivedAt&&<button type="button" className="text-btn danger" onClick={()=>void archiveItem(item)}>Lưu trữ</button>}
              </td>
            </tr>)}
            {visibleItems.length===0&&<tr><td colSpan={7}><div className="table-empty-state">Chưa có vật tư phù hợp. {canCreate?'Bạn có thể thêm vật tư mới.':''}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>{selected?'Lịch sử vật tư: '+selected.name:'Lịch sử giao dịch kho gần đây'}</h2><p>Giao dịch được lưu append-only; không có thao tác sửa hoặc xóa phiếu đã ghi.</p></div>{selected&&<button type="button" className="soft-btn" onClick={()=>setSelected(null)}>Xem tất cả</button>}</div>
      <div className="table-wrap table-standard-wrap">
        <table className="table-standard"><thead><tr><th>Ngày</th><th>Mã vật tư</th><th>Loại</th><th>Số lượng</th><th>Tồn trước</th><th>Tồn sau</th><th>Lý do</th><th>Người thực hiện</th></tr></thead>
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
    </section>

    {formMode&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setFormMode(null)}}>
      <section className="modal inventory-modal">
        <div className="modal-head"><div><div className="eyebrow">KHO VẬT TƯ</div><h2>{formMode==='create'?'Thêm vật tư':'Sửa thông tin vật tư'}</h2></div><button type="button" className="icon-btn" onClick={()=>setFormMode(null)}>×</button></div>
        <form className="form-grid" onSubmit={saveItem}>
          <div className="form-hint full-field">Số lượng tồn không chỉnh sửa trong biểu mẫu này. Muốn thay đổi tồn kho, dùng Nhập, Xuất hoặc Kiểm kê.</div>
          <label className="field">Mã vật tư *<input required value={form.code} onChange={event=>setForm(value=>({...value,code:event.target.value}))}/></label>
          <label className="field">Mã phụ tùng<input value={form.partNumber??''} onChange={event=>setForm(value=>({...value,partNumber:event.target.value}))}/></label>
          <label className="field full-field">Tên vật tư *<input required value={form.name} onChange={event=>setForm(value=>({...value,name:event.target.value}))}/></label>
          <label className="field">Nhóm<select value={form.group} onChange={event=>setForm(value=>({...value,group:event.target.value}))}>{groups.map(group=><option key={group}>{group}</option>)}</select></label>
          <label className="field">Đơn vị tính<select value={form.unit} onChange={event=>setForm(value=>({...value,unit:event.target.value}))}>{units.map(unit=><option key={unit}>{unit}</option>)}</select></label>
          <label className="field">Kích cỡ / quy cách<input value={form.size??''} onChange={event=>setForm(value=>({...value,size:event.target.value}))}/></label>
          <label className="field">Tồn tối thiểu<input type="number" min="0" step="any" required disabled={!isAdmin} value={form.minQuantity} onChange={event=>setForm(value=>({...value,minQuantity:Number(event.target.value)}))}/>{!isAdmin&&<small>Chỉ Admin được thay đổi mức tồn tối thiểu.</small>}</label>
          <label className="field">Vị trí lưu kho<input value={form.location??''} onChange={event=>setForm(value=>({...value,location:event.target.value}))}/></label>
          <label className="field">Nhà cung cấp<input value={form.supplier??''} onChange={event=>setForm(value=>({...value,supplier:event.target.value}))}/></label>
          <label className="field">Đơn giá<input type="number" min="0" step="any" required value={form.unitPrice} onChange={event=>setForm(value=>({...value,unitPrice:Number(event.target.value)}))}/></label>
          {formMode==='create'&&<label className="field">Tồn đầu kỳ<input type="number" min="0" step="any" disabled={!canAdjust} value={form.openingQuantity??0} onChange={event=>setForm(value=>({...value,openingQuantity:Number(event.target.value)}))}/>{!canAdjust&&<small>Tài khoản không có quyền ghi nhận tồn đầu kỳ.</small>}</label>}
          {error&&<div className="auth-error full-field">{error}</div>}
          <div className="modal-actions"><button type="button" className="soft-btn" disabled={busy} onClick={()=>setFormMode(null)}>Hủy</button><button type="submit" className="primary-btn" disabled={busy}>{busy?'Đang lưu…':'Lưu vật tư'}</button></div>
        </form>
      </section>
    </div>}

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
