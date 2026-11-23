import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset, AssetCloudLink, AssetMutationPayload, EquipmentIdComponentsSnapshot } from '../db'
import { db, now, uid } from '../db'
import { confirmSmartEquipmentIdReservation } from './smartEquipmentIdClient'

export type CloudAsset = Asset & { organizationId: string; cloudUpdatedAt: string }

export type CloudLock = {
  asset_code: string
  holder_user_id: string
  holder_device_id: string
  holder_label: string
  acquired_at: string
  expires_at: string
}
export type CloudLease = CloudLock & { lock_token: string }

const optional=(value:unknown)=>value==null||value===''?undefined:String(value)

function fromRow(row: Record<string, unknown>): CloudAsset {
  return {
    id: String(row.asset_key ?? row.code), code: String(row.code), name: String(row.name), category: String(row.category),
    brand: String(row.brand ?? ''), model: String(row.model ?? ''), serial: String(row.serial ?? ''),
    location: String(row.location ?? ''), commissionedAt: String(row.commissioned_at ?? ''),
    power: String(row.power ?? ''), cycle: String(row.cycle ?? ''), cycleStartedAt: optional(row.cycle_started_at),
    transferredFromOtherFacility: Boolean(row.transferred_from_other_facility),
    status: row.status as Asset['status'], notes: String(row.notes ?? ''), images: [],
    archivedAt: optional(row.archived_at), deletedAt: optional(row.deleted_at), createdAt: String(row.created_at),
    updatedAt: String(row.updated_at), createdByUserId: optional(row.created_by_user_id),
    createdByLabel: optional(row.created_by_label),
    originalName: optional(row.original_name), normalizedNameAtCreation: optional(row.normalized_name_at_creation),
    equipmentTypeCode: optional(row.equipment_type_code), groupCodeAtCreation: optional(row.group_code_at_creation),
    siteCodeAtCreation: optional(row.site_code_at_creation),
    idComponentsSnapshot: row.id_components_snapshot ? row.id_components_snapshot as EquipmentIdComponentsSnapshot : undefined,
    idReservationId: row.id_components_snapshot && typeof row.id_components_snapshot === 'object' ? optional((row.id_components_snapshot as Record<string,unknown>).reservation_id) : undefined,
    idReservationStatus: row.id_components_snapshot ? 'confirmed' : undefined,
    localScope: String(row.organization_id),
    organizationId: String(row.organization_id), cloudUpdatedAt: String(row.updated_at)
  }
}

export function toMutationPayload(asset:Asset):AssetMutationPayload{return {category:asset.category.trim(),name:asset.name.trim(),brand:asset.brand??'',model:asset.model??'',serial:asset.serial??'',location:asset.location??'',commissionedAt:asset.commissionedAt||'',power:asset.power??'',cycle:asset.cycle??'',cycleStartedAt:asset.cycleStartedAt||undefined,transferredFromOtherFacility:Boolean(asset.transferredFromOtherFacility),status:asset.status,notes:asset.notes??'',archivedAt:asset.archivedAt||undefined,deletedAt:asset.deletedAt||undefined}}

export function toImportPayload(asset: Asset) {
  return {
    name: asset.name.trim(), category: asset.category.trim(), brand: asset.brand ?? '',
    model: asset.model ?? '', serial: asset.serial ?? '', location: asset.location ?? '',
    commissioned_at: asset.commissionedAt || null, power: asset.power ?? '', cycle: asset.cycle ?? '',
    cycle_started_at: asset.cycleStartedAt || null, transferred_from_other_facility: Boolean(asset.transferredFromOtherFacility),
    status: asset.status, notes: asset.notes ?? '', archived_at: asset.archivedAt || null,
    created_at: asset.createdAt, updated_at: asset.updatedAt,
    created_by_user_id: asset.createdByUserId ?? null, created_by_label: asset.createdByLabel ?? null
  }
}

