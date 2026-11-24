import type { SupabaseClient } from '@supabase/supabase-js'
import {
  db, now,
  type InventoryCloudLink, type InventoryItem, type InventoryMovement,
  type InventoryMutation, type InventorySyncCursor
} from '../db'

type JsonRecord = Record<string, unknown>
type InventoryEventType = 'item_upsert' | 'item_archive' | 'movement_append'

type InventorySyncEvent = {
  organizationId: string
  sequence: number
  mutationId: string
  eventType: InventoryEventType
  itemId: string
  itemSnapshot: JsonRecord
  movementSnapshot: JsonRecord | null
  eventCreatedAt: string
}

type InventorySyncPage = {
  items: InventorySyncEvent[]
  hasMore: boolean
  nextCursor: number
}

export type InventoryCloudSyncSummary = {
  pushed: number
  pushFailed: number
  conflicts: number
  pulled: number
  pages: number
}

export type InventoryCloudPermissions = {
  view: boolean
  create: boolean
  update: boolean
  adjust: boolean
  delete: boolean
  isAdmin: boolean
}

const LINKED = 'linked' as const
const CONFLICT = 'conflict' as const
const CURSOR_PAGE_SIZE = 200
const STALE_PROCESSING_MS = 60_000

function record(value: unknown, label: string): JsonRecord {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(label + ': Cloud trả về bản ghi không hợp lệ.')
  }
  return row as JsonRecord
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ': thiếu chuỗi hợp lệ.')
  return value
}

function optionalString(value: unknown): string | undefined {
  return value == null || value === '' ? undefined : String(value)
}

function numeric(value: unknown, label: string, minimum = 0): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed) || parsed < minimum) throw new Error(label + ': Cloud trả về số không hợp lệ.')
  return parsed
}

function sequence(value: unknown, label: string): number {
  const parsed = numeric(value, label)
  if (!Number.isSafeInteger(parsed)) throw new Error(label + ': sequence không phải số nguyên an toàn.')
  return parsed
}

function normalizeCode(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('vi-VN')
}

function mapCloudItem(raw: unknown, organizationId: string): InventoryItem {
  const row = record(raw, 'Inventory item')
  const rowOrganization = string(row.organization_id, 'Inventory organization')
  if (rowOrganization !== organizationId) throw new Error('Cloud trả vật tư sai tổ chức; đã hủy đồng bộ.')
  const code = string(row.code, 'Mã vật tư')
  const item: InventoryItem = {
    id: string(row.id, 'Inventory item ID'),
    organizationId,
    localScope: organizationId,
    code,
    codeNormalized: string(row.code_normalized, 'Mã vật tư chuẩn hóa'),
    name: string(row.name, 'Tên vật tư'),
    group: string(row.item_group, 'Nhóm vật tư'),
    unit: string(row.unit, 'Đơn vị tính'),
    partNumber: optionalString(row.part_number),
    size: optionalString(row.size),
    quantity: numeric(row.quantity, 'Tồn kho'),
    minQuantity: numeric(row.min_quantity, 'Tồn tối thiểu'),
    location: String(row.location ?? ''),
    supplier: String(row.supplier ?? ''),
    unitPrice: numeric(row.unit_price, 'Đơn giá'),
    createdByUserId: optionalString(row.created_by_user_id),
    createdByLabel: optionalString(row.created_by_label),
    createdAt: string(row.created_at, 'Ngày tạo vật tư'),
    updatedAt: string(row.updated_at, 'Ngày cập nhật vật tư'),
    archivedAt: optionalString(row.archived_at)
  }
  return item
}

