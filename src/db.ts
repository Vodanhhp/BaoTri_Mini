import Dexie, { type Table } from 'dexie'

export type AssetStatus = 'Đang hoạt động' | 'Đang sửa chữa' | 'Ngừng sử dụng' | 'Thanh lý' | 'Lưu kho'
export type CloudLinkStatus = 'linked' | 'conflict'
export type AssetMutationStatus = 'pending' | 'processing' | 'applied' | 'conflict' | 'discarded'
export type AssetImportQueueStatus = 'pending' | 'processing' | 'applied' | 'conflict' | 'permanent'

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

export type AssetImportQueueItem = {
  id: string
  organizationId: string
  assetId: string
  reservationId?: string
  localUpdatedAt: string
  status: AssetImportQueueStatus
  attempts: number
  createdAt: string
  updatedAt: string
  nextAttemptAt?: string
  lastAttemptAt?: string
  lastError?: string
  failureKind?: 'transient' | 'permanent'
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
  syncStatus: 'pending' | 'synced' | 'local_only'
}

export type AssetHistory = {
  id: string
  organizationId: string
  assetId: string
  assetCode: string
  eventType: 'created' | 'updated' | 'status_changed' | 'archived' | 'restored' | 'deleted'
  summary: string
  changes: Array<{ field: string; label: string; before: string; after: string }>
  actorUserId?: string
  actorLabel: string
  occurredAt: string
  syncStatus: 'pending' | 'synced' | 'local_only'
}

export type AssetSyncCursor = {
  organizationId: string
  lastSequence: number
  resetGeneration: number
  bootstrapComplete: boolean
  initializedAt: string
  updatedAt: string
}

export type OrganizationAssetResetState = {
  organizationId: string
  generation: number
  appliedAt: string
  /** Local installation identity paired with the acknowledged generation. */
  deviceId?: string
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
  /** Durable retry scheduling; omitted on legacy mutations until first retry. */
  lastAttemptAt?: string
  nextAttemptAt?: string
  failureKind?: 'transient' | 'permanent'
  deviceId?: string
}


export type InventorySyncStatus = 'pending' | 'processing' | 'applied' | 'conflict' | 'discarded'
export type InventoryMovementType = 'Nhập' | 'Xuất' | 'Điều chỉnh'
export type InventoryMutationOperation = 'create' | 'update_metadata' | 'post_movement' | 'adjust_count' | 'archive'

