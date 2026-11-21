import {useCallback,useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'

type Props={client:SupabaseClient;onClose:()=>void}
type Created={organizationId:string;organizationName:string;adminEmail:string;status:string;createdAuthUser:boolean;message:string}
type OrganizationRow={id:string;name:string;status:string;createdAt:string;totalMembers:number;activeMembers:number;invitedMembers:number;suspendedMembers:number;uniqueUsers:number}
type Overview={organizationsTotal:number;organizationsActive:number;organizationsSuspended:number;authAccountsTotal:number;confirmedAccounts:number;unconfirmedAccounts:number;membershipsTotal:number;activeMemberships:number;invitedMemberships:number;suspendedMemberships:number;organizations:OrganizationRow[]}

const number=(value:number)=>new Intl.NumberFormat('vi-VN').format(value)
const date=(value:string)=>value?new Date(value).toLocaleDateString('vi-VN'):'—'

export default function PlatformAdminPanel({client,onClose}:Props){
 const [organizationName,setOrganizationName]=useState('')
 const [adminEmail,setAdminEmail]=useState('')
 const [adminName,setAdminName]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [created,setCreated]=useState<Created|null>(null)
 const [overview,setOverview]=useState<Overview|null>(null)
 const [loadingOverview,setLoadingOverview]=useState(true)
 const [overviewError,setOverviewError]=useState('')

 const loadOverview=useCallback(async()=>{
  setLoadingOverview(true);setOverviewError('')
  try{
   const {data,error}=await client.functions.invoke('platform-get-overview',{body:{}})
   if(error)throw new Error(error.message)
   if(data?.error)throw new Error(data.error)
   setOverview(data as Overview)
  }catch(e){setOverviewError(e instanceof Error?e.message:String(e))}
  finally{setLoadingOverview(false)}
 },[client])
 useEffect(()=>{void loadOverview()},[loadOverview])

 const submit=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setCreated(null)
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-create-customer',{body:{organizationName:organizationName.trim(),adminEmail:adminEmail.trim(),adminName:adminName.trim()}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setCreated(data as Created)
   setOrganizationName('');setAdminEmail('');setAdminName('')
   await loadOverview()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal member-modal" style={{width:'min(1000px,96vw)',maxHeight:'92vh',overflowY:'auto'}}>
  <div className="modal-head"><div><div className="eyebrow">CHỦ SỞ HỮU NỀN TẢNG</div><h2>Quản trị nền tảng</h2><p>Theo dõi toàn bộ doanh nghiệp và tài khoản trong BAOTRI Mini.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>

  <div className="panel-head" style={{marginTop:8}}><div><h3>Tổng quan hệ thống</h3><p>Số liệu trực tiếp từ Supabase Auth và cơ sở dữ liệu.</p></div><button type="button" className="soft-btn" onClick={()=>void loadOverview()} disabled={loadingOverview}>{loadingOverview?'Đang tải…':'Làm mới số liệu'}</button></div>
  {overviewError&&<div className="auth-error">{overviewError}</div>}
  {loadingOverview&&!overview&&<div className="auth-note">Đang tải thống kê nền tảng…</div>}
  {overview&&<>
   <div className="stat-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))'}}>
    <div className="stat-card"><div className="stat-icon blue">DN</div><div><small>Tổng doanh nghiệp</small><strong>{number(overview.organizationsTotal)}</strong><span>{number(overview.organizationsActive)} đang hoạt động · {number(overview.organizationsSuspended)} tạm khóa</span></div></div>
    <div className="stat-card"><div className="stat-icon purple">TK</div><div><small>Tài khoản Auth duy nhất</small><strong>{number(overview.authAccountsTotal)}</strong><span>{number(overview.confirmedAccounts)} đã xác nhận · {number(overview.unconfirmedAccounts)} chưa xác nhận</span></div></div>
    <div className="stat-card"><div className="stat-icon orange">TV</div><div><small>Tổng lượt tham gia</small><strong>{number(overview.membershipsTotal)}</strong><span>Không phải số tài khoản duy nhất</span></div></div>
    <div className="stat-card"><div className="stat-icon green">OK</div><div><small>Membership hoạt động</small><strong>{number(overview.activeMemberships)}</strong><span>{number(overview.invitedMemberships)} chờ xác nhận · {number(overview.suspendedMemberships)} tạm ngưng</span></div></div>
   </div>
   <div className="table-wrap" style={{marginTop:14}}><table><thead><tr><th>Doanh nghiệp</th><th>Trạng thái</th><th>Tài khoản trong DN</th><th>Đang hoạt động</th><th>Chờ xác nhận</th><th>Ngày tạo</th></tr></thead><tbody>
    {overview.organizations.map(org=><tr key={org.id}><td><b>{org.name}</b></td><td><span className={'status '+(org.status==='active'?'green':'gray')}>{org.status==='active'?'Đang hoạt động':'Tạm khóa'}</span></td><td>{number(org.uniqueUsers)}</td><td>{number(org.activeMembers)}</td><td>{number(org.invitedMembers)}</td><td>{date(org.createdAt)}</td></tr>)}
    {!overview.organizations.length&&<tr><td colSpan={6}>Chưa có doanh nghiệp nào.</td></tr>}
   </tbody></table></div>
   <div className="auth-note" style={{marginTop:10}}>Tài khoản Auth được đếm duy nhất trên toàn nền tảng. Một tài khoản tham gia nhiều doanh nghiệp chỉ tính một lần ở tổng Auth, nhưng được tính một lượt trong từng doanh nghiệp.</div>
  </>}

  <div className="divider" style={{margin:'22px 0',borderTop:'1px solid var(--border,#e5e7eb)'}}/>
  <div className="panel-head"><div><h3>Tạo khách hàng mới</h3><p>Tạo tổ chức riêng và cấp quyền Admin đầu tiên cho khách hàng.</p></div></div>
  <form className="form-grid" onSubmit={submit}>
   <label className="field full-field">Tên doanh nghiệp / tổ chức *<input required minLength={2} maxLength={120} value={organizationName} onChange={e=>setOrganizationName(e.target.value)} placeholder="Ví dụ: Công ty ABC"/></label>
   <label className="field full-field">Email Admin đầu tiên *<input type="email" required value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@company.com"/></label>
   <label className="field full-field">Tên người đại diện<input maxLength={120} value={adminName} onChange={e=>setAdminName(e.target.value)} placeholder="Họ và tên"/></label>
   {error&&<div className="auth-error full-field">{error}</div>}
   {created&&<div className="cloud-message full-field"><b>Đã tạo tổ chức {created.organizationName}.</b><br/>Admin: {created.adminEmail}<br/>Trạng thái: {created.status}<br/>{created.message}</div>}
   <div className="auth-note full-field">Admin nhận email mời để xác nhận và tự đặt mật khẩu. Nếu email đã có tài khoản BAOTRI, hệ thống sẽ gắn tài khoản đó vào tổ chức mới. Mỗi tổ chức có dữ liệu và quyền riêng.</div>
   <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button><button className="primary-btn" disabled={busy}>{busy?'Đang khởi tạo…':'Tạo khách hàng'}</button></div>
  </form>
 </section></div>
}
