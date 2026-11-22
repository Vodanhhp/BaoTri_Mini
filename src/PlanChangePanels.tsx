import {useCallback,useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {listCloudAssets} from './lib/cloudAssets'
import {loadOrganizationEquipmentCatalog,type OrganizationEquipmentCatalogRecord} from './lib/smartEquipmentIdClient'

type PlanCode='A'|'B'|'C'|'D'
type PlanOption={id:PlanCode;name:string;maxDevices:number|null;features:{equipmentGroups:boolean;multipleSites:boolean};idRule:string}
type PlanRequest={
 id:string;organization_id:string;organization_name?:string;
 current_plan_code:PlanCode;requested_plan_code:PlanCode;request_note:string;
 status:'pending'|'approved'|'rejected';requested_at:string;
 requested_by_user_id:string;requested_by_email?:string;requested_by_name?:string;
 reviewed_at?:string;review_note?:string;applied_catalog_version?:string
}
const number=(value:number)=>new Intl.NumberFormat('vi-VN').format(value)
const dateTime=(value:string)=>value?new Date(value).toLocaleString('vi-VN'):'—'
const planLabel=(code:PlanCode,plans:PlanOption[])=>{
 const plan=plans.find(item=>item.id===code)
 return plan?'Plan '+code+' — '+plan.name:'Plan '+code
}
const loadPlans=async(baseUrl:string)=>{
 const response=await fetch(baseUrl+'data/baotri-config.json')
 if(!response.ok)throw new Error('Không tải được danh mục Plan chuẩn.')
 const config=await response.json()
 if(!Array.isArray(config.plans))throw new Error('Danh mục Plan chuẩn không hợp lệ.')
 return config.plans as PlanOption[]
}

export function OrganizationPlanPanel({client,organizationId,onClose,onCatalogLoaded}:{client:SupabaseClient;organizationId:string;onClose:()=>void;onCatalogLoaded?:(catalog:OrganizationEquipmentCatalogRecord|null)=>void}){
 const [plans,setPlans]=useState<PlanOption[]>([])
 const [currentPlan,setCurrentPlan]=useState<PlanCode|null>(null)
 const [deviceCount,setDeviceCount]=useState(0)
 const [requests,setRequests]=useState<PlanRequest[]>([])
 const [targetPlan,setTargetPlan]=useState<PlanCode|''>('')
 const [note,setNote]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const [catalog,assets,planOptions,response]=await Promise.all([
    loadOrganizationEquipmentCatalog(client,organizationId),
    listCloudAssets(client,organizationId),
    loadPlans(import.meta.env.BASE_URL),
    client.functions.invoke('organization-plan-requests',{body:{action:'list',organizationId}})
   ])
   if(response.error)throw new Error(response.error.message)
   if(response.data?.error)throw new Error(response.data.error)
   setCurrentPlan(catalog?.plan_code??null)
   onCatalogLoaded?.(catalog)
   setDeviceCount(assets.length)
   setPlans(planOptions)
   setRequests((response.data?.requests??[]) as PlanRequest[])
   setTargetPlan('')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[client,organizationId,onCatalogLoaded])
 useEffect(()=>{void load()},[load])
 const selected=plans.find(plan=>plan.id===targetPlan)
 const overLimit=Boolean(selected&&selected.maxDevices!==null&&deviceCount>selected.maxDevices)
 const pending=requests.find(request=>request.status==='pending')
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(!targetPlan||busy||pending)return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('organization-plan-requests',{body:{
    action:'submit',organizationId,requestedPlanCode:targetPlan,note:note.trim()
   }})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã gửi yêu cầu đổi Plan.')
   setNote('');setTargetPlan('')
   await load()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <section className="modal member-modal" style={{width:'min(720px,96vw)',maxHeight:'90vh',overflowY:'auto'}}>
   <div className="modal-head"><div><div className="eyebrow">THUÊ BAO DOANH NGHIỆP</div><h2>Gói dịch vụ</h2><p>Xem Plan hiện tại và gửi yêu cầu thay đổi gói sử dụng.</p></div><button className="icon-btn" onClick={onClose} disabled={busy}>×</button></div>
   {error&&<div className="auth-error">{error}</div>}
   {message&&<div className="cloud-message">{message}</div>}
   {loading?<div className="auth-note">Đang tải thông tin Plan và thiết bị Cloud…</div>:<>
    {currentPlan?(()=>{
     const plan=plans.find(item=>item.id===currentPlan)
     const limit=plan?.maxDevices
     return <div className="platform-plan-summary" style={{marginBottom:14}}>
      <b>{planLabel(currentPlan,plans)}</b>
      <p>{limit===null?'Không giới hạn thiết bị':typeof limit==='number'?'Hạn mức '+number(limit)+' thiết bị':'Chưa xác định hạn mức'} · {number(deviceCount)} hồ sơ thiết bị Cloud hiện có</p>
     </div>
    })():<div className="auth-note">Tổ chức chưa có Plan hoặc Catalog Snapshot. Vui lòng liên hệ Super Admin.</div>}
    {pending&&<div className="auth-note" style={{marginBottom:14}}>
     <b>Đang có yêu cầu chờ duyệt</b><p>{planLabel(pending.current_plan_code,plans)} → {planLabel(pending.requested_plan_code,plans)} · gửi lúc {dateTime(pending.requested_at)}</p>
     {pending.request_note&&<p>Lý do: {pending.request_note}</p>}
     Chưa thể gửi yêu cầu mới cho đến khi yêu cầu này được xử lý.
    </div>}
    {!pending&&currentPlan&&<form className="form-grid" onSubmit={submit}>
     <label className="field full-field">Plan muốn chuyển tới
      <select required value={targetPlan} onChange={e=>setTargetPlan(e.target.value as PlanCode|'')}>
       <option value="">Chọn Plan A, B, C hoặc D</option>
       {plans.filter(plan=>plan.id!==currentPlan).map(plan=><option key={plan.id} value={plan.id}>Plan {plan.id} — {plan.name} · {plan.maxDevices===null?'Không giới hạn':number(plan.maxDevices)+' thiết bị'}</option>)}
      </select>
     </label>
     {selected&&<div className="platform-plan-summary full-field">
      <b>{planLabel(selected.id,plans)}</b>
      <p>{selected.maxDevices===null?'Không giới hạn thiết bị':number(selected.maxDevices)+' thiết bị tối đa'} · {selected.features.equipmentGroups?'Có phân nhóm':'Không phân nhóm'} · {selected.features.multipleSites?'Nhiều cơ sở':'Một cơ sở'}</p>
      {overLimit&&<p style={{color:'var(--danger,#b91c1c)'}}>Hiện có {number(deviceCount)} thiết bị, vượt hạn mức mới {number(selected.maxDevices!)} thiết bị. Nếu được duyệt, thiết bị cũ vẫn được giữ nguyên; hệ thống sẽ chặn cấp mã cho thiết bị mới cho đến khi số lượng nằm trong hạn mức.</p>}
     </div>}
     <label className="field full-field">Ghi chú / lý do (không bắt buộc)
      <textarea rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Nêu nhu cầu thay đổi gói dịch vụ…"/>
     </label>
     <div className="auth-note full-field">Gửi yêu cầu không làm thay đổi Plan ngay. Super Admin sẽ xem xét điều kiện thương mại/thanh toán và quyết định duyệt hoặc từ chối. Khi đổi Plan, mã quản lý và hồ sơ thiết bị đã cấp vẫn được giữ nguyên.</div>
     <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={onClose} disabled={busy}>Đóng</button><button type="submit" className="primary-btn" disabled={busy||!selected}>{busy?'Đang gửi…':'Gửi yêu cầu đổi Plan'}</button></div>
    </form>}
    <div className="divider" style={{margin:'18px 0',borderTop:'1px solid var(--border,#e5e7eb)'}}/>
    <h3 style={{fontSize:15}}>Lịch sử yêu cầu</h3>
    {requests.length===0?<p className="muted">Doanh nghiệp chưa gửi yêu cầu đổi Plan.</p>:<div className="cloud-list">{requests.map(request=><div className="cloud-row" key={request.id}>
     <div className="cloud-row-main"><b>{planLabel(request.current_plan_code,plans)} → {planLabel(request.requested_plan_code,plans)}</b><small>{dateTime(request.requested_at)}{request.request_note?' · '+request.request_note:''}</small>{request.review_note&&<small>Phản hồi: {request.review_note}</small>}</div>
     <span className={'status '+(request.status==='approved'?'green':request.status==='rejected'?'red':'orange')}>{request.status==='approved'?'Đã duyệt':request.status==='rejected'?'Từ chối':'Chờ duyệt'}</span>
    </div>)}</div>}
   </>}
   <div className="modal-actions"><button className="soft-btn" onClick={()=>void load()} disabled={loading||busy}>Làm mới</button><button className="soft-btn" onClick={onClose}>Đóng</button></div>
  </section>
 </div>
}

