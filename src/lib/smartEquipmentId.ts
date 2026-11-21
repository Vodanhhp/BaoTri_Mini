/**
 * Smart Equipment ID Engine — deterministic analysis and ID preview.
 *
 * This module never allocates an official sequence and never persists data.
 * The official sequence must be allocated atomically by the organization data
 * layer when the asset is saved.
 */

export type PlanCode = 'A' | 'B' | 'C' | 'D'

export type EquipmentGroup = {
  code: string
  name: string
  aliases?: string[]
}

export type EquipmentDictionaryEntry = {
  standardName: string
  shortCode: string
  aliases?: string[]
  suggestedGroup?: string
}

export type EquipmentCatalog = {
  equipmentGroups: EquipmentGroup[]
  equipmentDictionary: EquipmentDictionaryEntry[]
}

export type SmartIdStatus =
  | 'matched'
  | 'ambiguous'
  | 'not-found'
  | 'missing-group'
  | 'missing-commissioning-date'
  | 'invalid-input'

export type SmartIdInput = {
  name: string
  plan: PlanCode
  catalog: EquipmentCatalog
  /** Organization-specific snapshot additions. These never modify the standard catalog. */
  customGroups?: EquipmentGroup[]
  customEquipmentDictionary?: EquipmentDictionaryEntry[]
  /** Explicit group selected/confirmed by the user. */
  selectedGroupCode?: string
  /** Required only for Plan C/D; defaults to 00 when omitted. */
  siteCode?: string
  /** Confirmed commissioning date in YYYY-MM-DD format, required for Plan C/D. */
  commissionedAt?: string
  /** Preview only. Official sequence allocation happens in the save transaction. */
  previewSequence?: number
}

export type EquipmentMatch = {
  standardName: string
  shortCode: string
  suggestedGroup?: string
  score: number
}

export type SmartIdResult = {
  status: SmartIdStatus
  normalizedInput: string
  normalizedName?: string
  equipmentCode?: string
  group?: EquipmentGroup
  groupCode?: string
  siteCode?: string
  previewId?: string
  previewSequence?: number
  matches: EquipmentMatch[]
  requiresUserConfirmation: boolean
  canPrepareId: boolean
  message: string
}

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeCode = (value: string): string =>
  value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const scorePhrase = (input: string, phrase: string): number => {
  const candidate = normalize(phrase)
  if (!candidate) return 0
  if (input === candidate) return 100
  if (input.includes(candidate)) return Math.min(94, 78 + candidate.length / Math.max(input.length, 1) * 16)
  if (candidate.includes(input) && input.length >= 4) return 72
  return 0
}

const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T00:00:00.000Z')
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const formatSequence = (sequence: number): string =>
  String(sequence).padStart(3, '0')

export function formatEquipmentId(args: {
  plan: PlanCode
  equipmentCode: string
  groupCode?: string
  siteCode?: string
  sequence: number
  commissionedAt?: string
}): string {
  if (!Number.isSafeInteger(args.sequence) || args.sequence < 1) {
    throw new Error('Số thứ tự phải là số nguyên dương.')
  }

  const equipmentCode = normalizeCode(args.equipmentCode)
  if (equipmentCode.length < 2 || equipmentCode.length > 4) {
    throw new Error('Mã loại thiết bị phải có từ 2 đến 4 ký tự chữ/số.')
  }

  const sequence = formatSequence(args.sequence)
  if (args.plan === 'A') return equipmentCode + '-' + sequence

  const groupCode = normalizeCode(args.groupCode ?? '')
  if (groupCode.length < 2 || groupCode.length > 4) {
    throw new Error('Plan B/C/D yêu cầu mã nhóm thiết bị từ 2 đến 4 ký tự.')
  }
  if (args.plan === 'B') return equipmentCode + '-' + groupCode + '-' + sequence

  const siteCode = args.siteCode ?? '00'
  if (!/^\d{2}$/.test(siteCode)) {
    throw new Error('Mã cơ sở của Plan C/D phải gồm đúng 2 chữ số.')
  }
  if (!args.commissionedAt || !validDate(args.commissionedAt)) {
    throw new Error('Plan C/D yêu cầu ngày đưa vào sử dụng hợp lệ đã được xác nhận.')
  }
  const date = new Date(args.commissionedAt + 'T00:00:00.000Z')
  const monthYear = String(date.getUTCMonth() + 1).padStart(2, '0') + String(date.getUTCFullYear()).slice(-2)
  return [equipmentCode, groupCode, siteCode, sequence, monthYear].join('-')
}

/**
 * Analyze a free-text equipment name against the organization's catalog snapshot.
 * Standard and customer-defined catalog items are passed in separately so the
 * caller can preserve snapshot isolation.
 */
