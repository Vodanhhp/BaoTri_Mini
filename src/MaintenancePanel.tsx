import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, ClipboardList, Download, History, Plus, Wrench, X } from 'lucide-react'
import { db, now, uid, type Asset, type MaintenanceRequest, type MaintenanceTask, type MaintenanceHistory } from './db'

type Props = {
  organizationId: string
  assets: Asset[]
  userId?: string
  userLabel: string
  canView: boolean
  canManage: boolean
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const dateLabel = (value?: string) => value ? new Date(value + 'T00:00:00').toLocaleDateString('vi-VN') : '—'
const emptyRequest = (organizationId: string, userLabel: string): MaintenanceRequest => ({
  id: uid(), organizationId, assetId: '', requestDate: today(), dueDate: '', kind: 'Sửa chữa',
  description: '', parts: '', readings: '', requestedBy: userLabel, status: 'Chưa hoàn thành',
  result: '', performedBy: '', createdAt: now(), updatedAt: now()
})
const emptyTask = (organizationId: string): MaintenanceTask => ({
  id: uid(), organizationId, assetId: '', title: '', dueDate: today(), frequency: 'Một lần',
  status: 'Chờ thực hiện', checklist: '', readings: '', notes: '', createdAt: now(), updatedAt: now()
})

export default function MaintenancePanel({ organizationId, assets, userId, userLabel, canView, canManage }: Props) {
  const [tab, setTab] = useState<'requests'|'schedule'>('requests')
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [history, setHistory] = useState<MaintenanceHistory[]>([])
  const [requestEditor, setRequestEditor] = useState<MaintenanceRequest|null>(null)
  const [taskEditor, setTaskEditor] = useState<MaintenanceTask|null>(null)
  const [historyFor, setHistoryFor] = useState<string|null>(null)
  const [filter, setFilter] = useState<'all'|'open'|'done'>('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    if (!organizationId) { setRequests([]); setTasks([]); setHistory([]); return }
    const [requestRows, taskRows, historyRows] = await Promise.all([
      db.maintenanceRequests.where('organizationId').equals(organizationId).toArray(),
      db.maintenanceTasks.where('organizationId').equals(organizationId).toArray(),
      db.maintenanceHistory.where('organizationId').equals(organizationId).toArray()
    ])
    setRequests(requestRows.sort((a,b)=>b.requestDate.localeCompare(a.requestDate)||b.updatedAt.localeCompare(a.updatedAt)))
    setTasks(taskRows.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)))
    setHistory(historyRows.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)))
  }
  useEffect(()=>{ let active=true; void reload().catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))}); return()=>{active=false} },[organizationId])
  useEffect(()=>{ const refresh=()=>{void reload().catch(()=>{})}; window.addEventListener('baotri:maintenance-updated',refresh); return()=>window.removeEventListener('baotri:maintenance-updated',refresh) },[organizationId])

  const assetName = (id:string) => { const asset=assets.find(item=>item.id===id); return asset ? asset.code+' · '+asset.name : 'Thiết bị không còn trong danh sách' }
  const visibleRequests = useMemo(()=>requests.filter(row=>filter==='all'||(filter==='open'?row.status!=='Hoàn thành':row.status==='Hoàn thành')),[requests,filter])
  const openRequests = requests.filter(row=>row.status!=='Hoàn thành')
  const dueToday = openRequests.filter(row=>row.dueDate===today())
  const overdue = openRequests.filter(row=>Boolean(row.dueDate)&&row.dueDate<today())

  const addHistory = async (recordType:'request'|'task', recordId:string, eventType:MaintenanceHistory['eventType'], summary:string, before?:unknown, after?:unknown) => {
    await db.maintenanceHistory.add({
      id:uid(), organizationId, recordType, recordId, eventType, summary,
      actorUserId:userId, actorLabel:userLabel, occurredAt:now(),
      beforeSnapshot:before?JSON.stringify(before):undefined,
      afterSnapshot:after?JSON.stringify(after):undefined
    })
  }
  const saveRequest = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(!requestEditor||busy||!canManage)return
    if(!requestEditor.assetId||!requestEditor.description.trim()||!requestEditor.requestedBy.trim()){setError('Chọn thiết bị, nhập nội dung và người yêu cầu.');return}
    setBusy(true);setError('')
    try{
      const previous=await db.maintenanceRequests.get(requestEditor.id)
      const value:MaintenanceRequest={...requestEditor,organizationId,description:requestEditor.description.trim(),requestedBy:requestEditor.requestedBy.trim(),performedBy:requestEditor.performedBy.trim(),dueDate:requestEditor.dueDate||undefined,updatedAt:now()}
      await db.transaction('rw',[db.maintenanceRequests,db.maintenanceHistory],async()=>{
        await db.maintenanceRequests.put(value)
        await addHistory('request',value.id,previous?(previous.status!==value.status?'status_changed':'updated'):'created',previous?'Cập nhật Phiếu YC Bảo dưỡng – Sửa chữa':'Tạo Phiếu YC Bảo dưỡng – Sửa chữa',previous,value)
      })
      setRequestEditor(null);await reload()
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  const saveTask = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(!taskEditor||busy||!canManage)return
    if(!taskEditor.assetId||!taskEditor.title.trim()){setError('Chọn thiết bị và nhập nội dung công việc.');return}
    setBusy(true);setError('')
    try{
      const previous=await db.maintenanceTasks.get(taskEditor.id)
      const value:MaintenanceTask={...taskEditor,organizationId,title:taskEditor.title.trim(),updatedAt:now()}
      await db.transaction('rw',[db.maintenanceTasks,db.maintenanceHistory],async()=>{
        await db.maintenanceTasks.put(value)
        await addHistory('task',value.id,previous?'updated':'created',previous?'Cập nhật lịch bảo dưỡng định kỳ':'Tạo lịch bảo dưỡng định kỳ',previous,value)
      })
      setTaskEditor(null);await reload()
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  const completeRequest = async (row:MaintenanceRequest) => {
    if(!canManage)return
    const performedBy=window.prompt('Người hoàn thành:',userLabel)
    if(performedBy===null)return
    const result=window.prompt('Kết quả (Đạt / Không đạt):','Đạt')
    if(result===null)return
    const normalized=result.trim()
    if(normalized!=='Đạt'&&normalized!=='Không đạt'){setError('Kết quả chỉ nhận Đạt hoặc Không đạt.');return}
    const value={...row,status:'Hoàn thành' as const,result:normalized as 'Đạt'|'Không đạt',performedBy:performedBy.trim()||userLabel,completedAt:now(),updatedAt:now()}
    await db.transaction('rw',[db.maintenanceRequests,db.maintenanceHistory],async()=>{
      await db.maintenanceRequests.put(value)
      await addHistory('request',row.id,'completed','Xác nhận hoàn thành Phiếu YC',row,value)
    })
    await reload()
  }
  const updateTaskStatus = async (row:MaintenanceTask,status:MaintenanceTask['status']) => {
    if(!canManage)return
    const value={...row,status,completedAt:status==='Hoàn thành'?now():undefined,updatedAt:now()}
    await db.transaction('rw',[db.maintenanceTasks,db.maintenanceHistory],async()=>{
      await db.maintenanceTasks.put(value)
      await addHistory('task',row.id,'status_changed','Cập nhật trạng thái công việc: '+status,row,value)
    })
    await reload()
  }
  const exportRequests = () => {
    const rows=[['Ngày yêu cầu','Hạn hoàn thành','Mã thiết bị','Tên thiết bị','Loại yêu cầu','Nội dung','Thông số / vật tư','Trạng thái','Kết quả','Người yêu cầu','Người hoàn thành']]
    for(const row of visibleRequests){const asset=assets.find(item=>item.id===row.assetId);rows.push([row.requestDate,row.dueDate||'',asset?.code||'',asset?.name||'',row.kind,row.description,[row.readings,row.parts].filter(Boolean).join(' / '),row.status,row.result||'',row.requestedBy,row.performedBy])}
    const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    const anchor=document.createElement('a');anchor.href=url;anchor.download='phieu-bao-duong-sua-chua.csv';anchor.click();URL.revokeObjectURL(url)
  }

  if(!canView)return <section className="panel"><h2>Không có quyền xem phân hệ Bảo dưỡng – Sửa chữa</h2></section>
  return <div className="maintenance-workspace">
    <section className="welcome"><div><div className="eyebrow">BAOTRI MINI · BẢO TRÌ</div><h2>Bảo dưỡng – Sửa chữa</h2><p>Quản lý yêu cầu gắn với hồ sơ thiết bị và lịch bảo dưỡng định kỳ.</p><small className="maintenance-local-note">Dữ liệu hiện được lưu Local trên thiết bị này; đồng bộ Cloud chưa triển khai.</small></div><div className="welcome-icon"><Wrench size={40}/></div></section>
    <div className="maintenance-alert-grid">
      <div className="stat-card"><div className="stat-icon red"><ClipboardList size={19}/></div><div><small>Phiếu chưa hoàn thành</small><strong>{openRequests.length}</strong><span>Luôn cần theo dõi đến khi xác nhận</span></div></div>
      <div className="stat-card"><div className="stat-icon orange"><CalendarDays size={19}/></div><div><small>Đến hạn hôm nay</small><strong>{dueToday.length}</strong><span>{dateLabel(today())}</span></div></div>
      <div className="stat-card"><div className="stat-icon red"><Wrench size={19}/></div><div><small>Quá hạn</small><strong>{overdue.length}</strong><span>Cần ưu tiên xử lý</span></div></div>
    </div>
    <div className="panel maintenance-panel">
      <div className="panel-head"><div><h2>{tab==='requests'?'Phiếu YC Bảo dưỡng – Sửa chữa':'Lịch bảo dưỡng định kỳ'}</h2><p>{tab==='requests'?'Mỗi phiếu được gắn với lý lịch thiết bị ngay khi lưu.':'Theo dõi công việc lặp lại và ngày đến hạn theo từng thiết bị.'}</p></div><div className="top-actions">
        {tab==='requests'&&<button type="button" className="soft-btn" onClick={exportRequests}><Download size={15}/> Xuất CSV Excel</button>}
        {canManage&&<button type="button" className="primary-btn" onClick={()=>{setError('');tab==='requests'?setRequestEditor(emptyRequest(organizationId,userLabel)):setTaskEditor(emptyTask(organizationId))}}><Plus size={15}/> {tab==='requests'?'Tạo Phiếu YC':'Thêm lịch bảo dưỡng'}</button>}
      </div></div>
      <div className="maintenance-tabs"><button className={tab==='requests'?'active':''} onClick={()=>setTab('requests')}><ClipboardList size={15}/> Phiếu YC ({requests.length})</button><button className={tab==='schedule'?'active':''} onClick={()=>setTab('schedule')}><CalendarDays size={15}/> Lịch định kỳ ({tasks.length})</button></div>
      {tab==='requests'?<>
        <div className="maintenance-toolbar"><label>Trạng thái <select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">Tất cả</option><option value="open">Chưa hoàn thành</option><option value="done">Hoàn thành</option></select></label></div>
        <div className="table-wrap"><table className="table-standard maintenance-table"><thead><tr><th>Ngày YC</th><th>Hạn hoàn thành</th><th>Thiết bị</th><th>Loại</th><th>Nội dung yêu cầu</th><th>Trạng thái</th><th>Kết quả</th><th>Người yêu cầu</th><th>Người hoàn thành</th><th>Thao tác</th></tr></thead><tbody>
          {visibleRequests.map(row=><tr key={row.id} className={row.status!=='Hoàn thành'?'maintenance-open-row':''}><td>{dateLabel(row.requestDate)}</td><td>{dateLabel(row.dueDate)}</td><td>{assetName(row.assetId)}</td><td>{row.kind}</td><td>{row.description}</td><td><span className={'status '+(row.status==='Hoàn thành'?'green':'red')}>{row.status}</span></td><td>{row.result||'Đang chờ xử lý'}</td><td>{row.requestedBy}</td><td>{row.performedBy||'—'}{row.completedAt&&<small>{new Date(row.completedAt).toLocaleString('vi-VN')}</small>}</td><td className="actions">{canManage&&<><button className="text-btn" onClick={()=>setRequestEditor(row)}>Sửa</button>{row.status!=='Hoàn thành'&&<button className="text-btn success-text" onClick={()=>void completeRequest(row)}>Hoàn thành</button>}</>}<button className="text-btn" onClick={()=>setHistoryFor(historyFor===row.id?null:row.id)}><History size={13}/> Lịch sử</button></td></tr>)}
          {visibleRequests.length===0&&<tr><td colSpan={10}><div className="table-empty-state">Chưa có Phiếu YC phù hợp.</div></td></tr>}
        </tbody></table></div>
        {historyFor&&<section className="maintenance-history"><h3>Lịch sử thao tác · {assetName(requests.find(row=>row.id===historyFor)?.assetId||'')}</h3>{history.filter(item=>item.recordId===historyFor).map(item=><div key={item.id}><b>{item.summary}</b><small>{item.actorLabel} · {new Date(item.occurredAt).toLocaleString('vi-VN')}</small></div>)}{history.filter(item=>item.recordId===historyFor).length===0&&<p>Chưa có lịch sử.</p>}</section>}
      </>:<>
        <div className="table-wrap"><table className="table-standard maintenance-table"><thead><tr><th>Ngày đến hạn</th><th>Thiết bị</th><th>Công việc</th><th>Chu kỳ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {tasks.map(row=><tr key={row.id}><td>{dateLabel(row.dueDate)}</td><td>{assetName(row.assetId)}</td><td>{row.title}</td><td>{row.frequency}</td><td><span className={'status '+(row.status==='Hoàn thành'?'green':row.status==='Quá hạn'?'red':'orange')}>{row.status}</span></td><td className="actions">{canManage&&<><button className="text-btn" onClick={()=>setTaskEditor(row)}>Sửa</button><select aria-label="Cập nhật trạng thái lịch bảo dưỡng" value={row.status} onChange={event=>void updateTaskStatus(row,event.target.value as MaintenanceTask['status'])}><option>Chờ thực hiện</option><option>Đang thực hiện</option><option>Hoàn thành</option><option>Quá hạn</option></select></>}</td></tr>)}
          {tasks.length===0&&<tr><td colSpan={6}><div className="table-empty-state">Chưa có lịch bảo dưỡng định kỳ.</div></td></tr>}
        </tbody></table></div>
      </>}
      {error&&<div className="auth-error">{error}</div>}
      <div className="footnote"><History size={14}/> Mọi lần tạo, sửa và đổi trạng thái được ghi vào lịch sử riêng của phân hệ. Viewer chỉ được xem.</div>
    </div>
    {requestEditor&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setRequestEditor(null)}}><section className="modal maintenance-modal"><div className="modal-head"><div><h2>{requests.some(row=>row.id===requestEditor.id)?'Cập nhật Phiếu YC':'Tạo Phiếu YC Bảo dưỡng – Sửa chữa'}</h2><p>Phiếu được liên kết với lý lịch thiết bị khi lưu.</p></div><button className="icon-btn" onClick={()=>setRequestEditor(null)}><X size={17}/></button></div><form className="form-grid" onSubmit={saveRequest}>
      <label className="field full-field">Thiết bị *<select required value={requestEditor.assetId} onChange={event=>setRequestEditor({...requestEditor,assetId:event.target.value})}><option value="">-- Chọn thiết bị --</option>{assets.filter(asset=>!asset.deletedAt).map(asset=><option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}</select></label>
      <label className="field">Ngày yêu cầu *<input required type="date" value={requestEditor.requestDate} onChange={event=>setRequestEditor({...requestEditor,requestDate:event.target.value})}/></label>
      <label className="field">Hạn hoàn thành<input type="date" value={requestEditor.dueDate||''} onChange={event=>setRequestEditor({...requestEditor,dueDate:event.target.value})}/></label>
      <label className="field">Loại yêu cầu<select value={requestEditor.kind} onChange={event=>setRequestEditor({...requestEditor,kind:event.target.value as MaintenanceRequest['kind']})}><option>Sửa chữa</option><option>Bảo dưỡng</option></select></label>
      <label className="field full-field">Nội dung yêu cầu *<textarea required rows={3} value={requestEditor.description} onChange={event=>setRequestEditor({...requestEditor,description:event.target.value})} placeholder="Mô tả hiện tượng, lỗi hoặc công việc cần thực hiện"/></label>
      <label className="field">Người yêu cầu *<input required value={requestEditor.requestedBy} onChange={event=>setRequestEditor({...requestEditor,requestedBy:event.target.value})}/></label>
      <label className="field">Thông số ghi nhận<input value={requestEditor.readings} onChange={event=>setRequestEditor({...requestEditor,readings:event.target.value})}/></label>
      <label className="field full-field">Vật tư / phụ tùng<textarea rows={2} value={requestEditor.parts} onChange={event=>setRequestEditor({...requestEditor,parts:event.target.value})}/></label>
      {requestEditor.status==='Hoàn thành'&&<><label className="field">Người hoàn thành<input value={requestEditor.performedBy} onChange={event=>setRequestEditor({...requestEditor,performedBy:event.target.value})}/></label><label className="field">Kết quả<select value={requestEditor.result} onChange={event=>setRequestEditor({...requestEditor,result:event.target.value as MaintenanceRequest['result']})}><option value="">Chưa xác nhận</option><option>Đạt</option><option>Không đạt</option></select></label></>}
      <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>setRequestEditor(null)}>Hủy</button><button className="primary-btn" disabled={busy}><Check size={15}/> Lưu Phiếu YC</button></div>
    </form></section></div>}
    {taskEditor&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setTaskEditor(null)}}><section className="modal maintenance-modal"><div className="modal-head"><div><h2>{tasks.some(row=>row.id===taskEditor.id)?'Cập nhật lịch bảo dưỡng':'Thêm lịch bảo dưỡng định kỳ'}</h2><p>Gắn lịch với thiết bị cụ thể.</p></div><button className="icon-btn" onClick={()=>setTaskEditor(null)}><X size={17}/></button></div><form className="form-grid" onSubmit={saveTask}>
      <label className="field full-field">Thiết bị *<select required value={taskEditor.assetId} onChange={event=>setTaskEditor({...taskEditor,assetId:event.target.value})}><option value="">-- Chọn thiết bị --</option>{assets.filter(asset=>!asset.deletedAt).map(asset=><option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}</select></label>
      <label className="field full-field">Nội dung công việc *<input required value={taskEditor.title} onChange={event=>setTaskEditor({...taskEditor,title:event.target.value})}/></label>
      <label className="field">Ngày đến hạn *<input required type="date" value={taskEditor.dueDate} onChange={event=>setTaskEditor({...taskEditor,dueDate:event.target.value})}/></label>
      <label className="field">Chu kỳ<select value={taskEditor.frequency} onChange={event=>setTaskEditor({...taskEditor,frequency:event.target.value})}>{['Một lần','Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','6 tháng','Hàng năm'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="field">Trạng thái<select value={taskEditor.status} onChange={event=>setTaskEditor({...taskEditor,status:event.target.value as MaintenanceTask['status']})}>{['Chờ thực hiện','Đang thực hiện','Hoàn thành','Quá hạn'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="field full-field">Các bước công việc<textarea rows={4} value={taskEditor.checklist} onChange={event=>setTaskEditor({...taskEditor,checklist:event.target.value})} placeholder="Mỗi dòng một hạng mục"/></label>
      <label className="field full-field">Thông số / ghi chú<textarea rows={3} value={taskEditor.readings+'\n'+taskEditor.notes} onChange={event=>setTaskEditor({...taskEditor,readings:event.target.value,notes:''})}/></label>
      <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>setTaskEditor(null)}>Hủy</button><button className="primary-btn" disabled={busy}><Check size={15}/> Lưu lịch</button></div>
    </form></section></div>}
  </div>
}
