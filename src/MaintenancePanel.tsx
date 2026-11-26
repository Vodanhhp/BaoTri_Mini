import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, ClipboardList, Download, History, Plus, Printer, Wrench, X } from 'lucide-react'
import { db, now, uid, type Asset, type MaintenanceRequest, type MaintenanceTask, type MaintenanceHistory } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMaintenanceRequests, saveMaintenanceRequest, completeMaintenanceRequest, saveMaintenanceTask, updateMaintenanceTaskStatus } from './lib/maintenanceCloud'

type Props = {
  organizationId: string
  organizationName: string
  assets: Asset[]
  userId?: string
  userLabel: string
  canView: boolean
  canManage: boolean
  supabaseClient?: SupabaseClient | null
}

const today = () => { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const part=(type:string)=>parts.find(item=>item.type===type)?.value||''; return part('year')+'-'+part('month')+'-'+part('day') }
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

export default function MaintenancePanel({ organizationId, organizationName, assets, userId, userLabel, canView, canManage, supabaseClient }: Props) {
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
  const [printRequest, setPrintRequest] = useState<MaintenanceRequest|null>(null)
  const [completionEditor, setCompletionEditor] = useState<{row:MaintenanceRequest;performedBy:string;completionReadings:string;conditionAfterRepair:string;result:MaintenanceRequest['result']}|null>(null)

  useEffect(()=>{
    if(!printRequest)return
    const timer=window.setTimeout(()=>window.print(),140)
    const onAfterPrint=()=>setPrintRequest(null)
    window.addEventListener('afterprint',onAfterPrint)
    return()=>{window.clearTimeout(timer);window.removeEventListener('afterprint',onAfterPrint)}
  },[printRequest])

  const reload = async (isCurrent: () => boolean = () => true) => {
    if (!organizationId) {
      if (isCurrent()) { setRequests([]); setTasks([]); setHistory([]) }
      return
    }
    const cloudBundle=supabaseClient&&organizationId!=='local-preview'
      ? await loadMaintenanceRequests(supabaseClient,organizationId) : null
    let requestRows:MaintenanceRequest[]
    let taskRows:MaintenanceTask[]
    let historyRows:MaintenanceHistory[]
    if(cloudBundle){
      requestRows=cloudBundle.requests;taskRows=cloudBundle.tasks;historyRows=cloudBundle.history
    }else{
      [requestRows,taskRows,historyRows]=await Promise.all([
        db.maintenanceRequests.where('organizationId').equals(organizationId).toArray(),
        db.maintenanceTasks.where('organizationId').equals(organizationId).toArray(),
        db.maintenanceHistory.where('organizationId').equals(organizationId).toArray()
      ])
    }
    // A previous organization's IndexedDB read may finish after the user switches tenants.
    // Never let that stale result replace the currently selected organization's view.
    if (!isCurrent()) return
    setRequests(requestRows.sort((a,b)=>b.requestDate.localeCompare(a.requestDate)||b.updatedAt.localeCompare(a.updatedAt)))
    setTasks(taskRows.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)))
    setHistory(historyRows.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)))
  }
  useEffect(()=>{
    let active=true
    const refresh=()=>{void reload(()=>active).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))})}
    refresh()
    window.addEventListener('baotri:maintenance-updated',refresh)
    return()=>{active=false;window.removeEventListener('baotri:maintenance-updated',refresh)}
  },[organizationId,supabaseClient])

  const assetName = (id:string) => { const asset=assets.find(item=>item.id===id); return asset ? asset.code+' · '+asset.name : 'Thiết bị không còn trong danh sách' }
  const visibleRequests = useMemo(()=>requests.filter(row=>filter==='all'||(filter==='open'?row.status!=='Hoàn thành':row.status==='Hoàn thành')),[requests,filter])
  const openRequests = requests.filter(row=>row.status!=='Hoàn thành')
  const dueToday = openRequests.filter(row=>row.dueDate===today())
  const overdue = openRequests.filter(row=>row.dueDate!==undefined&&row.dueDate<today())

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
      const value:MaintenanceRequest={...requestEditor,organizationId,description:requestEditor.description.trim(),requestedBy:requestEditor.requestedBy.trim(),performedBy:requestEditor.performedBy.trim(),dueDate:requestEditor.dueDate||undefined,updatedAt:now()}
      if(supabaseClient&&organizationId!=='local-preview'){
        await saveMaintenanceRequest(supabaseClient,organizationId,value,requests.some(row=>row.id===value.id))
      }else{
        const previous=await db.maintenanceRequests.get(requestEditor.id)
        await db.transaction('rw',[db.maintenanceRequests,db.maintenanceHistory],async()=>{
          await db.maintenanceRequests.put(value)
          await addHistory('request',value.id,previous?(previous.status!==value.status?'status_changed':'updated'):'created',previous?'Cập nhật Phiếu YC Bảo dưỡng – Sửa chữa':'Tạo Phiếu YC Bảo dưỡng – Sửa chữa',previous,value)
        })
      }
      setRequestEditor(null);await reload();window.dispatchEvent(new Event('baotri:maintenance-updated'))
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  const saveTask = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(!taskEditor||busy||!canManage)return
    if(!taskEditor.assetId||!taskEditor.title.trim()){setError('Chọn thiết bị và nhập nội dung công việc.');return}
    setBusy(true);setError('')
    try{
      const previous=tasks.find(row=>row.id===taskEditor.id)||await db.maintenanceTasks.get(taskEditor.id)
      const value:MaintenanceTask={...taskEditor,organizationId,title:taskEditor.title.trim(),updatedAt:now()}
      if(supabaseClient&&organizationId!=='local-preview'){
        await saveMaintenanceTask(supabaseClient,organizationId,value,Boolean(previous))
      }else{
        await db.transaction('rw',[db.maintenanceTasks,db.maintenanceHistory],async()=>{
          await db.maintenanceTasks.put(value)
          await addHistory('task',value.id,previous?'updated':'created',previous?'Cập nhật lịch bảo dưỡng định kỳ':'Tạo lịch bảo dưỡng định kỳ',previous,value)
        })
      }
      setTaskEditor(null);await reload();window.dispatchEvent(new Event('baotri:maintenance-updated'))
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  const completeRequest = (row:MaintenanceRequest) => {
    if(!canManage||row.status==='Hoàn thành')return
    setError('')
    setCompletionEditor({row,performedBy:userLabel,completionReadings:row.completionReadings||'',conditionAfterRepair:row.conditionAfterRepair||'',result:row.result||'Đạt'})
  }
  const saveCompletion = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(!completionEditor||busy||!canManage)return
    const performedBy=completionEditor.performedBy.trim()
    const completionReadings=completionEditor.completionReadings.trim()
    const conditionAfterRepair=completionEditor.conditionAfterRepair.trim()
    if(!performedBy||!completionReadings||!conditionAfterRepair||!completionEditor.result){
      setError('Bắt buộc nhập người thực hiện, thông số sau sửa chữa, tình trạng thiết bị sau sửa chữa và kết quả.')
      return
    }
    setBusy(true);setError('')
    try{
      const row=completionEditor.row
      const value:MaintenanceRequest={...row,status:'Hoàn thành',result:completionEditor.result,performedBy,completionReadings,conditionAfterRepair,completedAt:now(),updatedAt:now()}
      if(supabaseClient&&organizationId!=='local-preview'){
        await completeMaintenanceRequest(supabaseClient,organizationId,row.id,{performedBy,completionReadings,conditionAfterRepair,result:completionEditor.result})
      }else{
        await db.transaction('rw',[db.maintenanceRequests,db.maintenanceHistory],async()=>{
          await db.maintenanceRequests.put(value)
          await addHistory('request',row.id,'completed','Hoàn thành Phiếu YC – đã ghi nhận thông số và tình trạng sau xử lý',row,value)
        })
      }
      setCompletionEditor(null);await reload();window.dispatchEvent(new Event('baotri:maintenance-updated'))
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  const updateTaskStatus = async (row:MaintenanceTask,status:MaintenanceTask['status']) => {
    if(!canManage)return
    const value={...row,status,completedAt:status==='Hoàn thành'?now():undefined,updatedAt:now()}
    if(supabaseClient&&organizationId!=='local-preview'){
      await updateMaintenanceTaskStatus(supabaseClient,organizationId,row.id,status)
    }else{
      await db.transaction('rw',[db.maintenanceTasks,db.maintenanceHistory],async()=>{
        await db.maintenanceTasks.put(value)
        await addHistory('task',row.id,'status_changed','Cập nhật trạng thái công việc: '+status,row,value)
      })
    }
    await reload();window.dispatchEvent(new Event('baotri:maintenance-updated'))
  }
  const exportTasks = async () => {
    if(!tasks.length){setError('Chưa có lịch bảo dưỡng để xuất Excel.');return}
    try{
      setError('')
      const {downloadExcelReport}=await import('./lib/excelExport')
      const headers=['Ngày đến hạn','Mã thiết bị','Tên thiết bị','Công việc','Chu kỳ','Trạng thái','Các bước','Thông số','Ghi chú']
      const rows=tasks.map(row=>{const asset=assets.find(item=>item.id===row.assetId);return {'Ngày đến hạn':dateLabel(row.dueDate),'Mã thiết bị':asset?.code||'','Tên thiết bị':asset?.name||'','Công việc':row.title,'Chu kỳ':row.frequency,'Trạng thái':row.status,'Các bước':row.checklist||'','Thông số':row.readings||'','Ghi chú':row.notes||''}})
      await downloadExcelReport(rows,'lich-bao-duong-dinh-ky.xlsx','LỊCH BẢO DƯỠNG ĐỊNH KỲ','Lịch bảo dưỡng',headers,'landscape',organizationName)
    }catch(cause){setError('Xuất Excel lịch bảo dưỡng thất bại: '+(cause instanceof Error?cause.message:String(cause)))}
  }
  const exportRequests = async () => {
    if(!visibleRequests.length){setError('Không có Phiếu YC trong danh sách hiện tại để xuất Excel.');return}
    try{
      setError('')
      const {downloadExcelReport}=await import('./lib/excelExport')
      const headers=['Ngày yêu cầu','Hạn hoàn thành','Mã thiết bị','Tên thiết bị','Loại yêu cầu','Nội dung','Thông số ban đầu','Thông số sau xử lý','Tình trạng sau xử lý','Vật tư / phụ tùng','Trạng thái','Kết quả','Người yêu cầu','Người hoàn thành']
      const rows=visibleRequests.map(row=>{const asset=assets.find(item=>item.id===row.assetId);return {'Ngày yêu cầu':dateLabel(row.requestDate),'Hạn hoàn thành':dateLabel(row.dueDate),'Mã thiết bị':asset?.code||'','Tên thiết bị':asset?.name||'','Loại yêu cầu':row.kind,'Nội dung':row.description,'Thông số ban đầu':row.readings||'','Thông số sau xử lý':row.completionReadings||'','Tình trạng sau xử lý':row.conditionAfterRepair||'','Vật tư / phụ tùng':row.parts||'','Trạng thái':row.status,'Kết quả':row.result||'','Người yêu cầu':row.requestedBy,'Người hoàn thành':row.performedBy||''}})
      await downloadExcelReport(rows,'phieu-bao-duong-sua-chua.xlsx','PHIẾU YÊU CẦU BẢO DƯỠNG – SỬA CHỮA','Phiếu yêu cầu',headers,'landscape',organizationName)
    }catch(cause){setError('Xuất Excel Phiếu YC thất bại: '+(cause instanceof Error?cause.message:String(cause)))}
  }

  if(!canView)return <section className="panel"><h2>Không có quyền xem phân hệ Bảo dưỡng – Sửa chữa</h2></section>
  return <div className="maintenance-workspace">
    <section className="welcome"><div><div className="eyebrow">BAOTRI MINI · BẢO TRÌ</div><h2>Bảo dưỡng – Sửa chữa</h2><p>Quản lý yêu cầu gắn với hồ sơ thiết bị và lịch bảo dưỡng định kỳ.</p><small className="maintenance-local-note">Phiếu yêu cầu và lịch bảo dưỡng định kỳ được lưu trên Cloud, dùng chung trong tổ chức.</small></div><div className="welcome-icon"><Wrench size={40}/></div></section>
    <div className="maintenance-alert-grid">
      <div className="stat-card"><div className="stat-icon red"><ClipboardList size={19}/></div><div><small>Phiếu chưa hoàn thành</small><strong>{openRequests.length}</strong><span>Luôn cần theo dõi đến khi xác nhận</span></div></div>
      <div className="stat-card"><div className="stat-icon orange"><CalendarDays size={19}/></div><div><small>Đến hạn hôm nay</small><strong>{dueToday.length}</strong><span>{dateLabel(today())}</span></div></div>
      <div className="stat-card"><div className="stat-icon red"><Wrench size={19}/></div><div><small>Quá hạn</small><strong>{overdue.length}</strong><span>Cần ưu tiên xử lý</span></div></div>
    </div>
    <div className="panel maintenance-panel">
      <div className="panel-head"><div><h2>{tab==='requests'?'Phiếu YC Bảo dưỡng – Sửa chữa':'Lịch bảo dưỡng định kỳ'}</h2><p>{tab==='requests'?'Mỗi phiếu được gắn với lý lịch thiết bị ngay khi lưu.':'Theo dõi công việc lặp lại và ngày đến hạn theo từng thiết bị.'}</p></div><div className="top-actions">
        <button type="button" className="soft-btn" onClick={()=>void (tab==='requests'?exportRequests():exportTasks())}><Download size={15}/> Xuất Excel</button>
        {canManage&&<button type="button" className="primary-btn" onClick={()=>{setError('');tab==='requests'?setRequestEditor(emptyRequest(organizationId,userLabel)):setTaskEditor(emptyTask(organizationId))}}><Plus size={15}/> {tab==='requests'?'Tạo Phiếu YC':'Thêm lịch bảo dưỡng'}</button>}
      </div></div>
      <div className="maintenance-tabs"><button className={tab==='requests'?'active':''} onClick={()=>setTab('requests')}><ClipboardList size={15}/> Phiếu YC ({requests.length})</button><button className={tab==='schedule'?'active':''} onClick={()=>setTab('schedule')}><CalendarDays size={15}/> Lịch định kỳ ({tasks.length})</button></div>
      {tab==='requests'?<>
        <div className="maintenance-toolbar"><label>Trạng thái <select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">Tất cả</option><option value="open">Chưa hoàn thành</option><option value="done">Hoàn thành</option></select></label></div>
        <div className="table-wrap"><table className="table-standard maintenance-table"><thead><tr><th>Ngày YC</th><th>Hạn hoàn thành</th><th>Thiết bị</th><th>Loại</th><th>Nội dung yêu cầu</th><th>Trạng thái</th><th>Kết quả</th><th>Người yêu cầu</th><th>Người hoàn thành</th><th>Thao tác</th></tr></thead><tbody>
          {visibleRequests.map(row=><tr key={row.id} className={row.status!=='Hoàn thành'?'maintenance-open-row':''}><td>{dateLabel(row.requestDate)}</td><td>{dateLabel(row.dueDate)}</td><td>{assetName(row.assetId)}</td><td>{row.kind}</td><td>{row.description}</td><td><span className={'status '+(row.status==='Hoàn thành'?'green':'red')}>{row.status}</span></td><td>{row.result||'Đang chờ xử lý'}{row.conditionAfterRepair&&<small>{row.conditionAfterRepair}</small>}</td><td>{row.requestedBy}</td><td>{row.performedBy||'—'}{row.completedAt&&<small>{new Date(row.completedAt).toLocaleString('vi-VN')}</small>}</td><td className="actions"><button className="text-btn" onClick={()=>setPrintRequest(row)}><Printer size={13}/> In phiếu</button>{canManage&&<><button className="text-btn" onClick={()=>setRequestEditor(row)}>Sửa</button>{row.status!=='Hoàn thành'&&<button className="text-btn success-text" onClick={()=>void completeRequest(row)}>Hoàn thành</button>}</>}<button className="text-btn" onClick={()=>setHistoryFor(historyFor===row.id?null:row.id)}><History size={13}/> Lịch sử</button></td></tr>)}
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
    {printRequest&&<section className="maintenance-print-sheet" aria-label="Phiếu Bảo dưỡng – Sửa chữa">
      <header className="maintenance-print-header"><div><strong>{organizationName||'ĐƠN VỊ / DOANH NGHIỆP'}</strong><span>BAOTRI MINI · PHIẾU BẢO DƯỠNG – SỬA CHỮA</span></div><small>Ngày in: {new Date().toLocaleString('vi-VN')}</small></header>
      <h1>PHIẾU YÊU CẦU BẢO DƯỠNG – SỬA CHỮA</h1>
      <p className="maintenance-print-number">Mã phiếu: <b>{printRequest.id.slice(0,8).toUpperCase()}</b> · Ngày yêu cầu: <b>{dateLabel(printRequest.requestDate)}</b></p>
      <h2>1. Thông tin thiết bị và yêu cầu</h2>
      <table><tbody><tr><th>Mã thiết bị</th><td>{assets.find(item=>item.id===printRequest.assetId)?.code||'—'}</td><th>Tên thiết bị</th><td>{assets.find(item=>item.id===printRequest.assetId)?.name||'—'}</td></tr><tr><th>Loại yêu cầu</th><td>{printRequest.kind}</td><th>Hạn hoàn thành</th><td>{dateLabel(printRequest.dueDate)}</td></tr><tr><th>Người yêu cầu</th><td>{printRequest.requestedBy||'—'}</td><th>Trạng thái</th><td>{printRequest.status}</td></tr></tbody></table>
      <h2>2. Nội dung yêu cầu</h2><div className="maintenance-print-text">{printRequest.description||'—'}</div>
      <h2>3. Thông số trước khi xử lý</h2><div className="maintenance-print-text">{printRequest.readings||'Chưa ghi nhận.'}</div>
      <h2>4. Vật tư / phụ tùng đề xuất hoặc đã sử dụng</h2><div className="maintenance-print-text">{printRequest.parts||'Không ghi nhận.'}</div>
      <h2>5. Kết quả sau xử lý</h2><div className="maintenance-print-text"><b>Thông số sau sửa chữa / bảo dưỡng:</b><br/>{printRequest.completionReadings||'Chưa ghi nhận.'}<br/><b>Tình trạng thiết bị sau sửa chữa / bảo dưỡng:</b><br/>{printRequest.conditionAfterRepair||'Chưa ghi nhận.'}</div><table><tbody><tr><th>Người thực hiện</th><td>{printRequest.performedBy||'—'}</td><th>Kết quả</th><td>{printRequest.result||'Chưa xác nhận'}</td></tr><tr><th>Thời điểm hoàn thành</th><td colSpan={3}>{printRequest.completedAt?new Date(printRequest.completedAt).toLocaleString('vi-VN'):'—'}</td></tr></tbody></table>
      <div className="maintenance-print-signatures"><div><b>NGƯỜI YÊU CẦU</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>NGƯỜI TIẾP NHẬN</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>NGƯỜI THỰC HIỆN</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>XÁC NHẬN / NGHIỆM THU</b><span>(Ký, ghi rõ họ tên)</span></div></div>
      <footer>Phiếu được trích xuất từ dữ liệu Bảo dưỡng – Sửa chữa BAOTRI MINI.</footer>
    </section>}
    {completionEditor&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setCompletionEditor(null)}}><section className="modal maintenance-modal"><div className="modal-head"><div><h2>Ghi nhận kết quả sau sửa chữa / bảo dưỡng</h2><p>{assetName(completionEditor.row.assetId)} · {completionEditor.row.description}</p></div><button type="button" className="icon-btn" disabled={busy} onClick={()=>setCompletionEditor(null)}><X size={17}/></button></div><form className="form-grid" onSubmit={saveCompletion}>
      <label className="field full-field">Người thực hiện *<input required value={completionEditor.performedBy} onChange={event=>setCompletionEditor({...completionEditor,performedBy:event.target.value})}/></label>
      <label className="field full-field">Thông số sau sửa chữa / bảo dưỡng *<textarea required rows={4} value={completionEditor.completionReadings} onChange={event=>setCompletionEditor({...completionEditor,completionReadings:event.target.value})} placeholder="Ví dụ: điện áp, dòng điện, áp suất, nhiệt độ, tốc độ, độ rung... Ghi rõ giá trị và đơn vị đo."/></label>
      <label className="field full-field">Tình trạng thiết bị sau sửa chữa / bảo dưỡng *<textarea required rows={3} value={completionEditor.conditionAfterRepair} onChange={event=>setCompletionEditor({...completionEditor,conditionAfterRepair:event.target.value})} placeholder="Mô tả tình trạng chạy thử, hoạt động ổn định hay còn lỗi, các hạng mục đã xử lý..."/></label>
      <label className="field">Kết quả *<select required value={completionEditor.result} onChange={event=>setCompletionEditor({...completionEditor,result:event.target.value as MaintenanceRequest['result']})}><option value="">-- Chọn kết quả --</option><option value="Đạt">Đạt</option><option value="Không đạt">Không đạt</option></select></label>
      <div className="modal-actions"><button type="button" className="soft-btn" disabled={busy} onClick={()=>setCompletionEditor(null)}>Hủy</button><button className="primary-btn" disabled={busy}><Check size={15}/> Lưu kết quả và hoàn thành phiếu</button></div>
    </form></section></div>}
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
      <label className="field">Thông số ghi nhận<input value={taskEditor.readings} onChange={event=>setTaskEditor({...taskEditor,readings:event.target.value})}/></label>
      <label className="field full-field">Ghi chú<textarea rows={2} value={taskEditor.notes} onChange={event=>setTaskEditor({...taskEditor,notes:event.target.value})}/></label>
      <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>setTaskEditor(null)}>Hủy</button><button className="primary-btn" disabled={busy}><Check size={15}/> Lưu lịch</button></div>
    </form></section></div>}
  </div>
}