export function PlatformPlanRequestsPanel({client}:{client:SupabaseClient}){
 const [requests,setRequests]=useState<PlanRequest[]>([])
 const [plans,setPlans]=useState<PlanOption[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [selected,setSelected]=useState<PlanRequest|null>(null)
 const [decision,setDecision]=useState<'approve'|'reject'>('approve')
 const [password,setPassword]=useState('')
 const [reviewNote,setReviewNote]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const [planOptions,response]=await Promise.all([
    loadPlans(import.meta.env.BASE_URL),
    client.functions.invoke('platform-manage-plan-requests',{body:{action:'list'}})
   ])
   if(response.error)throw new Error(response.error.message)
   if(response.data?.error)throw new Error(response.data.error)
   setPlans(planOptions);setRequests((response.data?.requests??[]) as PlanRequest[])
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[client])
 useEffect(()=>{void load()},[load])
 const begin=(request:PlanRequest,next:'approve'|'reject')=>{
  setSelected(request);setDecision(next);setPassword('');setReviewNote('');setConfirmed(false);setError('')
 }
 const cancel=()=>{setSelected(null);setPassword('');setReviewNote('');setConfirmed(false)}
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(!selected||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-manage-plan-requests',{body:{
    action:decision,requestId:selected.id,password,confirmation:confirmed?'yes':'no',reviewNote
   }})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã xử lý yêu cầu Plan.')
   cancel();await load()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <section style={{marginTop:18}}>
  <div className="panel-head"><div><h3>Yêu cầu nâng / hạ cấp Plan</h3><p>Yêu cầu từ Admin doanh nghiệp; thao tác duyệt được ghi lịch sử.</p></div><button className="soft-btn" onClick={()=>void load()} disabled={loading}>{loading?'Đang tải…':'Làm mới'}</button></div>
  {error&&<div className="auth-error">{error}</div>}
  {message&&<div className="cloud-message">{message}</div>}
  {loading?<div className="auth-note">Đang tải yêu cầu Plan…</div>:requests.length===0?<p className="muted">Chưa có yêu cầu đổi Plan.</p>:<div className="cloud-list">{requests.map(request=><div className="cloud-row" key={request.id}>
   <div className="cloud-row-main">
    <b>{request.organization_name||request.organization_id}</b>
    <small>{planLabel(request.current_plan_code,plans)} → {planLabel(request.requested_plan_code,plans)} · {dateTime(request.requested_at)}</small>
    <small>Người gửi: {request.requested_by_name||request.requested_by_email||request.requested_by_user_id}{request.requested_by_email?' · '+request.requested_by_email:''}</small>
    {request.request_note&&<small>Lý do: {request.request_note}</small>}
    {request.review_note&&<small>Phản hồi: {request.review_note}</small>}
   </div>
   <div className="cloud-row-actions">
    <span className={'status '+(request.status==='approved'?'green':request.status==='rejected'?'red':'orange')}>{request.status==='approved'?'Đã duyệt':request.status==='rejected'?'Từ chối':'Chờ duyệt'}</span>
    {request.status==='pending'&&<><button className="primary-btn small" onClick={()=>begin(request,'approve')}>Duyệt</button><button className="soft-btn small" onClick={()=>begin(request,'reject')}>Từ chối</button></>}
   </div>
  </div>)}</div>}
  {selected&&<div className="platform-action-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)cancel()}}>
   <section className="platform-action-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-review-title">
    <div className="platform-action-head"><div><span className="platform-action-kicker">XỬ LÝ YÊU CẦU PLAN</span><h3 id="plan-review-title">{decision==='approve'?'Duyệt và áp dụng Plan':'Từ chối yêu cầu Plan'}</h3><p>{selected.organization_name||selected.organization_id}</p></div><button className="icon-btn" onClick={cancel} disabled={busy}>×</button></div>
    <div className="platform-action-note"><b>{planLabel(selected.current_plan_code,plans)} → {planLabel(selected.requested_plan_code,plans)}</b><br/>Trước khi duyệt, xác nhận điều kiện thương mại/thanh toán đã được kiểm tra. Khi áp dụng, thiết bị và mã đã cấp không bị thay đổi.</div>
    <form className="platform-action-form" onSubmit={submit}>
     <label className="field">Ghi chú xử lý<textarea rows={3} maxLength={1000} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Ghi chú nội bộ hoặc phản hồi cho doanh nghiệp…"/></label>
     <label className="field">Mật khẩu Super Admin *<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập lại mật khẩu"/></label>
     <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,lineHeight:1.45}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Tôi đã kiểm tra điều kiện thương mại/thanh toán và xác nhận {decision==='approve'?'áp dụng Plan mới':'từ chối yêu cầu này'}.</span></label>
     {error&&<div className="auth-error">{error}</div>}
     <div className="platform-action-buttons"><button type="button" className="soft-btn" onClick={cancel} disabled={busy}>Hủy</button><button type="submit" className={decision==='approve'?'primary-btn':'danger-btn'} disabled={busy||!confirmed||!password}>{busy?'Đang xử lý…':decision==='approve'?'Xác nhận duyệt':'Xác nhận từ chối'}</button></div>
    </form>
   </section>
  </div>}
 </section>
}
