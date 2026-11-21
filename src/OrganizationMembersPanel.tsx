import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react'
import {Activity,Mail,RefreshCw,RotateCcw,Search,Shield,Trash2,UserPlus,UserRound,X} from 'lucide-react'
import type {SupabaseClient} from '@supabase/supabase-js'

type Member={
 id:string
 userId:string
 email:string
 displayName:string
 roleCode:string
 status:'active'|'invited'|'suspended'
 emailConfirmed:boolean
 createdAt:string
}
type Overview={total:number;active:number;invited:number;suspended:number;confirmed:number;unconfirmed:number}
type Props={client:SupabaseClient;organizationId:string;onClose:()=>void}
const roleLabel=(code:string)=>code==='admin'?'Admin':code==='technician'?'Kỹ thuật viên':code==='viewer'?'Người xem':code
const statusLabel=(status:Member['status'])=>status==='active'?'Đang hoạt động':status==='invited'?'Chờ xác nhận':'Tạm khóa'

export default function OrganizationMembersPanel({client,organizationId,onClose}:Props){
 const [members,setMembers]=useState<Member[]>([])
 const [overview,setOverview]=useState<Overview>({total:0,active:0,invited:0,suspended:0,confirmed:0,unconfirmed:0})
 const [email,setEmail]=useState('')
 const [displayName,setDisplayName]=useState('')
 const [roleCode,setRoleCode]=useState('technician')
 const [query,setQuery]=useState('')
 const [actorId,setActorId]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')

 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const [{data:userData,error:userError},{data,error:invokeError}]=await Promise.all([
    client.auth.getUser(),
    client.functions.invoke('manage-organization-members',{body:{action:'list',organizationId}})
   ])
   if(userError)throw userError
   if(invokeError)throw invokeError
   if(data?.error)throw new Error(data.error)
   setActorId(userData.user?.id??'')
   setMembers((data?.members??[]) as Member[])
   setOverview(data?.overview??{total:0,active:0,invited:0,suspended:0,confirmed:0,unconfirmed:0})
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 },[client,organizationId])

 useEffect(()=>{void load()},[load])

 const filtered=useMemo(()=>members.filter(m=>(m.email+' '+m.displayName+' '+roleLabel(m.roleCode)).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))),[members,query])

 const invite=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setMessage('');setError('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('invite-org-member',{body:{organizationId,email:email.trim(),displayName:displayName.trim(),roleCode}})
   if(invokeError)throw invokeError
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã gửi lời mời.')
   setEmail('');setDisplayName('')
   await load()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }

 const act=async(member:Member,action:'reset_password'|'suspend'|'reactivate'|'remove')=>{
  const prompts={
   reset_password:'Gửi email đặt lại mật khẩu cho '+member.email+'?',
   suspend:'Tạm khóa quyền truy cập tổ chức của '+member.email+'?',
   reactivate:'Mở lại quyền truy cập tổ chức cho '+member.email+'?',
   remove:'Xóa '+member.email+' khỏi tổ chức? Tài khoản Auth và lịch sử dữ liệu sẽ được giữ nguyên.'
  }
  if(!window.confirm(prompts[action]))return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('manage-organization-members',{body:{action,organizationId,memberId:member.id}})
   if(invokeError)throw invokeError
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã thực hiện thao tác.')
   await load()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }

 const dateLabel=(value:string)=>value?new Date(value).toLocaleDateString('vi-VN'):'—'
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="modal member-modal member-management-modal">
   <div className="modal-head"><div><div className="eyebrow">QUẢN TRỊ TỔ CHỨC</div><h2>Quản lý tài khoản</h2><p>Thành viên và quyền truy cập trong tổ chức hiện tại.</p></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div>
   <div className="member-stats">
    <div className="member-stat"><small>Tổng thành viên</small><strong>{overview.total}</strong></div>
    <div className="member-stat"><small>Đang hoạt động</small><strong>{overview.active}</strong></div>
    <div className="member-stat"><small>Chờ xác nhận</small><strong>{overview.invited}</strong></div>
    <div className="member-stat"><small>Tạm khóa</small><strong>{overview.suspended}</strong></div>
   </div>
   <div className="member-toolbar"><div className="member-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm email, tên hoặc vai trò..."/></div><button className="soft-btn" onClick={()=>void load()} disabled={loading||busy}><RefreshCw size={14}/> Làm mới</button></div>
   {error&&<div className="auth-error member-feedback">{error}</div>}
   {message&&<div className="cloud-message member-feedback">{message}</div>}
   <div className="member-list-wrap">
    {loading?<div className="member-empty">Đang tải danh sách tài khoản…</div>:filtered.length===0?<div className="member-empty">Chưa có tài khoản phù hợp.</div>:<div className="member-list">
     {filtered.map(member=>{
      const protectedMember=member.roleCode==='admin'||member.roleCode==='unknown'||member.userId===actorId
      return <article className="member-row" key={member.id}>
       <div className="member-identity"><span className="member-avatar"><UserRound size={17}/></span><div><b>{member.displayName||member.email}</b><small>{member.email}</small><small>Tham gia: {dateLabel(member.createdAt)}</small></div></div>
       <div className="member-meta"><span className="member-role">{roleLabel(member.roleCode)}</span><span className={'status '+(member.status==='active'?'green':member.status==='suspended'?'red':'orange')}>{statusLabel(member.status)}</span><small className="member-confirm">{member.emailConfirmed?'Email đã xác nhận':'Email chưa xác nhận'}</small></div>
       <div className="member-actions">
        {!protectedMember&&<><button className="member-action" disabled={busy||!member.emailConfirmed} title={member.emailConfirmed?'Gửi email đặt lại mật khẩu':'Cần xác nhận email trước khi reset'} onClick={()=>void act(member,'reset_password')}><Mail size={14}/> Reset mật khẩu</button>{member.status==='suspended'?<button className="member-action" disabled={busy} onClick={()=>void act(member,'reactivate')}><RotateCcw size={14}/> Mở khóa</button>:<button className="member-action warning" disabled={busy} onClick={()=>void act(member,'suspend')}><Shield size={14}/> Tạm khóa</button>}<button className="member-action danger" disabled={busy} onClick={()=>void act(member,'remove')}><Trash2 size={14}/> Xóa khỏi tổ chức</button></>}
        {protectedMember&&<small className="member-protected">Được bảo vệ</small>}
       </div>
      </article>
     })}
    </div>}
   </div>
   <div className="member-invite-section">
    <div className="member-section-title"><div><b><UserPlus size={16}/> Mời tài khoản mới</b><small>Người được mời xác nhận email và tự đặt mật khẩu.</small></div></div>
    <form className="form-grid" onSubmit={invite}>
     <label className="field">Email tài khoản *<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@company.com"/></label>
     <label className="field">Tên hiển thị<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Tên người dùng"/></label>
     <label className="field">Vai trò<select value={roleCode} onChange={e=>setRoleCode(e.target.value)}><option value="technician">Kỹ thuật viên</option><option value="viewer">Người xem</option></select></label>
     <div className="modal-actions full-field"><button className="primary-btn" disabled={busy}>{busy?'Đang xử lý…':'Gửi lời mời'}</button></div>
    </form>
   </div>
   <div className="auth-note member-note">Reset mật khẩu sẽ gửi email để người dùng tự đặt lại. Tạm khóa chỉ thu hồi quyền trong tổ chức này. Xóa khỏi tổ chức không xóa tài khoản Auth hoặc lịch sử thiết bị. Admin và tài khoản đang đăng nhập không thể bị khóa/xóa tại đây.</div>
   <div className="modal-actions"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button></div>
  </section>
 </div>
}
