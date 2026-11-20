import Dexie, { type Table } from 'dexie'

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
  status: 'Đang hoạt động' | 'Tạm dừng' | 'Hỏng' | 'Ngừng sử dụng'
  notes: string
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
  }
}

export const db = new BaoTriDatabase()
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
