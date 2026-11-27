import { useState } from 'react'
import { AlertTriangle, ChevronDown, RefreshCw, X } from 'lucide-react'

type Props = {
  title: string
  message: string
  detail?: string
  onRetry?: () => Promise<void>
  onDismiss: () => void
}

export default function SystemNotification({title,message,detail,onRetry,onDismiss}:Props) {
  const [retrying,setRetrying]=useState(false)
  const retry=async()=>{
    if(!onRetry||retrying)return
    setRetrying(true)
    try{await onRetry()}finally{setRetrying(false)}
  }
  return <section className="system-notification error" role="alert" aria-live="assertive">
    <div className="system-notification-icon"><AlertTriangle size={19}/></div>
    <div className="system-notification-content">
      <strong>{title}</strong>
      <p>{message}</p>
      {detail&&<details><summary><ChevronDown size={14}/> Chi tiết kỹ thuật</summary><pre>{detail}</pre></details>}
    </div>
    <div className="system-notification-actions">
      {onRetry&&<button type="button" className="system-notification-retry" onClick={()=>void retry()} disabled={retrying}>
        <RefreshCw size={15} className={retrying?'system-notification-spin':''}/>{retrying?'Đang thử…':'Thử tải lại'}
      </button>}
      <button type="button" className="system-notification-dismiss" onClick={onDismiss} aria-label="Đóng thông báo"><X size={17}/></button>
    </div>
  </section>
}
