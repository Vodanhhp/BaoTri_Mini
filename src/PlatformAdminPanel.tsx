import {useCallback,useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'

type Props={client:SupabaseClient;onClose:()=>void}
type Created={organizationId:string;organizationName:string;adminEmail:string;status:string;createdAuthUser:boolean;message:string}
type OrganizationRow={id:string;name:string;status:string;createdAt:string;totalMembers:number;activeMembers:number;invitedMembers:number;suspendedMembers:number;uniqueUsers:number}
type Overview={organizationsTotal:number;organizationsActive:number;organizationsSuspended:number;authAccountsTotal:number;confirmedAccounts:number;unconfirmedAccounts:number;membershipsTotal:number;activeMemberships:number;invitedMemberships:number;suspendedMemberships:number;organizations:OrganizationRow[]}
type LifecycleAction='suspend'|'reactivate'|'delete'

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
 const [management,setManagement]=useState<{organization:OrganizationRow;action:LifecycleAction}|null>(null)
 const [managementPassword,setManagementPassword]=useState('')
 const [managementAnswer,setManagementAnswer]=useState('')
 const [typedOrganizationName,setTypedOrganizationName]=useState('')
 const [managementBusy,setManagementBusy]=useState(false)
 const [managementError,setManagementError]=useState('')
 const [managementSuccess,setManagementSuccess]=useState('')

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

 const beginManagement=(organization:OrganizationRow,action:LifecycleAction)=>{
  setManagement({organization,action});setManagementPassword('');setManagementAnswer('');setTypedOrganizationName('');setManagementError('');setManagementSuccess('')
 }
 const cancelManagement=()=>{
  setManagement(null);setManagementPassword('');setManagementAnswer('');setTypedOrganizationName('');setManagementError('')
 }
 const submitManagement=async(e:FormEvent)=>{
  e.preventDefault()
  if(!management||managementBusy)return
  setManagementError('')
  if(managementAnswer!=='yes'){setManagementError('Bạn cần chọn Có để xác nhận thao tác.');return}
  if(!managementPassword){setManagementError('Hãy nhập mật khẩu Super Admin.');return}
  if(management.action==='delete'&&typedOrganizationName!==management.organization.name){setManagementError('Tên tổ chức nhập lại chưa khớp chính xác.');return}
  setManagementBusy(true)
  try{
   const {data,error}=await client.functions.invoke('platform-manage-organization',{body:{
    action:management.action,
    organizationId:management.organization.id,
    organizationName:management.organization.name,
    confirmName:typedOrganizationName,
    password:managementPassword,
    confirmation:managementAnswer
   }})
   if(error)throw new Error(error.message)
   if(data?.error)throw new Error(data.error)
   const label=management.action==='suspend'?'đã tạm ngưng':management.action==='reactivate'?'đã kích hoạt lại':'đã xóa vĩnh viễn'
   setManagementSuccess(`Tổ chức "${management.organization.name}" ${label} thành công.`)
   cancelManagement()
   await loadOverview()
  }catch(e){setManagementError(e instanceof Error?e.message:String(e))}
  finally{setManagementBusy(false)}
 }

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
   <div className="table-wrap" style={{marginTop:14}}><table><thead><tr><th>Doanh nghiệp</th><th>Trạng thái</th><th>Tài khoản trong DN</th><th>Đang hoạt động</th><th>Chờ xác nhận</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
    {overview.organizations.map(org=><tr key={org.id}><td><b>{org.name}</b></td><td><span className={'status '+(org.status==='active'?'green':'gray')}>{org.status==='active'?'Đang hoạt động':'Tạm khóa'}</span></td><td>{number(org.uniqueUsers)}</td><td>{number(org.activeMembers)}</td><td>{number(org.invitedMembers)}</td><td>{date(org.createdAt)}</td><td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{org.status==='active'?<button type="button" className="soft-btn" onClick={()=>beginManagement(org,'suspend')}>Tạm ngưng</button>:<button type="button" className="soft-btn" onClick={()=>beginManagement(org,'reactivate')}>Kích hoạt</button>}<button type="button" className="soft-btn" style={{color:'var(--danger,#b91c1c)'}} onClick={()=>beginManagement(org,'delete')}>Xóa</button></div></td></tr>)}
    {!overview.organizations.length&&<tr><td colSpan={7}>Chưa có doanh nghiệp nào.</td></tr>}
   </tbody></table></div>
   <div className="auth-note" style={{marginTop:10}}>Tài khoản Auth được đếm duy nhất trên toàn nền tảng. Một tài khoản tham gia nhiều doanh nghiệp chỉ tính một lần ở tổng Auth, nhưng được tính một lượt trong từng doanh nghiệp.</div>
  </>}
  {managementSuccess&&<div className="cloud-message" style={{marginTop:12}}>{managementSuccess}</div>}
  {management&&<div className="card" style={{marginTop:16,padding:16,border:'1px solid var(--border,#e5e7eb)'}}>
   <div className="panel-head"><div><h3>{management.action==='suspend'?'Xác nhận tạm ngưng tổ chức':management.action==='reactivate'?'Xác nhận kích hoạt tổ chức':'Xác nhận xóa vĩnh viễn tổ chức'}</h3><p><b>{management.organization.name}</b></p></div></div>
   {management.action==='suspend'&&<div className="auth-note">Tổ chức sẽ bị chặn truy cập. Thành viên không thể làm việc trong tổ chức này; toàn bộ dữ liệu Cloud vẫn được giữ nguyên. Có thể kích hoạt lại sau.</div>}
   {management.action==='reactivate'&&<div className="auth-note">Tổ chức sẽ hoạt động trở lại. Thành viên có membership hợp lệ có thể đăng nhập và truy cập lại.</div>}
   {management.action==='delete'&&<div className="auth-error">CẢNH BÁO: Thao tác không thể hoàn tác. Dữ liệu Cloud của tổ chức, thiết bị, thành viên và phân quyền sẽ bị xóa. Tài khoản Auth và hồ sơ cá nhân của thành viên được giữ nguyên. Bản Local đã tải về trên thiết bị từng thành viên không thể bị xóa từ xa.</div>}
   <form className="form-grid" onSubmit={submitManagement}>
    {management.action==='delete'&&<label className="field full-field">Nhập chính xác tên tổ chức để xác nhận *<input required value={typedOrganizationName} onChange={e=>setTypedOrganizationName(e.target.value)} placeholder={management.organization.name}/></label>}
    <label className="field full-field">Mật khẩu Super Admin *<input required type="password" autoComplete="current-password" value={managementPassword} onChange={e=>setManagementPassword(e.target.value)} placeholder="Nhập lại mật khẩu tài khoản Super Admin"/></label>
    <label className="field full-field">Bạn có chắc chắn muốn {management.action==='suspend'?'tạm ngưng':management.action==='reactivate'?'kích hoạt lại':'xóa vĩnh viễn'} tổ chức này không? *
     <select required value={managementAnswer} onChange={e=>setManagementAnswer(e.target.value)}><option value="">-- Chọn Có hoặc Không --</option><option value="yes">Có</option><option value="no">Không</option></select>
    </label>
    {managementError&&<div className="auth-error full-field">{managementError}</div>}
    <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={cancelManagement} disabled={managementBusy}>Hủy</button><button className="primary-btn" disabled={managementBusy}>{managementBusy?'Đang xác thực và xử lý…':'Xác nhận thao tác'}</button></div>
   </form>
  </div>}

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