export async function listCloudAssets(client: SupabaseClient, organizationId: string): Promise<CloudAsset[]> {
  const rows:CloudAsset[]=[]
  let cursor:string|null=null
  const seenCursors=new Set<string>()
  do{
    const {data,error}=await client.rpc('list_cloud_assets_page',{
      p_organization_id:organizationId,p_after_code:cursor,p_page_size:100,p_platform_admin:false
    })
    if(error)throw new Error('Tải danh sách Cloud thất bại: '+error.message)
    const page=data as {items?:Record<string,unknown>[];has_more?:boolean;next_cursor?:string|null}|null
    rows.push(...(page?.items??[]).map(fromRow))
    if(!page?.has_more)break
    const nextCursor=page?.next_cursor??null
    if(!nextCursor)throw new Error('Cloud trả về trang tiếp theo nhưng thiếu cursor.')
    if(seenCursors.has(nextCursor))throw new Error('Cloud lặp cursor phân trang; dừng tải để tránh vòng lặp vô hạn.')
    seenCursors.add(nextCursor)
    cursor=nextCursor
  }while(true)
  return rows
}

export type CloudSyncSummary = { downloaded:number; updated:number; unchanged:number; protectedLocal:number; conflicts:number; pages:number }

export async function syncCloudAssetsToLocal(
  client: SupabaseClient,
  organizationId: string,
  options: { platformAdmin?:boolean; shouldContinue?:()=>boolean } = {}
): Promise<CloudSyncSummary> {
  const summary:CloudSyncSummary={downloaded:0,updated:0,unchanged:0,protectedLocal:0,conflicts:0,pages:0}
  let cursor:string|null=null
  const seenCursors=new Set<string>()
  do {
    if(options.shouldContinue&&!options.shouldContinue())break
    const {data,error}=await client.rpc('list_cloud_assets_page',{
      p_organization_id:organizationId,
      p_after_code:cursor,
      p_page_size:100,
      p_platform_admin:options.platformAdmin===true
    })
    if(error)throw new Error('Đồng bộ Cloud thất bại: '+error.message)
    const page=data as {items?:Record<string,unknown>[];has_more?:boolean;next_cursor?:string|null}|null
    const rows=(page?.items??[]).map(fromRow)
    summary.pages++
    for(const cloud of rows){
      if(options.shouldContinue&&!options.shouldContinue())return summary
      const local=await db.assets.where('[localScope+code]').equals([organizationId,cloud.code]).first()
      if(!local){
        await downloadCloudAsset(organizationId,cloud)
        summary.downloaded++
        continue
      }
      const link=await db.assetCloudLinks.get(organizationId+':'+local.id)
      if(!link||link.cloudCode!==cloud.code){
        summary.protectedLocal++
        continue
      }
      if(cloud.deletedAt){
        const result=await reconcileCloudDeletion(organizationId,local,link,cloud.deletedAt,cloud.updatedAt)
        if(result==='conflict')summary.conflicts++
        else if(result==='protected')summary.protectedLocal++
        else summary.updated++
        continue
      }
      if(link.status==='conflict'){
        summary.conflicts++
        continue
      }
      const mutations=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,local.id])
        .filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict').toArray()
      if(mutations.length){
        summary.protectedLocal++
        continue
      }
      const localChanged=local.updatedAt!==link.lastSyncedLocalUpdatedAt
      const cloudChanged=cloud.updatedAt!==link.cloudUpdatedAt
      if(localChanged&&cloudChanged){
        await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:now()})
        const existing=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,local.id])
          .filter(m=>m.status==='conflict').first()
        if(!existing)await db.assetMutations.add({
          mutationId:uid(),organizationId,assetId:local.id,payload:toMutationPayload(local),
          expectedCloudUpdatedAt:link.cloudUpdatedAt,localUpdatedAt:local.updatedAt,
          status:'conflict',attempts:0,createdAt:now(),updatedAt:now(),
          lastError:'Local và Cloud đều thay đổi kể từ lần đồng bộ trước.'
        })
        summary.conflicts++
      }else if(localChanged){
        summary.protectedLocal++
      }else if(cloudChanged){
        await downloadCloudAsset(organizationId,cloud,local)
        summary.updated++
      }else{
        await db.assetCloudLinks.update(link.id,{lastVerifiedAt:now()})
        summary.unchanged++
      }
    }
    if(!page?.has_more)break
    const nextCursor=page?.next_cursor??null
    if(!nextCursor)throw new Error('Cloud trả về trang tiếp theo nhưng thiếu cursor; dừng để tránh lặp dữ liệu.')
    if(seenCursors.has(nextCursor))throw new Error('Cloud lặp cursor phân trang; dừng đồng bộ để tránh vòng lặp vô hạn.')
    seenCursors.add(nextCursor)
    cursor=nextCursor
  }while(true)
  const {data:tombstones,error:tombstoneError}=await client.rpc('list_cloud_asset_deletion_tombstones',{p_organization_id:organizationId})
  if(tombstoneError)throw new Error('Không đồng bộ được dấu xóa thiết bị: '+tombstoneError.message)
  for(const tombstone of (Array.isArray(tombstones)?tombstones:[]) as Array<{code:string;deleted_at:string;updated_at:string}>){
    if(options.shouldContinue&&!options.shouldContinue())break
    const local=await db.assets.where('[localScope+code]').equals([organizationId,tombstone.code]).first()
    if(!local||local.deletedAt===tombstone.deleted_at)continue
    const link=await db.assetCloudLinks.get(organizationId+':'+local.id)
    if(!link||link.cloudCode!==tombstone.code){
      summary.protectedLocal++
      continue
    }
    const result=await reconcileCloudDeletion(organizationId,local,link,tombstone.deleted_at,tombstone.updated_at)
    if(result==='conflict')summary.conflicts++
    else if(result==='protected')summary.protectedLocal++
    else summary.updated++
  }
  return summary
}