function mapCloudMovement(raw: unknown, organizationId: string): InventoryMovement {
  const row = record(raw, 'Inventory movement')
  if (string(row.organization_id, 'Movement organization') !== organizationId) {
    throw new Error('Cloud trả giao dịch sai tổ chức; đã hủy đồng bộ.')
  }
  const type = string(row.movement_type, 'Loại giao dịch')
  const mappedType = type === 'in' || type === 'opening' ? 'Nhập' : type === 'out' ? 'Xuất' : type === 'adjustment' ? 'Điều chỉnh' : null
  if (!mappedType) throw new Error('Cloud trả loại giao dịch kho không được hỗ trợ.')
  return {
    id: string(row.id, 'Movement ID'),
    organizationId,
    itemId: string(row.item_id, 'Movement item ID'),
    date: string(row.movement_date, 'Ngày giao dịch'),
    type: mappedType,
    quantity: numeric(row.quantity, 'Số lượng giao dịch', Number.MIN_VALUE),
    quantityDelta: numericSigned(row.quantity_delta, 'Chênh lệch tồn'),
    balanceBefore: numeric(row.balance_before, 'Tồn trước'),
    balanceAfter: numeric(row.balance_after, 'Tồn sau'),
    countedQuantity: row.counted_quantity == null ? undefined : numeric(row.counted_quantity, 'Số lượng kiểm kê'),
    reason: String(row.reason ?? ''),
    note: optionalString(row.note),
    performedBy: String(row.performed_by ?? ''),
    actorUserId: optionalString(row.actor_user_id),
    linkedAssetId: optionalString(row.linked_asset_id),
    mutationId: string(row.mutation_id, 'Movement mutation ID'),
    syncStatus: 'applied',
    createdAt: string(row.created_at, 'Movement created_at')
  }
}

function numericSigned(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) throw new Error(label + ': Cloud trả về số không hợp lệ.')
  return parsed
}

function parseEvent(raw: unknown, organizationId: string, afterSequence: number, previousSequence: number): InventorySyncEvent {
  const row = record(raw, 'Inventory sync event')
  const eventOrganization = string(row.organization_id, 'Event organization')
  if (eventOrganization !== organizationId) throw new Error('Incremental Pull trả event sai tổ chức.')
  const eventSequence = sequence(row.sequence, 'Event sequence')
  if (eventSequence <= afterSequence || eventSequence <= previousSequence) {
    throw new Error('Inventory feed sequence không tăng đơn điệu.')
  }
  const eventType = string(row.event_type, 'Event type') as InventoryEventType
  if (!['item_upsert', 'item_archive', 'movement_append'].includes(eventType)) {
    throw new Error('Inventory feed chứa event type không hỗ trợ.')
  }
  const itemSnapshot = record(row.item_snapshot, 'Event item snapshot')
  const itemId = string(row.item_id, 'Event item ID')
  if (string(itemSnapshot.id, 'Snapshot item ID') !== itemId) throw new Error('Event item ID không khớp snapshot.')
  const movementSnapshot = row.movement_snapshot == null ? null : record(row.movement_snapshot, 'Event movement snapshot')
  if (eventType === 'movement_append' && !movementSnapshot) throw new Error('Movement event thiếu snapshot giao dịch.')
  const mutationId = string(row.mutation_id, 'Event mutation ID')
  const eventCreatedAt = string(row.event_created_at, 'Event timestamp')
  if (Number.isNaN(Date.parse(eventCreatedAt))) throw new Error('Event timestamp không hợp lệ.')
  return { organizationId, sequence: eventSequence, mutationId, eventType, itemId, itemSnapshot, movementSnapshot, eventCreatedAt }
}

export async function readInventorySyncCursor(organizationId: string): Promise<InventorySyncCursor | undefined> {
  if (!organizationId || organizationId === 'local-preview') return undefined
  const cursor = await db.inventorySyncCursors.get(organizationId)
  if (!cursor || cursor.organizationId !== organizationId) return undefined
  if (!Number.isSafeInteger(cursor.lastSequence) || cursor.lastSequence < 0 ||
      typeof cursor.bootstrapComplete !== 'boolean' || typeof cursor.initializedAt !== 'string' ||
      typeof cursor.updatedAt !== 'string') {
    throw new Error('Inventory cursor Local bị hỏng; không tự ý bỏ qua hoặc đặt lại cursor.')
  }
  return cursor
}

async function ensureInventoryCursor(organizationId: string): Promise<InventorySyncCursor> {
  return db.transaction('rw', db.inventorySyncCursors, async () => {
    const existing = await db.inventorySyncCursors.get(organizationId)
    if (existing) return existing
    const at = now()
    const cursor: InventorySyncCursor = {
      organizationId, lastSequence: 0, bootstrapComplete: true, initializedAt: at, updatedAt: at
    }
    await db.inventorySyncCursors.add(cursor)
    return cursor
  })
}

