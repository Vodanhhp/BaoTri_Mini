import type { OrganizationEquipmentCatalogRecord } from './lib/smartEquipmentIdClient'

type Props = {
  catalog: OrganizationEquipmentCatalogRecord | null
  loading: boolean
  error: string
}

export default function OrganizationPlanSummary({ catalog, loading, error }: Props) {
  if (loading) return <div className="plan-context-strip" role="status"><span>Đang tải thông tin Plan…</span></div>
  if (catalog) {
    const maxDevices = catalog.snapshot.plan?.maxDevices
    return <div className="plan-context-strip" aria-label="Thông tin gói dịch vụ">
      <b>Plan {catalog.plan_code} · {catalog.snapshot.plan?.name || 'Gói sử dụng'}</b>
      <span>{maxDevices === null ? 'Không giới hạn thiết bị' : typeof maxDevices === 'number' ? 'Tối đa ' + maxDevices.toLocaleString('vi-VN') + ' thiết bị' : 'Hạn mức theo cấu hình Plan'}</span>
      <span>{catalog.snapshot.equipmentGroups.length} nhóm · {catalog.snapshot.equipmentDictionary.length} loại chuẩn</span>
      <span>Catalog v{catalog.source_data_version}</span>
    </div>
  }
  if (error) return <div className="plan-context-strip" role="status"><span>Không tải được Plan: {error}</span></div>
  return <div className="plan-context-strip" role="status"><span>Doanh nghiệp chưa có Plan / Catalog Snapshot. Liên hệ Super Admin để khởi tạo.</span></div>
}