export function MaintenanceDashboardSummary({organizationId,assets,onOpen,supabaseClient}:{organizationId:string;assets:Asset[];onOpen:()=>void;supabaseClient?:SupabaseClient|null}) {
  const [pending,setPending]=useState<MaintenanceRequest[]>([])
  useEffect(()=>{
    let active=true
    const load=()=> (supabaseClient&&organizationId!=='local-preview'
      ? loadMaintenanceRequests(supabaseClient,organizationId).then(bundle=>bundle.requests)
      : db.maintenanceRequests.where('organizationId').equals(organizationId).toArray())
      .then(rows=>{if(active)setPending(rows.filter(row=>row.status!=='Hoàn thành').sort((a,b)=>(a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31')||a.requestDate.localeCompare(b.requestDate)))})
    void load()
    const refresh=()=>{void load()}
    window.addEventListener('baotri:maintenance-updated',refresh)
    return()=>{active=false;window.removeEventListener('baotri:maintenance-updated',refresh)}
  },[organizationId,supabaseClient])
  const name=(id:string)=>{const asset=assets.find(row=>row.id===id);return asset?asset.code+' · '+asset.name:'Thiết bị'}
  return <section className="overview-section maintenance-dashboard-section">
    <div className="overview-section-head"><div><h2>Công việc hôm nay</h2><p>Phiếu Bảo dưỡng – Sửa chữa chưa xác nhận hoàn thành</p></div><button type="button" className="text-btn" onClick={onOpen}>Mở phân hệ →</button></div>
    {pending.length===0?<div className="maintenance-dashboard-empty">Không có Phiếu YC đang chờ xử lý.</div>:<div className="maintenance-dashboard-list">
      {pending.map(row=><button type="button" key={row.id} onClick={onOpen}><span className="maintenance-dashboard-dot"/><span className="maintenance-dashboard-copy"><b>{name(row.assetId)}</b><small>{row.kind} · {row.description}</small></span><span className="status red">{row.dueDate&&row.dueDate<today()?'Quá hạn':'Chưa hoàn thành'}</span></button>)}
    </div>}
  </section>
}


export function MaintenanceAssetHistory({organizationId,assetId,supabaseClient}:{organizationId:string;assetId:string;supabaseClient?:SupabaseClient|null}) {
  const [rows,setRows]=useState<MaintenanceRequest[]>([])
  useEffect(()=>{
    let active=true
    (supabaseClient&&organizationId!=='local-preview'
      ? loadMaintenanceRequests(supabaseClient,organizationId).then(bundle=>bundle.requests.filter(row=>row.assetId===assetId))
      : db.maintenanceRequests.where('[organizationId+assetId]').equals([organizationId,assetId]).toArray())
      .then(items=>{if(active)setRows(items.sort((a,b)=>b.requestDate.localeCompare(a.requestDate)))})
      .catch(()=>{if(active)setRows([])})
    return()=>{active=false}
  },[organizationId,assetId,supabaseClient])
  return <section className="maintenance-asset-history">
    <h3>Lịch sử Bảo dưỡng – Sửa chữa ({rows.length})</h3>
    {rows.length===0?<p>Chưa có Phiếu YC Bảo dưỡng – Sửa chữa cho thiết bị này.</p>:<div className="maintenance-asset-history-list">
      {rows.map(row=><article key={row.id}><div><b>{dateLabel(row.requestDate)} · {row.kind}</b><span className={'status '+(row.status==='Hoàn thành'?'green':'red')}>{row.status}</span></div><p>{row.description}</p><small>Người yêu cầu: {row.requestedBy||'—'} · Người hoàn thành: {row.performedBy||'—'} · Kết quả: {row.result||'Chưa xác nhận'}</small></article>)}
    </div>}
  </section>
}
