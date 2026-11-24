import {useCallback,useEffect,useState,type FormEvent} from 'react'
import { formatDateTimeVN } from './lib/dateTime'
import type {SupabaseClient} from '@supabase/supabase-js'
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
const dateTime=(value:string)=>value?formatDateTimeVN(value):'—'
const invokeErrorMessage=async(error:unknown)=>{
 const fallback=error instanceof Error?error.message:String(error)
 const context=(error as {context?:unknown}|null)?.context
 if(context instanceof Response){
  try{
   const payload=await context.clone().json() as {error?:unknown;message?:unknown}
   if(typeof payload.message==='string'&&payload.message.trim())return payload.message
   if(typeof payload.error==='string'&&payload.error.trim())return payload.error
  }catch{/* Use the SDK fallback when the body is not JSON. */}
 }
 return fallback
}
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
   const [catalog,assetCountResponse,planOptions,response]=await Promise.all([
    loadOrganizationEquipmentCatalog(client,organizationId),
    client.rpc('count_organization_cloud_assets',{p_organization_id:organizationId}),
    loadPlans(import.meta.env.BASE_URL),
    client.functions.invoke('organization-plan-requests',{body:{action:'list',organizationId}})
   ])
   // Giữ Plan/Catalog đã tải được ngay cả khi API lịch sử yêu cầu bị lỗi (ví dụ CORS).
   setCurrentPlan(catalog?.plan_code??null)
   onCatalogLoaded?.(catalog)
   setPlans(planOptions)
   if(!assetCountResponse.error){
    const assetCount=Number(assetCountResponse.data??0)
    if(Number.isSafeInteger(assetCount)&&assetCount>=0)setDeviceCount(assetCount)
   }
   if(assetCountResponse.error)throw new Error('Không tải được số lượng thiết bị Cloud: '+assetCountResponse.error.message)
   if(response.error)throw new Error(response.error.message)
   if(response.data?.error)throw new Error(response.data.error)
   const assetCount=Number(assetCountResponse.data??0)
   if(!Number.isSafeInteger(assetCount)||assetCount<0)throw new Error('Cloud trả về số lượng thiết bị không hợp lệ.')
   setDeviceCount(assetCount)
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
   if(invokeError)throw new Error(await invokeErrorMessage(invokeError))
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã gửi yêu cầu đổi Plan.')
   setNote('');setTargetPlan('')
   await load()
  }catch(e){const message=await invokeErrorMessage(e);await load();setError(message)}
  finally{setBusy(false)}
 }
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <section className="modal member-modal plan-request-modal" style={{maxHeight:'92vh',overflowY:'auto'}}>
   <div className="modal-head"><div><div className="eyebrow">THUÊ BAO DOANH NGHIỆP</div><h2>Gói dịch vụ</h2><p>Xem Plan hiện tại và gửi yêu cầu thay đổi gói sử dụng.</p></div><button className="icon-btn" onClick={onClose} disabled={busy}>×</button></div>
   {error&&<div className="auth-error">{error}</div>}
   {message&&<div className="cloud-message">{message}</div>}
   {loading?<div className="auth-note">Đang tải thông tin Plan và thiết bị Cloud…</div>:<>
    {currentPlan?(()=>{
     const plan=plans.find(item=>item.id===currentPlan)
     const limit=plan?.maxDevices
     return <div className="platform-plan-summary" style={{marginBottom:14}}>
      <b>{planLabel(currentPlan,plans)}</b>
      <p>{limit===null?'Không giới hạn thiết bị':typeof limit==='number'?'Hạn mức '+number(limit)+' thiết bị':'Chưa xác định hạn mức'} · {number(deviceCount)} thiết bị/lượt giữ mã đang được tính vào hạn mức</p>
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
    <OrganizationNameChangeRequestPanel client={client} organizationId={organizationId}/>
    <OrganizationAssetResetRequestPanel client={client} organizationId={organizationId}/>
    <div className="divider plan-section-divider"/>
    <h3 className="plan-history-heading">Lịch sử yêu cầu</h3>
    {requests.length===0?<div className="table-empty-state">Doanh nghiệp chưa gửi yêu cầu đổi Plan.</div>:<div className="table-wrap table-standard-wrap plan-history-table-wrap"><table className="table-standard plan-history-table"><thead><tr><th>Nội dung thay đổi</th><th>Ngày gửi</th><th>Ghi chú / phản hồi</th><th>Trạng thái</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}>
      <td><b>{planLabel(request.current_plan_code,plans)} → {planLabel(request.requested_plan_code,plans)}</b></td>
      <td className="table-date-cell">{dateTime(request.requested_at)}</td>
      <td className="table-note-cell">{request.request_note&&<small>Lý do: {request.request_note}</small>}{request.review_note&&<small>Phản hồi: {request.review_note}</small>}{!request.request_note&&!request.review_note?'—':null}</td>
      <td><span className={'status '+(request.status==='approved'?'green':request.status==='rejected'?'red':'orange')}>{request.status==='approved'?'Đã duyệt':request.status==='rejected'?'Từ chối':'Chờ duyệt'}</span></td>
     </tr>)}</tbody></table></div>}
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
  if(decision==='reject'&&!reviewNote.trim()){setError('Bắt buộc nhập lý do từ chối yêu cầu.');return}
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
  {loading?<div className="auth-note">Đang tải yêu cầu Plan…</div>:requests.length===0?<div className="table-empty-state">Chưa có yêu cầu đổi Plan.</div>:<div className="table-wrap table-standard-wrap plan-requests-table-wrap"><table className="table-standard plan-requests-table"><thead><tr><th>Doanh nghiệp</th><th>Thay đổi Plan</th><th>Người gửi</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}>
    <td><b>{request.organization_name||request.organization_id}</b><small className="table-subtext">{dateTime(request.requested_at)}</small></td>
    <td><b>{planLabel(request.current_plan_code,plans)} → {planLabel(request.requested_plan_code,plans)}</b></td>
    <td><b>{request.requested_by_name||request.requested_by_email||request.requested_by_user_id}</b>{request.requested_by_email&&request.requested_by_name&&<small className="table-subtext">{request.requested_by_email}</small>}</td>
    <td className="table-note-cell">{request.request_note&&<small>Lý do: {request.request_note}</small>}{request.review_note&&<small>Phản hồi: {request.review_note}</small>}{!request.request_note&&!request.review_note?'—':null}</td>
    <td><span className={'status '+(request.status==='approved'?'green':request.status==='rejected'?'red':'orange')}>{request.status==='approved'?'Đã duyệt':request.status==='rejected'?'Từ chối':'Chờ duyệt'}</span></td>
    <td><div className="table-action-group">{request.status==='pending'&&<><button className="primary-btn small" onClick={()=>begin(request,'approve')}>Duyệt</button><button className="soft-btn small" onClick={()=>begin(request,'reject')}>Từ chối</button></>}</div></td>
   </tr>)}</tbody></table></div>}
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