type CloudDeletionResult='updated'|'conflict'|'protected'

/**
 * Apply a Cloud tombstone without erasing a newer Local snapshot.
 * A deletion arriving while Local has unsynced work becomes a conflict;
 * the Local payload and its version timestamp remain available for review.
 */
async function reconcileCloudDeletion(
  organizationId:string,
  local:Asset,
  link:AssetCloudLink,
  deletedAt:string,
  cloudUpdatedAt:string
):Promise<CloudDeletionResult>{
  if(link.organizationId!==organizationId||link.assetId!==local.id||link.cloudCode!==local.code)return 'protected'
  const mutations=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,local.id])
    .filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict').toArray()
  const localChanged=local.updatedAt!==link.lastSyncedLocalUpdatedAt
  const needsReview=localChanged||mutations.length>0||link.status==='conflict'
  const at=now()
  const reason='Thiết bị đã bị Admin xóa trên Cloud trong khi Local có thay đổi chưa đồng bộ hoặc mutation chưa xác nhận. Dữ liệu Local được giữ lại để đối chiếu.'
  await db.transaction('rw',[db.assets,db.assetCloudLinks,db.assetMutations],async()=>{
    // Reflect the remote deletion, but do not replace Local updatedAt when it
    // represents a newer unsynced snapshot; that timestamp is part of conflict detection.
    await db.assets.update(local.id,needsReview
      ? {deletedAt,updatedAt:local.updatedAt}
      : {deletedAt,updatedAt:cloudUpdatedAt})
    await db.assetCloudLinks.update(link.id,needsReview
      ? {status:'conflict',lastVerifiedAt:at}
      : {cloudUpdatedAt,lastSyncedLocalUpdatedAt:cloudUpdatedAt,status:'linked',lastVerifiedAt:at})
    for(const mutation of mutations){
      if(mutation.status==='pending'||mutation.status==='processing'){
        await db.assetMutations.update(mutation.mutationId,{status:'conflict',updatedAt:at,lastError:reason})
      }
    }
    if(needsReview&&mutations.length===0){
      await db.assetMutations.add({
        mutationId:uid(),organizationId,assetId:local.id,payload:toMutationPayload(local),
        expectedCloudUpdatedAt:link.cloudUpdatedAt,localUpdatedAt:local.updatedAt,
        status:'conflict',attempts:0,createdAt:at,updatedAt:at,lastError:reason
      })
    }else if(needsReview){
      const existing=mutations.find(m=>m.status==='conflict')??mutations[0]
      if(existing)await db.assetMutations.update(existing.mutationId,{status:'conflict',lastError:reason,updatedAt:at})
    }
  })
  return needsReview?'conflict':'updated'
}

