import {useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'

type Props={client:SupabaseClient;onClose:()=>void}
type Created={organizationId:string;organizationName:string;adminEmail:string;status:string;createdAuthUser:boolean;message:string}

export default function PlatformAdminPanel({client,onClose}:Props){
 const [organizationName,setOrganizationName]=useState('')
 const [adminEmail,setAdminEmail]=useState('')
 const [adminName,setAdminName]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [created,setCreated]=useState<Created|null>(null)
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setCreated(null)
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-create-customer',{body:{organizationName:organizationName.trim(),adminEmail:adminEmail.trim(),adminName:adminName.trim()}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setCreated(data as Created)
   setOrganizationName('');setAdminEmail('');setAdminName('')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal member-modal">
  <div className="modal-head"><div><div className="eyebrow">CHỦ SỞ HỮU NỀN TẢNG</div><h2>Tạo khách hàng mới</h2><p>Tạo tổ chức riêng và gửi lời mời cho Admin đầu tiên của khách hàng.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>
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
