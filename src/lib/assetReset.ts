import type { SupabaseClient } from '@supabase/supabase-js'
import { db, now, uid, type OrganizationAssetResetState } from '../db'

const localDeviceId = () => {
  const key = 'baotri-mini-device-id'
  let value = localStorage.getItem(key)
  if (!value) { value = uid(); localStorage.setItem(key, value) }
  return value
}
const localDeviceLabel = () => {
  const ua = navigator.userAgent
  return /Android/i.test(ua) ? 'Android Mobile' : /iPhone|iPad/i.test(ua) ? 'iPhone/iPad'
    : /Windows/i.test(ua) ? 'Windows PC' : /Mac/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux PC' : 'Thiết bị'
}

/** Verify and apply each approved reset domain independently before any Cloud sync. */
export async function ensureOrganizationAssetResetApplied(client: SupabaseClient, organizationId: string): Promise<number> {
  if (!navigator.onLine) throw new Error('Đang offline; chưa thể xác minh lệnh Reset Cloud. Tạm dừng đồng bộ cho tới khi có mạng.')
  const deviceId = localDeviceId()
  const localAssetCount = await db.assets.where('localScope').equals(organizationId).count()
  const { data, error } = await client.rpc('register_organization_asset_reset_device', {
    p_organization_id: organizationId, p_device_id: deviceId,
    p_platform_label: localDeviceLabel(), p_local_asset_count: localAssetCount
  })
  if (error) throw new Error('Không kiểm tra được trạng thái Reset của tổ chức: ' + error.message)
  const row = data as {generation?:unknown;inventory_generation?:unknown;checklist_generation?:unknown}|null
  const generation = Number(row?.generation)
  const inventoryGeneration = Number(row?.inventory_generation ?? 0)
  const checklistGeneration = Number(row?.checklist_generation ?? 0)
  if (![generation,inventoryGeneration,checklistGeneration].every(v=>Number.isSafeInteger(v)&&v>=0))
    throw new Error('Cloud trả về Reset generation không hợp lệ; đã dừng đồng bộ an toàn.')

  const saved = await db.organizationAssetResetStates.get(organizationId)
  const knownAsset = saved?.generation ?? 0
  const knownInventory = saved?.inventoryGeneration ?? 0
  const knownChecklist = saved?.checklistGeneration ?? 0
  if (generation < knownAsset || inventoryGeneration < knownInventory || checklistGeneration < knownChecklist)
    throw new Error('Reset generation Local cao hơn Cloud. Đã khóa đồng bộ để tránh phục hồi dữ liệu cũ.')

  const installationChanged = Boolean(saved?.deviceId && saved.deviceId !== deviceId)
  const purgeAssets = generation > knownAsset || (installationChanged && generation > 0)
  const purgeInventory = inventoryGeneration > knownInventory || (installationChanged && inventoryGeneration > 0)
  const purgeChecklist = checklistGeneration > knownChecklist || (installationChanged && checklistGeneration > 0)
  if (purgeAssets || purgeInventory || purgeChecklist) {
    const appliedAt = now()
    await db.transaction('rw', [
      db.assets,db.assetCloudLinks,db.assetMutations,db.assetDrafts,db.assetGroupChanges,db.assetHistory,db.assetImportQueue,
      db.organizationAssetResetStates,db.inventoryGroups,db.inventoryItems,db.inventoryMovements,db.inventoryMutations,
      db.inventoryCloudLinks,db.inventorySyncCursors,db.checklistCategorySettings,db.checklistDefinitions,db.checklistRuns,db.checklistTasks
    ], async () => {
      if (purgeAssets) {
        await db.assets.where('localScope').equals(organizationId).delete()
        await db.assetCloudLinks.where('organizationId').equals(organizationId).delete()
        await db.assetMutations.where('organizationId').equals(organizationId).delete()
        await db.assetDrafts.where('organizationId').equals(organizationId).delete()
        await db.assetImportQueue.where('organizationId').equals(organizationId).delete()
        await db.assetGroupChanges.where('organizationId').equals(organizationId).filter(x=>x.syncStatus==='pending').modify({syncStatus:'local_only'})
        await db.assetHistory.where('organizationId').equals(organizationId).filter(x=>x.syncStatus==='pending').modify({syncStatus:'local_only'})
      }
      if (purgeInventory) {
        await db.inventoryGroups.where('organizationId').equals(organizationId).delete()
        await db.inventoryItems.where('organizationId').equals(organizationId).delete()
        await db.inventoryMovements.where('organizationId').equals(organizationId).delete()
        await db.inventoryMutations.where('organizationId').equals(organizationId).delete()
        await db.inventoryCloudLinks.where('organizationId').equals(organizationId).delete()
        await db.inventorySyncCursors.where('organizationId').equals(organizationId).delete()
      }
      if (purgeChecklist) {
        await db.checklistCategorySettings.where('organizationId').equals(organizationId).delete()
        await db.checklistDefinitions.where('organizationId').equals(organizationId).delete()
        await db.checklistRuns.where('organizationId').equals(organizationId).delete()
        await db.checklistTasks.where('organizationId').equals(organizationId).delete()
      }
      const state: OrganizationAssetResetState = {organizationId,generation,inventoryGeneration,checklistGeneration,appliedAt,deviceId}
      await db.organizationAssetResetStates.put(state)
    })
  } else if (!saved || saved.deviceId !== deviceId || saved.inventoryGeneration===undefined || saved.checklistGeneration===undefined) {
    await db.organizationAssetResetStates.put({organizationId,generation,inventoryGeneration,checklistGeneration,appliedAt:now(),deviceId})
  }
  const { error: acknowledgeError } = await client.rpc('acknowledge_organization_asset_reset', {
    p_organization_id:organizationId,p_device_id:deviceId,p_generation:generation,
    p_inventory_generation:inventoryGeneration,p_checklist_generation:checklistGeneration
  })
  if (acknowledgeError) throw new Error('Local đã áp dụng Reset nhưng chưa gửi được xác nhận lên Cloud: '+acknowledgeError.message)
  return generation
}