export async function importLocalAsset(client: SupabaseClient, organizationId: string, asset: Asset) {
  if(asset.idReservationId&&asset.idReservationStatus!=='confirmed'){
    if(!asset.idComponentsSnapshot||!asset.equipmentTypeCode)throw new Error('Thiếu snapshot định danh Local; chưa thể nhập thiết bị Smart ID lên Cloud.')
    await confirmSmartEquipmentIdReservation(client,{
      organizationId,
      reservationId:asset.idReservationId,
      assetId:asset.id,
      equipmentId:asset.code,
      originalName:asset.originalName||asset.name,
      normalizedNameAtCreation:asset.normalizedNameAtCreation||asset.name,
      equipmentTypeCode:asset.equipmentTypeCode,
      components:asset.idComponentsSnapshot
    })
    await db.assets.update(asset.id,{idReservationStatus:'confirmed'})
  }
  const { data, error } = await client.rpc('import_asset_preserving_identity', {
    p_organization_id: organizationId, p_id: asset.id, p_code: asset.code,
    p_asset: toImportPayload(asset), p_mutation_id: asset.id
  })
  if (error) throw new Error('Không thể nhập lên Cloud: '+error.message)
  const result=data as {asset?:Record<string,unknown>;already_present?:boolean}
  if (!result?.asset || result.asset.asset_key!==asset.code || result.asset.code!==asset.code) throw new Error('Cloud trả về mã thiết bị không khớp Local.')
  const cloud=fromRow(result.asset)
  const pendingGroupChanges=await db.assetGroupChanges.where('[organizationId+assetId]').equals([organizationId,asset.id])
    .filter(change=>change.syncStatus==='pending').toArray()
  if(pendingGroupChanges.length){
    const ordered=[...pendingGroupChanges].sort((a,b)=>a.changedAt.localeCompare(b.changedAt))
    const {error:historyError}=await client.rpc('mirror_cloud_asset_group_change_history',{
      p_organization_id:organizationId,
      p_asset_code:asset.code,
      p_changes:ordered.map(change=>({
        id:change.id,oldCategory:change.oldCategory,newCategory:change.newCategory,
        changedByUserId:change.changedByUserId??null,changedAt:change.changedAt,reason:change.reason??null
      }))
    })
    if(historyError)throw new Error('Thiết bị đã có trên Cloud nhưng chưa đồng bộ được lịch sử đổi nhóm: '+historyError.message)
    for(const change of ordered)await db.assetGroupChanges.update(change.id,{syncStatus:'synced'})
  }
  const link: AssetCloudLink = {
    id: organizationId+':'+asset.id, organizationId, assetId: asset.id, cloudCode: cloud.code,
    cloudUpdatedAt: cloud.updatedAt, lastSyncedLocalUpdatedAt: asset.updatedAt, status:'linked', lastVerifiedAt:now()
  }
  await db.assetCloudLinks.put(link)
  return {cloud,alreadyPresent:result.already_present===true}
}

