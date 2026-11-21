import {useCallback,useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import { isPcPlatform } from './lib/platform'

type Props={client:SupabaseClient;onClose:()=>void}
type PlanOption={id:'A'|'B'|'C'|'D';name:string;maxDevices:number|null;features:{equipmentGroups:boolean;multipleSites:boolean};idRule:string}
type Created={organizationId:string;organizationName:string;adminEmail:string;status:string;createdAuthUser:boolean;planCode:string;planName:string;sourceDataVersion:string;equipmentGroups:number;equipmentDictionary:number;industries:number;message:string}
type OrganizationRow={id:string;name:string;status:string;createdAt:string;totalMembers:number;activeMembers:number;invitedMembers:number;suspendedMembers:number;uniqueUsers:number;planCode:string|null;planName:string|null;sourceDataVersion:string|null}
type Overview={organizationsTotal:number;organizationsActive:number;organizationsSuspended:number;authAccountsTotal:number;confirmedAccounts:number;unconfirmedAccounts:number;membershipsTotal:number;activeMemberships:number;invitedMemberships:number;suspendedMemberships:number;organizations:OrganizationRow[]}
type LifecycleAction='suspend'|'reactivate'|'delete'

const number=(value:number)=>new Intl.NumberFormat('vi-VN').format(value)
const date=(value:string)=>value?new Date(value).toLocaleDateString('vi-VN'):'—'

export default function PlatformAdminPanel({client,onClose}:Props){
 const [organizationName,setOrganizationName]=useState('')
 const [adminEmail,setAdminEmail]=useState('')
 const [adminName,setAdminName]=useState('')
 const [planCode,setPlanCode]=useState<PlanOption['id']|''>('')
 const [planOptions,setPlanOptions]=useState<PlanOption[]>([])
 const [planLoadError,setPlanLoadError]=useState('')
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
 useEffect(()=>{if(isPcPlatform())void loadOverview()},[loadOverview])
 useEffect(()=>{
  let active=true
  fetch(`${import.meta.env.BASE_URL}data/baotri-config.json`)
   .then(async response=>{if(!response.ok)throw new Error('Không tải được danh mục Plan chuẩn.');return response.json()})
   .then(config=>{if(active&&Array.isArray(config.plans))setPlanOptions(config.plans as PlanOption[])})
   .catch(error=>{if(active)setPlanLoadError(error instanceof Error?error.message:String(error))})
  return()=>{active=false}
 },[])
 const selectedPlan=planOptions.find(plan=>plan.id===planCode)

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
  if(managementAnswer==='no'){cancelManagement();return}
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
   const {data,error:invokeError}=await client.functions.invoke('platform-create-customer',{body:{organizationName:organizationName.trim(),adminEmail:adminEmail.trim(),adminName:adminName.trim(),planCode}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setCreated(data as Created)
   setOrganizationName('');setAdminEmail('');setAdminName('')
   await loadOverview()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 if(!isPcPlatform())return <div className="modal-backdrop"><section className="modal member-modal"><div className="modal-head"><div><div className="eyebrow">GIỚI HẠN NỀN TẢNG</div><h2>Chỉ hỗ trợ trên PC</h2><p>Quản trị nền tảng chỉ sử dụng được trên máy tính để bàn hoặc máy tính xách tay.</p></div><button className="icon-btn" onClick={onClose}>×</button></div><div className="auth-note">Vui lòng sử dụng trình duyệt trên PC để quản trị tổ chức.</div><div className="modal-actions"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button></div></section></div>
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal member-modal platform-admin-modal" style={{width:'min(1000px,96vw)',maxHeight:'92vh',overflowY:'auto'}}>
  <div className="modal-head"><div><div className="eyebrow">CHỦ SỞ HỮU NỀN TẢNG</div><h2>Quản trị nền tảng</h2><p>Theo dõi toàn bộ doanh nghiệp và tài khoản trong BAOTRI Mini.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>

  <style>{`.platform-admin-modal{font-size:13px;line-height:1.45}.platform-admin-modal h2{font-size:21px}.platform-admin-modal h3{font-size:15px}.platform-admin-modal p,.platform-admin-modal small{font-size:12px}.platform-admin-modal .stat-card{padding:12px;gap:10px}.platform-admin-modal .stat-card strong{font-size:21px}.platform-admin-modal .stat-card span{font-size:11px;line-height:1.4}.platform-admin-modal .stat-card small{font-size:11px}.platform-org-table{overflow-x:auto;border:1px solid var(--border,#e5e7eb);border-radius:10px}.platform-org-table table{width:100%;min-width:850px;border-collapse:collapse;font-size:12px}.platform-org-table th{font-size:11px;font-weight:650;white-space:nowrap;background:var(--surface-2,#f8fafc);padding:10px 9px}.platform-org-table td{padding:9px;vertical-align:middle;white-space:nowrap}.platform-org-table td:first-child{white-space:normal;min-width:155px;max-width:220px}.platform-org-table td:first-child b{font-size:12px}.platform-org-table .status{font-size:11px;padding:4px 7px}.platform-org-actions{display:flex;gap:5px;flex-wrap:nowrap}.platform-org-actions button{font-size:11px;padding:6px 9px;min-height:29px;white-space:nowrap}.platform-admin-modal .auth-note{font-size:11px;line-height:1.5;padding:9px 11px}.platform-action-backdrop{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(2px)}.platform-action-dialog{width:min(490px,96vw);max-height:90vh;overflow-y:auto;background:var(--card,#fff);color:var(--text,#172033);border:1px solid var(--border,#e5e7eb);border-radius:15px;box-shadow:0 22px 70px rgba(0,0,0,.28);padding:20px;font-size:13px}.platform-action-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:15px}.platform-action-kicker{font-size:10px;letter-spacing:.08em;font-weight:700;color:var(--muted,#64748b)}.platform-action-head h3{font-size:18px;margin:5px 0}.platform-action-head p{font-size:13px;font-weight:600;margin:0;overflow-wrap:anywhere}.platform-action-note,.platform-action-danger{font-size:12px;line-height:1.55;padding:11px 12px;border-radius:9px;margin-bottom:15px;background:var(--surface-2,#f1f5f9)}.platform-action-danger{background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.25);color:var(--danger,#b91c1c)}.platform-action-form{display:grid;gap:13px}.platform-action-form .field{font-size:12px;gap:6px}.platform-action-form input:not([type=radio]){font-size:13px;min-height:38px}.platform-confirm-choice{border:1px solid var(--border,#e5e7eb);border-radius:9px;padding:10px 12px;display:flex;gap:16px;flex-wrap:wrap;margin:0}.platform-confirm-choice legend{font-size:12px;font-weight:600;padding:0 4px}.platform-confirm-choice label{font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer}.platform-action-buttons{display:flex;justify-content:flex-end;gap:8px;margin-top:3px}.platform-action-buttons button{min-width:105px;font-size:12px}.platform-action-buttons .danger-btn{background:var(--danger,#b91c1c);color:white;border:0;border-radius:8px;padding:9px 14px;font-weight:600;cursor:pointer}.platform-action-buttons button:disabled{opacity:.55;cursor:not-allowed}`}</style>
  <div className="panel-head" style={{marginTop:8}}><div><h3>Tổng quan hệ thống</h3><p>Số liệu trực tiếp từ Supabase Auth và cơ sở dữ liệu.</p></div><button type="button" className="soft-btn" onClick={()=>void loadOverview()} disabled={loadingOverview}>{loadingOverview?'Đang tải…':'Làm mới số liệu'}</button></div>
  {overviewError&&<div className="auth-error">{overviewError}</div>}
  {loadingOverview&&!overview&&<div className="auth-note">Đang tải thống kê nền tảng…</div>}
  {overview&&<>
   <div className="stat-grid platform-admin-stats" style={{gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))'}}>
    <div className="stat-card"><div className="stat-icon blue">DN</div><div><small>Tổng doanh nghiệp</small><strong>{number(overview.organizationsTotal)}</strong><span>{number(overview.organizationsActive)} đang hoạt động · {number(overview.organizationsSuspended)} tạm khóa</span></div></div>
    <div className="stat-card"><div className="stat-icon purple">TK</div><div><small>Tài khoản Auth duy nhất</small><strong>{number(overview.authAccountsTotal)}</strong><span>{number(overview.confirmedAccounts)} đã xác nhận · {number(overview.unconfirmedAccounts)} chưa xác nhận</span></div></div>
    <div className="stat-card"><div className="stat-icon orange">TV</div><div><small>Tổng lượt tham gia</small><strong>{number(overview.membershipsTotal)}</strong><span>Không phải số tài khoản duy nhất</span></div></div>
    <div className="stat-card"><div className="stat-icon green">OK</div><div><small>Membership hoạt động</small><strong>{number(overview.activeMemberships)}</strong><span>{number(overview.invitedMemberships)} chờ xác nhận · {number(overview.suspendedMemberships)} tạm ngưng</span></div></div>
   </div>
   <div className="table-wrap platform-org-table" style={{marginTop:14}}><table><thead><tr><th>Doanh nghiệp</th><th>Trạng thái</th><th>Plan / Snapshot</th><th>Tài khoản trong DN</th><th>Đang hoạt động</th><th>Chờ xác nhận</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
    {overview.organizations.map(org=><tr key={org.id}><td><b>{org.name}</b></td><td><span className={'status '+(org.status==='active'?'green':'gray')}>{org.status==='active'?'Đang hoạt động':'Tạm ngưng'}</span></td><td>{org.planCode?<><b>Plan {org.planCode}</b><small style={{display:'block',color:'var(--muted,#64748b)'}}>{org.planName||'Đã gán'} · v{org.sourceDataVersion||'—'}</small></>:<span className="status gray">Chưa khởi tạo</span>}</td><td>{number(org.uniqueUsers)}</td><td>{number(org.activeMembers)}</td><td>{number(org.invitedMembers)}</td><td>{date(org.createdAt)}</td><td><div className="platform-org-actions">{org.status==='active'?<button type="button" className="soft-btn" onClick={()=>beginManagement(org,'suspend')}>Tạm ngưng</button>:<button type="button" className="soft-btn" onClick={()=>beginManagement(org,'reactivate')}>Kích hoạt</button>}<button type="button" className="soft-btn" style={{color:'var(--danger,#b91c1c)'}} onClick={()=>beginManagement(org,'delete')}>Xóa</button></div></td></tr>)}
    {!overview.organizations.length&&<tr><td colSpan={8}>Chưa có doanh nghiệp nào.</td></tr>}
   </tbody></table></div>
   <div className="auth-note" style={{marginTop:10}}>Tài khoản Auth được đếm duy nhất trên toàn nền tảng. Một tài khoản tham gia nhiều doanh nghiệp chỉ tính một lần ở tổng Auth, nhưng được tính một lượt trong từng doanh nghiệp.</div>
  </>}
  {managementSuccess&&<div className="cloud-message" style={{marginTop:12}}>{managementSuccess}</div>}
  {management&&<div className="platform-action-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!managementBusy)cancelManagement()}}>
   <section className="platform-action-dialog" role="dialog" aria-modal="true" aria-labelledby="platform-action-title">
    <div className="platform-action-head"><div><span className="platform-action-kicker">QUẢN TRỊ TỔ CHỨC</span><h3 id="platform-action-title">{management.action==='suspend'?'Tạm ngưng tổ chức':management.action==='reactivate'?'Kích hoạt tổ chức':'Xóa vĩnh viễn tổ chức'}</h3><p>{management.organization.name}</p></div><button type="button" className="icon-btn" onClick={cancelManagement} disabled={managementBusy} aria-label="Đóng">×</button></div>
    {management.action==='suspend'&&<div className="platform-action-note">Tổ chức sẽ bị chặn truy cập. Dữ liệu Cloud vẫn được giữ nguyên và có thể kích hoạt lại sau.</div>}
    {management.action==='reactivate'&&<div className="platform-action-note">Tổ chức sẽ hoạt động trở lại. Thành viên có quyền truy cập hợp lệ có thể sử dụng Cloud.</div>}
    {management.action==='delete'&&<div className="platform-action-danger"><b>Không thể hoàn tác.</b> Dữ liệu Cloud của tổ chức, thiết bị, thành viên và phân quyền sẽ bị xóa. Tài khoản Auth, hồ sơ cá nhân và bản Local trên thiết bị thành viên không bị xóa.</div>}
    <form className="platform-action-form" onSubmit={submitManagement}>
     {management.action==='delete'&&<label className="field">Nhập chính xác tên tổ chức *<input required value={typedOrganizationName} onChange={e=>setTypedOrganizationName(e.target.value)} placeholder={management.organization.name}/></label>}
     <label className="field">Mật khẩu Super Admin *<input required type="password" autoComplete="current-password" value={managementPassword} onChange={e=>setManagementPassword(e.target.value)} placeholder="Nhập mật khẩu tài khoản Super Admin"/></label>
     <fieldset className="platform-confirm-choice"><legend>Bạn có chắc chắn muốn {management.action==='suspend'?'tạm ngưng':management.action==='reactivate'?'kích hoạt lại':'xóa vĩnh viễn'} tổ chức này?</legend><label><input type="radio" name="platform-confirm" value="yes" checked={managementAnswer==='yes'} onChange={()=>setManagementAnswer('yes')}/> Có, xác nhận</label><label><input type="radio" name="platform-confirm" value="no" checked={managementAnswer==='no'} onChange={()=>setManagementAnswer('no')}/> Không, hủy thao tác</label></fieldset>
     {managementError&&<div className="auth-error">{managementError}</div>}
     <div className="platform-action-buttons"><button type="button" className="soft-btn" onClick={cancelManagement} disabled={managementBusy}>Hủy</button><button type="submit" className={management.action==='delete'?'danger-btn':'primary-btn'} disabled={managementBusy||!managementAnswer}>{managementBusy?'Đang xác thực…':management.action==='delete'?'Xóa tổ chức':management.action==='suspend'?'Tạm ngưng tổ chức':'Kích hoạt tổ chức'}</button></div>
    </form>
   </section>
  </div>}

  <div className="divider" style={{margin:'22px 0',borderTop:'1px solid var(--border,#e5e7eb)'}}/>
  <div className="panel-head"><div><h3>Tạo khách hàng mới</h3><p>Tạo tổ chức riêng và cấp quyền Admin đầu tiên cho khách hàng.</p></div></div>
  <form className="form-grid platform-create-form" onSubmit={submit}>
   <label className="field full-field">Tên doanh nghiệp / tổ chức *<input required minLength={2} maxLength={120} value={organizationName} onChange={e=>setOrganizationName(e.target.value)} placeholder="Ví dụ: Công ty ABC"/></label>
   <label className="field full-field">Gói sử dụng (Plan) *<select required value={planCode} onChange={e=>setPlanCode(e.target.value as PlanOption['id']|'')} disabled={!planOptions.length}><option value="" disabled>Chọn Plan</option>{planOptions.map(plan=><option key={plan.id} value={plan.id}>Plan {plan.id} — {plan.name} · {plan.maxDevices===null?'Không giới hạn':number(plan.maxDevices)+' thiết bị'}</option>)}</select></label>
   {selectedPlan&&<div className="auth-note full-field"><b>Plan {selectedPlan.id} — {selectedPlan.name}:</b> {selectedPlan.maxDevices===null?'Không giới hạn số thiết bị':`Tối đa ${number(selectedPlan.maxDevices)} thiết bị`} · {selectedPlan.features.equipmentGroups?'Có nhóm thiết bị':'Không hiển thị nhóm thiết bị'} · {selectedPlan.features.multipleSites?'Có mã cơ sở':'Một cơ sở'}<br/>Mã quản lý theo quy tắc {selectedPlan.idRule.replace('PLAN_','Plan ')}. Snapshot riêng của doanh nghiệp sẽ được khởi tạo theo đúng Plan này.</div>}
   {planLoadError&&<div className="auth-error full-field">{planLoadError}</div>}
   <label className="field full-field">Email Admin đầu tiên *<input type="email" required value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@company.com"/></label>
   <label className="field full-field">Tên người đại diện<input maxLength={120} value={adminName} onChange={e=>setAdminName(e.target.value)} placeholder="Họ và tên"/></label>
   {error&&<div className="auth-error full-field">{error}</div>}
   {created&&<div className="cloud-message full-field"><b>Đã tạo tổ chức {created.organizationName} — Plan {created.planCode}: {created.planName}.</b><br/>Admin: {created.adminEmail}<br/>Trạng thái: {created.status}<br/>Catalog Snapshot: v{created.sourceDataVersion} · {number(created.equipmentGroups)} nhóm · {number(created.equipmentDictionary)} loại thiết bị<br/>{created.message}</div>}
   <div className="auth-note full-field">Admin nhận email mời để xác nhận và tự đặt mật khẩu. Nếu email đã có tài khoản BAOTRI, hệ thống sẽ gắn tài khoản đó vào tổ chức mới. Mỗi tổ chức có dữ liệu và quyền riêng. Plan và Catalog Snapshot được khởi tạo cùng giao dịch tạo doanh nghiệp; không tạo tổ chức thiếu Plan.</div>
   <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button><button className="primary-btn" disabled={busy||!selectedPlan||!!planLoadError}>{busy?'Đang khởi tạo…':'Tạo khách hàng'}</button></div>
  </form>
 </section></div>
}
