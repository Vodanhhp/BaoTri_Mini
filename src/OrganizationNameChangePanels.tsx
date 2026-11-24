import {useCallback,useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDateTimeVN} from './lib/dateTime'

type NameRequest={
 id:string;organization_id:string;organization_name?:string;current_name:string;requested_name:string;
 request_note:string;status:'pending'|'approved'|'rejected';requested_at:string;
 requested_by_user_id:string;requested_by_email?:string;requested_by_name?:string;
 reviewed_at?:string;review_note?:string
}
const dateTime=(value:string)=>value?formatDateTimeVN(value):'—'
const errorMessage=async(error:unknown)=>{
 const fallback=error instanceof Error?error.message:String(error)
 const context=(error as {context?:unknown}|null)?.context
 if(context instanceof Response){
  try{const payload=await context.clone().json() as {error?:unknown;message?:unknown};if(typeof payload.error==='string'&&payload.error.trim())return payload.error;if(typeof payload.message==='string'&&payload.message.trim())return payload.message}catch{/* use fallback */}
 }
 return fallback
}

export function OrganizationNameChangePanel({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [organizationName,setOrganizationName]=useState('')
 const [requests,setRequests]=useState<NameRequest[]>([])
 const [requestedName,setRequestedName]=useState('')
 const [note,setNote]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const [org,response]=await Promise.all([
    client.from('organizations').select('name').eq('id',organizationId).maybeSingle(),
    client.functions.invoke('organization-name-change-requests',{body:{action:'list',organizationId}})
   ])
   if(org.error)throw new Error('Không tải được tên doanh nghiệp: '+org.error.message)
   if(!org.data)throw new Error('Không tìm thấy thông tin doanh nghiệp.')
   if(response.error)throw new Error(await errorMessage(response.error))
   if(response.data?.error)throw new Error(response.data.error)
   setOrganizationName(org.data.name)
   setRequests((response.data?.requests??[]) as NameRequest[])
  }catch(e){setError(await errorMessage(e))}
  finally{setLoading(false)}
 },[client,organizationId])
 useEffect(()=>{void load()},[load])
 const pending=requests.find(item=>item.status==='pending')
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(busy||pending)return
  const cleanName=requestedName.trim()
  if(cleanName.length<2||cleanName.length>160){setError('Tên doanh nghiệp mới phải có từ 2 đến 160 ký tự.');return}
  if(cleanName.toLocaleLowerCase('vi')===organizationName.trim().toLocaleLowerCase('vi')){setError('Tên mới đang trùng tên doanh nghiệp hiện tại.');return}
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('organization-name-change-requests',{body:{action:'submit',organizationId,requestedName:cleanName,note:note.trim()}})
   if(invokeError)throw new Error(await errorMessage(invokeError))
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã gửi yêu cầu đổi tên doanh nghiệp.')
   setRequestedName('');setNote('')
   await load()
  }catch(e){await load();setError(await errorMessage(e))}
  finally{setBusy(false)}
 }
 return <section className="organization-change-card organization-name-change-card">
  <div className="organization-change-card-head"><div><span className="organization-change-kicker">THÔNG TIN PHÁP LÝ</span><h3>Đổi tên doanh nghiệp</h3></div><button type="button" className="soft-btn small" onClick={()=>void load()} disabled={loading||busy}>Làm mới</button></div>
  {loading?<div className="auth-note">Đang tải tên doanh nghiệp…</div>:<>
   <div className="organization-current-name"><small>Tên đang sử dụng</small><b>{organizationName}</b></div>
   {pending?<div className="auth-note organization-pending-name"><b>Đang có yêu cầu chờ duyệt</b><span>{pending.current_name} → {pending.requested_name}</span><small>Gửi lúc {dateTime(pending.requested_at)}. Chưa thể gửi yêu cầu đổi tên khác.</small>{pending.request_note&&<small>Lý do: {pending.request_note}</small>}</div>:<form className="organization-name-form" onSubmit={submit}>
    <label className="field">Tên doanh nghiệp mới *<input required minLength={2} maxLength={160} value={requestedName} onChange={e=>setRequestedName(e.target.value)} placeholder="Nhập tên doanh nghiệp theo giấy tờ mới"/></label>
    <label className="field">Lý do / ghi chú (không bắt buộc)<textarea rows={2} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ví dụ: doanh nghiệp đã thay đổi tên pháp lý…"/></label>
    <p className="organization-name-hint">Tên hiện tại vẫn được giữ nguyên cho đến khi Super Admin đối chiếu giấy tờ pháp lý phù hợp và duyệt. Việc đổi tên không làm thay đổi mã tổ chức, tài khoản, thiết bị, vật tư, Plan hoặc lịch sử. Sau khi được duyệt, tải lại trang để tên mới cập nhật ở các khu vực đang mở.</p>
    <button type="submit" className="primary-btn" disabled={busy||requestedName.trim().length<2}>{busy?'Đang gửi…':'Gửi yêu cầu đổi tên'}</button>
   </form>}
   {requests.length>0&&<div className="organization-name-history"><b>Lịch sử đổi tên</b>{requests.map(request=><div className="organization-name-history-row" key={request.id}><div><span>{request.current_name} → {request.requested_name}</span><small>{dateTime(request.requested_at)}{request.request_note?' · '+request.request_note:''}</small>{request.review_note&&<small>Phản hồi: {request.review_note}</small>}</div><span className={'status '+(request.status==='approved'?'green':request.status==='rejected'?'red':'orange')}>{request.status==='approved'?'Đã duyệt':request.status==='rejected'?'Từ chối':'Chờ duyệt'}</span></div>)}</div>}
  </>}
  {error&&<div className="auth-error">{error}</div>}
  {message&&<div className="cloud-message">{message}</div>}
 </section>
}

