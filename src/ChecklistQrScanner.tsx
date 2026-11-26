import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

type DetectedBarcode = { rawValue?: string }
type NativeBarcodeDetector = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector

type Props = { onDetected: (value:string)=>void; onClose:()=>void }

export default function ChecklistQrScanner({onDetected,onClose}:Props){
  const videoRef=useRef<HTMLVideoElement|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const frameRef=useRef<number|null>(null)
  const activeRef=useRef(false)
  const [manualCode,setManualCode]=useState('')
  const [cameraError,setCameraError]=useState('')
  const [cameraReady,setCameraReady]=useState(false)
  useEffect(()=>()=>{activeRef.current=false;if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null},[])
  const startCamera=async()=>{
    activeRef.current=false
    if(frameRef.current!==null){cancelAnimationFrame(frameRef.current);frameRef.current=null}
    streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null
    setCameraReady(false)
    setCameraError('')
    const Detector=(window as unknown as {BarcodeDetector?:BarcodeDetectorConstructor}).BarcodeDetector
    if(!Detector){setCameraError('Trình duyệt này chưa hỗ trợ quét QR trực tiếp. Bạn có thể nhập mã thiết bị ở bên dưới.');return}
    if(!navigator.mediaDevices?.getUserMedia){setCameraError('Thiết bị hoặc trình duyệt không hỗ trợ truy cập camera.');return}
    try{
      activeRef.current=true
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
      if(!activeRef.current){stream.getTracks().forEach(track=>track.stop());return}
      streamRef.current=stream
      const video=videoRef.current
      if(!video)throw new Error('Không tìm thấy vùng hiển thị camera.')
      video.srcObject=stream
      await video.play()
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
            if(value){activeRef.current=false;onDetected(value);return}
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
  return <div className="checklist-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="checklist-editor-modal checklist-qr-modal" role="dialog" aria-modal="true" aria-labelledby="checklist-qr-title">
      <div className="panel-head"><div><h2 id="checklist-qr-title">Quét mã QR thiết bị</h2><p>Đưa camera điện thoại vào mã QR trên tem thiết bị. Cần có Internet để tải Checklist từ Cloud.</p></div><button type="button" className="soft-btn" onClick={onClose}><X size={16}/> Đóng</button></div>
      <div className="checklist-qr-camera">
        <video ref={videoRef} playsInline muted aria-label="Camera quét mã QR"/>
        {!cameraReady&&<div className="checklist-qr-camera-placeholder"><Camera size={32}/><span>Camera chưa được bật</span></div>}
      </div>
      <div className="modal-actions"><button type="button" className="primary-btn" onClick={()=>void startCamera()}><Camera size={16}/> {cameraReady?'Mở lại camera':'Bật camera và quét QR'}</button></div>
      {cameraError&&<div className="checklist-alert error">{cameraError}</div>}
      <label className="field">Hoặc nhập mã thiết bị trên tem QR
        <input value={manualCode} onChange={event=>setManualCode(event.target.value)} placeholder="Ví dụ: mã quản lý thiết bị"/>
      </label>
      <div className="modal-actions"><button type="button" className="primary-btn" disabled={!manualCode.trim()} onClick={()=>onDetected(manualCode.trim())}>Tìm Checklist thiết bị</button></div>
    </section>
  </div>
}
