import type { SupabaseClient } from '@supabase/supabase-js'
import { db, now, uid, type OrganizationAssetResetState } from '../db'

const localDeviceId = () => {
  const key = 'baotri-mini-device-id'
  let value = localStorage.getItem(key)
  if (!value) {
    value = uid()
    localStorage.setItem(key, value)
  }
  return value
}

const localDeviceLabel = () => {
  const ua = navigator.userAgent
  return /Android/i.test(ua) ? 'Android Mobile'
    : /iPhone|iPad/i.test(ua) ? 'iPhone/iPad'
    : /Windows/i.test(ua) ? 'Windows PC'
    : /Mac/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux PC'
    : 'Thiết bị'
}

/**
 * Must complete before any tenant Cloud sync, import, mutation retry or audit mirror.
 * If offline, callers must stop Cloud work rather than assume the cached generation is current.
 */
export async function ensureOrganizationAssetResetApplied(
  client: SupabaseClient,
  organizationId: string
): Promise<number> {
  if (!navigator.onLine) throw new Error('Đang offline; chưa thể xác minh lệnh reset Cloud. Tạm dừng đồng bộ cho tới khi có mạng.')

  const deviceId = localDeviceId()
  const localAssetCount = await db.assets.where('localScope').equals(organizationId).count()
  const { data, error } = await client.rpc('register_organization_asset_reset_device', {
    p_organization_id: organizationId,
    p_device_id: deviceId,
    p_platform_label: localDeviceLabel(),
    p_local_asset_count: localAssetCount
  })
  if (error) throw new Error('Không kiểm tra được generation reset của tổ chức: ' + error.message)

  const generation = Number((data as { generation?: unknown } | null)?.generation)
  if (!Number.isSafeInteger(generation) || generation < 0) {
    throw new Error('Cloud trả về reset generation không hợp lệ; đã dừng đồng bộ an toàn.')
  }

  const saved = await db.organizationAssetResetStates.get(organizationId)
  const knownGeneration = saved?.generation ?? 0
  if (generation < knownGeneration) {
    throw new Error('Reset generation Local cao hơn Cloud. Đã khóa đồng bộ để tránh phục hồi dữ liệu cũ.')
  }

  const installationChanged = generation > 0 && (!saved?.deviceId || saved.deviceId !== deviceId)
  const mustPurge = generation > knownGeneration || installationChanged

  if (mustPurge) {
    const appliedAt = now()
    await db.transaction('rw', [
      db.assets, db.assetCloudLinks, db.assetMutations, db.assetDrafts,
      db.assetGroupChanges, db.assetHistory, db.organizationAssetResetStates
    ], async () => {
      await db.assets.where('localScope').equals(organizationId).delete()
      await db.assetCloudLinks.where('organizationId').equals(organizationId).delete()
      await db.assetMutations.where('organizationId').equals(organizationId).delete()
      await db.assetDrafts.where('organizationId').equals(organizationId).delete()

      // Keep historical rows, but prevent stale queued audit mirrors from being replayed.
      await db.assetGroupChanges.where('organizationId').equals(organizationId)
        .filter(row => row.syncStatus === 'pending')
        .modify({ syncStatus: 'local_only' })
      await db.assetHistory.where('organizationId').equals(organizationId)
        .filter(row => row.syncStatus === 'pending')
        .modify({ syncStatus: 'local_only' })

      await db.organizationAssetResetStates.put({ organizationId, generation, appliedAt, deviceId })
    })
  } else if (!saved || saved.deviceId !== deviceId) {
    await db.organizationAssetResetStates.put({ organizationId, generation, appliedAt: now(), deviceId })
  }

  const { error: acknowledgeError } = await client.rpc('acknowledge_organization_asset_reset', {
    p_organization_id: organizationId,
    p_device_id: deviceId,
    p_generation: generation
  })
  if (acknowledgeError) {
    throw new Error('Local đã áp dụng reset generation ' + generation + ' nhưng chưa gửi được xác nhận lên Cloud: ' + acknowledgeError.message)
  }
  return generation
}
