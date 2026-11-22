import Dexie, { type Table } from 'dexie'

export type AssetStatus = 'Đang hoạt động' | 'Đang sửa chữa' | 'Ngừng sử dụng' | 'Thanh lý'
export type CloudLinkStatus = 'linked' | 'conflict'
export type AssetMutationStatus = 'pending' | 'processing' | 'applied' | 'conflict' | 'discarded'

export type EquipmentIdComponentsSnapshot = {
  plan: 'A' | 'B' | 'C' | 'D'
  equipment_code: string
  group_code?: string | null
  site_code?: string | null
  sequence: number
  month_year?: string | null
  standard_equipment_name: string
  group_name_at_creation?: string | null
  source_data_version: string
  issued_at: string
  reservation_id?: string
}

export type AssetDraft = {
  id: string
  organizationId: string
  userId: string
  reservationId: string
  asset: Asset
  createdAt: string
  updatedAt: string
}

export type Asset = {
  id: string
  code: string
  /** Local-created immutable issuance metadata; legacy records may not have it. */
  originalName?: string
  normalizedNameAtCreation?: string
  equipmentTypeCode?: string
  groupCodeAtCreation?: string
  siteCodeAtCreation?: string
  idComponentsSnapshot?: EquipmentIdComponentsSnapshot
  idReservationId?: string
  idReservationStatus?: 'reserved' | 'confirmed' | 'released'
  name: string
  category: string
  brand: string
  model: string
  serial: string
  location: string
  commissionedAt: string
  power: string
  cycle: string
  cycleStartedAt?: string
  transferredFromOtherFacility: boolean
  status: AssetStatus
  notes: string
  images: string[]
  createdByLabel?: string
  createdByUserId?: string
  archivedAt?: string
  deletedAt?: string
  createdAt: string
  updatedAt: string
  /** Local scope: organization UUID, or 'local-preview' for demo data. */
  localScope: string
}

export type AssetGroupChange = {
  id: string
  organizationId: string
  assetId: string
  oldCategory: string
  newCategory: string
  changedByUserId?: string
  mutationId?: string
  changedAt: string
  reason?: string
  syncStatus: 'pending' | 'synced'
}

export type AssetCloudLink = {
  id: string
  organizationId: string
  assetId: string
  cloudCode: string
  cloudUpdatedAt: string
  lastSyncedLocalUpdatedAt: string
  status: CloudLinkStatus
  lastVerifiedAt?: string
}

export type AssetMutationPayload = {
  /** Current equipment group; the Cloud RPC permits changes only for Admin. */
  category: string
  name: string
  brand: string
  model: string
  serial: string
  location: string
  commissionedAt: string
  power: string
  cycle: string
  cycleStartedAt?: string
  transferredFromOtherFacility: boolean
  status: AssetStatus
  notes: string
  archivedAt?: string
  deletedAt?: string
}

export type AssetMutation = {
  mutationId: string
  organizationId: string
  assetId: string
  payload: AssetMutationPayload
  expectedCloudUpdatedAt: string
  localUpdatedAt: string
  status: AssetMutationStatus
  attempts: number
  createdAt: string
  updatedAt: string
  appliedAt?: string
  cloudUpdatedAt?: string
  lastError?: string
}

class BaoTriDatabase extends Dexie {
  assets!: Table<Asset, string>
  assetCloudLinks!: Table<AssetCloudLink, string>
  assetMutations!: Table<AssetMutation, string>
  assetGroupChanges!: Table<AssetGroupChange, string>
  assetDrafts!: Table<AssetDraft, string>

  constructor() {
    super('baotri-mini-device-only')
    this.version(1).stores({
      assets: 'id, code, name, category, location, status, updatedAt'
    })
    this.version(2).stores({
      assets: 'id, code, name, category, location, status, archivedAt, updatedAt'
    }).upgrade(async tx => {
      const rows = await tx.table('assets').toArray()
      await tx.table('assets').bulkPut(rows.map((row: Record<string, unknown>) => ({
        ...row,
        status: row.status === 'Hỏng' || row.status === 'Tạm dừng' ? 'Đang sửa chữa' : row.status,
        cycle: typeof row.cycle === 'string' ? row.cycle : '',
        transferredFromOtherFacility: Boolean(row.transferredFromOtherFacility),
        images: Array.isArray(row.images) ? row.images : []
      })))
    })
    this.version(3).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt'
    }).upgrade(async tx => {
      const rows = await tx.table('assets').toArray()
      await tx.table('assets').bulkPut(rows.map((row: Record<string, unknown>) => ({
        ...row,
        localScope: typeof row.localScope === 'string' ? row.localScope : 'local-preview',
        createdByUserId: typeof row.createdByUserId === 'string' ? row.createdByUserId : undefined
      })))
    })
    this.version(4).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt',
      assetGroupChanges: 'id, organizationId, assetId, [organizationId+assetId], changedAt, syncStatus'
    })
    this.version(5).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt',
      assetGroupChanges: 'id, organizationId, assetId, [organizationId+assetId], changedAt, syncStatus',
      assetDrafts: 'id, organizationId, userId, [organizationId+userId], reservationId, updatedAt'
    })
  }
}

export const db = new BaoTriDatabase()
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
