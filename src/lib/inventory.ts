import {
  db, now, uid,
  type InventoryItem, type InventoryMovement, type InventoryMovementType,
  type InventoryMutation, type InventorySyncStatus
} from '../db'
import { requestSync } from './syncEngine'

export type InventoryActor = {
  organizationId: string
  userId?: string
  label: string
  canCreate: boolean
  canUpdate: boolean
  canAdjust: boolean
  canDelete: boolean
  isAdmin: boolean
}

export type InventoryItemInput = {
  code: string
  name: string
  group: string
  unit: string
  partNumber?: string
  size?: string
  openingQuantity?: number
  minQuantity: number
  location?: string
  supplier?: string
  unitPrice: number
}

export type InventoryItemMetadataInput = Omit<InventoryItemInput, 'openingQuantity'> & {
  openingQuantity?: never
}

const clean = (value: string | undefined) => (value ?? '').trim().replace(/\s+/g, ' ')

export function normalizeInventoryCode(value: string): string {
  return clean(value).toLocaleUpperCase('vi-VN')
}

function requireOrganization(actor: InventoryActor): void {
  if (!actor.organizationId.trim()) throw new Error('Thiếu tổ chức làm việc cho kho vật tư.')
}

function requirePermission(allowed: boolean, action: string): void {
  if (!allowed) throw new Error(`Bạn không có quyền ${action}.`)
}

function validateNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} phải là số hợp lệ và không âm.`)
}

function validatePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} phải lớn hơn 0.`)
}

