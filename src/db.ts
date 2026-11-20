import Dexie, { type Table } from 'dexie'

export type AssetStatus = 'Đang hoạt động' | 'Đang sửa chữa' | 'Ngừng sử dụng' | 'Thanh lý'

export type Asset = {
  id: string
  code: string
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
  archivedAt?: string
  createdAt: string
  updatedAt: string
}

class BaoTriDatabase extends Dexie {
  assets!: Table<Asset, string>

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
  }
}

export const db = new BaoTriDatabase()
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