async function listInventorySyncChanges(
  client: SupabaseClient,
  organizationId: string,
  afterSequence: number
): Promise<InventorySyncPage> {
  const { data, error } = await client.rpc('list_inventory_sync_changes', {
    p_organization_id: organizationId,
    p_after_sequence: afterSequence,
    p_limit: CURSOR_PAGE_SIZE
  })
  if (error) throw error
  const row = record(data, 'Inventory Incremental Pull')
  if (!Array.isArray(row.items) || row.items.length > CURSOR_PAGE_SIZE) {
    throw new Error('Inventory feed trả page size không hợp lệ.')
  }
  const items: InventorySyncEvent[] = []
  let previous = afterSequence
  for (const raw of row.items) {
    const event = parseEvent(raw, organizationId, afterSequence, previous)
    items.push(event)
    previous = event.sequence
  }
  if (typeof row.has_more !== 'boolean') throw new Error('Inventory feed thiếu has_more.')
  const nextCursor = sequence(row.next_cursor, 'Inventory next cursor')
  if (items.length === 0 && nextCursor !== afterSequence) throw new Error('Page rỗng không được nhảy cursor.')
  if (items.length > 0 && nextCursor !== items[items.length - 1].sequence) {
    throw new Error('Inventory next_cursor không khớp event cuối.')
  }
  if (row.has_more && nextCursor <= afterSequence) throw new Error('Inventory feed báo còn trang nhưng cursor không tiến.')
  return { items, hasMore: row.has_more, nextCursor }
}

function pendingOrProcessing(mutation: InventoryMutation): boolean {
  if (mutation.status === 'pending') return !mutation.nextAttemptAt || Date.parse(mutation.nextAttemptAt) <= Date.now()
  return mutation.status === 'processing' && Date.now() - Date.parse(mutation.updatedAt) > STALE_PROCESSING_MS
}

function canPush(mutation: InventoryMutation, permissions: InventoryCloudPermissions): boolean {
  if (mutation.operation === 'create') return permissions.create
  if (mutation.operation === 'update_metadata') return permissions.update
  if (mutation.operation === 'post_movement' || mutation.operation === 'adjust_count') return permissions.adjust
  if (mutation.operation === 'archive') return permissions.delete && permissions.isAdmin
  return false
}

function rpcErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  return String((error as { code?: unknown }).code ?? '')
}

function rpcErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  return String((error as { message?: unknown }).message ?? 'Lỗi RPC không xác định.')
}

function isConflictError(error: unknown): boolean {
  return ['40001', '23505', '42501', '55000', 'P0002'].includes(rpcErrorCode(error))
}

function linkId(organizationId: string, itemId: string): string {
  return organizationId + ':' + itemId
}

async function markMutationFailure(
  mutation: InventoryMutation,
  error: unknown
): Promise<void> {
  const conflict = isConflictError(error)
  const attempts = mutation.attempts + 1
  const at = now()
  const nextAttemptAt = conflict ? undefined : new Date(Date.now() + Math.min(300_000, 2_000 * (2 ** Math.min(attempts, 7)))).toISOString()
  await db.transaction('rw', [db.inventoryMutations, db.inventoryCloudLinks], async () => {
    await db.inventoryMutations.update(mutation.mutationId, {
      status: conflict ? 'conflict' : 'pending',
      attempts,
      updatedAt: at,
      nextAttemptAt,
      lastError: rpcErrorMessage(error)
    })
    if (conflict) {
      const id = linkId(mutation.organizationId, mutation.itemId)
      const link = await db.inventoryCloudLinks.get(id)
      if (link) await db.inventoryCloudLinks.put({ ...link, status: CONFLICT })
    }
  })
}