export function PlatformOrganizationNameRequestsPanel({client}:{client:SupabaseClient}){
 const [requests,setRequests]=useState<NameRequest[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [selected,setSelected]=useState<NameRequest|null>(null)
 const [decision,setDecision]=useState<'approve'|'reject'>('approve')
 const [password,setPassword]=useState('')
 const [reviewNote,setReviewNote]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-manage-organization-name-requests',{body:{action:'list'}})
   if(invokeError)throw new Error(await errorMessage(invokeError))
   if(data?.error)throw new Error(data.error)
   setRequests((data?.requests??[]) as NameRequest[])
  }catch(e){setError(await errorMessage(e))}
  finally{setLoading(false)}
 },[client])
 useEffect(()=>{void load()},[load])
 const begin=(request:NameRequest,next:'approve'|'reject')=>{setSelected(request);setDecision(next);setPassword('');setReviewNote('');setConfirmed(false);setError('')}
 const cancel=()=>{setSelected(null);setPassword('');setReviewNote('');setConfirmed(false)}
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(!selected||busy)return
  if(decision==='reject'&&!reviewNote.trim()){setError('Bắt buộc nhập lý do từ chối yêu cầu.');return}
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-manage-organization-name-requests',{body:{
    action:decision,requestId:selected.id,password,confirmation:confirmed?'yes':'no',reviewNote
   }})
   if(invokeError)throw new Error(await errorMessage(invokeError))
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã xử lý yêu cầu đổi tên doanh nghiệp.')
   cancel();await load()
  }catch(e){setError(await errorMessage(e))}
  finally{setBusy(false)}
 }
 const pendingCount=requests.filter(request=>request.status==='pending').length
 return <section className="platform-name-requests-section">
  <div className="panel-head"><div><h3>Yêu cầu đổi tên doanh nghiệp</h3><p>{pendingCount} yêu cầu đang chờ duyệt · tên chỉ đổi sau khi xác nhận.</p></div><button className="soft-btn" onClick={()=>void load()} disabled={loading}>{loading?'Đang tải…':'Làm mới'}</button></div>
  {error&&<div className="auth-error">{error}</div>}{message&&<div className="cloud-message">{message}</div>}
  {loading?<div className="auth-note">Đang tải yêu cầu đổi tên…</div>:requests.length===0?<div className="table-empty-state">Chưa có yêu cầu đổi tên doanh nghiệp.</div>:<div className="table-wrap table-standard-wrap platform-name-requests-table-wrap"><table className="table-standard platform-name-requests-table"><thead><tr><th>Doanh nghiệp</th><th>Tên hiện tại → tên mới</th><th>Người gửi</th><th>Lý do / phản hồi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}><td><b>{request.organization_name||request.organization_id}</b><small className="table-subtext">{dateTime(request.requested_at)}</small></td><td><b>{request.current_name} → {request.requested_name}</b></td><td><b>{request.requested_by_name||request.requested_by_email||request.requested_by_user_id}</b>{request.requested_by_email&&request.requested_by_name&&<small className="table-subtext">{request.requested_by_email}</small>}</td><td className="table-note-cell">{request.request_note&&<small>Lý do: {request.request_note}</small>}{request.review_note&&<small>Phản hồi: {request.review_note}</small>}{!request.request_note&&!request.review_note?'—':null}</td><td><span className={'status '+(request.status==='approved'?'green':request.status==='rejected'?'red':'orange')}>{request.status==='approved'?'Đã duyệt':request.status==='rejected'?'Từ chối':'Chờ duyệt'}</span></td><td><div className="table-action-group">{request.status==='pending'&&<><button className="primary-btn small" onClick={()=>begin(request,'approve')}>Duyệt</button><button className="soft-btn small" onClick={()=>begin(request,'reject')}>Từ chối</button></>}</div></td></tr>)}</tbody></table></div>}
  {selected&&<div className="platform-action-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)cancel()}}><section className="platform-action-dialog" role="dialog" aria-modal="true" aria-labelledby="organization-name-review-title">
   <div className="platform-action-head"><div><span className="platform-action-kicker">XỬ LÝ YÊU CẦU ĐỔI TÊN</span><h3 id="organization-name-review-title">{decision==='approve'?'Duyệt và cập nhật tên':'Từ chối yêu cầu đổi tên'}</h3><p>{selected.organization_name||selected.organization_id}</p></div><button className="icon-btn" onClick={cancel} disabled={busy}>×</button></div>
   <div className="platform-action-note"><b>{selected.current_name} → {selected.requested_name}</b><br/>Chỉ duyệt sau khi đối chiếu giấy tờ pháp lý/ủy quyền phù hợp. Khi duyệt, chỉ cập nhật tên hiển thị; mã tổ chức, thành viên, Plan, thiết bị, vật tư và lịch sử được giữ nguyên.</div>
   {selected.request_note&&<div className="platform-action-note">Lý do doanh nghiệp: {selected.request_note}</div>}
   <form className="platform-action-form" onSubmit={submit}>
    <label className="field">{decision==='reject'?'Lý do từ chối *':'Phản hồi / ghi chú xử lý'}<textarea rows={3} maxLength={1000} required={decision==='reject'} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder={decision==='reject'?'Nêu rõ lý do từ chối…':'Ghi chú xử lý (không bắt buộc)…'}/></label>
    <label className="field">Mật khẩu Super Admin *<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập lại mật khẩu Super Admin"/></label>
    <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,lineHeight:1.45}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Tôi đã đối chiếu giấy tờ pháp lý/ủy quyền và xác nhận {decision==='approve'?'cập nhật tên doanh nghiệp mới':'từ chối yêu cầu này'}.</span></label>
    {error&&<div className="auth-error">{error}</div>}
    <div className="platform-action-buttons"><button type="button" className="soft-btn" onClick={cancel} disabled={busy}>Hủy</button><button type="submit" className={decision==='approve'?'primary-btn':'danger-btn'} disabled={busy||!confirmed||!password}>{busy?'Đang xử lý…':decision==='approve'?'Xác nhận duyệt':'Xác nhận từ chối'}</button></div>
   </form>
  </section></div>}
 </section>
}
