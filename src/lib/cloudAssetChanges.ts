import type { SupabaseClient } from '@supabase/supabase-js'

export type AssetSyncCheckpoint = {
  lastSequence: number
  resetGeneration: number
}

export type AssetSyncEventType = 'upsert' | 'soft_delete' | 'hard_delete' | 'reset'

export type AssetSyncEvent = {
  organizationId: string
  sequence: number
  assetId: string | null
  assetCode: string | null
  eventType: AssetSyncEventType
  assetUpdatedAt: string | null
  resetGeneration: number | null
  snapshot: Record<string, unknown> | null
}

export type AssetSyncPage = {
  items: AssetSyncEvent[]
  hasMore: boolean
  nextCursor: number
  currentGeneration: number
}

function singleRecord(data: unknown, label: string): Record<string, unknown> {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ': Cloud trả về dữ liệu không hợp lệ.')
  }
  return value as Record<string, unknown>
}

function integer(value: unknown, label: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    throw new Error(label + ': Cloud trả về số không hợp lệ.')
  }
  return value
}

export async function getAssetSyncCheckpoint(
  client: SupabaseClient,
  organizationId: string
): Promise<AssetSyncCheckpoint> {
  const { data, error } = await client.rpc('get_asset_sync_checkpoint', {
    p_organization_id: organizationId
  })
  if (error) throw error
  const row = singleRecord(data, 'Checkpoint')
  return {
    lastSequence: integer(row.last_sequence ?? row.lastSequence, 'Checkpoint sequence'),
    resetGeneration: integer(row.reset_generation ?? row.resetGeneration, 'Checkpoint generation')
  }
}

export async function listAssetSyncChanges(
  client: SupabaseClient,
  organizationId: string,
  afterSequence: number,
  limit = 200
): Promise<AssetSyncPage> {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error('Cursor Local không hợp lệ.')
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('Page size phải từ 1 đến 500.')
  const { data, error } = await client.rpc('list_asset_sync_changes', {
    p_organization_id: organizationId,
    p_after_sequence: afterSequence,
    p_limit: limit
  })
  if (error) throw error
  const row = singleRecord(data, 'Incremental Pull')
  const rawItems = row.items
  if (!Array.isArray(rawItems) || rawItems.length > limit) throw new Error('Incremental Pull trả về page size không hợp lệ.')
  const items: AssetSyncEvent[] = rawItems.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Incremental Pull chứa event không hợp lệ.')
    const event = raw as Record<string, unknown>
    const sequence = integer(event.sequence, 'Event sequence', 1)
    const eventType = event.event_type ?? event.eventType
    if (!['upsert', 'soft_delete', 'hard_delete', 'reset'].includes(String(eventType))) {
      throw new Error('Incremental Pull chứa event type không được hỗ trợ.')
    }
    const eventOrganization = String(event.organization_id ?? event.organizationId ?? '')
    if (eventOrganization !== organizationId) throw new Error('Incremental Pull trả event sai tổ chức; đã hủy.')
    if (sequence <= afterSequence || (index > 0 && sequence <= itemsSequence(rawItems[index - 1]))) {
      throw new Error('Incremental Pull sequence không tăng đơn điệu; đã hủy.')
    }
    const snapshot = event.snapshot
    if (snapshot !== null && snapshot !== undefined && (typeof snapshot !== 'object' || Array.isArray(snapshot))) {
      throw new Error('Incremental Pull snapshot không hợp lệ.')
    }
    return {
      organizationId: eventOrganization,
      sequence,
      assetId: event.asset_id == null ? null : String(event.asset_id),
      assetCode: event.asset_code == null ? null : String(event.asset_code),
      eventType: eventType as AssetSyncEventType,
      assetUpdatedAt: event.asset_updated_at == null ? null : String(event.asset_updated_at),
      resetGeneration: event.reset_generation == null ? null : integer(event.reset_generation, 'Event generation'),
      snapshot: snapshot == null ? null : snapshot as Record<string, unknown>
    }
  })
  const hasMore = row.has_more ?? row.hasMore
  if (typeof hasMore !== 'boolean') throw new Error('Incremental Pull thiếu has_more.')
  const nextCursor = integer(row.next_cursor ?? row.nextCursor, 'Next cursor')
  const currentGeneration = integer(row.current_generation ?? row.currentGeneration, 'Current generation')
  if (items.length > 0 && nextCursor !== items[items.length - 1].sequence) {
    throw new Error('Incremental Pull next_cursor không khớp event cuối.')
  }
  if (hasMore && nextCursor <= afterSequence) throw new Error('Incremental Pull cursor không tiến; đã dừng.')
  if (!hasMore && nextCursor < afterSequence) throw new Error('Incremental Pull cursor lùi; đã dừng.')
  return { items, hasMore, nextCursor, currentGeneration }
}

function itemsSequence(raw: unknown): number {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return -1
  return integer((raw as Record<string, unknown>).sequence, 'Event sequence', 1)
}