type AssetResetRequest={
 id:string;organization_id:string;requester_user_id:string;requester_email?:string;
 requester_note:string;status:'pending'|'approved'|'executed'|'rejected'|'failed';
 cloud_assets_at_request:number;cloud_inventory_items_at_request:number;cloud_inventory_movements_at_request:number;registered_devices_at_request:number;requested_at:string;
 reviewed_at?:string;review_note?:string;executed_at?:string;reset_generation?:number;
 assets_deleted?:number;inventory_items_deleted?:number;inventory_movements_deleted?:number;inventory_mutation_receipts_deleted?:number;inventory_sync_events_deleted?:number;execution_error?:string
}
const resetStatusLabel=(status:AssetResetRequest['status'])=>status==='pending'?'Chờ duyệt':status==='approved'?'Đã phê duyệt':status==='executed'?'Đã thực hiện':status==='rejected'?'Từ chối':'Thực hiện thất bại'
const resetStatusClass=(status:AssetResetRequest['status'])=>status==='executed'?'green':status==='rejected'||status==='failed'?'red':status==='pending'?'orange':'blue'

export function OrganizationAssetResetRequestPanel({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [requests,setRequests]=useState<AssetResetRequest[]>([])
 const [note,setNote]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [confirmed,setConfirmed]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('organization-asset-reset-requests',{body:{action:'list',organizationId}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setRequests((data?.requests??[]) as AssetResetRequest[])
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[client,organizationId])
 useEffect(()=>{void load()},[load])
 const openRequest=requests.some(request=>request.status==='pending'||request.status==='approved')
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(busy||openRequest||!confirmed)return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('organization-asset-reset-requests',{body:{action:'submit',organizationId,note:note.trim()}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã gửi yêu cầu Reset để Superadmin xem xét.')
   setNote('');setConfirmed(false);await load()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <section className="organization-reset-request-section">
  <div className="panel-head reset-request-head"><div><h3>Yêu cầu Reset thiết bị và vật tư</h3><p>Gửi yêu cầu để Superadmin xem xét. Không có dữ liệu nào bị xóa khi gửi yêu cầu.</p></div><button type="button" className="soft-btn" onClick={()=>void load()} disabled={loading||busy}>{loading?'Đang tải…':'Làm mới'}</button></div>
  {error&&<div className="auth-error">{error}</div>}
  {message&&<div className="cloud-message">{message}</div>}
  {openRequest&&<div className="auth-note"><b>Đang có yêu cầu Reset chờ xử lý.</b> Bạn chưa thể gửi yêu cầu mới cho đến khi Superadmin duyệt hoặc từ chối.</div>}
  {!openRequest&&<form className="form-grid" onSubmit={submit}>
   <label className="field full-field">Lý do Reset (không bắt buộc)<textarea rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Nêu lý do cần xóa toàn bộ hồ sơ thiết bị và vật tư để bắt đầu quản lý lại…"/></label>
   <div className="auth-note full-field">Nếu được duyệt, toàn bộ hồ sơ thiết bị và vật tư sẽ bị xóa ở Cloud; dữ liệu Local trên các thiết bị đã đăng ký sẽ được xóa khi kết nối lại, trước khi đồng bộ. Lịch sử kiểm toán thiết bị, danh mục thiết bị dùng chung, tài khoản, phân quyền và Plan được giữ nguyên. Riêng vật tư sẽ xóa cả danh mục nhóm, tồn kho, toàn bộ lịch sử nhập/xuất/điều chỉnh và hàng đợi đồng bộ.</div>
   <label className="full-field" style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,lineHeight:1.45}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Tôi hiểu Reset là thao tác không thể hoàn tác và xác nhận gửi yêu cầu để Superadmin xem xét.</span></label>
   <div className="modal-actions full-field"><button type="submit" className="danger-btn" disabled={busy||!confirmed}>{busy?'Đang gửi…':'Gửi yêu cầu Reset'}</button></div>
  </form>}
  <h3 className="reset-history-heading">Lịch sử yêu cầu Reset</h3>
  {loading?<div className="auth-note">Đang tải lịch sử yêu cầu…</div>:requests.length===0?<div className="table-empty-state">Chưa có yêu cầu Reset.</div>:<div className="table-wrap table-standard-wrap reset-history-table-wrap"><table className="table-standard reset-history-table"><thead><tr><th>Ngày gửi</th><th>Cloud thiết bị</th><th>Cloud vật tư</th><th>Local</th><th>Lý do / phản hồi</th><th>Trạng thái</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}>
   <td>{dateTime(request.requested_at)}</td><td>{number(request.cloud_assets_at_request)}</td><td>{number(request.cloud_inventory_items_at_request)} vật tư · {number(request.cloud_inventory_movements_at_request)} giao dịch</td><td>{number(request.registered_devices_at_request)}</td>
   <td className="table-note-cell">{request.requester_note&&<small>Lý do: {request.requester_note}</small>}{request.review_note&&<small>Phản hồi: {request.review_note}</small>}{request.execution_error&&<small style={{color:'var(--danger,#b91c1c)'}}>Lỗi: {request.execution_error}</small>}{!request.requester_note&&!request.review_note&&!request.execution_error?'—':null}</td>
   <td><span className={'status '+resetStatusClass(request.status)}>{resetStatusLabel(request.status)}</span>{request.reset_generation!==undefined&&<small className="table-subtext">Generation {request.reset_generation}</small>}</td>
  </tr>)}</tbody></table></div>}
 </section>
}