async function pushOneInventoryMutation(
  client: SupabaseClient,
  organizationId: string,
  mutation: InventoryMutation
): Promise<void> {
  const current = await db.inventoryMutations.get(mutation.mutationId)
  if (!current || !pendingOrProcessing(current)) return
  const item = await db.inventoryItems.get(current.itemId)
  if (!item || item.organizationId !== organizationId) throw new Error('Không tìm thấy vật tư Local thuộc tổ chức đang đồng bộ.')
  const link = await db.inventoryCloudLinks.get(linkId(organizationId, current.itemId))
  const expectedCloudUpdatedAt = link?.cloudUpdatedAt

  await db.inventoryMutations.update(current.mutationId, {
    status: 'processing', attempts: current.attempts + 1, updatedAt: now(), lastError: undefined, nextAttemptAt: undefined
  })

  let data: unknown
  try {
    if (current.operation === 'create') {
      const payload = record(current.payload, 'Create mutation')
      const itemPayload = record(payload.item, 'Create item payload')
      const { data: result, error } = await client.rpc('create_inventory_item', {
        p_organization_id: organizationId,
        p_item_id: current.itemId,
        p_mutation_id: current.mutationId,
        p_item: itemPayload,
        p_opening_quantity: numeric(payload.opening_quantity, 'Tồn đầu kỳ'),
        p_opening_movement: payload.opening_movement ?? null
      })
      if (error) throw error
      data = result
    } else {
      if (!link || !expectedCloudUpdatedAt) throw new Error('Vật tư chưa có liên kết Cloud; cần đồng bộ thao tác tạo trước.')
      if (current.operation === 'update_metadata') {
        const payload = record(current.payload, 'Metadata mutation')
        const itemPayload = record(payload.item, 'Metadata payload')
        const { data: result, error } = await client.rpc('update_inventory_item_metadata', {
          p_organization_id: organizationId,
          p_item_id: current.itemId,
          p_mutation_id: current.mutationId,
          p_expected_cloud_updated_at: expectedCloudUpdatedAt,
          p_payload: itemPayload
        })
        if (error) throw error
        data = result
      } else if (current.operation === 'post_movement' || current.operation === 'adjust_count') {
        const payload = record(current.payload, 'Movement mutation')
        const movement = record(payload.movement, 'Movement payload')
        const { data: result, error } = await client.rpc('apply_inventory_movement', {
          p_organization_id: organizationId,
          p_item_id: current.itemId,
          p_mutation_id: current.mutationId,
          p_expected_cloud_updated_at: expectedCloudUpdatedAt,
          p_movement: movement
        })
        if (error) throw error
        data = result
      } else if (current.operation === 'archive') {
        const { data: result, error } = await client.rpc('archive_inventory_item', {
          p_organization_id: organizationId,
          p_item_id: current.itemId,
          p_mutation_id: current.mutationId,
          p_expected_cloud_updated_at: expectedCloudUpdatedAt
        })
        if (error) throw error
        data = result
      } else {
        throw new Error('Loại mutation Inventory không được hỗ trợ.')
      }
    }

    const response = record(data, 'Inventory mutation result')
    const cloudItem = mapCloudItem(response.item, organizationId)
    const cloudMovement = response.movement == null ? undefined : mapCloudMovement(response.movement, organizationId)
    const appliedAt = string(response.applied_at, 'Mutation applied_at')
    await db.transaction('rw', [db.inventoryItems, db.inventoryMovements, db.inventoryMutations, db.inventoryCloudLinks], async () => {
      const latestMutation = await db.inventoryMutations.get(current.mutationId)
      if (!latestMutation) throw new Error('Mutation Local biến mất trong khi đang đồng bộ.')
      const laterPending = await db.inventoryMutations.where('[organizationId+itemId]')
        .equals([organizationId, current.itemId])
        .filter(row => row.mutationId !== current.mutationId && (row.status === 'pending' || row.status === 'processing' || row.status === 'conflict'))
        .toArray()
      const localItem = await db.inventoryItems.get(current.itemId)
      if (!localItem) throw new Error('Vật tư Local không còn tồn tại sau khi Cloud xác nhận.')
      if (!laterPending.length && localItem.updatedAt === latestMutation.localUpdatedAt) {
        await db.inventoryItems.put({ ...cloudItem, localScope: organizationId })
      }
      if (cloudMovement) {
        const existing = await db.inventoryMovements.get(cloudMovement.id)
        if (!existing) await db.inventoryMovements.add(cloudMovement)
        else if (existing.mutationId !== cloudMovement.mutationId || existing.balanceAfter !== cloudMovement.balanceAfter) {
          throw new Error('Cloud trả movement trùng ID nhưng nội dung khác; cần đối chiếu.')
        } else await db.inventoryMovements.update(existing.id, { syncStatus: 'applied' })
      } else {
        await db.inventoryMovements.where('mutationId').equals(current.mutationId).modify({ syncStatus: 'applied' })
      }
      await db.inventoryMutations.update(current.mutationId, {
        status: 'applied', appliedAt, cloudUpdatedAt: cloudItem.updatedAt, updatedAt: now(), lastError: undefined, nextAttemptAt: undefined
      })
      const id = linkId(organizationId, current.itemId)
      const previous = await db.inventoryCloudLinks.get(id)
      const nextLink: InventoryCloudLink = {
        id, organizationId, itemId: current.itemId,
        cloudUpdatedAt: cloudItem.updatedAt,
        lastSyncedLocalUpdatedAt: latestMutation.localUpdatedAt,
        status: LINKED,
        lastVerifiedAt: now(),
        ...(previous?.conflictSnapshot ? { conflictSnapshot: previous.conflictSnapshot } : {})
      }
      await db.inventoryCloudLinks.put(nextLink)
    })
  } catch (error) {
    await markMutationFailure(current, error)
    throw error
  }
}

