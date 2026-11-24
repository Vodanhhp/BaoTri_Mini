import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset, AssetCloudLink, AssetMutationPayload, EquipmentIdComponentsSnapshot } from '../db'
import { db, now, uid } from '../db'
import { confirmSmartEquipmentIdReservation } from './smartEquipmentIdClient'
import { ensureOrganizationAssetResetApplied } from './assetReset'
import {
  advanceAssetSyncCursor, getAssetSyncCheckpoint, initializeAssetSyncCursor,
  listAssetSyncChanges, markAssetSyncBootstrapComplete, readAssetSyncCursor
} from './cloudAssetChanges'

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

export function cloudAssetFromRow(row: Record<string, unknown>): CloudAsset {
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
  await ensureOrganizationAssetResetApplied(client,organizationId)
  const rows:CloudAsset[]=[]
  let cursor:string|null=null
  const seenCursors=new Set<string>()
  do{
    const {data,error}=await client.rpc('list_cloud_assets_page',{
      p_organization_id:organizationId,p_after_code:cursor,p_page_size:100,p_platform_admin:false
    })
    if(error)throw new Error('Tải danh sách Cloud thất bại: '+error.message)
    const page=data as {items?:Record<string,unknown>[];has_more?:boolean;next_cursor?:string|null}|null
    rows.push(...(page?.items??[]).map(cloudAssetFromRow))
    if(!page?.has_more)break
    const nextCursor=page?.next_cursor??null
    if(!nextCursor)throw new Error('Cloud trả về trang tiếp theo nhưng thiếu cursor.')
    if(seenCursors.has(nextCursor))throw new Error('Cloud lặp cursor phân trang; dừng tải để tránh vòng lặp vô hạn.')
    seenCursors.add(nextCursor)
    cursor=nextCursor
  }while(true)
  // A reset may commit while the paginated read is in progress.
  await ensureOrganizationAssetResetApplied(client,organizationId)
  return rows
}

export type CloudSyncSummary = { downloaded:number; updated:number; unchanged:number; protectedLocal:number; conflicts:number; pages:number }


function incrementCloudSyncSummary(summary:CloudSyncSummary,result:CloudAssetReconcileResult):void{
  if(result==='downloaded')summary.downloaded++
  else if(result==='updated')summary.updated++
  else if(result==='unchanged')summary.unchanged++
  else if(result==='protected')summary.protectedLocal++
  else if(result==='conflict')summary.conflicts++
}

type CloudAssetReconcileResult='downloaded'|'updated'|'unchanged'|'protected'|'conflict'

async function reconcileCloudAssetSnapshot(organizationId:string,cloud:CloudAsset):Promise<CloudAssetReconcileResult>{
  const local=await db.assets.where('[localScope+code]').equals([organizationId,cloud.code]).first()
  if(!local){await downloadCloudAsset(organizationId,cloud);return 'downloaded'}
  const link=await db.assetCloudLinks.get(organizationId+':'+local.id)
  if(!link||link.cloudCode!==cloud.code)return 'protected'
  if(cloud.deletedAt){
    const result=await reconcileCloudDeletion(organizationId,local,link,cloud.deletedAt,cloud.updatedAt)
    return result==='conflict'?'conflict':result==='protected'?'protected':'updated'
  }
  if(link.status==='conflict')return 'conflict'
  const mutations=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,local.id])
    .filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict').toArray()
  if(mutations.length)return 'protected'
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
    return 'conflict'
  }
  if(localChanged)return 'protected'
  if(cloudChanged){await downloadCloudAsset(organizationId,cloud,local);return 'updated'}
  await db.assetCloudLinks.update(link.id,{lastVerifiedAt:now()})
  return 'unchanged'
}