export function PlatformAssetResetRequestsPanel({client}:{client:SupabaseClient}){
 const [requests,setRequests]=useState<AssetResetRequest[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [selected,setSelected]=useState<AssetResetRequest|null>(null)
 const [decision,setDecision]=useState<'approve'|'reject'>('approve')
 const [password,setPassword]=useState('')
 const [reviewNote,setReviewNote]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-manage-asset-reset-requests',{body:{action:'list'}})
   if(invokeError)throw new Error(await invokeErrorMessage(invokeError))
   if(data?.error)throw new Error(data.error)
   setRequests((data?.requests??[]) as AssetResetRequest[])
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[client])
 useEffect(()=>{void load()},[load])
 const begin=(request:AssetResetRequest,next:'approve'|'reject')=>{setSelected(request);setDecision(next);setPassword('');setReviewNote('');setConfirmed(false);setError('')}
 const cancel=()=>{setSelected(null);setPassword('');setReviewNote('');setConfirmed(false)}
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(!selected||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-manage-asset-reset-requests',{body:{action:decision,requestId:selected.id,password,confirmation:confirmed?'yes':'no',reviewNote}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã xử lý yêu cầu Reset.')
   cancel();await load()
  }catch(e){const message=await invokeErrorMessage(e);await load();setError(message)}
  finally{setBusy(false)}
 }
 return <section style={{marginTop:20}}>
  <div className="panel-head"><div><h3>Yêu cầu Reset thiết bị và vật tư</h3><p>Admin doanh nghiệp gửi yêu cầu; chỉ Superadmin mới có quyền phê duyệt và thực hiện Reset.</p></div><button className="soft-btn" onClick={()=>void load()} disabled={loading}>{loading?'Đang tải…':'Làm mới'}</button></div>
  {error&&<div className="auth-error">{error}</div>}{message&&<div className="cloud-message">{message}</div>}
  {loading?<div className="auth-note">Đang tải yêu cầu Reset…</div>:requests.length===0?<div className="table-empty-state">Chưa có yêu cầu Reset từ doanh nghiệp.</div>:<div className="table-wrap table-standard-wrap"><table className="table-standard"><thead><tr><th>Doanh nghiệp / ngày gửi</th><th>Người gửi</th><th>Dữ liệu tại thời điểm yêu cầu</th><th>Lý do / phản hồi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}>
   <td><b>{(request as AssetResetRequest&{organization_name?:string}).organization_name||request.organization_id}</b><small className="table-subtext">{dateTime(request.requested_at)}</small></td>
   <td>{request.requester_email||request.requester_user_id}</td><td>{number(request.cloud_assets_at_request)} thiết bị · {number(request.cloud_inventory_items_at_request)} vật tư · {number(request.cloud_inventory_movements_at_request)} giao dịch vật tư<br />{number(request.registered_devices_at_request)} thiết bị Local đã đăng ký</td>
   <td className="table-note-cell">{request.requester_note&&<small>Lý do: {request.requester_note}</small>}{request.review_note&&<small>Phản hồi: {request.review_note}</small>}{request.execution_error&&<small style={{color:'var(--danger,#b91c1c)'}}>Lỗi: {request.execution_error}</small>}{!request.requester_note&&!request.review_note&&!request.execution_error?'—':null}</td>
   <td><span className={'status '+resetStatusClass(request.status)}>{resetStatusLabel(request.status)}</span>{request.assets_deleted!==undefined&&<small className="table-subtext">Đã xóa {number(request.assets_deleted)} thiết bị + {number(request.inventory_items_deleted??0)} vật tư + {number(request.inventory_movements_deleted??0)} giao dịch · Gen {request.reset_generation}</small>}</td>
   <td><div className="table-action-group">{request.status==='pending'&&<><button className="primary-btn small" onClick={()=>begin(request,'approve')}>Duyệt và Reset</button><button className="soft-btn small" onClick={()=>begin(request,'reject')}>Từ chối</button></>}</div></td>
  </tr>)}</tbody></table></div>}
  {selected&&<div className="platform-action-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)cancel()}}>
   <section className="platform-action-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-reset-review-title">
    <div className="platform-action-head"><div><span className="platform-action-kicker">DUYỆT RESET THIẾT BỊ + VẬT TƯ</span><h3 id="asset-reset-review-title">{decision==='approve'?'Phê duyệt và thực hiện Reset':'Từ chối yêu cầu Reset'}</h3><p>{(selected as AssetResetRequest&{organization_name?:string}).organization_name||selected.organization_id}</p></div><button className="icon-btn" onClick={cancel} disabled={busy}>×</button></div>
    <div className="platform-action-danger"><b>{number(selected.cloud_assets_at_request)} thiết bị Cloud</b>, <b>{number(selected.cloud_inventory_items_at_request)} vật tư</b>, <b>{number(selected.cloud_inventory_movements_at_request)} giao dịch vật tư</b> và {number(selected.registered_devices_at_request)} thiết bị Local đã đăng ký tại thời điểm gửi yêu cầu. {decision==='approve'?'Khi xác nhận, hệ thống xóa toàn bộ dữ liệu thiết bị và vật tư trên Cloud ngay; Local sẽ xóa cả danh mục vật tư, tồn kho, lịch sử giao dịch và hàng đợi đồng bộ khi từng thiết bị kết nối lại.':'Yêu cầu sẽ được đóng mà không thay đổi dữ liệu.'}</div>
    {selected.requester_note&&<div className="platform-action-note">Lý do doanh nghiệp: {selected.requester_note}</div>}
    <form className="platform-action-form" onSubmit={submit}>
     <label className="field">{decision==='reject'?'Lý do từ chối *':'Phản hồi / ghi chú xử lý'}<textarea rows={3} maxLength={1000} required={decision==='reject'} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder={decision==='reject'?'Nêu rõ lý do từ chối yêu cầu này…':'Ghi chú xử lý (không bắt buộc)…'}/></label>
     <label className="field">Mật khẩu Superadmin *<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập lại mật khẩu Superadmin"/></label>
     <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,lineHeight:1.45}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Tôi đã kiểm tra yêu cầu và xác nhận {decision==='approve'?'phê duyệt, xóa sạch toàn bộ thiết bị và vật tư Cloud/Local':'từ chối yêu cầu này'}.</span></label>
     {error&&<div className="auth-error">{error}</div>}
     <div className="platform-action-buttons"><button type="button" className="soft-btn" onClick={cancel} disabled={busy}>Hủy</button><button type="submit" className={decision==='approve'?'danger-btn':'primary-btn'} disabled={busy||!confirmed||!password}>{busy?'Đang xử lý…':decision==='approve'?'Xác nhận duyệt và Reset':'Xác nhận từ chối'}</button></div>
    </form>
   </section>
  </div>}
 </section>
}