async function pushPendingInventoryMutations(
  client: SupabaseClient,
  organizationId: string,
  permissions: InventoryCloudPermissions,
  shouldContinue: () => boolean
): Promise<{ pushed: number; pushFailed: number; conflicts: number }> {
  const pending = await db.inventoryMutations.where('organizationId').equals(organizationId)
    .filter(pendingOrProcessing).toArray()
  pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const byItem = new Map<string, InventoryMutation[]>()
  for (const mutation of pending) {
    const rows = byItem.get(mutation.itemId) ?? []
    rows.push(mutation)
    byItem.set(mutation.itemId, rows)
  }
  let pushed = 0, failed = 0, conflicts = 0
  for (const rows of byItem.values()) {
    if (!shouldContinue()) break
    for (const mutation of rows) {
      if (!shouldContinue()) break
      if (!canPush(mutation, permissions)) continue
      const link = await db.inventoryCloudLinks.get(linkId(organizationId, mutation.itemId))
      if (link?.status === CONFLICT || mutation.status === 'conflict') {
        conflicts++
        break
      }
      try {
        await pushOneInventoryMutation(client, organizationId, mutation)
        pushed++
      } catch {
        failed++
        const refreshed = await db.inventoryMutations.get(mutation.mutationId)
        if (refreshed?.status === 'conflict') conflicts++
        break
      }
    }
  }
  return { pushed, pushFailed: failed, conflicts }
}

async function applyInventoryEvent(organizationId: string, event: InventorySyncEvent): Promise<void> {
  const cloudItem = mapCloudItem(event.itemSnapshot, organizationId)
  const cloudMovement = event.movementSnapshot ? mapCloudMovement(event.movementSnapshot, organizationId) : undefined
  if (cloudItem.id !== event.itemId) throw new Error('Inventory event snapshot không khớp item ID.')
  if (cloudMovement && cloudMovement.itemId !== event.itemId) throw new Error('Inventory movement thuộc vật tư khác event.')
  await db.transaction('rw', [db.inventoryItems, db.inventoryMovements, db.inventoryMutations, db.inventoryCloudLinks], async () => {
    const localMutation = await db.inventoryMutations.get(event.mutationId)
    const pending = await db.inventoryMutations.where('[organizationId+itemId]')
      .equals([organizationId, event.itemId])
      .filter(row => row.status === 'pending' || row.status === 'processing' || row.status === 'conflict')
      .toArray()
    const ownMutation = Boolean(localMutation)
    const laterPending = pending.filter(row => row.mutationId !== event.mutationId)
    const localItem = await db.inventoryItems.get(event.itemId)
    const id = linkId(organizationId, event.itemId)
    const existingLink = await db.inventoryCloudLinks.get(id)

    if (cloudMovement) {
      const existingMovement = await db.inventoryMovements.get(cloudMovement.id)
      if (!existingMovement) await db.inventoryMovements.add(cloudMovement)
      else if (existingMovement.mutationId !== cloudMovement.mutationId || existingMovement.balanceAfter !== cloudMovement.balanceAfter) {
        throw new Error('Inventory feed có movement trùng ID nhưng dữ liệu không khớp.')
      } else await db.inventoryMovements.update(existingMovement.id, { syncStatus: 'applied' })
    }

    if (ownMutation && localMutation) {
      await db.inventoryMutations.update(localMutation.mutationId, {
        status: 'applied', appliedAt: localMutation.appliedAt ?? event.eventCreatedAt,
        cloudUpdatedAt: cloudItem.updatedAt, updatedAt: now(), lastError: undefined, nextAttemptAt: undefined
      })
      if (!laterPending.length && localItem) await db.inventoryItems.put(cloudItem)
      await db.inventoryCloudLinks.put({
        id, organizationId, itemId: event.itemId,
        cloudUpdatedAt: cloudItem.updatedAt,
        lastSyncedLocalUpdatedAt: localMutation.localUpdatedAt,
        status: LINKED, lastVerifiedAt: now()
      })
      return
    }

    if (pending.length) {
      const conflictSnapshot = {
        sequence: event.sequence,
        item: event.itemSnapshot,
        movement: event.movementSnapshot ?? null,
        detectedAt: now(),
        reason: 'Cloud có thay đổi trong khi thiết bị còn mutation Local chưa đồng bộ.'
      }
      for (const mutation of pending) {
        await db.inventoryMutations.update(mutation.mutationId, {
          status: 'conflict', lastError: conflictSnapshot.reason, updatedAt: now()
        })
      }
      await db.inventoryCloudLinks.put({
        id, organizationId, itemId: event.itemId,
        cloudUpdatedAt: existingLink?.cloudUpdatedAt ?? cloudItem.updatedAt,
        lastSyncedLocalUpdatedAt: existingLink?.lastSyncedLocalUpdatedAt ?? '',
        status: CONFLICT, lastVerifiedAt: now(), conflictSnapshot
      })
      return
    }

    await db.inventoryItems.put(cloudItem)
    await db.inventoryCloudLinks.put({
      id, organizationId, itemId: event.itemId,
      cloudUpdatedAt: cloudItem.updatedAt,
      lastSyncedLocalUpdatedAt: cloudItem.updatedAt,
      status: LINKED, lastVerifiedAt: now()
    })
  })
}

