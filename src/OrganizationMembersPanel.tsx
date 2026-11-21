import {useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
type Props={client:SupabaseClient;organizationId:string;onClose:()=>void}
export default function OrganizationMembersPanel({client,organizationId,onClose}:Props){
 const [email,setEmail]=useState('')
 const [displayName,setDisplayName]=useState('')
 const [roleCode,setRoleCode]=useState('technician')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setMessage('');setError('')
  try{
   const {data,error:invokeError}=await client.functions.invoke('invite-org-member',{body:{organizationId,email:email.trim(),displayName:displayName.trim(),roleCode}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setMessage(data?.message||'Đã gửi lời mời.')
   setEmail('');setDisplayName('')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal member-modal">
  <div className="modal-head"><div><div className="eyebrow">QUẢN TRỊ TỔ CHỨC</div><h2>Tạo / mời tài khoản</h2><p>Tài khoản Auth mới nhận email mời để xác nhận và đặt mật khẩu.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>
  <form className="form-grid" onSubmit={submit}>
   <label className="field full-field">Email tài khoản *<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@company.com"/></label>
   <label className="field full-field">Tên hiển thị<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Tên người dùng"/></label>
   <label className="field full-field">Vai trò<select value={roleCode} onChange={e=>setRoleCode(e.target.value)}><option value="technician">Kỹ thuật viên</option><option value="viewer">Người xem</option><option value="admin">Admin</option></select></label>
   {error&&<div className="auth-error full-field">{error}</div>}{message&&<div className="cloud-message full-field">{message}</div>}
   <div className="auth-note full-field">Admin: quản trị toàn bộ. Kỹ thuật viên: tạo/sửa nghiệp vụ thiết bị. Người xem: chỉ đọc. Email mời phụ thuộc cấu hình SMTP của Supabase.</div>
   <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button><button className="primary-btn" disabled={busy}>{busy?'Đang gửi…':'Gửi lời mời'}</button></div>
  </form>
 </section></div>
}
