import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, Archive, Building2, Check, LayoutDashboard, LogOut, Plus, Search, ShieldCheck, SlidersHorizontal, UserRound, Wrench, X, RotateCcw, ImagePlus } from 'lucide-react'
import AuthScreen from './AuthScreen'
import { db, now, uid, type Asset, type AssetStatus } from './db'
import { supabase } from './lib/supabase'

const STATUSES: AssetStatus[] = ['Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý']

const ASSET_CATEGORY_GROUPS = [
 {label:'Điện – điện tử – tự động hóa',items:['Thiết bị điện','Tủ điện','Tủ điện tổng','Tủ điện phân phối','Tủ điều khiển','Biến tần','UPS','Máy biến áp','Thiết bị đo lường','Động cơ điện','Bộ chuyển nguồn ATS','Tủ tụ bù','PLC','HMI','Cảm biến','Bộ nguồn điện','Thiết bị điện tử','Bo mạch điện tử','Rơ le – contactor']},
 {label:'Cơ khí – máy móc – truyền động',items:['Máy bơm','Thiết bị xưởng','Thang máy','Hộp giảm tốc','Băng tải','Máy tiện','Máy phay','Máy khoan bàn','Máy cưa','Máy ép','Máy dập','Máy CNC','Máy nén thủy lực','Hệ thống thủy lực','Thiết bị nâng hạ','Pa lăng – tời','Cầu trục','Xe nâng']},
 {label:'Công cụ – dụng cụ điện',items:['Công cụ điện cầm tay','Máy khoan cầm tay','Máy mài','Máy cắt','Máy siết bu lông','Máy chà nhám','Máy thổi bụi','Máy hút bụi công nghiệp','Dụng cụ đo điện','Dụng cụ cơ khí']},
 {label:'Hàn – cắt – gia công',items:['Máy hàn','Máy hàn xung','Máy hàn MIG/MAG','Máy hàn TIG','Máy hàn que','Máy cắt plasma','Máy cắt gas','Máy cắt kim loại','Máy uốn','Máy đột lỗ']},
 {label:'Quạt công nghiệp',items:['Quạt công nghiệp','Quạt hút','Quạt cấp','Quạt thông gió','Quạt làm mát','Quạt hướng trục','Quạt ly tâm']},
 {label:'Khí nén – nhiệt – lạnh – HVAC',items:['Máy nén khí','Máy sấy khí','Bộ lọc khí nén','Khí nén','Kho lạnh','Điều hòa thông gió','Chiller','Tháp giải nhiệt','Nồi hơi','Nồi hấp','Máy lạnh','Máy hút ẩm','Máy sưởi','Hệ thống HVAC']},
 {label:'Nguồn điện – an toàn – PCCC',items:['Máy phát điện','Phòng cháy chữa cháy','Hệ thống tiếp địa','Chống sét','Đèn chiếu sáng','Thiết bị an toàn']},
 {label:'Thiết bị sản xuất – đóng gói – phụ trợ',items:['Máy đóng gói','Máy chiết rót','Máy dán nhãn','Máy in công nghiệp','Máy trộn','Máy nghiền','Máy sàng','Máy sấy công nghiệp','Máy ép nhựa','Robot công nghiệp','Thiết bị xử lý nước','Hệ thống lọc bụi']},
 {label:'Nhóm khác',items:['Khác']}
] as const
const ASSET_CYCLES = ['Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','Hàng năm'] as const
const emptyAsset = (): Asset => ({
  id: uid(), code: '', name: '', category: '', brand: '', model: '', serial: '',
  location: '', commissionedAt: '', power: '', cycle: '', transferredFromOtherFacility: false,
  status: 'Đang hoạt động', notes: '', images: [], createdAt: now(), updatedAt: now()
})
const dateText = (value: string) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN') : '—'
const imageToDataUrl = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('Chỉ chấp nhận tệp hình ảnh.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể xử lý hình ảnh trên trình duyệt này.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) return reject(new Error('Không thể nén hình ảnh.'))
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Không đọc được hình ảnh.'))
    reader.readAsDataURL(blob)
  }, 'image/jpeg', 0.78))
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [assets, setAssets] = useState<Asset[]>([])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Tất cả nhóm')
  const [locationFilter, setLocationFilter] = useState('Tất cả vị trí')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [editing, setEditing] = useState<Asset | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setSessionReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadAssets = async () => setAssets(await db.assets.toArray())
  useEffect(() => { if (session) void loadAssets() }, [session])

  const categories = useMemo(() => [...new Set(assets.filter(a => !a.archivedAt).map(a => a.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [assets])
  const locations = useMemo(() => [...new Set(assets.filter(a => !a.archivedAt).map(a => a.location).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [assets])
  const visibleAssets = useMemo(() => assets.filter(asset => {
    if (Boolean(asset.archivedAt) !== showArchived) return false
    const text = [asset.code, asset.name, asset.category, asset.brand, asset.model, asset.serial, asset.location].join(' ').toLocaleLowerCase('vi')
    return (!query || text.includes(query.toLocaleLowerCase('vi'))) &&
      (categoryFilter === 'Tất cả nhóm' || asset.category === categoryFilter) &&
      (locationFilter === 'Tất cả vị trí' || asset.location === locationFilter) &&
      (statusFilter === 'Tất cả trạng thái' || asset.status === statusFilter)
  }).sort((a,b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name,'vi')
    if (sortBy === 'code') return a.code.localeCompare(b.code,'vi', {numeric:true})
    if (sortBy === 'commissionedAt') return (a.commissionedAt || '').localeCompare(b.commissionedAt || '')
    return b.updatedAt.localeCompare(a.updatedAt)
  }), [assets, query, categoryFilter, locationFilter, statusFilter, sortBy, showArchived])

  const resetFilters = () => { setQuery(''); setCategoryFilter('Tất cả nhóm'); setLocationFilter('Tất cả vị trí'); setStatusFilter('Tất cả trạng thái'); setSortBy('updatedAt') }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }

  const saveAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing || busy) return
    setBusy(true); setError('')
    try {
      const value = { ...editing, code: editing.code.trim().toUpperCase(), name: editing.name.trim(), category: editing.category.trim(), updatedAt: now() }
      if (!value.code || !value.name || !value.category) throw new Error('Cần nhập mã, tên và nhóm thiết bị.')
      const duplicate = await db.assets.where('code').equals(value.code).first()
      if (duplicate && duplicate.id !== value.id) throw new Error('Mã thiết bị đã tồn tại, kể cả hồ sơ đang lưu kho.')
      await db.assets.put(value)
      await loadAssets(); setShowForm(false); setEditing(null); notify('Đã lưu hồ sơ thiết bị.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }

  const addImages = async (files: FileList | null) => {
    if (!editing || !files?.length) return
    setError('')
    try {
      const remaining = 8 - (editing.images?.length || 0)
      if (remaining <= 0) throw new Error('Mỗi thiết bị được lưu tối đa 8 ảnh.')
      const converted = await Promise.all(Array.from(files).slice(0, remaining).map(imageToDataUrl))
      setEditing({ ...editing, images: [...(editing.images || []), ...converted] })
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  const archiveAsset = async (asset: Asset) => {
    if (!window.confirm('Đưa thiết bị ' + asset.code + ' – ' + asset.name + ' vào Lưu kho? Hồ sơ sẽ được giữ lại và có thể khôi phục.')) return
    await db.assets.update(asset.id, { archivedAt: now(), updatedAt: now() })
    await loadAssets(); notify('Đã đưa thiết bị vào Lưu kho.')
  }
  const restoreAsset = async (asset: Asset) => {
    await db.assets.update(asset.id, { archivedAt: undefined, updatedAt: now() })
    await loadAssets(); notify('Đã khôi phục thiết bị khỏi Lưu kho.')
  }
  const signOut = async () => { await supabase?.auth.signOut(); setSession(null) }

  if (!sessionReady) return <div className="loading-screen">Đang kiểm tra phiên đăng nhập…</div>
  if (!session) return <AuthScreen client={supabase}/>

  const activeAssets = assets.filter(item => !item.archivedAt && item.status !== 'Thanh lý')
  const stoppedCount = assets.filter(item => item.status === 'Ngừng sử dụng' && !item.archivedAt).length
  const repairingCount = assets.filter(item => item.status === 'Đang sửa chữa' && !item.archivedAt).length

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Wrench size={21}/></span><div><b>BAOTRI</b><small>QUẢN LÝ BẢO TRÌ</small></div></div>
      <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
      <button className="nav-item active"><LayoutDashboard size={17}/><span>Tổng quan thiết bị</span></button>
      <button className="nav-item"><Building2 size={17}/><span>Danh mục thiết bị</span></button>
      <div className="sidebar-bottom"><ShieldCheck size={15}/> Dữ liệu thiết bị Local</div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="page-heading"><div className="eyebrow">QUẢN LÝ TÀI SẢN & THIẾT BỊ</div><h1>Danh mục thiết bị</h1></div>
        <div className="top-actions"><span className="sync-status"><i/>Đang lưu trên thiết bị</span><div className="profile-chip"><span className="avatar"><UserRound size={17}/></span><span className="profile-text"><b>{session.user.email}</b><small>Đã đăng nhập</small></span></div><button className="icon-btn" title="Đăng xuất" onClick={signOut}><LogOut size={17}/></button></div>
      </header>
      <div className="content">
        <section className="welcome"><div><div className="eyebrow">BAOTRI MINI · THIẾT BỊ</div><h2>Quản lý thiết bị tập trung</h2><p>Theo dõi hồ sơ, vị trí và tình trạng vận hành thiết bị.</p></div><div className="welcome-icon"><Wrench size={42}/></div></section>
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-icon blue"><Building2 size={20}/></div><div><small>Tổng thiết bị đang quản lý</small><strong>{activeAssets.length}</strong><span>Không tính hồ sơ lưu kho / thanh lý</span></div></div>
          <div className="stat-card"><div className="stat-icon orange"><Archive size={20}/></div><div><small>Đã lưu kho</small><strong>{assets.filter(item=>Boolean(item.archivedAt)).length}</strong><span>Có thể khôi phục</span></div></div>
          <div className="stat-card"><div className="stat-icon purple"><Activity size={20}/></div><div><small>Đang hoạt động</small><strong>{activeAssets.filter(item=>item.status==='Đang hoạt động').length}</strong><span>Thiết bị sẵn sàng</span></div></div>
          <div className="stat-card"><div className="stat-icon red"><SlidersHorizontal size={20}/></div><div><small>Đang sửa chữa</small><strong>{repairingCount}</strong><span>{stoppedCount} thiết bị ngừng sử dụng</span></div></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><h2>{showArchived?'Thiết bị trong Lưu kho':'Danh sách thiết bị'}</h2><p>Tra cứu, phân loại và cập nhật hồ sơ thiết bị tại cơ sở.</p></div><div className="top-actions">{!showArchived&&<button className="primary-btn" onClick={()=>{setEditing(emptyAsset());setError('');setShowForm(true)}}><Plus size={16}/> Thêm thiết bị</button>}<button className={showArchived?'soft-btn active':'soft-btn'} onClick={()=>{setShowArchived(v=>!v);resetFilters()}}>{showArchived?'Danh sách đang quản lý':'Mở Lưu kho'}</button></div></div>
          <div className="asset-toolbar">
            <label className="searchbar"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tìm theo mã, tên, nhóm, vị trí…"/></label>
            <select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option>Tất cả nhóm</option>{categories.map(item=><option key={item}>{item}</option>)}</select>
            <select value={locationFilter} onChange={event=>setLocationFilter(event.target.value)}><option>Tất cả vị trí</option>{locations.map(item=><option key={item}>{item}</option>)}</select>
            <select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option>Tất cả trạng thái</option>{STATUSES.map(item=><option key={item}>{item}</option>)}</select>
            <select value={sortBy} onChange={event=>setSortBy(event.target.value)}><option value="updatedAt">Mới cập nhật</option><option value="code">Sắp xếp theo mã</option><option value="name">Sắp xếp theo tên</option><option value="commissionedAt">Ngày đưa vào sử dụng</option></select>
            <button className="soft-btn" onClick={resetFilters}><RotateCcw size={14}/> Đặt lại</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
            {visibleAssets.map(asset=><tr key={asset.id}><td><button className="asset-title-btn" onClick={()=>setDetailAsset(asset)}><b>{asset.code}</b><small>{asset.name}</small></button></td><td>{asset.category}</td><td>{asset.location||'—'}</td><td>{dateText(asset.commissionedAt)}</td><td><span className={'status '+(asset.archivedAt?'gray':asset.status==='Đang hoạt động'?'green':asset.status==='Đang sửa chữa'?'orange':asset.status==='Thanh lý'?'red':'gray')}>{asset.archivedAt?'Đã lưu kho':asset.status}</span></td><td className="actions">{showArchived?<button className="text-btn success-text" onClick={()=>void restoreAsset(asset)}><RotateCcw size={13}/> Khôi phục</button>:<><button className="text-btn" onClick={()=>{setEditing({...asset});setError('');setShowForm(true)}}>Sửa</button><button className="text-btn danger" onClick={()=>void archiveAsset(asset)} title="Đưa hồ sơ vào lưu kho"><Archive size={14}/> Lưu kho</button></>}</td></tr>)}
          </tbody></table>{visibleAssets.length===0&&<div className="empty"><Building2 size={25}/>{assets.length?'Không tìm thấy thiết bị phù hợp.':'Chưa có thiết bị. Hãy thêm hồ sơ đầu tiên.'}</div>}</div>
        </div>
        <div className="footnote"><ShieldCheck size={15}/> Dữ liệu thiết bị lưu trên trình duyệt này. Chưa bật đồng bộ Cloud hoặc chia sẻ giữa nhiều thiết bị. Xóa vĩnh viễn chưa được cung cấp để tránh mất hồ sơ.</div>
      </div>
    </main>
    {showForm&&editing&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setShowForm(false);setEditing(null)}}}><section className="modal"><div className="modal-head"><div><h2>{assets.some(item=>item.id===editing.id)?'Cập nhật thiết bị':'Thêm thiết bị mới'}</h2><p>Nhập thông tin hồ sơ thiết bị.</p></div><button className="icon-btn" onClick={()=>{setShowForm(false);setEditing(null)}}><X size={17}/></button></div>
      <form className="form-grid" onSubmit={saveAsset}>
        <label className="field">Mã quản lý thiết bị *<input required value={editing.code} onChange={event=>setEditing({...editing,code:event.target.value})} placeholder="Nhập mã quản lý"/></label>
        <label className="field">Tên thiết bị *<input required value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})} placeholder="Tên thiết bị"/></label>
        <label className="field">Nhóm thiết bị *<select required value={editing.category} onChange={event=>setEditing({...editing,category:event.target.value})}><option value="">-- Chọn nhóm thiết bị --</option>{ASSET_CATEGORY_GROUPS.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(item=><option key={item} value={item}>{item}</option>)}</optgroup>)}{editing.category&&!ASSET_CATEGORY_GROUPS.some(group=>group.items.some(item=>item===editing.category))&&<option value={editing.category}>{editing.category} · danh mục cũ</option>}</select></label>
        <label className="field">Vị trí lắp đặt<input value={editing.location} onChange={event=>setEditing({...editing,location:event.target.value})} placeholder="Tầng / khu vực"/></label>
        <label className="field">Hãng sản xuất<input value={editing.brand} onChange={event=>setEditing({...editing,brand:event.target.value})}/></label>
        <label className="field">Model<input value={editing.model} onChange={event=>setEditing({...editing,model:event.target.value})}/></label>
        <label className="field">Số serial<input value={editing.serial} onChange={event=>setEditing({...editing,serial:event.target.value})}/></label>
        <label className="field">Công suất / thông số<input value={editing.power} onChange={event=>setEditing({...editing,power:event.target.value})}/></label>
        <label className="field">Ngày đưa vào sử dụng<input type="date" value={editing.commissionedAt} onChange={event=>setEditing({...editing,commissionedAt:event.target.value})}/></label>
        <label className="field">Chu kỳ bảo trì<select value={editing.cycle} onChange={event=>setEditing({...editing,cycle:event.target.value})}><option value="">Chưa thiết lập</option>{ASSET_CYCLES.map(item=><option key={item} value={item}>{item}</option>)}{editing.cycle&&!ASSET_CYCLES.includes(editing.cycle as typeof ASSET_CYCLES[number])&&<option value={editing.cycle}>{editing.cycle} · giá trị cũ</option>}</select></label>
        <label className="field">Trạng thái<select value={editing.status} onChange={event=>setEditing({...editing,status:event.target.value as AssetStatus})}>{STATUSES.map(item=><option key={item}>{item}</option>)}</select></label>
        <label className="field full-field"><span><input type="checkbox" checked={editing.transferredFromOtherFacility} onChange={event=>setEditing({...editing,transferredFromOtherFacility:event.target.checked})}/> Thiết bị được chuyển từ cơ sở khác đến</span></label>
        <label className="field full-field">Ghi chú<textarea rows={3} value={editing.notes} onChange={event=>setEditing({...editing,notes:event.target.value})}/></label>
        <div className="field full-field"><span>Ảnh thiết bị ({editing.images?.length || 0}/8)</span><label className="image-upload-btn"><ImagePlus size={16}/> Thêm ảnh<input type="file" accept="image/*" multiple disabled={(editing.images?.length || 0)>=8} onChange={event=>{void addImages(event.target.files);event.target.value=''}}/></label><div className="asset-image-grid">{(editing.images || []).map((src,index)=><div className="asset-image-item" key={index}><img src={src} alt={'Ảnh thiết bị '+(index+1)}/><button type="button" title="Xóa ảnh" onClick={()=>setEditing({...editing,images:editing.images.filter((_,i)=>i!==index)})}>×</button></div>)}</div><small>Ảnh được thu nhỏ và lưu trong trình duyệt hiện tại; chưa đồng bộ Cloud.</small></div>
        {error&&<div className="auth-error full-field">{error}</div>}
        <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>{setShowForm(false);setEditing(null)}}>Hủy</button><button type="submit" className="primary-btn" disabled={busy}>{busy?'Đang lưu…':<><Check size={15}/> Lưu thiết bị</>}</button></div>
      </form>
    </section></div>}
    {detailAsset&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setDetailAsset(null)}}><section className="modal detail-modal"><div className="modal-head"><div><div className="eyebrow">HỒ SƠ THIẾT BỊ</div><h2>{detailAsset.name}</h2><p>{detailAsset.code} · {detailAsset.category}</p></div><button className="icon-btn" onClick={()=>setDetailAsset(null)}><X size={17}/></button></div>
      <div className="detail-status-row"><span className={'status '+(detailAsset.archivedAt?'gray':detailAsset.status==='Đang hoạt động'?'green':detailAsset.status==='Đang sửa chữa'?'orange':detailAsset.status==='Thanh lý'?'red':'gray')}>{detailAsset.archivedAt?'Đã lưu kho':detailAsset.status}</span><span className="muted">Cập nhật: {dateText(detailAsset.updatedAt.slice(0,10))}</span></div>
      <div className="detail-grid">{[['Mã quản lý',detailAsset.code],['Nhóm thiết bị',detailAsset.category],['Vị trí lắp đặt',detailAsset.location],['Hãng sản xuất',detailAsset.brand],['Model',detailAsset.model],['Số serial',detailAsset.serial],['Công suất / thông số',detailAsset.power],['Ngày đưa vào sử dụng',dateText(detailAsset.commissionedAt)],['Chu kỳ bảo trì',detailAsset.cycle],['Chuyển từ cơ sở khác',detailAsset.transferredFromOtherFacility?'Có':'Không'],['Ngày lưu kho',detailAsset.archivedAt?dateText(detailAsset.archivedAt.slice(0,10)):'—']].map(([label,value])=><div className="detail-field" key={label}><small>{label}</small><b>{value || '—'}</b></div>)}</div>
      <div className="detail-notes"><small>Ghi chú</small><p>{detailAsset.notes || 'Chưa có ghi chú.'}</p></div>
      <div className="detail-photos"><h3>Hình ảnh thiết bị ({detailAsset.images?.length || 0})</h3>{detailAsset.images?.length?<div className="detail-photo-grid">{detailAsset.images.map((src,index)=><a href={src} target="_blank" rel="noreferrer" key={index}><img src={src} alt={'Ảnh thiết bị '+(index+1)}/></a>)}</div>:<p className="muted">Chưa có hình ảnh. Chọn Sửa để bổ sung ảnh.</p>}</div>
      <div className="modal-actions"><button className="soft-btn" onClick={()=>setDetailAsset(null)}>Đóng</button><button className="primary-btn" onClick={()=>{setEditing({...detailAsset});setDetailAsset(null);setError('');setShowForm(true)}}>Chỉnh sửa hồ sơ</button></div>
    </section></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}