async function pullInventoryChanges(
  client: SupabaseClient,
  organizationId: string,
  shouldContinue: () => boolean
): Promise<{ pulled: number; pages: number }> {
  let cursor = await ensureInventoryCursor(organizationId)
  if (!cursor.bootstrapComplete) {
    cursor = { ...cursor, bootstrapComplete: true, updatedAt: now() }
    await db.inventorySyncCursors.put(cursor)
  }
  let pulled = 0, pages = 0
  do {
    if (!shouldContinue()) break
    const page = await listInventorySyncChanges(client, organizationId, cursor.lastSequence)
    pages++
    await db.transaction('rw', [db.inventoryItems, db.inventoryMovements, db.inventoryMutations, db.inventoryCloudLinks, db.inventorySyncCursors], async () => {
      for (const event of page.items) await applyInventoryEvent(organizationId, event)
      const latest = await db.inventorySyncCursors.get(organizationId)
      if (!latest || latest.lastSequence !== cursor.lastSequence) {
        throw new Error('Inventory cursor đã thay đổi bởi tiến trình khác; dừng pull để tránh bỏ sót event.')
      }
      await db.inventorySyncCursors.put({
        ...latest, lastSequence: page.nextCursor, bootstrapComplete: true, updatedAt: now()
      })
    })
    pulled += page.items.length
    const previousCursor = cursor.lastSequence
    cursor = { ...cursor, lastSequence: page.nextCursor, bootstrapComplete: true, updatedAt: now() }
    if (!page.hasMore) break
    if (page.nextCursor <= previousCursor) throw new Error('Inventory feed không tiến cursor.')
  } while (true)
  return { pulled, pages }
}

export async function syncInventoryCloud(
  client: SupabaseClient,
  organizationId: string,
  permissions: InventoryCloudPermissions,
  options: { shouldContinue?: () => boolean } = {}
): Promise<InventoryCloudSyncSummary> {
  if (!organizationId || organizationId === 'local-preview') throw new Error('Không đồng bộ kho vật tư cho Local preview.')
  if (!permissions.view) throw new Error('Tài khoản không có quyền inventory.view.')
  const shouldContinue = options.shouldContinue ?? (() => true)
  const pushed = await pushPendingInventoryMutations(client, organizationId, permissions, shouldContinue)
  if (!shouldContinue()) return { ...pushed, pulled: 0, pages: 0 }
  const pulled = await pullInventoryChanges(client, organizationId, shouldContinue)
  return { ...pushed, pulled: pulled.pulled, pages: pulled.pages }
}