export type InventoryItem = {
  id: string
  organizationId: string
  localScope: string
  code: string
  codeNormalized: string
  name: string
  group: string
  unit: string
  partNumber?: string
  size?: string
  quantity: number
  minQuantity: number
  location: string
  supplier: string
  unitPrice: number
  createdByUserId?: string
  createdByLabel?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type InventoryMovement = {
  id: string
  organizationId: string
  itemId: string
  date: string
  type: InventoryMovementType
  /** Absolute movement quantity. Always greater than zero. */
  quantity: number
  /** Signed balance delta: positive for stock-in, negative for stock-out. */
  quantityDelta: number
  balanceBefore: number
  balanceAfter: number
  countedQuantity?: number
  reason: string
  note?: string
  performedBy: string
  actorUserId?: string
  linkedAssetId?: string
  mutationId: string
  syncStatus: InventorySyncStatus
  createdAt: string
}

export type InventoryMutation = {
  mutationId: string
  organizationId: string
  itemId: string
  operation: InventoryMutationOperation
  payload: Record<string, unknown>
  expectedCloudUpdatedAt?: string
  localUpdatedAt: string
  status: InventorySyncStatus
  attempts: number
  createdAt: string
  updatedAt: string
  appliedAt?: string
  cloudUpdatedAt?: string
  lastError?: string
  nextAttemptAt?: string
}

export type InventoryCloudLink = {
  id: string
  organizationId: string
  itemId: string
  cloudUpdatedAt: string
  lastSyncedLocalUpdatedAt: string
  status: CloudLinkStatus
  lastVerifiedAt?: string
  conflictSnapshot?: {
    sequence?: number
    item: Record<string, unknown>
    movement?: Record<string, unknown> | null
    detectedAt: string
    reason: string
  }
}

export type InventorySyncCursor = {
  organizationId: string
  lastSequence: number
  bootstrapComplete: boolean
  initializedAt: string
  updatedAt: string
}

class BaoTriDatabase extends Dexie {
  assets!: Table<Asset, string>
  assetCloudLinks!: Table<AssetCloudLink, string>
  assetMutations!: Table<AssetMutation, string>
  assetGroupChanges!: Table<AssetGroupChange, string>
  assetHistory!: Table<AssetHistory, string>
  assetDrafts!: Table<AssetDraft, string>
  assetImportQueue!: Table<AssetImportQueueItem, string>
  organizationAssetResetStates!: Table<OrganizationAssetResetState, string>
  assetSyncCursors!: Table<AssetSyncCursor, string>
  inventoryItems!: Table<InventoryItem, string>
  inventoryMovements!: Table<InventoryMovement, string>
  inventoryMutations!: Table<InventoryMutation, string>
  inventoryCloudLinks!: Table<InventoryCloudLink, string>
  inventorySyncCursors!: Table<InventorySyncCursor, string>

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
    this.version(6).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt',
      assetGroupChanges: 'id, organizationId, assetId, [organizationId+assetId], changedAt, syncStatus',
      assetDrafts: 'id, organizationId, userId, [organizationId+userId], reservationId, updatedAt',
      assetHistory: 'id, organizationId, assetId, assetCode, eventType, occurredAt, syncStatus, [organizationId+assetId]'
    })
    this.version(7).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt',
      assetGroupChanges: 'id, organizationId, assetId, [organizationId+assetId], changedAt, syncStatus',
      assetDrafts: 'id, organizationId, userId, [organizationId+userId], reservationId, updatedAt',
      assetHistory: 'id, organizationId, assetId, assetCode, eventType, occurredAt, syncStatus, [organizationId+assetId]',
      organizationAssetResetStates: 'organizationId, generation'
    })
    this.version(8).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt',
      assetGroupChanges: 'id, organizationId, assetId, [organizationId+assetId], changedAt, syncStatus',
      assetDrafts: 'id, organizationId, userId, [organizationId+userId], reservationId, updatedAt',
      assetHistory: 'id, organizationId, assetId, assetCode, eventType, occurredAt, syncStatus, [organizationId+assetId]',
      organizationAssetResetStates: 'organizationId, generation',
      assetSyncCursors: 'organizationId, lastSequence, resetGeneration, updatedAt'
    })
    this.version(9).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt',
      assetGroupChanges: 'id, organizationId, assetId, [organizationId+assetId], changedAt, syncStatus',
      assetDrafts: 'id, organizationId, userId, [organizationId+userId], reservationId, updatedAt',
      assetHistory: 'id, organizationId, assetId, assetCode, eventType, occurredAt, syncStatus, [organizationId+assetId]',
      organizationAssetResetStates: 'organizationId, generation',
      assetSyncCursors: 'organizationId, lastSequence, resetGeneration, updatedAt',
      assetImportQueue: 'id, organizationId, assetId, [organizationId+assetId], status, nextAttemptAt, updatedAt'
    })
    // v10: add organization-scoped Local-first inventory stores without changing
    // existing Asset records or the existing equipment sync tables.
    this.version(10).stores({
      assets: 'id, code, name, category, location, status, archivedAt, localScope, [localScope+code], updatedAt',
      assetCloudLinks: 'id, organizationId, assetId, [organizationId+assetId], status',
      assetMutations: 'mutationId, organizationId, assetId, [organizationId+assetId], status, updatedAt',
      assetGroupChanges: 'id, organizationId, assetId, [organizationId+assetId], changedAt, syncStatus',
      assetDrafts: 'id, organizationId, userId, [organizationId+userId], reservationId, updatedAt',
      assetHistory: 'id, organizationId, assetId, assetCode, eventType, occurredAt, syncStatus, [organizationId+assetId]',
      organizationAssetResetStates: 'organizationId, generation',
      assetSyncCursors: 'organizationId, lastSequence, resetGeneration, updatedAt',
      assetImportQueue: 'id, organizationId, assetId, [organizationId+assetId], status, nextAttemptAt, updatedAt',
      inventoryItems: 'id, organizationId, [organizationId+codeNormalized], [organizationId+name], [organizationId+group], archivedAt, updatedAt',
      inventoryMovements: 'id, organizationId, itemId, [organizationId+itemId], date, type, mutationId',
      inventoryMutations: 'mutationId, organizationId, itemId, [organizationId+itemId], status, updatedAt, nextAttemptAt',
      inventoryCloudLinks: 'id, organizationId, itemId, [organizationId+itemId], status',
      inventorySyncCursors: 'organizationId, lastSequence, updatedAt'
    })
  }
}

export const db = new BaoTriDatabase()
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