export async function downloadCloudAsset(organizationId: string, cloud: CloudAsset, existing?: Asset) {
  const local: Asset = {
    ...cloud, id:existing?.id??uid(), localScope: organizationId,
    images: existing?.images ?? [],
    createdByLabel: cloud.createdByLabel ?? existing?.createdByLabel,
    createdByUserId: cloud.createdByUserId ?? existing?.createdByUserId
  }
  const link: AssetCloudLink = {
    id: organizationId+':'+local.id, organizationId, assetId:local.id, cloudCode:cloud.code,
    cloudUpdatedAt:cloud.updatedAt,lastSyncedLocalUpdatedAt:local.updatedAt,status:'linked',lastVerifiedAt:now()
  }
  // Keep the Local asset and its Cloud link atomic. If either write fails,
  // Dexie rolls back both so a retry cannot strand an unlinked Local row.
  await db.transaction('rw',[db.assets,db.assetCloudLinks],async()=>{
    await db.assets.put(local)
    await db.assetCloudLinks.put(link)
  })
  return local
}

export async function acquireCloudAssetLock(client: SupabaseClient, organizationId: string, assetCode: string, deviceId: string, label: string) {
  const {data,error}=await client.rpc('acquire_cloud_asset_edit_lock',{p_organization_id:organizationId,p_asset_code:assetCode,p_device_id:deviceId,p_holder_label:label})
  if(error) throw new Error('Xin khóa sửa thiết bị thất bại: '+error.message)
  const result=data as Record<string,unknown>
  if(result.acquired===true) {
    if(!result.lock_token || !result.expires_at) throw new Error('Cloud cấp khóa thiếu thông tin.')
    return {acquired:true as const,lease:result as unknown as CloudLease}
  }
  return {acquired:false as const,lock:result as unknown as CloudLock}
}

export async function heartbeatCloudAssetLock(client: SupabaseClient, organizationId: string, assetCode: string, token: string) {
  const {data,error}=await client.rpc('heartbeat_cloud_asset_edit_lock',{p_organization_id:organizationId,p_asset_code:assetCode,p_lock_token:token})
  if(error) throw new Error(error.message)
  return (data as {renewed?:boolean})?.renewed===true
}

export async function releaseCloudAssetLock(client: SupabaseClient, organizationId: string, assetCode: string, token: string) {
  const {data,error}=await client.rpc('release_cloud_asset_edit_lock',{p_organization_id:organizationId,p_asset_code:assetCode,p_lock_token:token})
  if(error) throw new Error(error.message)
  return data===true
}

export async function applyCloudAssetMutation(client: SupabaseClient, organizationId: string, asset: Asset, token: string, mutationId: string, expectedCloudUpdatedAt: string, payload: AssetMutationPayload) {
  if(payload.deletedAt){
    const {data,error}=await client.rpc('soft_delete_cloud_asset_with_lock',{p_organization_id:organizationId,p_asset_code:asset.code,p_lock_token:token,p_mutation_id:mutationId,p_expected_cloud_updated_at:expectedCloudUpdatedAt,p_deleted_at:payload.deletedAt})
    if(error)throw new Error(error.message)
    const result=data as {asset?:Record<string,unknown>;already_applied?:boolean;applied_at?:string}
    if(!result.asset||result.asset.asset_key!==asset.code||!result.applied_at)throw new Error('Cloud thiếu biên nhận xóa mềm hợp lệ.')
    return {asset:fromRow(result.asset),alreadyApplied:result.already_applied===true,appliedAt:result.applied_at}
  }
  const cloudPayload={
    name:payload.name.trim(),brand:payload.brand,model:payload.model,serial:payload.serial,location:payload.location,
    commissioned_at:payload.commissionedAt||null,power:payload.power,cycle:payload.cycle,cycle_started_at:payload.cycleStartedAt||null,
    transferred_from_other_facility:payload.transferredFromOtherFacility,status:payload.status,notes:payload.notes,archived_at:payload.archivedAt||null
  }
  const {data,error}=await client.rpc('apply_cloud_asset_mutation_with_lock',{
    p_organization_id:organizationId,p_asset_code:asset.code,p_lock_token:token,p_mutation_id:mutationId,
    p_expected_cloud_updated_at:expectedCloudUpdatedAt,p_payload:cloudPayload
  })
  if(error) throw new Error(error.message)
  const result=data as {asset?:Record<string,unknown>;already_applied?:boolean;applied_at?:string}
  if(!result.asset || result.asset.asset_key!==asset.code || !result.applied_at) throw new Error('Cloud thiếu biên nhận cập nhật hợp lệ.')
  return {asset:fromRow(result.asset),alreadyApplied:result.already_applied===true,appliedAt:result.applied_at}
}