type OrganizationNameChangeRequest={
 id:string;organization_id:string;organization_name?:string;old_name:string;requested_name:string;
 requester_user_id:string;requester_email?:string;status:'pending'|'approved'|'rejected';
 requester_note:string;review_note:string;requested_at:string;reviewed_at?:string
}
const nameStatus=(status:OrganizationNameChangeRequest['status'])=>status==='approved'?'Đã duyệt':status==='rejected'?'Từ chối':'Chờ duyệt'
const nameStatusClass=(status:OrganizationNameChangeRequest['status'])=>status==='approved'?'green':status==='rejected'?'red':'orange'

export function OrganizationNameChangeRequestPanel({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [currentName,setCurrentName]=useState('')
 const [requestedName,setRequestedName]=useState('')
 const [note,setNote]=useState('')
 const [requests,setRequests]=useState<OrganizationNameChangeRequest[]>([])
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[message,setMessage]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const [org,history]=await Promise.all([
    client.from('organizations').select('name').eq('id',organizationId).single(),
    client.functions.invoke('organization-name-change-requests',{body:{action:'list',organizationId}})
   ])
   if(org.error)throw org.error
   if(history.error)throw new Error(await invokeErrorMessage(history.error))
   if(history.data?.error)throw new Error(history.data.error)
   setCurrentName(org.data.name)
   setRequests((history.data?.requests??[]) as OrganizationNameChangeRequest[])
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[client,organizationId])
 useEffect(()=>{void load()},[load])
 const pending=requests.some(r=>r.status==='pending')
 const submit=async(e:FormEvent)=>{
  e.preventDefault()
  if(busy||pending)return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error}=await client.functions.invoke('organization-name-change-requests',{body:{action:'submit',organizationId,requestedName:requestedName.trim(),note:note.trim()}})
   if(error)throw new Error(await invokeErrorMessage(error))
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã gửi yêu cầu đổi tên doanh nghiệp.')
   setRequestedName('');setNote('');await load()
  }catch(e){setError(await invokeErrorMessage(e))}
  finally{setBusy(false)}
 }
 return <section className="organization-name-request-section">
  <div className="panel-head reset-request-head"><div><h3>Yêu cầu đổi tên doanh nghiệp</h3><p>Áp dụng khi doanh nghiệp thay đổi tên pháp lý hoặc tên giao dịch.</p></div><button type="button" className="soft-btn" onClick={()=>void load()} disabled={loading||busy}>Làm mới</button></div>
  {error&&<div className="auth-error">{error}</div>}{message&&<div className="cloud-message">{message}</div>}
  {loading?<div className="auth-note">Đang tải thông tin doanh nghiệp…</div>:<>
   <div className="organization-name-current"><span>Tên đang sử dụng</span><b>{currentName||'—'}</b></div>
   {pending?<div className="auth-note"><b>Đang có yêu cầu đổi tên chờ duyệt.</b> Không thể gửi yêu cầu khác cho đến khi Super Admin xử lý.</div>:
    <form className="form-grid organization-name-form" onSubmit={submit}>
     <label className="field full-field">Tên doanh nghiệp mới *<input required minLength={2} maxLength={160} value={requestedName} onChange={e=>setRequestedName(e.target.value)} placeholder="Nhập tên doanh nghiệp sau khi thay đổi"/></label>
     <label className="field full-field">Ghi chú / lý do (không bắt buộc)<textarea rows={2} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ví dụ: thay đổi tên theo giấy chứng nhận đăng ký doanh nghiệp…"/></label>
     <div className="auth-note full-field">Gửi yêu cầu không đổi tên ngay. Super Admin sẽ kiểm tra hồ sơ và phê duyệt. Khi được duyệt, tên mới cập nhật trên hệ thống; mã doanh nghiệp, tài khoản, thiết bị, vật tư, lịch sử và Plan được giữ nguyên.</div>
     <div className="modal-actions full-field"><button type="submit" className="primary-btn" disabled={busy||requestedName.trim().length<2||requestedName.trim().toLocaleLowerCase('vi')===currentName.trim().toLocaleLowerCase('vi')}>{busy?'Đang gửi…':'Gửi yêu cầu đổi tên'}</button></div>
    </form>}
   <h3 className="reset-history-heading">Lịch sử yêu cầu đổi tên</h3>
   {requests.length===0?<div className="table-empty-state">Chưa có yêu cầu đổi tên.</div>:<div className="table-wrap table-standard-wrap name-change-history-wrap"><table className="table-standard name-change-history-table"><thead><tr><th>Tên cũ → tên mới</th><th>Ngày gửi</th><th>Ghi chú / phản hồi</th><th>Trạng thái</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td><b>{r.old_name}</b><div>→ {r.requested_name}</div></td><td>{dateTime(r.requested_at)}</td><td className="table-note-cell">{r.requester_note&&<small>Lý do: {r.requester_note}</small>}{r.review_note&&<small>Phản hồi: {r.review_note}</small>}{!r.requester_note&&!r.review_note?'—':null}</td><td><span className={'status '+nameStatusClass(r.status)}>{nameStatus(r.status)}</span></td></tr>)}</tbody></table></div>}
  </>}
 </section>
}