export async function syncCloudAssetsToLocal(
  client: SupabaseClient,
  organizationId: string,
  options: { platformAdmin?:boolean; shouldContinue?:()=>boolean } = {}
): Promise<CloudSyncSummary> {
  await ensureOrganizationAssetResetApplied(client,organizationId)
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
    const rows=(page?.items??[]).map(cloudAssetFromRow)
    summary.pages++
    for(const cloud of rows){
      if(options.shouldContinue&&!options.shouldContinue())return summary
      incrementCloudSyncSummary(summary,await reconcileCloudAssetSnapshot(organizationId,cloud))
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
  // A reset may commit while pagination is in progress. Re-check after the read
  // so any records downloaded from the pre-reset snapshot are purged immediately.
  await ensureOrganizationAssetResetApplied(client,organizationId)
  return summary
}


/** Incremental Cloud Pull after a one-time checkpoint + Full Scan bootstrap. */
export async function syncCloudAssetsIncrementally(
  client:SupabaseClient,
  organizationId:string,
  options:{shouldContinue?:()=>boolean;platformAdmin?:boolean}={}
):Promise<CloudSyncSummary>{
  await ensureOrganizationAssetResetApplied(client,organizationId)
  let cursor=await readAssetSyncCursor(organizationId)
  if(!cursor){
    let checkpoint:Awaited<ReturnType<typeof getAssetSyncCheckpoint>>
    try{checkpoint=await getAssetSyncCheckpoint(client,organizationId)}catch(error){
      if(isMissingAssetSyncRpc(error))return syncCloudAssetsToLocal(client,organizationId,options)
      throw error
    }
    cursor=await initializeAssetSyncCursor(organizationId,checkpoint)
  }
  const summary:CloudSyncSummary={downloaded:0,updated:0,unchanged:0,protectedLocal:0,conflicts:0,pages:0}
  if(!cursor.bootstrapComplete){
    const full=await syncCloudAssetsToLocal(client,organizationId,options)
    mergeCloudSyncSummary(summary,full)
    if(options.shouldContinue&&!options.shouldContinue())return summary
    await markAssetSyncBootstrapComplete(organizationId)
    cursor=await readAssetSyncCursor(organizationId)
    if(!cursor)throw new Error('Bootstrap hoàn tất nhưng cursor Local không còn.')
  }
  let afterSequence=cursor.lastSequence
  let resetGeneration=cursor.resetGeneration
  do{
    if(options.shouldContinue&&!options.shouldContinue())break
    let page
    try{page=await listAssetSyncChanges(client,organizationId,afterSequence,200)}catch(error){
      if(isMissingAssetSyncRpc(error)){
        const fallback=await syncCloudAssetsToLocal(client,organizationId,options)
        mergeCloudSyncSummary(summary,fallback)
        return summary
      }
      throw error
    }
    summary.pages++
    if(page.currentGeneration<resetGeneration)throw new Error('Cloud reset generation thấp hơn cursor Local; dừng đồng bộ an toàn.')
    let lastResetIndex=-1
    for(let i=0;i<page.items.length;i++)if(page.items[i].eventType==='reset')lastResetIndex=i
    const lastResetGenerationInPage=lastResetIndex>=0?page.items[lastResetIndex].resetGeneration??resetGeneration:resetGeneration
    const generationGap=page.currentGeneration>resetGeneration
    const resetAfterPageMarker=lastResetIndex>=0&&page.currentGeneration>lastResetGenerationInPage
    if(generationGap&&lastResetIndex<0&&!page.hasMore)throw new Error('Feed thiếu Reset barrier dù generation Cloud đã tăng; không advance cursor.')
    if(resetAfterPageMarker&&!page.hasMore)throw new Error('Feed thiếu Reset barrier mới hơn marker cuối page; không advance cursor.')
    for(let i=0;i<page.items.length;i++){
      const event=page.items[i]
      if(options.shouldContinue&&!options.shouldContinue())return summary
      if(event.organizationId!==organizationId)throw new Error('Pull event sai tenant; dừng đồng bộ.')
      // Reset is a durable barrier. Ignore any pre-reset events in a page (or
      // pages before the marker) because the preflight reset already purged Local.
      if(lastResetIndex>=0&&i<lastResetIndex)continue
      if(generationGap&&lastResetIndex<0&&event.eventType!=='reset')continue
      if(resetAfterPageMarker&&i>lastResetIndex&&event.eventType!=='reset')continue
      if(event.eventType==='reset'){
        const appliedGeneration=await ensureOrganizationAssetResetApplied(client,organizationId)
        resetGeneration=Math.max(resetGeneration,event.resetGeneration??appliedGeneration)
        continue
      }
      if(!event.assetCode)throw new Error('Pull event thiếu mã thiết bị.')
      if(event.eventType==='upsert'){
        if(!event.snapshot)throw new Error('Upsert event thiếu snapshot; cursor chưa advance.')
        const cloud=cloudAssetFromRow(event.snapshot)
        if(cloud.organizationId!==organizationId||cloud.code!==event.assetCode)throw new Error('Snapshot event sai tenant/mã thiết bị.')
        incrementCloudSyncSummary(summary,await reconcileCloudAssetSnapshot(organizationId,cloud))
      }else{
        const local=await db.assets.where('[localScope+code]').equals([organizationId,event.assetCode]).first()
        if(!local){summary.unchanged++;continue}
        const link=await db.assetCloudLinks.get(organizationId+':'+local.id)
        if(!link||link.organizationId!==organizationId||link.cloudCode!==event.assetCode){summary.protectedLocal++;continue}
        const deletedAt=event.snapshot&&typeof event.snapshot.deleted_at==='string'
          ?event.snapshot.deleted_at:event.eventCreatedAt
        const result=await reconcileCloudDeletion(organizationId,local,link,deletedAt,event.assetUpdatedAt??event.eventCreatedAt)
        if(result==='conflict')summary.conflicts++
        else if(result==='protected')summary.protectedLocal++
        else summary.updated++
      }
    }
    if(options.shouldContinue&&!options.shouldContinue())break
    if(page.items.length>0&&page.nextCursor<=afterSequence)throw new Error('Pull cursor lùi hoặc không tiến; dừng để không mất dữ liệu.')
    if(page.items.length===0&&page.nextCursor!==afterSequence)throw new Error('Pull page rỗng nhưng cursor tiến; đã dừng.')
    if(page.items.length>0){
      await advanceAssetSyncCursor(organizationId,page.nextCursor,resetGeneration)
      afterSequence=page.nextCursor
    }
    if(!page.hasMore)break
    if(page.nextCursor===afterSequence&&page.items.length===0)break
  }while(true)
  await ensureOrganizationAssetResetApplied(client,organizationId)
  return summary
}

function mergeCloudSyncSummary(target:CloudSyncSummary,source:CloudSyncSummary):void{
  target.downloaded+=source.downloaded;target.updated+=source.updated;target.unchanged+=source.unchanged
  target.protectedLocal+=source.protectedLocal;target.conflicts+=source.conflicts;target.pages+=source.pages
}

function isMissingAssetSyncRpc(error:unknown):boolean{
  const candidate=error as {code?:unknown;message?:unknown}
  const code=String(candidate?.code??'')
  const message=String(candidate?.message??error??'').toLowerCase()
  return code==='PGRST202'||code==='PGRST204'||code==='42883'||
    (message.includes('get_asset_sync_checkpoint')||message.includes('list_asset_sync_changes'))&&
    (message.includes('not found')||message.includes('does not exist')||message.includes('schema cache')||message.includes('could not find'))
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
  const resetGeneration=await ensureOrganizationAssetResetApplied(client,organizationId)
  const current=await db.assets.get(asset.id)
  if(!current||current.localScope!==asset.localScope||current.code!==asset.code||current.updatedAt!==asset.updatedAt||
     (asset.localScope!=='local-preview'&&asset.localScope!==organizationId)){
    throw new Error('Hồ sơ Local đã bị xóa hoặc thay đổi sau reset; hãy tải lại dữ liệu trước khi nhập.')
  }
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
  const { data, error } = await client.rpc('import_asset_preserving_identity_v2', {
    p_organization_id: organizationId, p_id: asset.id, p_code: asset.code,
    p_asset: toImportPayload(asset), p_mutation_id: asset.id, p_reset_generation: resetGeneration
  })
  if (error) throw new Error('Không thể nhập lên Cloud: '+error.message)
  const result=data as {asset?:Record<string,unknown>;already_present?:boolean}
  if (!result?.asset || result.asset.asset_key!==asset.code || result.asset.code!==asset.code) throw new Error('Cloud trả về mã thiết bị không khớp Local.')
  const cloud=cloudAssetFromRow(result.asset)
  const groupResetGeneration=await ensureOrganizationAssetResetApplied(client,organizationId)
  const currentAfterImport=await db.assets.get(asset.id)
  if(!currentAfterImport||currentAfterImport.localScope!==asset.localScope||currentAfterImport.code!==asset.code||currentAfterImport.updatedAt!==asset.updatedAt){
    throw new Error('Tổ chức vừa được reset trong lúc nhập Cloud; Local snapshot cũ đã bị loại bỏ.')
  }
  const pendingGroupChanges=await db.assetGroupChanges.where('[organizationId+assetId]').equals([organizationId,asset.id])
    .filter(change=>change.syncStatus==='pending').toArray()
  if(pendingGroupChanges.length){
    const ordered=[...pendingGroupChanges].sort((a,b)=>a.changedAt.localeCompare(b.changedAt))
    const {error:historyError}=await client.rpc('mirror_cloud_asset_group_change_history_v2',{
      p_organization_id:organizationId,
      p_asset_code:asset.code,
      p_changes:ordered.map(change=>({
        id:change.id,oldCategory:change.oldCategory,newCategory:change.newCategory,
        changedByUserId:change.changedByUserId??null,changedAt:change.changedAt,reason:change.reason??null
      })),
      p_reset_generation:groupResetGeneration
    })
    if(historyError)throw new Error('Thiết bị đã có trên Cloud nhưng chưa đồng bộ được lịch sử đổi nhóm: '+historyError.message)
    for(const change of ordered)await db.assetGroupChanges.update(change.id,{syncStatus:'synced'})
  }
  const link: AssetCloudLink = {
    id: organizationId+':'+asset.id, organizationId, assetId: asset.id, cloudCode: cloud.code,
    cloudUpdatedAt: cloud.updatedAt, lastSyncedLocalUpdatedAt: asset.updatedAt, status:'linked', lastVerifiedAt:now()
  }
  await db.transaction('rw',[db.assetCloudLinks,db.assetImportQueue],async()=>{
    await db.assetCloudLinks.put(link)
    const queued=await db.assetImportQueue.get(organizationId+':'+asset.id)
    if(queued)await db.assetImportQueue.update(queued.id,{status:'applied',updatedAt:now(),lastError:undefined,nextAttemptAt:undefined,failureKind:undefined})
  })
  await ensureOrganizationAssetResetApplied(client,organizationId)
  if(!await db.assets.get(asset.id))throw new Error('Tổ chức vừa được reset sau khi nhập Cloud; Local snapshot cũ đã được xóa.')
  return {cloud,alreadyPresent:result.already_present===true}
}

export type LocalAssetImportSyncResult = { queued:number; imported:number; failed:number; conflicts:number }

export async function syncPendingLocalAssetImports(
  client: SupabaseClient,
  organizationId: string,
  options: { canCreate: boolean; canImportLegacy: boolean; shouldContinue?:()=>boolean }
): Promise<LocalAssetImportSyncResult> {
  const result:LocalAssetImportSyncResult={queued:0,imported:0,failed:0,conflicts:0}
  if(!options.canCreate&&!options.canImportLegacy)return result
  const [assets,links]=await Promise.all([
    db.assets.where('localScope').equals(organizationId).toArray(),
    db.assetCloudLinks.where('organizationId').equals(organizationId).toArray()
  ])
  const linked=new Set(links.map(link=>link.assetId))
  const byId=new Map(assets.map(asset=>[asset.id,asset]))
  const eligible=assets.filter(asset=>{
    if(linked.has(asset.id)||asset.localScope!==organizationId||asset.deletedAt)return false
    const hasVerifiedSmartId=Boolean(asset.idReservationId&&asset.idComponentsSnapshot&&asset.equipmentTypeCode)
    return (hasVerifiedSmartId&&options.canCreate)||options.canImportLegacy
  })
  for(const asset of eligible){
    if(options.shouldContinue&&!options.shouldContinue())break
    const id=organizationId+':'+asset.id
    const existing=await db.assetImportQueue.get(id)
    if(!existing){
      const at=now()
      await db.assetImportQueue.put({
        id,organizationId,assetId:asset.id,reservationId:asset.idReservationId,
        localUpdatedAt:asset.updatedAt,status:'pending',attempts:0,createdAt:at,updatedAt:at
      })
      result.queued++
    }else if((existing.localUpdatedAt!==asset.updatedAt||existing.status==='applied')&&!linked.has(asset.id)){
      await db.assetImportQueue.update(id,{
        reservationId:asset.idReservationId,localUpdatedAt:asset.updatedAt,
        status:'pending',failureKind:undefined,lastError:undefined,nextAttemptAt:undefined,updatedAt:now()
      })
    }
  }
  const queue=await db.assetImportQueue.where('organizationId').equals(organizationId).toArray()
  for(const item of queue){
    if(options.shouldContinue&&!options.shouldContinue())break
    if(item.status==='processing'){
      if(Date.now()-Date.parse(item.updatedAt)<=60_000)continue
      await db.assetImportQueue.update(item.id,{status:'pending',updatedAt:now()})
    }
    if(item.status==='applied'||item.status==='conflict'||item.status==='permanent')continue
    if(item.nextAttemptAt&&Date.parse(item.nextAttemptAt)>Date.now())continue
    const asset=byId.get(item.assetId)??await db.assets.get(item.assetId)
    if(!asset||asset.localScope!==organizationId||asset.deletedAt){
      await db.assetImportQueue.delete(item.id)
      continue
    }
    const hasVerifiedSmartId=Boolean(asset.idReservationId&&asset.idComponentsSnapshot&&asset.equipmentTypeCode)
    if(!(hasVerifiedSmartId&&options.canCreate)&&!options.canImportLegacy)continue
    const existingLink=await db.assetCloudLinks.get(organizationId+':'+asset.id)
    if(existingLink){
      await db.assetImportQueue.update(item.id,{status:'applied',updatedAt:now(),lastError:undefined,nextAttemptAt:undefined})
      continue
    }
    const at=now()
    await db.assetImportQueue.update(item.id,{status:'processing',attempts:item.attempts+1,lastAttemptAt:at,updatedAt:at})
    try{
      await importLocalAsset(client,organizationId,asset)
      result.imported++
    }catch(error){
      const message=error instanceof Error?error.message:String(error)
      // During a staged rollout, the old RPC may still return the former
      // assets.import-only error. Keep a verified Smart ID import retryable so
      // applying the matching migration later does not strand the Local record.
      const permissionMigrationPending=hasVerifiedSmartId&&options.canCreate&&/Missing assets\.import permission/i.test(message)
      const permanent=!permissionMigrationPending&&/already exists|different Cloud content|UUID already|does not match|invalid|unsupported|Missing assets\.import|permission|reset generation is stale|stale; purge/i.test(message)
      const attempts=item.attempts+1
      const delay=Math.min(15*60_000,30_000*Math.pow(2,Math.min(attempts-1,5)))*(0.8+Math.random()*0.4)
      await db.assetImportQueue.update(item.id,{
        status:permanent?( /already exists|different Cloud content|UUID already|does not match/i.test(message)?'conflict':'permanent'):'pending',
        failureKind:permanent?'permanent':'transient',lastError:message,
        nextAttemptAt:permanent?undefined:new Date(Date.now()+delay).toISOString(),updatedAt:now()
      })
      if(permanent&&/already exists|different Cloud content|UUID already|does not match/i.test(message))result.conflicts++
      else result.failed++
    }
  }
  return result
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
  await ensureOrganizationAssetResetApplied(client,organizationId)
  const local=await db.assets.where('[localScope+code]').equals([organizationId,assetCode]).first()
  if(!local)throw new Error('Thiết bị Local không còn tồn tại sau khi kiểm tra reset; hãy tải lại danh sách.')
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
  const resetGeneration=await ensureOrganizationAssetResetApplied(client,organizationId)
  const current=await db.assets.get(asset.id)
  if(!current||current.localScope!==organizationId||current.code!==asset.code||current.updatedAt!==asset.updatedAt)throw new Error('Hồ sơ Local không còn hợp lệ sau khi kiểm tra reset; không gửi dữ liệu cũ lên Cloud.')
  if(payload.deletedAt){
    const {data,error}=await client.rpc('soft_delete_cloud_asset_with_lock_v2',{p_organization_id:organizationId,p_asset_code:asset.code,p_lock_token:token,p_mutation_id:mutationId,p_expected_cloud_updated_at:expectedCloudUpdatedAt,p_deleted_at:payload.deletedAt,p_reset_generation:resetGeneration})
    if(error)throw new Error(error.message)
    const result=data as {asset?:Record<string,unknown>;already_applied?:boolean;applied_at?:string}
    if(!result.asset||result.asset.asset_key!==asset.code||!result.applied_at)throw new Error('Cloud thiếu biên nhận xóa mềm hợp lệ.')
    return {asset:cloudAssetFromRow(result.asset),alreadyApplied:result.already_applied===true,appliedAt:result.applied_at}
  }
  const cloudPayload={
    name:payload.name.trim(),brand:payload.brand,model:payload.model,serial:payload.serial,location:payload.location,
    commissioned_at:payload.commissionedAt||null,power:payload.power,cycle:payload.cycle,cycle_started_at:payload.cycleStartedAt||null,
    transferred_from_other_facility:payload.transferredFromOtherFacility,status:payload.status,notes:payload.notes,archived_at:payload.archivedAt||null
  }
  const {data,error}=await client.rpc('apply_cloud_asset_mutation_with_lock_v2',{
    p_organization_id:organizationId,p_asset_code:asset.code,p_lock_token:token,p_mutation_id:mutationId,
    p_expected_cloud_updated_at:expectedCloudUpdatedAt,p_payload:cloudPayload,p_reset_generation:resetGeneration
  })
  if(error) throw new Error(error.message)
  const result=data as {asset?:Record<string,unknown>;already_applied?:boolean;applied_at?:string}
  if(!result.asset || result.asset.asset_key!==asset.code || !result.applied_at) throw new Error('Cloud thiếu biên nhận cập nhật hợp lệ.')
  return {asset:cloudAssetFromRow(result.asset),alreadyApplied:result.already_applied===true,appliedAt:result.applied_at}
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
 await ensureOrganizationAssetResetApplied(client,organizationId)
 const mutation=await db.assetMutations.get(mutationId)
 if(!mutation||mutation.organizationId!==organizationId)throw new Error('Không tìm thấy mutation Local.')
 if(mutation.status==='conflict'||mutation.failureKind==='permanent')throw new Error(mutation.lastError||'Mutation cần được xử lý thủ công; không tự retry.')
 if(mutation.nextAttemptAt&&Date.parse(mutation.nextAttemptAt)>Date.now())throw new Error('Mutation đang chờ đến lượt retry lúc '+new Date(mutation.nextAttemptAt).toLocaleString('vi-VN')+'.')
 const local=await db.assets.get(mutation.assetId)
 if(!local)throw new Error('Local snapshot của mutation đã mất.')
 const link=await db.assetCloudLinks.get(organizationId+':'+mutation.assetId)
 if(!link)throw new Error('Thiết bị chưa có liên kết Cloud.')
 if(link.organizationId!==organizationId||link.assetId!==local.id||link.cloudCode!==local.code){
  const reason='Liên kết Cloud không còn khớp tổ chức, UUID hoặc mã thiết bị; mutation được giữ lại để đối chiếu.'
  await db.transaction('rw',[db.assetMutations,db.assetCloudLinks],async()=>{
   await db.assetMutations.update(mutationId,{status:'conflict',lastError:reason,updatedAt:now()})
   await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:now()})
  })
  throw new Error(reason)
 }
 if(link.status==='conflict'||local.updatedAt!==mutation.localUpdatedAt){
  const reason=link.status==='conflict'
   ?'Liên kết Cloud đã ở trạng thái conflict; không tự retry mutation.'
   :'Snapshot Local đã thay đổi sau khi tạo mutation; không gửi snapshot cũ lên Cloud. Cần đối chiếu trước khi tiếp tục.'
  await db.transaction('rw',[db.assetMutations,db.assetCloudLinks],async()=>{
   await db.assetMutations.update(mutationId,{status:'conflict',lastError:reason,updatedAt:now()})
   await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:now()})
  })
  throw new Error(reason)
 }
 const deviceId=getLocalDeviceId()
 let acquiredLease:CloudLease|undefined
 try{
  const acquired=await acquireCloudAssetLock(client,organizationId,local.code,deviceId,getDeviceLabel())
  if(!acquired.acquired)throw new Error('Cloud đang khóa bởi '+acquired.lock.holder_label+'.')
  acquiredLease=acquired.lease
  const attemptAt=now()
  await db.assetMutations.update(mutationId,{status:'processing',attempts:mutation.attempts+1,lastAttemptAt:attemptAt,deviceId,updatedAt:attemptAt,lastError:undefined,nextAttemptAt:undefined,failureKind:undefined})
  const applied=await applyCloudAssetMutation(client,organizationId,local,acquired.lease.lock_token,mutation.mutationId,mutation.expectedCloudUpdatedAt,mutation.payload)
  const groupResetGeneration=await ensureOrganizationAssetResetApplied(client,organizationId)
  if(!await db.assets.get(local.id))throw new Error('Tổ chức vừa được reset trong lúc retry; Local mutation cũ đã bị xóa.')
  const pendingGroupChanges=await db.assetGroupChanges.where('[organizationId+assetId]').equals([organizationId,mutation.assetId])
   .filter(change=>change.syncStatus==='pending'&&change.mutationId===mutationId).toArray()
  if(pendingGroupChanges.length){
   const ordered=[...pendingGroupChanges].sort((a,b)=>a.changedAt.localeCompare(b.changedAt))
   const {error:historyError}=await client.rpc('mirror_cloud_asset_group_change_history_v2',{
    p_organization_id:organizationId,
    p_asset_code:local.code,
    p_changes:ordered.map(change=>({
     id:change.id,oldCategory:change.oldCategory,newCategory:change.newCategory,
     changedByUserId:change.changedByUserId??null,changedAt:change.changedAt,reason:change.reason??null
    })),
    p_reset_generation:groupResetGeneration
   })
   if(historyError)throw new Error('Thiết bị đã được cập nhật trên Cloud nhưng chưa đồng bộ được lịch sử đổi nhóm: '+historyError.message)
  }
  await ensureOrganizationAssetResetApplied(client,organizationId)
  if(!await db.assets.get(local.id))throw new Error('Tổ chức vừa được reset sau khi Cloud xác nhận; dữ liệu Local cũ đã được xóa.')
  const at=now()
  const conflicts=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,mutation.assetId]).filter(m=>m.status==='conflict'&&m.mutationId!==mutationId).toArray()
  await db.transaction('rw',[db.assetMutations,db.assetCloudLinks,db.assetGroupChanges],async()=>{
   await db.assetMutations.update(mutationId,{status:'applied',appliedAt:at,cloudUpdatedAt:applied.asset.updatedAt,updatedAt:at,lastError:undefined})
   for(const old of conflicts)await db.assetMutations.update(old.mutationId,{status:'discarded',updatedAt:at,lastError:'Đã giải quyết conflict bằng retry mutation.'})
   await db.assetCloudLinks.update(link.id,{cloudUpdatedAt:applied.asset.updatedAt,lastSyncedLocalUpdatedAt:mutation.localUpdatedAt,status:'linked',lastVerifiedAt:at})
   for(const change of pendingGroupChanges)await db.assetGroupChanges.update(change.id,{syncStatus:'synced'})
  })
  return {alreadyApplied:applied.alreadyApplied,cloudUpdatedAt:applied.asset.updatedAt}
 }catch(error){
  const msg=error instanceof Error?error.message:String(error)
  const conflict=msg.toLowerCase().includes('version changed')||msg.toLowerCase().includes('changed since')
  const permanent=/permission denied|not authorized|unauthorized|forbidden|jwt|invalid (input|parameter)|violates (check|foreign key|unique) constraint|does not have permission/i.test(msg)
  const failedAt=now()
  const latestMutation=await db.assetMutations.get(mutationId)
  const attemptCount=latestMutation?.attempts??mutation.attempts
  const retryDelay=Math.min(5000*Math.pow(2,Math.min(Math.max(0,attemptCount-1),8)),15*60*1000)
  const jitteredDelay=Math.round(retryDelay*(0.8+Math.random()*0.4))
  await db.assetMutations.update(mutationId,{
   status:conflict?'conflict':'pending',lastError:msg,updatedAt:failedAt,lastAttemptAt:failedAt,deviceId,
   failureKind:conflict||permanent?'permanent':'transient',
   nextAttemptAt:conflict||permanent?undefined:new Date(Date.now()+jitteredDelay).toISOString()
  })
  if(conflict)await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:failedAt})
  throw error
 }finally{
  if(acquiredLease)await releaseCloudAssetLock(client,organizationId,local.code,acquiredLease.lock_token).catch(()=>false)
 }
}
