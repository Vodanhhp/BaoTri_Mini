import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LockKeyhole, Mail, Wrench } from 'lucide-react'

type Props = { client: SupabaseClient | null; onLocalPreview?: () => void }

export default function AuthScreen({ client, onLocalPreview }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!client) return
    setBusy(true)
    setError('')
    setRecoverySent(false)
    try {
      const { error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password
      })
      if (authError) {
        const message = authError.message.toLowerCase()
        if (message.includes('invalid login credentials')) setError('Email hoặc mật khẩu không chính xác.')
        else if (message.includes('email not confirmed')) setError('Email chưa được xác nhận. Hãy xác nhận email trong hộp thư trước khi đăng nhập.')
        else setError('Đăng nhập chưa thành công: ' + authError.message)
      }
    } catch {
      setError('Không kết nối được Supabase. Kiểm tra Internet và cấu hình project rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const sendRecovery = async () => {
    if (!client || !email.trim()) { setError('Nhập email trước để gửi liên kết đặt lại mật khẩu.'); return }
    setBusy(true);setError('');setRecoverySent(false)
    try {
      const {error:resetError}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin})
      if(resetError) throw resetError
      setRecoverySent(true)
    } catch(e) { setError(e instanceof Error?e.message:'Không gửi được email đặt lại mật khẩu.') }
    finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><span><Wrench size={25}/></span><div><b>BAOTRI</b><small>QUẢN LÝ THIẾT BỊ</small></div></div>
      <h1>Đăng nhập hệ thống</h1>
      <p className="auth-intro">Sử dụng tài khoản đã được tạo và cấp quyền trong hệ thống.</p>
      {!client ? <><div className="auth-error">Chưa có cấu hình Supabase. Hãy tạo file <code>.env.local</code> từ <code>.env.example</code> và điền URL cùng Publishable Key của Supabase riêng cho dự án mới.</div>{(import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_PREVIEW === 'true') && onLocalPreview && <button type="button" className="auth-submit" onClick={onLocalPreview}>Vào chế độ xem thử Local</button>}</> : <form onSubmit={submit} className="auth-form">
        <label>Email đăng nhập</label>
        <div className="auth-input"><Mail size={17}/><input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></div>
        <label>Mật khẩu</label>
        <div className="auth-input"><LockKeyhole size={17}/><input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="Nhập mật khẩu"/></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {recoverySent&&<div className="cloud-message">Nếu email hợp lệ, liên kết đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư và Spam.</div>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy?'Đang xác thực…':'Đăng nhập'}</button>
        <button className="auth-link" type="button" disabled={busy} onClick={()=>void sendRecovery()}>Quên mật khẩu?</button>
      </form>}
      <div className="auth-note"><b>Lưu ý:</b> Chưa bật đăng ký tự do. Tài khoản do Admin cấp.</div>
    </section>
  </main>
}