export function analyzeEquipmentName(input: SmartIdInput): SmartIdResult {
  const normalizedInput = normalize(input.name)
  const empty = (status: SmartIdStatus, message: string, matches: EquipmentMatch[] = []): SmartIdResult => ({
    status,
    normalizedInput,
    matches,
    requiresUserConfirmation: true,
    canPrepareId: false,
    message
  })

  if (!normalizedInput) return empty('invalid-input', 'Bạn cần nhập tên thiết bị.')
  if (!input.catalog || !Array.isArray(input.catalog.equipmentGroups) || !Array.isArray(input.catalog.equipmentDictionary)) {
    return empty('invalid-input', 'Danh mục thiết bị chưa được nạp hoặc không đúng cấu trúc.')
  }

  const groups = [...input.catalog.equipmentGroups, ...(input.customGroups ?? [])]
  const duplicateGroupCodes = new Set<string>()
  for (const group of groups) {
    const code = normalizeCode(group.code)
    if (!code || duplicateGroupCodes.has(code)) {
      return empty('invalid-input', 'Danh mục có mã nhóm trống hoặc trùng nhau; cần Admin kiểm tra.')
    }
    duplicateGroupCodes.add(code)
  }

  const dictionary = [...input.catalog.equipmentDictionary, ...(input.customEquipmentDictionary ?? [])]
  const scored = dictionary.map(entry => {
    const phrases = [entry.standardName, ...(entry.aliases ?? [])]
    const score = Math.max(0, ...phrases.map(phrase => scorePhrase(normalizedInput, phrase)))
    return { entry, score }
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.standardName.localeCompare(b.entry.standardName, 'vi'))

  if (!scored.length) return empty('not-found', 'Chưa tìm thấy loại thiết bị phù hợp trong danh mục. Cần chọn loại hoặc bổ sung từ điển riêng.')

  const topScore = scored[0].score
  const tied = scored.filter(item => topScore - item.score < 4)
  const matches: EquipmentMatch[] = tied.slice(0, 5).map(item => ({
    standardName: item.entry.standardName,
    shortCode: item.entry.shortCode,
    suggestedGroup: item.entry.suggestedGroup,
    score: Math.round(item.score * 10) / 10
  }))

  if (tied.length > 1 && new Set(tied.map(item => item.entry.shortCode)).size > 1) {
    return empty('ambiguous', 'Tên thiết bị có nhiều cách phân loại gần tương đương. Hãy chọn loại thiết bị phù hợp.', matches)
  }

  const best = scored[0].entry
  const equipmentCode = normalizeCode(best.shortCode)
  if (equipmentCode.length < 2 || equipmentCode.length > 4) {
    return empty('invalid-input', 'Mã loại thiết bị trong danh mục phải được chuẩn hóa về 2–4 ký tự.', matches)
  }

  if (input.plan === 'A' && input.selectedGroupCode) {
    return empty('invalid-input', 'Plan A không có chức năng chọn/quản lý nhóm thiết bị.', matches)
  }

  const selectedGroupCode = input.plan === 'A' ? '' : (input.selectedGroupCode ? normalizeCode(input.selectedGroupCode) : '')
  const suggestedGroupCode = input.plan === 'A' ? '' : normalizeCode(best.suggestedGroup ?? '')
  const resolvedGroupCode = selectedGroupCode || suggestedGroupCode
  const group = groups.find(item => normalizeCode(item.code) === resolvedGroupCode)

  if (resolvedGroupCode && !group) {
    return empty('missing-group', 'Nhóm được chọn/gợi ý không có trong Snapshot của Organization. Không tự thay bằng nhóm khác.', matches)
  }

  if (input.plan !== 'A' && !group) {
    return empty('missing-group', 'Plan B/C/D cần xác nhận một nhóm thiết bị có mã hợp lệ.', matches)
  }

  if (group && input.plan !== 'A') {
    const planRank: Record<PlanCode, number> = { A: 1, B: 2, C: 3, D: 4 }
    const availableFrom = (group as EquipmentGroup & { availableFromPlan?: PlanCode }).availableFromPlan ?? 'B'
    if (planRank[availableFrom] > planRank[input.plan]) {
      return empty('invalid-input', 'Nhóm thiết bị này chưa được phép sử dụng trong Plan hiện tại.', matches)
    }
  }

  const groupCode = group ? normalizeCode(group.code) : undefined
  if (input.plan !== 'A' && (!groupCode || groupCode.length < 2 || groupCode.length > 4)) {
    return empty('invalid-input', 'Mã nhóm thiết bị phải có từ 2 đến 4 ký tự chữ/số.', matches)
  }

  let siteCode: string | undefined
  if (input.plan === 'C' || input.plan === 'D') {
    siteCode = input.siteCode ?? '00'
    if (!/^\d{2}$/.test(siteCode)) {
      return empty('invalid-input', 'Mã cơ sở phải gồm đúng 2 chữ số.', matches)
    }
    if (!input.commissionedAt || !validDate(input.commissionedAt)) {
      return empty('missing-commissioning-date', 'Plan C/D cần ngày đưa vào sử dụng hợp lệ trước khi tạo mã.', matches)
    }
  }

  let previewId: string | undefined
  if (input.previewSequence !== undefined) {
    try {
      previewId = formatEquipmentId({
        plan: input.plan,
        equipmentCode,
        groupCode,
        siteCode,
        sequence: input.previewSequence,
        commissionedAt: input.commissionedAt
      })
    } catch (error) {
      return empty('invalid-input', error instanceof Error ? error.message : String(error), matches)
    }
  }

  return {
    status: 'matched',
    normalizedInput,
    normalizedName: best.standardName,
    equipmentCode,
    group,
    groupCode,
    siteCode,
    previewId,
    previewSequence: input.previewSequence,
    matches,
    requiresUserConfirmation: !input.selectedGroupCode && input.plan !== 'A',
    canPrepareId: true,
    message: input.selectedGroupCode
      ? 'Đã sử dụng nhóm do người dùng xác nhận.'
      : 'Đã tìm thấy loại thiết bị và nhóm gợi ý. Cần xác nhận nhóm trước khi lưu.'
  }
}

/** Create a UUID v4 for a new equipment record; keep it unchanged for its lifetime. */
export function createEquipmentUuid(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không hỗ trợ tạo UUID an toàn.')
  }
  return globalThis.crypto.randomUUID()
}
