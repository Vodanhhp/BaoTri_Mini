import type { SupabaseClient } from '@supabase/supabase-js'
import type { EquipmentIdComponentsSnapshot } from '../db'
import {
  type EquipmentCatalog,
  type PlanCode
} from './smartEquipmentId'

export type OrganizationEquipmentCatalogRecord = {
  plan_code: PlanCode
  source_data_version: string
  snapshot: EquipmentCatalog
}

export type SmartSequenceReservation = {
  reservation_id: string
  plan_code: PlanCode
  sequence: number | string
  equipment_code: string
  group_code?: string | null
  site_code?: string | null
  month_year?: string | null
  source_data_version: string
  status: 'reserved' | 'confirmed'
}

export type SmartEquipmentIssuance = {
  equipmentId: string
  reservationId: string
  components: EquipmentIdComponentsSnapshot
}

export async function loadOrganizationEquipmentCatalog(
  client: SupabaseClient,
  organizationId: string
): Promise<OrganizationEquipmentCatalogRecord | null> {
  const { data, error } = await client
    .from('organization_equipment_catalog')
    .select('plan_code,source_data_version,snapshot')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error('Không tải được Catalog Snapshot của tổ chức: ' + error.message)
  if (!data) return null

  const row = data as OrganizationEquipmentCatalogRecord
  if (!['A', 'B', 'C', 'D'].includes(row.plan_code)
    || !row.snapshot
    || !Array.isArray(row.snapshot.equipmentGroups)
    || !Array.isArray(row.snapshot.equipmentDictionary)) {
    throw new Error('Catalog Snapshot hoặc Plan của tổ chức không hợp lệ.')
  }
  return row
}

/**
 * Cloud reserves a numeric sequence only. Local formats the complete ID and
 * writes the asset to IndexedDB; this helper never creates or writes an asset.
 */
export async function reserveSmartEquipmentId(
  client: SupabaseClient,
  input: {
    organizationId: string
    reservationId: string
    plan: PlanCode
    equipmentCode: string
    groupCode?: string
    siteCode?: string
    commissionedAt?: string
    standardEquipmentName: string
    groupNameAtCreation?: string
  }
): Promise<SmartEquipmentIssuance> {
  const { data, error } = await client.rpc('reserve_asset_id_sequence', {
    p_organization_id: input.organizationId,
    p_reservation_id: input.reservationId,
    p_equipment_code: input.equipmentCode,
    p_group_code: input.groupCode ?? null,
    p_site_code: input.siteCode ?? null,
    p_commissioned_at: input.commissionedAt || null
  })
  if (error) throw new Error('Cloud không cấp được số thứ tự: ' + error.message)

  const reservation = data as SmartSequenceReservation
  const expectedGroup = input.groupCode?.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const expectedSite = input.siteCode?.replace(/[^0-9]/g, '')
  const expectedMonthYear = input.commissionedAt
    ? input.commissionedAt.slice(5, 7) + input.commissionedAt.slice(2, 4)
    : undefined
  const validPlan = ['A', 'B', 'C', 'D'].includes(reservation?.plan_code)
  const groupRequired = reservation?.plan_code !== 'A'
  const siteRequired = reservation?.plan_code === 'C' || reservation?.plan_code === 'D'
  if (!reservation || reservation.reservation_id !== input.reservationId
    || !validPlan
    || reservation.equipment_code !== input.equipmentCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    || !Number.isSafeInteger(Number(reservation.sequence))
    || Number(reservation.sequence) < 1
    || !reservation.source_data_version
    || !['reserved', 'confirmed'].includes(reservation.status)
    || (groupRequired && !reservation.group_code)
    || (siteRequired && !/^\\d{2}$/.test(reservation.site_code ?? ''))
    || (reservation.plan_code === 'A' && (reservation.group_code || reservation.site_code || reservation.month_year))
    || (!groupRequired && reservation.group_code)
    || (expectedGroup !== undefined && groupRequired && reservation.group_code !== expectedGroup)
    || (expectedSite !== undefined && siteRequired && reservation.site_code !== expectedSite)
    || (expectedMonthYear !== undefined && siteRequired && reservation.month_year !== expectedMonthYear)
    || (siteRequired && !reservation.month_year)) {
    throw new Error('Cloud trả về thông tin giữ số thứ tự không hợp lệ hoặc không khớp thành phần đã xác nhận.')
  }

  const sequence = Number(reservation.sequence)
  const groupCode = reservation.group_code ?? undefined
  const siteCode = reservation.site_code ?? undefined
  const sequenceText = String(sequence).padStart(3, '0')
  const equipmentId = reservation.plan_code === 'A'
    ? `${reservation.equipment_code}-${sequenceText}`
    : reservation.plan_code === 'B'
      ? `${reservation.equipment_code}-${groupCode}-${sequenceText}`
      : `${reservation.equipment_code}-${groupCode}-${siteCode}-${sequenceText}-${reservation.month_year}`

  const components: EquipmentIdComponentsSnapshot = {
    plan: reservation.plan_code,
    equipment_code: reservation.equipment_code,
    group_code: groupCode ?? null,
    site_code: siteCode ?? null,
    sequence,
    month_year: reservation.month_year ?? null,
    standard_equipment_name: input.standardEquipmentName,
    group_name_at_creation: input.groupNameAtCreation ?? null,
    source_data_version: reservation.source_data_version,
    issued_at: new Date().toISOString()
  }

  return { equipmentId, reservationId: input.reservationId, components }
}

export async function confirmSmartEquipmentIdReservation(
  client: SupabaseClient,
  input: {
    organizationId: string
    reservationId: string
    assetId: string
    equipmentId: string
    originalName: string
    normalizedNameAtCreation: string
    equipmentTypeCode: string
    components: EquipmentIdComponentsSnapshot
  }
): Promise<void> {
  const { data, error } = await client.rpc('confirm_asset_id_sequence_reservation', {
    p_organization_id: input.organizationId,
    p_reservation_id: input.reservationId,
    p_asset_id: input.assetId,
    p_equipment_id: input.equipmentId,
    p_original_name: input.originalName,
    p_normalized_name_at_creation: input.normalizedNameAtCreation,
    p_equipment_type_code: input.equipmentTypeCode,
    p_id_components_snapshot: input.components
  })
  if (error) throw new Error('Local đã lưu thiết bị nhưng Cloud chưa xác nhận số thứ tự: ' + error.message)
  const result = data as { reservation_id?: string; status?: string } | null
  if (result?.reservation_id !== input.reservationId || result.status !== 'confirmed') {
    throw new Error('Cloud chưa trả về xác nhận hợp lệ cho số thứ tự.')
  }
}

export async function releaseSmartEquipmentIdReservation(
  client: SupabaseClient,
  organizationId: string,
  reservationId: string
): Promise<void> {
  const { data, error } = await client.rpc('release_asset_id_sequence_reservation', {
    p_organization_id: organizationId,
    p_reservation_id: reservationId
  })
  if (error) throw new Error('Không giải phóng được số thứ tự chưa sử dụng: ' + error.message)
  const result = data as { status?: string } | null
  if (result?.status !== 'released' && result?.status !== 'not_found') {
    throw new Error('Cloud chưa xác nhận giải phóng số thứ tự.')
  }
}