export function PlatformNameChangeRequestsPanel({client}:{client:SupabaseClient}){
 const [requests,setRequests]=useState<OrganizationNameChangeRequest[]>([])
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [selected,setSelected]=useState<OrganizationNameChangeRequest|null>(null)
 const [decision,setDecision]=useState<'approve'|'reject'>('approve')
 const [password,setPassword]=useState(''),[reviewNote,setReviewNote]=useState('')
 const [confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{const {data,error}=await client.functions.invoke('platform-manage-organization-name-change-requests',{body:{action:'list'}})
   if(error)throw new Error(await invokeErrorMessage(error))
   if(data?.error)throw new Error(data.error)
   setRequests((data?.requests??[]) as OrganizationNameChangeRequest[])
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[client])
 useEffect(()=>{void load()},[load])
 const begin=(r:OrganizationNameChangeRequest,d:'approve'|'reject')=>{setSelected(r);setDecision(d);setPassword('');setReviewNote('');setConfirmed(false);setError('')}
 const cancel=()=>{setSelected(null);setPassword('');setReviewNote('');setConfirmed(false)}
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(!selected||busy)return
  if(decision==='reject'&&!reviewNote.trim()){setError('Bắt buộc nhập lý do từ chối.');return}
  setBusy(true);setError('');setMessage('')
  try{const {data,error}=await client.functions.invoke('platform-manage-organization-name-change-requests',{body:{action:decision,requestId:selected.id,password,confirmation:confirmed?'yes':'no',reviewNote}})
   if(error)throw new Error(await invokeErrorMessage(error))
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã xử lý yêu cầu đổi tên.');cancel();await load()
  }catch(e){setError(await invokeErrorMessage(e))}
  finally{setBusy(false)}
 }
 return <section className="platform-name-requests">
  <div className="panel-head"><div><h3>Yêu cầu đổi tên doanh nghiệp</h3><p>Kiểm tra tên mới trước khi phê duyệt; mọi lần đổi tên đều được lưu lịch sử.</p></div><button className="soft-btn" onClick={()=>void load()} disabled={loading}>Làm mới</button></div>
  {error&&<div className="auth-error">{error}</div>}{message&&<div className="cloud-message">{message}</div>}
  {loading?<div className="auth-note">Đang tải yêu cầu đổi tên…</div>:requests.length===0?<div className="table-empty-state">Chưa có yêu cầu đổi tên doanh nghiệp.</div>:
   <div className="table-wrap table-standard-wrap name-change-platform-table-wrap"><table className="table-standard name-change-platform-table"><thead><tr><th>Doanh nghiệp</th><th>Tên cũ → tên mới</th><th>Người gửi</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td><b>{r.organization_name||r.organization_id}</b><small className="table-subtext">{dateTime(r.requested_at)}</small></td><td><b>{r.old_name}</b><div>→ {r.requested_name}</div></td><td>{r.requester_email||r.requester_user_id}</td><td className="table-note-cell">{r.requester_note||r.review_note||'—'}</td><td><span className={'status '+nameStatusClass(r.status)}>{nameStatus(r.status)}</span></td><td><div className="table-action-group">{r.status==='pending'&&<><button className="primary-btn small" onClick={()=>begin(r,'approve')}>Duyệt</button><button className="soft-btn small" onClick={()=>begin(r,'reject')}>Từ chối</button></>}</div></td></tr>)}</tbody></table></div>}
  {selected&&<div className="platform-action-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)cancel()}}><section className="platform-action-dialog" role="dialog" aria-modal="true" aria-labelledby="name-review-title">
   <div className="platform-action-head"><div><span className="platform-action-kicker">XỬ LÝ YÊU CẦU ĐỔI TÊN</span><h3 id="name-review-title">{decision==='approve'?'Phê duyệt tên doanh nghiệp mới':'Từ chối yêu cầu đổi tên'}</h3><p>{selected.organization_name||selected.organization_id}</p></div><button className="icon-btn" onClick={cancel} disabled={busy}>×</button></div>
   <div className="platform-action-note"><b>{selected.old_name}</b><br/>↓<br/><b>{selected.requested_name}</b><p>Phê duyệt chỉ cập nhật tên tổ chức; không thay đổi mã tổ chức, tài khoản, thiết bị, vật tư, lịch sử hoặc Plan.</p></div>
   <form className="platform-action-form" onSubmit={submit}>
    <label className="field">Ghi chú xử lý<textarea rows={2} maxLength={1000} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Ghi chú nội bộ hoặc lý do từ chối…"/></label>
    <label className="field">Mật khẩu Super Admin *<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập lại mật khẩu"/></label>
    <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,lineHeight:1.45}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Tôi đã kiểm tra thông tin tên mới và xác nhận {decision==='approve'?'phê duyệt':'từ chối'} yêu cầu.</span></label>
    {error&&<div className="auth-error">{error}</div>}
    <div className="platform-action-buttons"><button type="button" className="soft-btn" onClick={cancel} disabled={busy}>Hủy</button><button type="submit" className={decision==='approve'?'primary-btn':'danger-btn'} disabled={busy||!confirmed||!password||(decision==='reject'&&!reviewNote.trim())}>{busy?'Đang xử lý…':decision==='approve'?'Xác nhận phê duyệt':'Xác nhận từ chối'}</button></div>
   </form>
  </section></div>}
 </section>
}
