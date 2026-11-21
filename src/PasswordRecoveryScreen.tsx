import {useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
type Props={client:SupabaseClient;onDone:()=>void}
export default function PasswordRecoveryScreen({client,onDone}:Props){
 const [password,setPassword]=useState('')
 const [confirm,setConfirm]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setError('')
  if(password.length<8){setError('Mật khẩu tối thiểu 8 ký tự.');return}
  if(password!==confirm){setError('Mật khẩu nhập lại chưa khớp.');return}
  setBusy(true)
  try{const {error:changeError}=await client.auth.updateUser({password});if(changeError)throw changeError;await client.auth.signOut();onDone()}
  catch(err){setError(err instanceof Error?err.message:'Không đổi được mật khẩu.')}
  finally{setBusy(false)}
 }
 return <main className="auth-page"><section className="auth-card"><h1>Đặt mật khẩu mới</h1><p className="auth-intro">Liên kết xác nhận đã đưa bạn đến đây. Nhập mật khẩu mới cho tài khoản.</p><form className="auth-form" onSubmit={submit}><label>Mật khẩu mới</label><div className="auth-input"><input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></div><label>Nhập lại mật khẩu</label><div className="auth-input"><input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value}/></div>{error&&<div className="auth-error">{error}</div>}<button className="auth-submit" disabled={busy}>{busy?'Đang cập nhật…':'Cập nhật mật khẩu'}</button></form></section></main>
}
