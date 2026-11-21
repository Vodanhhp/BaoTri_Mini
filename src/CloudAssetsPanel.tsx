import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from './db'
import { db, type AssetMutation } from './db'
import { downloadCloudAsset, importLocalAsset, listCloudAssets, retryCloudAssetMutation, type CloudAsset } from './lib/cloudAssets'

type Props={client:SupabaseClient;organizationId:string;localAssets:Asset[];canImport:boolean;canUpdate:boolean;onClose:()=>void;onChanged:()=>void}

export default function CloudAssetsPanel({client,organizationId,localAssets,canImport,canUpdate,onClose,onChanged}:Props){
 const [cloud,setCloud]=useState<CloudAsset[]>([])
 const [linkedIds,setLinkedIds]=useState<string[]>([])
 const [pending,setPending]=useState<AssetMutation[]>([])
 const [selected,setSelected]=useState<string[]>([])
 const [loading,setLoading]=useState(false)
 const [busyId,setBusyId]=useState('')
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const reload=async()=>{
  setLoading(true);setError('')
  try{
   const [cloudRows,linkRows,mutationRows]=await Promise.all([listCloudAssets(client,organizationId),db.assetCloudLinks.where('organizationId').equals(organizationId).toArray(),db.assetMutations.where('organizationId').equals(organizationId).toArray()])
   setCloud(cloudRows);setLinkedIds(linkRows.map(l=>l.assetId));setPending(mutationRows.filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict'))
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 }
 useEffect(()=>{void reload()},[organizationId])
 const candidates=localAssets.filter(a=>a.localScope===organizationId&&!linkedIds.includes(a.id))
 const retryOne=async(mutation:AssetMutation)=>{
  setBusyId(mutation.mutationId);setError('');setMessage('')
  try{
   const result=await retryCloudAssetMutation(client,organizationId,mutation.mutationId)
   setMessage(result.alreadyApplied?'Cloud xác nhận lại biên nhận đã áp dụng.':'Đã retry và Cloud xác nhận mutation.')
   await reload();onChanged()
  }catch(e){setError(e instanceof Error?e.message:String(e));await reload()}
  finally{setBusyId('')}
 }
 const importOne=async(asset:Asset)=>{
  setBusyId(asset.id);setError('');setMessage('')
  try{
   if(await db.assetCloudLinks.get(organizationId+':'+asset.id))throw new Error('Thiết bị đã có liên kết Cloud.')
   const result=await importLocalAsset(client,organizationId,asset)
   setMessage((result.alreadyPresent?'Cloud đã có hồ sơ trùng khớp; đã xác nhận liên kết.':'Đã nhập Local lên Cloud, giữ nguyên UUID và mã quản lý.')+(asset.images?.length?' Ảnh vẫn chỉ lưu Local.':''))
   await reload();onChanged()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusyId('')}
 }
 const importSelected=async()=>{
  const items=candidates.filter(a=>selected.includes(a.id))
  if(!items.length)return
  if(!window.confirm('Nhập '+items.length+' hồ sơ Local lên Cloud? UUID và mã quản lý được giữ nguyên. Ảnh vẫn ở Local.'))return
  for(const asset of items)await importOne(asset)
  setSelected([])
 }
 const downloadOne=async(asset:CloudAsset)=>{
  setBusyId(asset.id);setError('');setMessage('')
  try{
   const local=await db.assets.get(asset.id)
   const link=await db.assetCloudLinks.get(organizationId+':'+asset.id)
   if(local&&!link){
    if(local.localScope!==organizationId)throw new Error('UUID đã tồn tại ở phạm vi Local khác; không ghi đè.')
    if(local.code!==asset.code)throw new Error('Local và Cloud cùng UUID nhưng mã khác nhau; cần đối chiếu thủ công.')
    throw new Error('Local đã có UUID này nhưng chưa liên kết Cloud. Không tự ghi đè.')
   }
   if(local&&link){
    if(link.status!=='linked')throw new Error('Liên kết đang conflict; cần xử lý trước.')
    const localChanged=local.updatedAt!==link.lastSyncedLocalUpdatedAt
    const cloudChanged=asset.updatedAt!==link.cloudUpdatedAt
    if(localChanged&&cloudChanged){await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:new Date().toISOString()});throw new Error('Local và Cloud đều thay đổi. Đã đánh dấu conflict; cần đối chiếu thủ công.')}
    if(localChanged&&!cloudChanged){setMessage('Local có thay đổi chưa đồng bộ; giữ nguyên Local.');return}
    if(!cloudChanged){setMessage('Local và Cloud đã cùng phiên bản.');return}
   }
   await downloadCloudAsset(organizationId,asset,local)
   setMessage(local?'Đã cập nhật Local theo Cloud; giữ lại ảnh Local.':'Đã tải hồ sơ Cloud về Local.')
   onChanged()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusyId('')}
 }
 return <div className="modal-backdrop cloud-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="modal cloud-modal">
   <div className="modal-head"><div><div className="eyebrow">ĐỒNG BỘ CÓ KIỂM SOÁT</div><h2>Local ↔ Cloud</h2><p>Không đồng bộ đại trà; kiểm tra UUID, mã quản lý và phiên bản trước khi chuyển.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>
   <div className="cloud-summary"><b>{localAssets.length}</b> Local · <b>{cloud.length}</b> Cloud · <span>Ảnh chỉ lưu Local</span></div>
   {error&&<div className="auth-error">{error}</div>}{message&&<div className="cloud-message">{message}</div>}
   <div className="cloud-section">
    <div className="cloud-section-head"><h3>Mutation Local chưa được Cloud xác nhận</h3><button className="soft-btn small" disabled={loading} onClick={()=>void reload()}>Kiểm tra</button></div>
    {pending.length===0?<p className="empty-small">Không có thay đổi Cloud đang chờ.</p>:<div className="cloud-list">{pending.map(m=>{
      const asset=localAssets.find(a=>a.id===m.assetId)
      return <div className="cloud-row" key={m.mutationId}><div className="cloud-row-main"><b>{asset?.code||m.assetId} · {m.status==='conflict'?'Cần đối chiếu':'Đang chờ đồng bộ'}</b><small>{m.lastError||'Mutation '+m.mutationId+' · '+m.updatedAt}</small></div><div className="cloud-row-actions">{m.status==='conflict'?<span className="status red">Conflict</span>:<button className="primary-btn small" disabled={!canUpdate||!!busyId} onClick={()=>void retryOne(m)}>{busyId===m.mutationId?'Đang retry…':'Retry đúng snapshot'}</button>}</div></div>
    })}</div>}
   </div>
   <div className="cloud-section">
    <div className="cloud-section-head"><h3>Local chưa liên kết</h3><div className="cloud-row-actions"><button className="soft-btn small" onClick={()=>setSelected(candidates.map(a=>a.id))}>Chọn tất cả</button><button className="primary-btn small" disabled={!canImport||selected.length===0||!!busyId} onClick={()=>void importSelected()}>Nhập đã chọn ({selected.length})</button></div></div>
    {candidates.length===0?<p className="empty-small">Không có hồ sơ Local chưa liên kết trong tổ chức này.</p>:<div className="cloud-list">{candidates.map(a=>{
     const collision=cloud.some(row=>row.id===a.id||row.code===a.code)
     return <div className="cloud-row" key={a.id}>
      <label className="cloud-select"><input type="checkbox" checked={selected.includes(a.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,a.id]:prev.filter(id=>id!==a.id))}/><span className="cloud-row-main"><b>{a.code} · {a.name}</b><small>{a.category} · {a.location||'Chưa có vị trí'} · {a.images?.length||0} ảnh Local {collision?'· Có UUID/mã trùng trên Cloud':''}</small></span></label>
      <div className="cloud-row-actions">{canImport&&<button className="primary-btn small" disabled={!!busyId} onClick={()=>void importOne(a)}>{busyId===a.id?'Đang nhập…':'Nhập lên Cloud'}</button>}</div>
     </div>
    })}</div>}
   </div>
   <div className="cloud-section">
    <div className="cloud-section-head"><h3>Thiết bị Cloud</h3><button className="soft-btn small" disabled={loading} onClick={()=>void reload()}>{loading?'Đang tải…':'Tải lại'}</button></div>
    {loading?<p className="empty-small">Đang tải…</p>:cloud.length===0?<p className="empty-small">Cloud chưa có thiết bị.</p>:<div className="cloud-list">{cloud.map(a=><div className="cloud-row" key={a.id}>
     <div className="cloud-row-main"><b>{a.code} · {a.name}</b><small>{a.category} · {a.location||'Chưa có vị trí'} · Cập nhật {new Date(a.updatedAt).toLocaleString('vi-VN')}</small></div>
     <div className="cloud-row-actions"><button className="soft-btn small" disabled={!canUpdate||!!busyId} onClick={()=>void downloadOne(a)}>{busyId===a.id?'Đang tải…':'Tải về Local'}</button></div>
    </div>)}</div>}
   </div>
   <div className="modal-actions"><button className="soft-btn" onClick={onClose}>Đóng</button></div>
  </section>
 </div>
}
