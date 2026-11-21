import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from './db'
import { db } from './db'
import { downloadCloudAsset, importLocalAsset, listCloudAssets, type CloudAsset } from './lib/cloudAssets'

type Props = {
  client: SupabaseClient
  organizationId: string
  localAssets: Asset[]
  canImport: boolean
  canUpdate: boolean
  onClose: () => void
  onChanged: () => void
}

export default function CloudAssetsPanel({client,organizationId,localAssets,canImport,canUpdate,onClose,onChanged}:Props){
  const [cloud,setCloud]=useState<CloudAsset[]>([])
  const [selected,setSelected]=useState<string[]>([])
  const [loading,setLoading]=useState(false)
  const [busyId,setBusyId]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const reload=async()=>{
    setLoading(true);setError('')
    try{const [cloudRows,linkRows]=await Promise.all([listCloudAssets(client,organizationId),db.assetCloudLinks.where('organizationId').equals(organizationId).toArray()]);setCloud(cloudRows);setLinks(linkRows.map(l=>l.assetId))}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  }
  useEffect(()=>{void reload()},[organizationId])
  const localLinkedIds=new Set(localAssets.map(a=>a.id))
  const cloudLocalIds=new Set(cloud.map(a=>a.id))
  const importCandidates=localAssets.filter(a=>!localLinkedIds.has(a.id) && !cloudLocalIds.has(a.id))
  // Only Local-only records without an existing link are importable. Existing Cloud
  // UUID/code collisions are displayed for manual inspection, never auto-overwritten.
  const linkedById=new Map<string,string>()
  for(const a of localAssets){const link=awaitLinkPlaceholder(a); if(link) linkedById.set(a.id,link)}
  function awaitLinkPlaceholder(a:Asset){return a.localScope===organizationId && a.id && a.code ? '' : ''}

  const importOne=async(asset:Asset)=>{
    setBusyId(asset.id);setError('');setMessage('')
    try{
      const existing=await db.assetCloudLinks.get(organizationId+':'+asset.id)
      if(existing)throw new Error('Thiết bị đã có liên kết Cloud.')
      if(asset.images?.length) setMessage('Lưu ý: ảnh vẫn chỉ ở Local; hồ sơ Cloud không nhận ảnh.')
      const result=await importLocalAsset(client,organizationId,asset)
      setMessage(result.alreadyPresent?'Cloud đã có hồ sơ trùng khớp; đã xác nhận liên kết.':'Đã nhập Local lên Cloud và giữ nguyên UUID/mã quản lý.')
      await reload();onChanged()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusyId('')}
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
        if(localChanged&&cloudChanged)throw new Error('Cả Local và Cloud đều thay đổi từ lần đồng bộ trước. Không ghi đè; cần đối chiếu.')
        if(localChanged&&!cloudChanged){setMessage('Local có thay đổi chưa đồng bộ; giữ Local và không ghi đè.');return}
        if(!cloudChanged){setMessage('Local và Cloud đã cùng phiên bản.');return}
      }
      await downloadCloudAsset(organizationId,asset,local)
      setMessage(local?'Đã cập nhật Local theo Cloud; giữ lại ảnh Local.':'Đã tải thiết bị Cloud về Local.')
      onChanged()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusyId('')}
  }
  const importSelected=async()=>{
    const items=importCandidates.filter(a=>selected.includes(a.id))
    if(!items.length)return
    if(!window.confirm('Nhập '+items.length+' hồ sơ Local lên Cloud? UUID và mã quản lý được giữ nguyên. Ảnh vẫn ở Local.'))return
    for(const a of items)await importOne(a)
    setSelected([])
  }
  return <div className="modal-backdrop cloud-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="modal cloud-modal">
      <div className="modal-head"><div><div className="eyebrow">ĐỒNG BỘ CÓ KIỂM SOÁT</div><h2>Local ↔ Cloud</h2><p>Không đồng bộ đại trà; mỗi lần chuyển hồ sơ đều kiểm tra UUID và mã quản lý.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>
      <div className="cloud-summary"><b>{localAssets.length}</b> Local · <b>{cloud.length}</b> Cloud · <span>Ảnh chưa đồng bộ</span></div>
      {error&&<div className="auth-error">{error}</div>}{message&&<div className="cloud-message">{message}</div>}
      <div className="cloud-section">
        <div className="cloud-section-head"><h3>Local chưa liên kết</h3><button className="soft-btn" onClick={()=>setSelected(importCandidates.map(a=>a.id))}>Chọn tất cả chưa liên kết</button></div>
        {importCandidates.length===0?<p className="empty-small">Không có hồ sơ Local chưa liên kết.</p>:<div className="cloud-list">{localAssets.map(a=>{
          const linked=Boolean(a.localScope!==organizationId)||false
          const linkId=organizationId+':'+a.id
          return <div className="cloud-row" key={a.id}>
            <div className="cloud-row-main"><b>{a.code} · {a.name}</b><small>{a.category} · {a.location||'Chưa có vị trí'} · {a.images?.length||0} ảnh Local</small></div>
            <div className="cloud-row-actions">{db.assetCloudLinks.get(linkId).then(()=>{})&&null}
              {a.localScope===organizationId&&canImport&&!busyId&&<button className="primary-btn small" onClick={()=>void importOne(a)}>Nhập lên Cloud</button>}
              {a.localScope!==organizationId&&<span className="status gray">Local riêng</span>}
            </div>
          </div>
        })}</div>}
      </div>
      <div className="cloud-section">
        <div className="cloud-section-head"><h3>Thiết bị trên Cloud</h3><button className="soft-btn" disabled={loading} onClick={()=>void reload()}>{loading?'Đang tải…':'Tải lại'}</button></div>
        {loading?<p className="empty-small">Đang tải dữ liệu Cloud…</p>:cloud.length===0?<p className="empty-small">Cloud chưa có thiết bị.</p>:<div className="cloud-list">{cloud.map(a=><div className="cloud-row" key={a.id}>
          <div className="cloud-row-main"><b>{a.code} · {a.name}</b><small>{a.category} · {a.location||'Chưa có vị trí'} · Cập nhật {new Date(a.updatedAt).toLocaleString('vi-VN')}</small></div>
          <div className="cloud-row-actions"><button className="soft-btn small" disabled={!canUpdate||busyId===a.id} onClick={()=>void downloadOne(a)}>{busyId===a.id?'Đang xử lý…':'Tải về Local'}</button></div>
        </div>)}</div>}
      </div>
      <div className="modal-actions"><button className="soft-btn" onClick={onClose}>Đóng</button></div>
    </section>
  </div>
}
