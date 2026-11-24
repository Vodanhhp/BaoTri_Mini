import {useEffect,useState,type FormEvent} from 'react'
import { todayVNDateInput } from './lib/dateTime'
import type {SupabaseClient} from '@supabase/supabase-js'
import {Check,KeyRound,Mail,UserRound,X} from 'lucide-react'

type Props={client:SupabaseClient;onClose:()=>void}
function describeError(error:unknown):string{
 if(error&&typeof error==='object'){
  const value=error as {message?:unknown;details?:unknown;hint?:unknown;code?:unknown}
  const parts=[value.message,value.details,value.hint].filter(v=>typeof v==='string'&&v.trim()).map(String)
  if(parts.length)return parts.join(' — ')+(value.code?' (mã: '+String(value.code)+')':'')
  try{return JSON.stringify(error)}catch{return 'Lỗi không xác định.'}
 }
 return error instanceof Error?error.message:String(error)
}
export default function AccountProfilePanel({client,onClose}:Props){
 const [userId,setUserId]=useState('')
 const [email,setEmail]=useState('')
 const [fullName,setFullName]=useState('')
 const [phone,setPhone]=useState('')
 const [birthDate,setBirthDate]=useState('')
 const [newEmail,setNewEmail]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')

 useEffect(()=>{
  let active=true
  const load=async()=>{
   setLoading(true);setError('')
   try{
    const {data:{user},error:userError}=await client.auth.getUser()
    if(userError)throw userError
    if(!user)throw new Error('Không tìm thấy tài khoản đang đăng nhập.')
    const {data,error:profileError}=await client.from('profiles').select('display_name,phone').eq('id',user.id).single()
    if(profileError)throw profileError
    if(!active)return
    setUserId(user.id)
    setEmail(user.email??'')
    setNewEmail(user.email??'')
    setFullName(data?.display_name??String(user.user_metadata?.full_name??''))
    setPhone(data?.phone??'')
    setBirthDate(String(user.user_metadata?.date_of_birth??''))
   }catch(e){if(active)setError(describeError(e))}
   finally{if(active)setLoading(false)}
  }
  void load()
  return()=>{active=false}
 },[client])

 const saveProfile=async(e:FormEvent)=>{
  e.preventDefault();if(busy||!userId)return
  setBusy(true);setError('');setMessage('')
  try{
   const name=fullName.trim()
   if(!name)throw new Error('Vui lòng nhập họ và tên.')
   if(birthDate&&birthDate>todayVNDateInput())throw new Error('Ngày sinh không thể ở tương lai.')
   const {data:updatedProfile,error:profileError}=await client.from('profiles').update({display_name:name,phone:phone.trim()||null,updated_at:new Date().toISOString()}).eq('id',userId).select('id').maybeSingle()
   if(profileError)throw new Error('Không lưu được thông tin hồ sơ: '+describeError(profileError))
   if(!updatedProfile)throw new Error('Không tìm thấy bản ghi hồ sơ để cập nhật. Hãy đăng xuất rồi đăng nhập lại.')
   const {data:{user},error:userError}=await client.auth.getUser()
   if(userError)throw new Error('Đã lưu họ tên/số điện thoại, nhưng không đọc được thông tin tài khoản để lưu ngày sinh: '+describeError(userError))
   const {error:metadataError}=await client.auth.updateUser({data:{...(user?.user_metadata??{}),full_name:name,date_of_birth:birthDate||null}})
   if(metadataError)throw new Error('Đã lưu họ tên/số điện thoại, nhưng ngày sinh chưa lưu được: '+describeError(metadataError))
   setMessage('Đã cập nhật hồ sơ cá nhân.')
  }catch(e){setError(describeError(e))}
  finally{setBusy(false)}
 }

 const changeEmail=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return
  const value=newEmail.trim().toLowerCase()
  if(!value||value===email.toLowerCase()){setMessage('Email đăng nhập hiện tại không thay đổi.');return}
  setBusy(true);setError('');setMessage('')
  try{
   const {error:changeError}=await client.auth.updateUser({email:value})
   if(changeError)throw changeError
   setMessage('Đã gửi yêu cầu đổi email. Hãy mở email xác nhận theo hướng dẫn của Supabase; email đăng nhập chỉ đổi sau khi xác nhận thành công.')
  }catch(e){setError(describeError(e))}
  finally{setBusy(false)}
 }

 const changePassword=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return
  if(newPassword.length<8) {setError('Mật khẩu mới cần tối thiểu 8 ký tự.');return}
  if(newPassword!==confirmPassword){setError('Mật khẩu xác nhận không khớp.');return}
  setBusy(true);setError('');setMessage('')
  try{
   const {error:passwordError}=await client.auth.updateUser({password:newPassword})
   if(passwordError)throw passwordError
   setNewPassword('');setConfirmPassword('')
   setMessage('Đã đổi mật khẩu đăng nhập.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }

 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="modal account-profile-modal">
   <div className="modal-head"><div><div className="eyebrow">TÀI KHOẢN CỦA BẠN</div><h2>Hồ sơ cá nhân</h2><p>Chỉnh sửa thông tin cá nhân và thông tin đăng nhập.</p></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div>
   {loading?<div className="member-empty">Đang tải thông tin tài khoản…</div>:<>
    {error&&<div className="auth-error member-feedback">{error}</div>}
    {message&&<div className="cloud-message member-feedback">{message}</div>}
    <div className="account-profile-layout">
    <form className="account-profile-section profile-personal-section" onSubmit={saveProfile}>
     <h3><UserRound size={16}/> Thông tin cá nhân</h3>
     <label className="field">Họ và tên *<input required maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nhập họ và tên"/></label>
     <label className="field">Số điện thoại<input type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Số điện thoại liên hệ"/></label>
     <label className="field">Ngày tháng năm sinh<input type="date" max={todayVNDateInput()} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
     <div className="modal-actions"><button className="primary-btn" disabled={busy}><Check size={15}/> Lưu hồ sơ</button></div>
    </form>
    <form className="account-profile-section" onSubmit={changeEmail}>
     <h3><Mail size={16}/> Email đăng nhập</h3>
     <label className="field">Email hiện tại<input value={email} readOnly disabled/></label>
     <label className="field">Email mới<input type="email" required value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Nhập email mới"/></label>
     <div className="modal-actions"><button className="soft-btn" disabled={busy}>Yêu cầu đổi email</button></div>
     <small className="auth-note">Supabase có thể yêu cầu xác nhận ở email hiện tại và email mới. Email đăng nhập chưa đổi cho đến khi xác nhận hoàn tất.</small>
    </form>
    <form className="account-profile-section" onSubmit={changePassword}>
     <h3><KeyRound size={16}/> Đổi mật khẩu</h3>
     <label className="field">Mật khẩu mới<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự"/></label>
     <label className="field">Nhập lại mật khẩu mới<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới"/></label>
     <div className="modal-actions"><button className="soft-btn" disabled={busy}>Đổi mật khẩu</button></div>
     <small className="auth-note">Mật khẩu được xử lý bởi Supabase Auth, không lưu trong hồ sơ cá nhân hoặc bảng profiles.</small>
    </form>
    </div>
   </>}
   <div className="modal-actions account-profile-footer"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button></div>
  </section>
 </div>
}
