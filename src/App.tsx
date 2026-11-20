import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, Archive, Building2, Check, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Trash2, UserRound, Wrench, X } from 'lucide-react'
import AuthScreen from './AuthScreen'
import { db, now, uid, type Asset } from './db'
import { supabase } from './lib/supabase'

const emptyAsset = (): Asset => ({
  id: uid(), code: '', name: '', category: '', brand: '', model: '', serial: '',
  location: '', commissionedAt: '', power: '', status: 'Đang hoạt động',
  notes: '', createdAt: now(), updatedAt: now()
})

const dateText = (value: string) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN') : '—'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [assets, setAssets] = useState<Asset[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')
  const [editing, setEditing] = useState<Asset | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadAssets = async () => setAssets(await db.assets.orderBy('updatedAt').reverse().toArray())
  useEffect(() => { if (session) void loadAssets() }, [session])

  const visibleAssets = useMemo(() => assets.filter(asset => {
    const archived = asset.status === 'Ngừng sử dụng'
    if (archived !== showArchived) return false
    const text = [asset.code, asset.name, asset.category, asset.brand, asset.model, asset.serial, asset.location].join(' ').toLocaleLowerCase('vi')
    return (!query || text.includes(query.toLocaleLowerCase('vi'))) &&
      (statusFilter === 'Tất cả trạng thái' || asset.status === statusFilter)
  }), [assets, query, statusFilter, showArchived])

  const saveAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing || busy) return
    setBusy(true)
    setError('')
    try {
      const value = { ...editing, code: editing.code.trim().toUpperCase(), name: editing.name.trim(), updatedAt: now() }
      if (!value.code || !value.name || !value.category.trim()) throw new Error('Cần nhập mã, tên và nhóm thiết bị.')
      const duplicate = await db.assets.where('code').equals(value.code).first()
      if (duplicate && duplicate.id !== value.id) throw new Error('Mã thiết bị đã tồn tại.')
      await db.assets.put(value)
      await loadAssets()
      setShowForm(false)
      setEditing(null)
      setToast('Đã lưu hồ sơ thiết bị.')
      window.setTimeout(() => setToast(''), 2600)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const deleteAsset = async (asset: Asset) => {
    if (!window.confirm('Xóa hồ sơ thiết bị ' + asset.code + ' – ' + asset.name + ' khỏi dữ liệu Local?')) return
    await db.assets.delete(asset.id)
    await loadAssets()
    setToast('Đã xóa hồ sơ thiết bị.')
    window.setTimeout(() => setToast(''), 2600)
  }

  const signOut = async () => { await supabase?.auth.signOut(); setSession(null) }

  if (!sessionReady) return <div className="loading-screen">Đang kiểm tra phiên đăng nhập…</div>
  if (!session) return <AuthScreen client={supabase}/>

  const activeCount = assets.filter(item => item.status !== 'Ngừng sử dụng').length
  const stoppedCount = assets.filter(item => item.status === 'Ngừng sử dụng').length

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
          <div className="stat-card"><div className="stat-icon blue"><Building2 size={20}/></div><div><small>Tổng thiết bị đang quản lý</small><strong>{activeCount}</strong><span>Hồ sơ trên trình duyệt này</span></div></div>
          <div className="stat-card"><div className="stat-icon orange"><Archive size={20}/></div><div><small>Ngừng sử dụng</small><strong>{stoppedCount}</strong><span>Đã lưu trong danh mục</span></div></div>
          <div className="stat-card"><div className="stat-icon purple"><Activity size={20}/></div><div><small>Đang hoạt động</small><strong>{assets.filter(item=>item.status==='Đang hoạt động').length}</strong><span>Thiết bị sẵn sàng</span></div></div>
          <div className="stat-card"><div className="stat-icon red"><SlidersHorizontal size={20}/></div><div><small>Cần theo dõi</small><strong>{assets.filter(item=>item.status==='Hỏng'||item.status==='Tạm dừng').length}</strong><span>Tạm dừng hoặc hỏng</span></div></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><h2>Danh sách thiết bị</h2><p>Tra cứu và cập nhật hồ sơ thiết bị tại cơ sở.</p></div><button className="primary-btn" onClick={()=>{setEditing(emptyAsset());setError('');setShowForm(true)}}><Plus size={16}/> Thêm thiết bị</button></div>
          <div className="asset-toolbar"><label className="searchbar"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tìm theo mã, tên, nhóm, vị trí…"/></label><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option>Tất cả trạng thái</option><option>Đang hoạt động</option><option>Tạm dừng</option><option>Hỏng</option><option>Ngừng sử dụng</option></select><button className={showArchived?'soft-btn active':'soft-btn'} onClick={()=>setShowArchived(value=>!value)}>{showArchived?'Thiết bị đang ngừng':'Thiết bị đang dùng'}</button></div>
          <div className="table-wrap"><table><thead><tr><th>Mã thiết bị</th><th>Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày đưa vào dùng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
            {visibleAssets.map(asset=><tr key={asset.id}><td><b>{asset.code}</b></td><td><b>{asset.name}</b><small>{[asset.brand,asset.model].filter(Boolean).join(' · ')||'Chưa cập nhật hãng/model'}</small></td><td>{asset.category}</td><td>{asset.location||'—'}</td><td>{dateText(asset.commissionedAt)}</td><td><span className={'status '+(asset.status==='Đang hoạt động'?'green':asset.status==='Hỏng'?'red':asset.status==='Tạm dừng'?'orange':'gray')}>{asset.status}</span></td><td className="actions"><button className="text-btn" onClick={()=>{setEditing({...asset});setError('');setShowForm(true)}}>Sửa</button><button className="text-btn danger" onClick={()=>void deleteAsset(asset)} title="Xóa thiết bị"><Trash2 size={14}/></button></td></tr>)}
          </tbody></table>{visibleAssets.length===0&&<div className="empty"><Building2 size={25}/>{assets.length?'Không tìm thấy thiết bị phù hợp.':'Chưa có thiết bị. Hãy thêm hồ sơ đầu tiên.'}</div>}</div>
        </div>
        <div className="footnote"><ShieldCheck size={15}/> Dữ liệu thiết bị hiện lưu trên trình duyệt này. Chưa bật đồng bộ Cloud hoặc chia sẻ giữa nhiều thiết bị.</div>
      </div>
    </main>
    {showForm&&editing&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setShowForm(false);setEditing(null)}}}><section className="modal"><div className="modal-head"><div><h2>{assets.some(item=>item.id===editing.id)?'Cập nhật thiết bị':'Thêm thiết bị mới'}</h2><p>Nhập thông tin hồ sơ thiết bị.</p></div><button className="icon-btn" onClick={()=>{setShowForm(false);setEditing(null)}}><X size={17}/></button></div>
      <form className="form-grid" onSubmit={saveAsset}>
        <label className="field">Mã thiết bị *<input required value={editing.code} onChange={event=>setEditing({...editing,code:event.target.value})} placeholder="VD: BOM-001"/></label>
        <label className="field">Tên thiết bị *<input required value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})} placeholder="Tên thiết bị"/></label>
        <label className="field">Nhóm thiết bị *<input required value={editing.category} onChange={event=>setEditing({...editing,category:event.target.value})} placeholder="VD: Máy bơm"/></label>
        <label className="field">Vị trí lắp đặt<input value={editing.location} onChange={event=>setEditing({...editing,location:event.target.value})} placeholder="Tầng / khu vực"/></label>
        <label className="field">Hãng sản xuất<input value={editing.brand} onChange={event=>setEditing({...editing,brand:event.target.value})}/></label>
        <label className="field">Model<input value={editing.model} onChange={event=>setEditing({...editing,model:event.target.value})}/></label>
        <label className="field">Số serial<input value={editing.serial} onChange={event=>setEditing({...editing,serial:event.target.value})}/></label>
        <label className="field">Công suất / thông số<input value={editing.power} onChange={event=>setEditing({...editing,power:event.target.value})}/></label>
        <label className="field">Ngày đưa vào sử dụng<input type="date" value={editing.commissionedAt} onChange={event=>setEditing({...editing,commissionedAt:event.target.value})}/></label>
        <label className="field">Trạng thái<select value={editing.status} onChange={event=>setEditing({...editing,status:event.target.value as Asset['status']})}><option>Đang hoạt động</option><option>Tạm dừng</option><option>Hỏng</option><option>Ngừng sử dụng</option></select></label>
        <label className="field full-field">Ghi chú<textarea rows={3} value={editing.notes} onChange={event=>setEditing({...editing,notes:event.target.value})}/></label>
        {error&&<div className="auth-error full-field">{error}</div>}
        <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>{setShowForm(false);setEditing(null)}}>Hủy</button><button type="submit" className="primary-btn" disabled={busy}>{busy?'Đang lưu…':<><Check size={15}/> Lưu thiết bị</>}</button></div>
      </form>
    </section></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}
