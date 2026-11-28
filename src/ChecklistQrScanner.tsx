import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Keyboard, ScanLine, ShieldCheck, X } from 'lucide-react'

type DetectedBarcode = { rawValue?: string }
type NativeBarcodeDetector = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector

type Props = { onDetected: (value:string)=>void; onClose:()=>void; errorMessage?:string }

export default function ChecklistQrScanner({onDetected,onClose,errorMessage=''}:Props){
  const videoRef=useRef<HTMLVideoElement|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const frameRef=useRef<number|null>(null)
  const activeRef=useRef(false)
  const [manualCode,setManualCode]=useState('')
  const [cameraError,setCameraError]=useState('')
  const [cameraReady,setCameraReady]=useState(false)
  useEffect(()=>()=>{activeRef.current=false;if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null},[])
  const stopCamera=()=>{
    activeRef.current=false
    if(frameRef.current!==null){cancelAnimationFrame(frameRef.current);frameRef.current=null}
    streamRef.current?.getTracks().forEach(track=>track.stop())
    streamRef.current=null
    if(videoRef.current)videoRef.current.srcObject=null
    setCameraReady(false)
  }
  const startCamera=async()=>{
    activeRef.current=false
    if(frameRef.current!==null){cancelAnimationFrame(frameRef.current);frameRef.current=null}
    streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null
    setCameraReady(false)
    setCameraError('')
    const Detector=(window as unknown as {BarcodeDetector?:BarcodeDetectorConstructor}).BarcodeDetector
    if(!window.isSecureContext){setCameraError('Camera cần trang web HTTPS. Bạn vẫn có thể nhập mã thiết bị thủ công.');return}
    if(!Detector){setCameraError('Trình duyệt này chưa hỗ trợ giải mã QR trực tiếp. Hãy dùng Chrome/Edge mới hoặc nhập mã thiết bị ở bên dưới.');return}
    if(!navigator.mediaDevices?.getUserMedia){setCameraError('Thiết bị hoặc trình duyệt không hỗ trợ truy cập camera. Bạn vẫn có thể nhập mã thủ công.');return}
    try{
      activeRef.current=true
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
      if(!activeRef.current){stream.getTracks().forEach(track=>track.stop());return}
      streamRef.current=stream
      const video=videoRef.current
      if(!video)throw new Error('Không tìm thấy vùng hiển thị camera.')
      video.srcObject=stream
      await video.play()
      if(!activeRef.current){stream.getTracks().forEach(track=>track.stop());return}
      setCameraReady(true)
      const detector=new Detector({formats:['qr_code']})
      let busy=false
      const scan=async()=>{
        if(!activeRef.current)return
        if(video.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&!busy){
          busy=true
          try{
            const codes=await detector.detect(video)
            if(!activeRef.current)return
            const value=codes.find(code=>code.rawValue?.trim())?.rawValue?.trim()
            if(value){stopCamera();onDetected(value);return}
          }catch{if(activeRef.current)setCameraError('Không đọc được QR. Hãy giữ mã QR rõ nét trong khung hình hoặc nhập mã thủ công.')}
          finally{busy=false}
        }
        if(activeRef.current)frameRef.current=requestAnimationFrame(()=>void scan())
      }
      frameRef.current=requestAnimationFrame(()=>void scan())
    }catch(cause){
      if(activeRef.current)setCameraError(cause instanceof Error?cause.message:'Không thể mở camera. Hãy kiểm tra quyền truy cập camera.')
      activeRef.current=false
      streamRef.current?.getTracks().forEach(track=>track.stop())
      streamRef.current=null
      setCameraReady(false)
    }
  }
  return <div className="checklist-modal-backdrop checklist-qr-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="checklist-editor-modal checklist-qr-modal" role="dialog" aria-modal="true" aria-labelledby="checklist-qr-title">
      <div className="panel-head checklist-qr-head"><div><div className="eyebrow">BAOTRI MINI · CHECKLIST</div><h2 id="checklist-qr-title">Quét mã thiết bị</h2><p>Đưa mã QR trên tem thiết bị vào giữa khung hình để mở đúng Checklist.</p></div><button type="button" className="soft-btn" onClick={onClose}><X size={16}/> Đóng</button></div>
      <div className="checklist-qr-camera">
        <video ref={videoRef} playsInline muted aria-label="Camera quét mã QR"/>
        {!cameraReady&&<div className="checklist-qr-camera-placeholder"><div className="checklist-qr-frame"><span/><span/><span/><span/></div><Camera size={30}/><b>Sẵn sàng quét mã QR</b><small>Camera chỉ bật khi bạn chọn nút bên dưới</small></div>}
        {cameraReady&&<div className="checklist-qr-overlay"><div className="checklist-qr-frame"><span/><span/><span/><span/></div><small>Đưa mã QR vào giữa khung hình</small></div>}
      </div>
      <div className="checklist-qr-camera-actions"><button type="button" className="primary-btn" onClick={()=>void startCamera()}><Camera size={16}/> {cameraReady?'Mở lại camera':'Bật camera để quét'}</button><small>PC cần có camera kết nối; điện thoại ưu tiên camera sau. Trình duyệt cần được cấp quyền camera.</small></div>
      <div className="checklist-qr-divider"><span>HOẶC NHẬP MÃ THỦ CÔNG</span></div>
      <form className="checklist-qr-manual" onSubmit={event=>{event.preventDefault();if(manualCode.trim()){stopCamera();onDetected(manualCode.trim())}}}>
        <label className="field"><span><Keyboard size={14}/> Mã thiết bị hoặc ID</span><input value={manualCode} onChange={event=>setManualCode(event.target.value)} placeholder="Ví dụ: TB-001 hoặc dán ID thiết bị" autoComplete="off"/></label>
        <button type="submit" className="primary-btn" disabled={!manualCode.trim()}>Tìm thiết bị</button>
      </form>
      {(cameraError||errorMessage)&&<div className="checklist-qr-error" role="alert">{errorMessage||cameraError}</div>}
      <div className="checklist-qr-help"><ShieldCheck size={16}/><span>Chỉ mở Checklist khi mã khớp duy nhất một thiết bị đang quản lý. Mã sai hoặc không rõ ràng sẽ không mở nhầm thiết bị.</span></div>
    </section>
  </div>
}