export function getLocalDeviceId() {
  const key='baotri-mini-device-id'
  let value=localStorage.getItem(key)
  if(!value){value=uid();localStorage.setItem(key,value)}
  return value
}
export function getDeviceLabel() {
  const ua=navigator.userAgent
  return /Android/i.test(ua)?'Android Mobile':/iPhone|iPad/i.test(ua)?'iPhone/iPad':/Windows/i.test(ua)?'Windows PC':/Mac/i.test(ua)?'Mac':/Linux/i.test(ua)?'Linux PC':'Thiết bị'
}

export async function retryCloudAssetMutation(client:SupabaseClient,organizationId:string,mutationId:string){
 const mutation=await db.assetMutations.get(mutationId)
 if(!mutation||mutation.organizationId!==organizationId)throw new Error('Không tìm thấy mutation Local.')
 if(mutation.status==='conflict')throw new Error('Mutation đã conflict; cần đối chiếu thủ công, không tự retry.')
 const local=await db.assets.get(mutation.assetId)
 if(!local)throw new Error('Local snapshot của mutation đã mất.')
 const link=await db.assetCloudLinks.get(organizationId+':'+mutation.assetId)
 if(!link)throw new Error('Thiết bị chưa có liên kết Cloud.')
 const deviceId=getLocalDeviceId()
 const acquired=await acquireCloudAssetLock(client,organizationId,local.code,deviceId,getDeviceLabel())
 if(!acquired.acquired)throw new Error('Cloud đang khóa bởi '+acquired.lock.holder_label+'.')
 try{
  await db.assetMutations.update(mutationId,{status:'processing',attempts:mutation.attempts+1,updatedAt:now(),lastError:undefined})
  const applied=await applyCloudAssetMutation(client,organizationId,local,acquired.lease.lock_token,mutation.mutationId,mutation.expectedCloudUpdatedAt,mutation.payload)
  const at=now()
  const conflicts=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,mutation.assetId]).filter(m=>m.status==='conflict'&&m.mutationId!==mutationId).toArray()
  await db.transaction('rw',[db.assetMutations,db.assetCloudLinks],async()=>{
   await db.assetMutations.update(mutationId,{status:'applied',appliedAt:at,cloudUpdatedAt:applied.asset.updatedAt,updatedAt:at,lastError:undefined})
   for(const old of conflicts)await db.assetMutations.update(old.mutationId,{status:'discarded',updatedAt:at,lastError:'Đã giải quyết conflict bằng retry mutation.'})
   await db.assetCloudLinks.update(link.id,{cloudUpdatedAt:applied.asset.updatedAt,lastSyncedLocalUpdatedAt:local.updatedAt,status:'linked',lastVerifiedAt:at})
  })
  return {alreadyApplied:applied.alreadyApplied,cloudUpdatedAt:applied.asset.updatedAt}
 }catch(error){
  const msg=error instanceof Error?error.message:String(error)
  const conflict=msg.toLowerCase().includes('version changed')||msg.toLowerCase().includes('changed since')
  await db.assetMutations.update(mutationId,{status:conflict?'conflict':'pending',lastError:msg,updatedAt:now()})
  if(conflict)await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:now()})
  throw error
 }finally{
  await releaseCloudAssetLock(client,organizationId,local.code,acquired.lease.lock_token).catch(()=>false)
 }
}
