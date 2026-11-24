import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from './db'
import { db, now, uid, type AssetMutation, type AssetImportQueueItem } from './db'
import { ensureOrganizationAssetResetApplied } from './lib/assetReset'
import { acquireCloudAssetLock, applyCloudAssetMutation, downloadCloudAsset, importLocalAsset, listCloudAssets, retryCloudAssetMutation, releaseCloudAssetLock, toMutationPayload, getLocalDeviceId, getDeviceLabel, type CloudAsset } from './lib/cloudAssets'

type Props={client:SupabaseClient;organizationId:string;localAssets:Asset[];localPreviewAssets:Asset[];canImport:boolean;canView:boolean;canUpdate:boolean;onClose:()=>void;onChanged:()=>void;onConflictResolved:(before:Asset,after:Asset,summary:string,eventId?:string)=>Promise<void>}

export default function CloudAssetsPanel({client,organizationId,localAssets,localPreviewAssets,canImport,canView,canUpdate,onClose,onChanged,onConflictResolved}:Props){
 const [cloud,setCloud]=useState<CloudAsset[]>([])
 const [deletedCloudCodes,setDeletedCloudCodes]=useState<string[]>([])
 const [linkedIds,setLinkedIds]=useState<string[]>([])
 const [pending,setPending]=useState<AssetMutation[]>([])
 const [importQueue,setImportQueue]=useState<AssetImportQueueItem[]>([])
 const [selected,setSelected]=useState<string[]>([])
 const [selectedPreview,setSelectedPreview]=useState<string[]>([])
 const [loading,setLoading]=useState(false)
 const [busyId,setBusyId]=useState('')
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const reload=async()=>{
  setLoading(true);setError('')
  try{
   await ensureOrganizationAssetResetApplied(client,organizationId)
   onChanged()
   const [linkRows,mutationRows]=await Promise.all([
    db.assetCloudLinks.where('organizationId').equals(organizationId).toArray(),
    db.assetMutations.where('organizationId').equals(organizationId).toArray()
   ])
   setLinkedIds(linkRows.map(l=>l.assetId))
   if(!canView){setPending([]);setCloud([]);setDeletedCloudCodes([]);return}
   setPending(mutationRows.filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict'))
   const [cloudRows,tombstonesResult]=await Promise.all([
    listCloudAssets(client,organizationId),
    client.rpc('list_cloud_asset_deletion_tombstones',{p_organization_id:organizationId})
   ])
   if(tombstonesResult.error)throw new Error('Không tải được danh sách dấu xóa Cloud: '+tombstonesResult.error.message)
   const tombstones=Array.isArray(tombstonesResult.data)?tombstonesResult.data as Array<{code?:string}>:[]
   setCloud(cloudRows);setDeletedCloudCodes(tombstones.map(row=>String(row.code??'')))
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 }
 useEffect(()=>{void reload()},[organizationId,canView])
 const candidates=localAssets.filter(a=>a.localScope===organizationId&&!linkedIds.includes(a.id))
 const previewCandidates=localPreviewAssets.filter(a=>a.localScope==='local-preview')
 const retryOne=async(mutation:AssetMutation)=>{
  if(!canView||!canUpdate){setError('Cần quyền xem và cập nhật thiết bị để retry mutation.');return}
  setBusyId(mutation.mutationId);setError('');setMessage('')
  try{
   // A manual retry is an explicit operator decision to re-attempt a previously
   // classified permanent failure after permissions or source data have changed.
   await db.assetMutations.update(mutation.mutationId,{failureKind:undefined,nextAttemptAt:undefined})
   const result=await retryCloudAssetMutation(client,organizationId,mutation.mutationId)
   const resetGeneration=await ensureOrganizationAssetResetApplied(client,organizationId)
   const currentMutation=await db.assetMutations.get(mutation.mutationId)
   if(!currentMutation){
    setMessage('Tổ chức vừa được reset trong lúc retry; mutation và hồ sơ Local cũ đã được xóa.')
    await reload();onChanged()
    return
   }
   const pendingHistory=await db.assetHistory.get(mutation.mutationId)
   let historyMessage=''
   if(pendingHistory?.syncStatus==='pending'){
    const {error:historyError}=await client.rpc('record_cloud_asset_history_event_v2',{
     p_organization_id:organizationId,p_event_id:pendingHistory.id,p_asset_code:pendingHistory.assetCode,p_event_type:pendingHistory.eventType,
     p_summary:pendingHistory.summary,p_changes:pendingHistory.changes,p_actor_label:pendingHistory.actorLabel,p_occurred_at:pendingHistory.occurredAt,
     p_reset_generation:resetGeneration
    })
    if(!historyError)await db.assetHistory.update(pendingHistory.id,{syncStatus:'synced'})
    else historyMessage=' Mutation đã được xác nhận; lịch sử vẫn chờ đồng bộ: '+historyError.message
   }
   setMessage((result.alreadyApplied?'Cloud xác nhận lại biên nhận đã áp dụng.':'Đã retry và Cloud xác nhận mutation.')+historyMessage)
   await reload();onChanged()
  }catch(e){setError(e instanceof Error?e.message:String(e));await reload()}
  finally{setBusyId('')}
 }
 const resolveConflictCloud=async(mutation:AssetMutation)=>{
  if(!canView||!canUpdate){setError('Cần quyền xem và cập nhật thiết bị để xử lý conflict.');return}
  const local=localAssets.find(a=>a.id===mutation.assetId)
  let cloudAsset:CloudAsset|undefined
  if(!local){setError('Không tìm thấy Local để đối chiếu.');return}
  if(!window.confirm('Chọn Cloud làm bản đúng và ghi đè Local? Ảnh Local được giữ, các thay đổi Local chưa đồng bộ sẽ bị bỏ.'))return
  setBusyId(mutation.mutationId);setError('');setMessage('')
  try{
   const fresh=await listCloudAssets(client,organizationId);cloudAsset=fresh.find(a=>a.code===local.code);setCloud(fresh)
   if(!cloudAsset)throw new Error('Cloud không còn hồ sơ này.')
   const resolvedLocal=await downloadCloudAsset(organizationId,cloudAsset,local)
   await ensureOrganizationAssetResetApplied(client,organizationId)
   if(!await db.assets.get(local.id))throw new Error('Tổ chức vừa được reset trong lúc đối chiếu; không thể áp dụng snapshot cũ.')
   await onConflictResolved(local,resolvedLocal,'Giải quyết xung đột: chọn Cloud làm phiên bản đúng.')
   const conflicts=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,mutation.assetId]).filter(m=>m.status==='conflict').toArray()
   for(const m of conflicts)await db.assetMutations.update(m.mutationId,{status:'discarded',updatedAt:now(),lastError:'Đã chọn Cloud làm phiên bản đúng.'})
   setMessage('Đã chọn Cloud; Local cập nhật theo Cloud và giữ ảnh Local.')
   await reload();onChanged()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusyId('')}
 }
 const resolveConflictLocal=async(mutation:AssetMutation)=>{
  if(!canView||!canUpdate){setError('Cần quyền xem và cập nhật thiết bị để xử lý conflict.');return}
  const local=localAssets.find(a=>a.id===mutation.assetId)
  const link=await db.assetCloudLinks.get(organizationId+':'+mutation.assetId)
  if(!local||!link){setError('Không tìm thấy snapshot hoặc liên kết để đối chiếu.');return}
  if(!window.confirm('Ghi đè Cloud bằng snapshot Local hiện tại? Cloud sẽ được cập nhật sau khi kiểm tra khóa.'))return
  setBusyId(mutation.mutationId);setError('');setMessage('')
  let lease:{assetId:string;token:string}|null=null
  const mutationId=uid()
  const payload=toMutationPayload(local)
  try{
   const fresh=await listCloudAssets(client,organizationId);const cloudAsset=fresh.find(a=>a.code===local.code);setCloud(fresh)
   if(!cloudAsset)throw new Error('Cloud không còn hồ sơ này.')
   if(cloudAsset.code!==link.cloudCode)throw new Error('Mã quản lý Cloud đã đổi; cần xử lý thủ công.')
   const {data:tombstones,error:tombstoneError}=await client.rpc('list_cloud_asset_deletion_tombstones',{p_organization_id:organizationId})
   if(tombstoneError)throw new Error('Không xác minh được dấu xóa Cloud: '+tombstoneError.message)
   if(cloudAsset.deletedAt||(Array.isArray(tombstones)&&tombstones.some((row:Record<string,unknown>)=>row.code===local.code)))throw new Error('Cloud đã xóa mềm thiết bị. Không thể chọn Local vì hệ thống chưa có thao tác khôi phục thiết bị đã xóa trên Cloud; hãy chọn Cloud để đồng bộ dấu xóa.')
   const acquired=await acquireCloudAssetLock(client,organizationId,local.code,getLocalDeviceId(),getDeviceLabel())
   if(!acquired.acquired)throw new Error('Cloud đang khóa bởi '+acquired.lock.holder_label+'.')
   lease={assetId:local.code,token:acquired.lease.lock_token}
   await db.assetMutations.add({mutationId,organizationId,assetId:local.id,payload,expectedCloudUpdatedAt:cloudAsset.updatedAt,localUpdatedAt:local.updatedAt,status:'processing',attempts:1,createdAt:now(),updatedAt:now()})
   const applied=await applyCloudAssetMutation(client,organizationId,local,lease.token,mutationId,cloudAsset.updatedAt,payload)
   const at=now()
   const conflicts=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,local.id]).filter(m=>m.status==='conflict').toArray()
   await db.transaction('rw',[db.assetMutations,db.assetCloudLinks],async()=>{
    await db.assetMutations.update(mutationId,{status:'applied',appliedAt:at,cloudUpdatedAt:applied.asset.updatedAt,updatedAt:at})
    for(const old of conflicts)await db.assetMutations.update(old.mutationId,{status:'discarded',updatedAt:at,lastError:'Đã giải quyết conflict bằng cách chọn Local.'})
    await db.assetCloudLinks.update(link.id,{cloudUpdatedAt:applied.asset.updatedAt,lastSyncedLocalUpdatedAt:local.updatedAt,status:'linked',lastVerifiedAt:at})
   })
   await onConflictResolved(local,local,'Giải quyết xung đột: chọn Local làm phiên bản đúng.',mutationId)
   setMessage('Đã chọn Local; Cloud được cập nhật và xác nhận.')
   await reload();onChanged()
  }catch(e){
   const msg=e instanceof Error?e.message:String(e)
   await db.assetMutations.update(mutationId,{status:'pending',lastError:msg,updatedAt:now()}).catch(()=>{})
   setError(msg)
   await reload()
  }finally{if(lease)await releaseCloudAssetLock(client,organizationId,lease.assetId,lease.token).catch(()=>false);setBusyId('')}
 }
 const importOne=async(asset:Asset)=>{
  if(!canImport){setError('Tài khoản không có quyền nhập thiết bị lên Cloud.');return}
  setBusyId(asset.id);setError('');setMessage('')
  try{
   if(await db.assetCloudLinks.get(organizationId+':'+asset.id))throw new Error('Thiết bị đã có liên kết Cloud.')
   const result=await importLocalAsset(client,organizationId,asset)
   setMessage((result.alreadyPresent?'Cloud đã có hồ sơ trùng khớp; đã xác nhận liên kết.':'Đã nhập Local lên Cloud, giữ nguyên UUID và mã quản lý.')+(asset.images?.length?' Ảnh vẫn chỉ lưu Local.':''))
   await reload();onChanged()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusyId('')}
 }
 const importPreviewOne=async(asset:Asset)=>{
  if(!canImport){setError('Tài khoản không có quyền chuyển dữ liệu Local Preview.');return false}
  setBusyId('preview:'+asset.id);setError('');setMessage('')
  try{
   if(asset.localScope!=='local-preview')throw new Error('Hồ sơ không còn thuộc Local Preview; hãy tải lại danh sách.')
   if(!asset.id||!asset.code.trim()||!asset.name.trim())throw new Error('Hồ sơ thiếu UUID, mã quản lý hoặc tên thiết bị; cần bổ sung dữ liệu trước khi chuyển.')
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(asset.id))throw new Error('UUID hồ sơ không hợp lệ; không thể nhập an toàn.')
   if(asset.idReservationId)throw new Error('Hồ sơ có Smart ID reservation gắn với Local Preview. Không tự chuyển vì chưa xác định được reservation thuộc tổ chức nào.')
   const links=await db.assetCloudLinks.where('assetId').equals(asset.id).toArray()
   if(links.some(link=>link.organizationId!==organizationId))throw new Error('UUID này đã được liên kết với Cloud của tổ chức khác; không thể chuyển tự động.')
   if(links.some(link=>link.organizationId===organizationId&&(link.status!=='linked'||link.cloudCode!==asset.code)))throw new Error('Liên kết Cloud hiện có đang xung đột hoặc không khớp mã; cần đối chiếu thủ công.')
   const duplicate=await db.assets.where('[localScope+code]').equals([organizationId,asset.code]).first()
   if(duplicate&&duplicate.id!==asset.id)throw new Error('Tổ chức đã có hồ sơ Local cùng mã quản lý. Cần đối chiếu thủ công.')
   const result=await importLocalAsset(client,organizationId,asset)
   await db.transaction('rw',[db.assets,db.assetCloudLinks],async()=>{
    const current=await db.assets.get(asset.id)
    if(!current||current.localScope!=='local-preview')throw new Error('Hồ sơ Local Preview đã thay đổi trong lúc nhập Cloud; cần kiểm tra lại.')
    const link=await db.assetCloudLinks.get(organizationId+':'+asset.id)
    if(!link||link.cloudCode!==asset.code||link.status!=='linked')throw new Error('Cloud chưa xác nhận liên kết hợp lệ; giữ nguyên nguồn Local Preview để retry.')
    await db.assets.update(asset.id,{localScope:organizationId})
   })
   setMessage((result.alreadyPresent?'Cloud đã có hồ sơ cùng UUID và mã; đã xác nhận lại.':'Đã nhập Cloud và chuyển hồ sơ vào tổ chức.')+' UUID và mã quản lý được giữ nguyên; ảnh vẫn ở trình duyệt này.')
   await reload();onChanged()
   return true
  }catch(e){const message=e instanceof Error?e.message:String(e);await reload();setError(message);return false}
  finally{setBusyId('')}
 }
 const importSelectedPreview=async()=>{
  const items=previewCandidates.filter(a=>selectedPreview.includes(a.id))
  if(!items.length)return
  if(!window.confirm('Bạn đang chuyển '+items.length+' hồ sơ từ Local Preview (có thể chứa dữ liệu thử nghiệm) vào tổ chức hiện tại. Chỉ các hồ sơ đã chọn mới được nhập. Tiếp tục?'))return
  const failed:string[]=[]
  let completed=0
  for(const asset of items){if(await importPreviewOne(asset))completed++;else failed.push(asset.id)}
  setSelectedPreview(failed)
  if(failed.length){setError('Đã chuyển '+completed+' hồ sơ; còn '+failed.length+' hồ sơ chưa chuyển được và vẫn được giữ nguyên trong Local Preview.')}
  else setMessage('Đã chuyển thành công '+completed+' hồ sơ đã chọn vào tổ chức.')
 }
 const importSelected=async()=>{
  const items=candidates.filter(a=>selected.includes(a.id))
  if(!items.length)return
  if(!window.confirm('Nhập '+items.length+' hồ sơ Local lên Cloud? UUID và mã quản lý được giữ nguyên. Ảnh vẫn ở Local.'))return
  for(const asset of items)await importOne(asset)
  setSelected([])
 }
 const downloadOne=async(asset:CloudAsset)=>{
  if(!canView){setError('Tài khoản không có quyền xem thiết bị Cloud.');return}
  setBusyId(asset.id);setError('');setMessage('')
  try{
   await ensureOrganizationAssetResetApplied(client,organizationId)
   const local=await db.assets.where('[localScope+code]').equals([organizationId,asset.code]).first()
   const link=local?await db.assetCloudLinks.get(organizationId+':'+local.id):undefined
   if(local&&!link){
    if(local.localScope!==organizationId)throw new Error('Mã thiết bị đã tồn tại ở phạm vi Local khác; không ghi đè.')
    if(local.code!==asset.code)throw new Error('Local và Cloud cùng mã nhưng dữ liệu khác nhau; cần đối chiếu thủ công.')
    throw new Error('Local đã có mã này nhưng chưa liên kết Cloud. Không tự ghi đè.')
   }
   if(local&&link){
    if(link.cloudCode!==asset.code)throw new Error('Mã Cloud đã thay đổi so với liên kết; cần đối chiếu thủ công.')
    const localChanged=local.updatedAt!==link.lastSyncedLocalUpdatedAt
    const cloudChanged=asset.updatedAt!==link.cloudUpdatedAt
    if(localChanged&&cloudChanged){
      await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:new Date().toISOString()})
      if(local){
       const existingConflict=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,local.id]).filter(m=>m.status==='conflict').first()
       if(!existingConflict)await db.assetMutations.add({mutationId:uid(),organizationId,assetId:local.id,payload:toMutationPayload(local),expectedCloudUpdatedAt:link.cloudUpdatedAt,localUpdatedAt:local.updatedAt,status:'conflict',attempts:0,createdAt:now(),updatedAt:now(),lastError:'Local và Cloud đều thay đổi kể từ lần đồng bộ trước.'})
      }
      await reload()
      throw new Error('Local và Cloud đều thay đổi. Đã tạo mục đối chiếu; chọn Cloud hoặc Local trong phần conflict.')
    }
    if(localChanged&&!cloudChanged){setMessage('Local có thay đổi chưa đồng bộ; giữ nguyên Local.');return}
    if(!cloudChanged){await db.assetCloudLinks.update(link.id,{status:'linked',lastVerifiedAt:new Date().toISOString()});setMessage('Local và Cloud đã cùng phiên bản.');return}
   }
   await downloadCloudAsset(organizationId,asset,local)
   await ensureOrganizationAssetResetApplied(client,organizationId)
   const downloaded=await db.assets.where('[localScope+code]').equals([organizationId,asset.code]).first()
   if(!downloaded)throw new Error('Tổ chức vừa được reset trong lúc tải Cloud; dữ liệu cũ đã bị loại bỏ.')
   setMessage(local?'Đã cập nhật Local theo Cloud; giữ lại ảnh Local.':'Đã tải hồ sơ Cloud về Local.')
   onChanged()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusyId('')}
 }
 return <div className="modal-backdrop cloud-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="modal cloud-modal">
   <div className="modal-head"><div><div className="eyebrow">ĐỒNG BỘ CÓ KIỂM SOÁT</div><h2>Local ↔ Cloud</h2><p>Không đồng bộ đại trà; đối chiếu mã quản lý và phiên bản trước khi chuyển.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>
   <div className="cloud-summary"><b>{localAssets.length}</b> Local · <b>{cloud.length}</b> Cloud · <span>Ảnh chỉ lưu Local</span></div>
   {error&&<div className="auth-error">{error}</div>}{message&&<div className="cloud-message">{message}</div>}
   <div className="cloud-section">
    <div className="cloud-section-head"><h3>Mutation Local chưa được Cloud xác nhận</h3><button className="soft-btn small" disabled={loading} onClick={()=>void reload()}>Kiểm tra</button></div>
    {pending.length===0?<p className="empty-small">Không có thay đổi Cloud đang chờ.</p>:<div className="cloud-list">{pending.map(m=>{
      const asset=localAssets.find(a=>a.id===m.assetId)
      const cloudRecord=cloud.find(row=>row.code===asset?.code)
      const cloudDeleted=Boolean(cloudRecord?.deletedAt||deletedCloudCodes.includes(asset?.code??''))
      const cloudDeletionProfileAvailable=Boolean(cloudRecord?.deletedAt)
      return <div className="cloud-row" key={m.mutationId}><div className="cloud-row-main"><b>{asset?.code||m.assetId} · {m.status==='conflict'?'Cần đối chiếu':m.failureKind==='permanent'?'Cần kiểm tra thủ công':'Đang chờ đồng bộ'}</b><small>{cloudDeleted?(cloudDeletionProfileAvailable?'Cloud đã xóa mềm; chỉ có thể chọn Cloud để đồng bộ dấu xóa.':'Cloud đã xóa mềm; cần Admin xác nhận Cloud vì vai trò hiện tại không được xem hồ sơ đã xóa.'):m.lastError||'Mutation '+m.mutationId+' · '+m.updatedAt}</small></div><div className="cloud-row-actions">{m.status==='conflict'?<><span className="status red">Conflict</span>{(!cloudDeleted||cloudDeletionProfileAvailable)&&<button className="soft-btn small" disabled={!canView||!canUpdate||!!busyId} onClick={()=>void resolveConflictCloud(m)}>Chọn Cloud</button>}{!cloudDeleted&&<button className="primary-btn small" disabled={!canView||!canUpdate||!!busyId} onClick={()=>void resolveConflictLocal(m)}>Chọn Local</button>}</>:<button className="primary-btn small" disabled={!canView||!canUpdate||!!busyId} onClick={()=>void retryOne(m)}>{busyId===m.mutationId?'Đang retry…':'Retry đúng snapshot'}</button>}</div></div>
    })}</div>}
   </div>
   <div className="cloud-section">
    <div className="cloud-section-head"><h3>Local chưa liên kết</h3><div className="cloud-row-actions"><button className="soft-btn small" onClick={()=>setSelected(candidates.map(a=>a.id))}>Chọn tất cả</button><button className="primary-btn small" disabled={!canImport||selected.length===0||!!busyId} onClick={()=>void importSelected()}>Nhập đã chọn ({selected.length})</button></div></div>
    {candidates.length===0?<p className="empty-small">Không có hồ sơ Local chưa liên kết trong tổ chức này.</p>:<div className="cloud-list">{candidates.map(a=>{
     const collision=cloud.some(row=>row.code===a.code)
     const queued=importQueue.find(item=>item.assetId===a.id)
     const queueLabel=queued?.status==='processing'?'Tự động đồng bộ: đang gửi lên Cloud':queued?.status==='pending'?'Tự động đồng bộ: đang chờ retry':queued?.status==='conflict'?'Tự động đồng bộ: cần đối chiếu':queued?.status==='permanent'?'Tự động đồng bộ: tạm dừng do lỗi':''
     return <div className="cloud-row" key={a.id}>
      <label className="cloud-select"><input type="checkbox" checked={selected.includes(a.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,a.id]:prev.filter(id=>id!==a.id))}/><span className="cloud-row-main"><b>{a.code} · {a.name}</b><small>{a.category} · {a.location||'Chưa có vị trí'} · {a.images?.length||0} ảnh Local {collision?'· Mã quản lý đã có trên Cloud':''}{queueLabel?' · '+queueLabel:''}{queued?.lastError?' · '+queued.lastError:''}</small></span></label>
      <div className="cloud-row-actions">{canImport&&<button className="primary-btn small" disabled={!!busyId} onClick={()=>void importOne(a)}>{busyId===a.id?'Đang nhập…':'Nhập lên Cloud'}</button>}</div>
     </div>
    })}</div>}
   </div>
   {canImport&&<div className="cloud-section">
    <div className="cloud-section-head"><h3>Dữ liệu Local Preview cũ</h3><div className="cloud-row-actions"><button className="soft-btn small" onClick={()=>setSelectedPreview(previewCandidates.map(a=>a.id))}>Chọn tất cả</button><button className="primary-btn small" disabled={selectedPreview.length===0||!!busyId} onClick={()=>void importSelectedPreview()}>Chuyển đã chọn ({selectedPreview.length})</button></div></div>
    <p className="empty-small">Nguồn này có thể chứa dữ liệu thử nghiệm. Chỉ tài khoản có quyền nhập thiết bị (assets.import) mới thấy và có thể chọn từng hồ sơ. Sau khi Cloud xác nhận thành công, hồ sơ mới được chuyển khỏi Local Preview.</p>
    {previewCandidates.length===0?<p className="empty-small">Không có hồ sơ Local Preview cũ.</p>:<div className="cloud-list">{previewCandidates.map(a=><div className="cloud-row" key={a.id}>
     <label className="cloud-select"><input type="checkbox" checked={selectedPreview.includes(a.id)} onChange={e=>setSelectedPreview(prev=>e.target.checked?[...prev,a.id]:prev.filter(id=>id!==a.id))}/><span className="cloud-row-main"><b>{a.code||'Chưa có mã'} · {a.name||'Chưa có tên'}</b><small>{a.category||'Chưa phân nhóm'} · {a.location||'Chưa có vị trí'} · {a.images?.length||0} ảnh Local {a.idReservationId?'· Có reservation cần xử lý riêng':''}</small></span></label>
     <div className="cloud-row-actions"><button className="primary-btn small" disabled={!!busyId||Boolean(a.idReservationId)} onClick={()=>void importPreviewOne(a)}>{busyId==='preview:'+a.id?'Đang chuyển…':'Chuyển vào tổ chức'}</button></div>
    </div>)}</div>}
   </div>}
   <div className="cloud-section">
    <div className="cloud-section-head"><h3>Thiết bị Cloud</h3><button className="soft-btn small" disabled={loading} onClick={()=>void reload()}>{loading?'Đang tải…':'Tải lại'}</button></div>
    {loading?<p className="empty-small">Đang tải…</p>:cloud.length===0?<p className="empty-small">Cloud chưa có thiết bị.</p>:<div className="cloud-list">{cloud.map(a=><div className="cloud-row" key={a.id}>
     <div className="cloud-row-main"><b>{a.code} · {a.name}</b><small>{a.category} · {a.location||'Chưa có vị trí'} · Cập nhật {new Date(a.updatedAt).toLocaleString('vi-VN')}</small></div>
     <div className="cloud-row-actions"><button className="soft-btn small" disabled={!canView||!!busyId} onClick={()=>void downloadOne(a)}>{busyId===a.id?'Đang tải…':'Tải về Local'}</button></div>
    </div>)}</div>}
   </div>
   <div className="modal-actions"><button className="soft-btn" onClick={onClose}>Đóng</button></div>
  </section>
 </div>
}