function localDate(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function makeMutation(
  actor: InventoryActor,
  itemId: string,
  operation: InventoryMutation['operation'],
  payload: Record<string, unknown>,
  localUpdatedAt: string,
  expectedCloudUpdatedAt?: string
): InventoryMutation {
  const at = now()
  return {
    mutationId: uid(),
    organizationId: actor.organizationId,
    itemId,
    operation,
    payload,
    expectedCloudUpdatedAt,
    localUpdatedAt,
    status: 'pending',
    attempts: 0,
    createdAt: at,
    updatedAt: at
  }
}

function movementRecord(
  actor: InventoryActor,
  item: InventoryItem,
  type: InventoryMovementType,
  delta: number,
  reason: string,
  mutationId: string,
  countedQuantity?: number,
  linkedAssetId?: string
): InventoryMovement {
  const at = now()
  const balanceBefore = item.quantity
  const balanceAfter = balanceBefore + delta
  return {
    id: uid(),
    organizationId: actor.organizationId,
    itemId: item.id,
    date: localDate(),
    type,
    quantity: Math.abs(delta),
    quantityDelta: delta,
    balanceBefore,
    balanceAfter,
    countedQuantity,
    reason: clean(reason),
    note: clean(reason),
    performedBy: clean(actor.label) || 'Tài khoản',
    actorUserId: actor.userId,
    linkedAssetId,
    mutationId,
    syncStatus: 'pending',
    createdAt: at
  }
}

function metadataSnapshot(item: InventoryItem): Record<string, unknown> {
  return {
    code: item.code,
    code_normalized: item.codeNormalized,
    name: item.name,
    item_group: item.group,
    unit: item.unit,
    part_number: item.partNumber ?? null,
    size: item.size ?? null,
    min_quantity: item.minQuantity,
    location: item.location,
    supplier: item.supplier,
    unit_price: item.unitPrice
  }
}

async function assertCodeAvailable(organizationId: string, code: string, exceptId?: string): Promise<void> {
  const normalized = normalizeInventoryCode(code)
  if (!normalized) throw new Error('Mã vật tư không được để trống.')
  const duplicate = await db.inventoryItems.where('[organizationId+codeNormalized]')
    .equals([organizationId, normalized]).first()
  if (duplicate && duplicate.id !== exceptId) throw new Error(`Mã vật tư "${code.trim()}" đã tồn tại trong tổ chức.`)
}

/** Create item and optional opening-balance movement in one Local transaction. */
export async function createInventoryItem(
  actor: InventoryActor,
  input: InventoryItemInput
): Promise<InventoryItem> {
  requireOrganization(actor)
  requirePermission(actor.canCreate, 'thêm vật tư')
  const code = clean(input.code)
  const name = clean(input.name)
  const group = clean(input.group) || 'Khác'
  const unit = clean(input.unit)
  if (!name) throw new Error('Tên vật tư không được để trống.')
  if (!unit) throw new Error('Đơn vị tính không được để trống.')
  const openingQuantity = input.openingQuantity ?? 0
  validateNonNegative(openingQuantity, 'Tồn đầu kỳ')
  validateNonNegative(input.minQuantity, 'Tồn tối thiểu')
  validateNonNegative(input.unitPrice, 'Đơn giá')
  if (openingQuantity > 0) requirePermission(actor.canAdjust, 'ghi nhận tồn đầu kỳ')

  const at = now()
  const itemId = uid()
  const codeNormalized = normalizeInventoryCode(code)
  const item: InventoryItem = {
    id: itemId,
    organizationId: actor.organizationId,
    localScope: actor.organizationId,
    code,
    codeNormalized,
    name,
    group,
    unit,
    partNumber: clean(input.partNumber) || undefined,
    size: clean(input.size) || undefined,
    quantity: openingQuantity,
    minQuantity: input.minQuantity,
    location: clean(input.location),
    supplier: clean(input.supplier),
    unitPrice: input.unitPrice,
    createdByUserId: actor.userId,
    createdByLabel: clean(actor.label) || 'Tài khoản',
    createdAt: at,
    updatedAt: at
  }

  const created = await db.transaction('rw', [db.inventoryItems, db.inventoryMovements, db.inventoryMutations], async () => {
    await assertCodeAvailable(actor.organizationId, code)
    const mutation = makeMutation(actor, itemId, 'create', { item: metadataSnapshot(item), opening_quantity: openingQuantity }, at)
    const movement = openingQuantity > 0
      ? movementRecord(actor, item, 'Nhập', openingQuantity, 'Tồn đầu kỳ', mutation.mutationId)
      : undefined
    await db.inventoryItems.add(item)
    if (movement) await db.inventoryMovements.add(movement)
    mutation.payload = {
      item: metadataSnapshot(item),
      opening_quantity: openingQuantity,
      opening_movement: movement ? {
        id: movement.id,
        date: movement.date,
        quantity: movement.quantity,
        quantity_delta: movement.quantityDelta,
        balance_before: movement.balanceBefore,
        balance_after: movement.balanceAfter,
        reason: movement.reason,
        performed_by: movement.performedBy,
        actor_user_id: movement.actorUserId ?? null
      } : null
    }
    await db.inventoryMutations.add(mutation)
    return item
  })
  requestSync()
  return created
}

/** Metadata editing intentionally has no quantity field. Stock can only change through movements. */
export async function updateInventoryItemMetadata(
  actor: InventoryActor,
  itemId: string,
  expectedLocalUpdatedAt: string,
  input: InventoryItemMetadataInput
): Promise<InventoryItem> {
  requireOrganization(actor)
  requirePermission(actor.canUpdate, 'sửa thông tin vật tư')
  const code = clean(input.code)
  const name = clean(input.name)
  const unit = clean(input.unit)
  if (!name || !unit) throw new Error('Tên vật tư và đơn vị tính là bắt buộc.')
  validateNonNegative(input.minQuantity, 'Tồn tối thiểu')
  validateNonNegative(input.unitPrice, 'Đơn giá')

  const updated = await db.transaction('rw', [db.inventoryItems, db.inventoryMutations, db.inventoryCloudLinks], async () => {
    const current = await db.inventoryItems.get(itemId)
    if (!current || current.organizationId !== actor.organizationId) throw new Error('Không tìm thấy vật tư trong tổ chức hiện tại.')
    if (current.updatedAt !== expectedLocalUpdatedAt) throw new Error('Thông tin vật tư đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.')
    if (!actor.isAdmin && input.minQuantity !== current.minQuantity) throw new Error('Chỉ Admin được thay đổi tồn tối thiểu.')
    await assertCodeAvailable(actor.organizationId, code, itemId)
    const at = now()
    const next: InventoryItem = {
      ...current,
      code,
      codeNormalized: normalizeInventoryCode(code),
      name,
      group: clean(input.group) || 'Khác',
      unit,
      partNumber: clean(input.partNumber) || undefined,
      size: clean(input.size) || undefined,
      minQuantity: input.minQuantity,
      location: clean(input.location),
      supplier: clean(input.supplier),
      unitPrice: input.unitPrice,
      updatedAt: at
    }
    const link = await db.inventoryCloudLinks.get(actor.organizationId + ':' + itemId)
    const mutation = makeMutation(actor, itemId, 'update_metadata', { item: metadataSnapshot(next) }, at, link?.cloudUpdatedAt)
    await db.inventoryItems.put(next)
    await db.inventoryMutations.add(mutation)
    return next
  })
  requestSync()
  return updated
}

/** Post a stock-in or stock-out movement atomically with the new Local balance. */
export async function postInventoryMovement(
  actor: InventoryActor,
  itemId: string,
  type: 'Nhập' | 'Xuất',
  quantity: number,
  reason: string,
  linkedAssetId?: string
): Promise<InventoryMovement> {
  requireOrganization(actor)
  requirePermission(actor.canAdjust, 'nhập hoặc xuất kho')
  validatePositive(quantity, 'Số lượng')
  const cleanReason = clean(reason)
  if (!cleanReason) throw new Error('Lý do giao dịch không được để trống.')

  const posted = await db.transaction('rw', [db.inventoryItems, db.inventoryMovements, db.inventoryMutations, db.inventoryCloudLinks], async () => {
    const current = await db.inventoryItems.get(itemId)
    if (!current || current.organizationId !== actor.organizationId) throw new Error('Vật tư không tồn tại trong tổ chức hiện tại.')
    const delta = type === 'Nhập' ? quantity : -quantity
    if (current.quantity + delta < 0) throw new Error('Số lượng xuất vượt tồn kho hiện tại.')
    const at = now()
    const link = await db.inventoryCloudLinks.get(actor.organizationId + ':' + itemId)
    const mutation = makeMutation(actor, itemId, 'post_movement', {}, at, link?.cloudUpdatedAt)
    const movement = movementRecord(actor, current, type, delta, cleanReason, mutation.mutationId, undefined, linkedAssetId)
    const next = { ...current, quantity: movement.balanceAfter, updatedAt: at }
    mutation.payload = { movement: movementPayload(movement), item_quantity: next.quantity }
    await db.inventoryItems.put(next)
    await db.inventoryMovements.add(movement)
    await db.inventoryMutations.add(mutation)
    return movement
  })
  requestSync()
  return posted
}

/** Inventory count adjustment accepts the counted quantity, never a user-supplied delta. */
export async function adjustInventoryCount(
  actor: InventoryActor,
  itemId: string,
  countedQuantity: number,
  reason: string
): Promise<{ status: 'adjusted' | 'no_change'; movement?: InventoryMovement; quantity: number }> {
  requireOrganization(actor)
  requirePermission(actor.canAdjust, 'điều chỉnh tồn kho')
  validateNonNegative(countedQuantity, 'Số lượng kiểm kê')
  const cleanReason = clean(reason)
  if (!cleanReason) throw new Error('Lý do kiểm kê không được để trống.')

  const adjusted = await db.transaction('rw', [db.inventoryItems, db.inventoryMovements, db.inventoryMutations, db.inventoryCloudLinks], async () => {
    const current = await db.inventoryItems.get(itemId)
    if (!current || current.organizationId !== actor.organizationId) throw new Error('Vật tư không tồn tại trong tổ chức hiện tại.')
    const delta = countedQuantity - current.quantity
    if (delta === 0) return { status: 'no_change' as const, quantity: current.quantity }
    const at = now()
    const link = await db.inventoryCloudLinks.get(actor.organizationId + ':' + itemId)
    const mutation = makeMutation(actor, itemId, 'adjust_count', {}, at, link?.cloudUpdatedAt)
    const movement = movementRecord(actor, current, 'Điều chỉnh', delta, cleanReason, mutation.mutationId, countedQuantity)
    const next = { ...current, quantity: countedQuantity, updatedAt: at }
    mutation.payload = { movement: movementPayload(movement), item_quantity: next.quantity }
    await db.inventoryItems.put(next)
    await db.inventoryMovements.add(movement)
    await db.inventoryMutations.add(mutation)
    return { status: 'adjusted' as const, movement, quantity: next.quantity }
  })
  if (adjusted.status === 'adjusted') requestSync()
  return adjusted
}

export async function archiveInventoryItem(actor: InventoryActor, itemId: string): Promise<void> {
  requireOrganization(actor)
  requirePermission(actor.canDelete && actor.isAdmin, 'lưu trữ vật tư')
  await db.transaction('rw', [db.inventoryItems, db.inventoryMutations, db.inventoryCloudLinks], async () => {
    const current = await db.inventoryItems.get(itemId)
    if (!current || current.organizationId !== actor.organizationId) throw new Error('Không tìm thấy vật tư trong tổ chức hiện tại.')
    if (current.archivedAt) return
    if (current.quantity !== 0) throw new Error('Chỉ lưu trữ vật tư khi số tồn đã bằng 0. Hãy xử lý số tồn bằng giao dịch kho trước.')
    const at = now()
    const link = await db.inventoryCloudLinks.get(actor.organizationId + ':' + itemId)
    const mutation = makeMutation(actor, itemId, 'archive', { archived_at: at }, at, link?.cloudUpdatedAt)
    await db.inventoryItems.put({ ...current, archivedAt: at, updatedAt: at })
    await db.inventoryMutations.add(mutation)
  })
  requestSync()
}

function movementPayload(movement: InventoryMovement): Record<string, unknown> {
  return {
    id: movement.id,
    date: movement.date,
    type: movement.type,
    quantity: movement.quantity,
    quantity_delta: movement.quantityDelta,
    balance_before: movement.balanceBefore,
    balance_after: movement.balanceAfter,
    counted_quantity: movement.countedQuantity ?? null,
    reason: movement.reason,
    note: movement.note ?? null,
    performed_by: movement.performedBy,
    actor_user_id: movement.actorUserId ?? null,
    linked_asset_id: movement.linkedAssetId ?? null
  }
}

export async function listInventoryItems(organizationId: string, includeArchived = false): Promise<InventoryItem[]> {
  if (!organizationId.trim()) return []
  const items = await db.inventoryItems.where('organizationId').equals(organizationId).toArray()
  return items
    .filter(item => includeArchived || !item.archivedAt)
    .sort((a, b) => a.code.localeCompare(b.code, 'vi'))
}

export async function listInventoryMovements(organizationId: string, itemId?: string): Promise<InventoryMovement[]> {
  if (!organizationId.trim()) return []
  const movements = itemId
    ? await db.inventoryMovements.where('[organizationId+itemId]').equals([organizationId, itemId]).toArray()
    : await db.inventoryMovements.where('organizationId').equals(organizationId).toArray()
  return movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function inventorySyncStatusLabel(status: InventorySyncStatus): string {
  if (status === 'pending') return 'Chờ đồng bộ Cloud'
  if (status === 'processing') return 'Đang đồng bộ'
  if (status === 'applied') return 'Đã đồng bộ'
  if (status === 'conflict') return 'Cần đối chiếu'
  return 'Đã hủy'
}
