import { useEffect, useMemo, useState } from 'react'
import { Hash, X } from 'lucide-react'
import {
  analyzeEquipmentName,
  type EquipmentCatalog,
  type EquipmentDictionaryEntry,
  type EquipmentGroup,
  type PlanCode
} from './lib/smartEquipmentId'

type StandardCatalogFile = {
  dataVersion: string
  plans: Array<{
    id: PlanCode
    name: string
    maxDevices: number | null
    features: { equipmentGroups: boolean; multipleSites: boolean }
  }>
  equipmentGroups: EquipmentGroup[]
  equipmentDictionary: EquipmentDictionaryEntry[]
}

type Props = { onClose: () => void }
const PLAN_RANK: Record<PlanCode, number> = { A: 1, B: 2, C: 3, D: 4 }

export default function SmartEquipmentIdTool({ onClose }: Props) {
  const [catalogFile, setCatalogFile] = useState<StandardCatalogFile | null>(null)
  const [loadError, setLoadError] = useState('')
  const [plan, setPlan] = useState<PlanCode>('A')
  const [name, setName] = useState('Máy bơm nước')
  const [equipmentChoice, setEquipmentChoice] = useState('')
  const [groupChoice, setGroupChoice] = useState('')
  const [siteCode, setSiteCode] = useState('00')
  const [commissionedAt, setCommissionedAt] = useState('')
  const [sequence, setSequence] = useState('1')

  useEffect(() => {
    let active = true
    fetch('/data/baotri-config.json')
      .then(response => {
        if (!response.ok) throw new Error('Không tải được danh mục chuẩn.')
        return response.json() as Promise<StandardCatalogFile>
      })
      .then(data => {
        if (!Array.isArray(data.plans) || !Array.isArray(data.equipmentGroups) || !Array.isArray(data.equipmentDictionary)) {
          throw new Error('Cấu trúc danh mục chuẩn không hợp lệ.')
        }
        if (active) setCatalogFile(data)
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : String(error))
      })
    return () => { active = false }
  }, [])

  const availableGroups = useMemo(() => {
    if (!catalogFile || plan === 'A') return []
    return catalogFile.equipmentGroups.filter(group => PLAN_RANK[group.availableFromPlan ?? 'B'] <= PLAN_RANK[plan])
  }, [catalogFile, plan])

  const analysis = useMemo(() => {
    if (!catalogFile) return null
    const dictionary = equipmentChoice
      ? catalogFile.equipmentDictionary.filter(entry =>
          entry.shortCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === equipmentChoice.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
      : catalogFile.equipmentDictionary
    const numericSequence = Number(sequence)
    return analyzeEquipmentName({
      name,
      plan,
      catalog: {
        equipmentGroups: catalogFile.equipmentGroups,
        equipmentDictionary: dictionary
      } as EquipmentCatalog,
      selectedGroupCode: groupChoice || undefined,
      siteCode,
      commissionedAt: commissionedAt || undefined,
      previewSequence: Number.isSafeInteger(numericSequence) && numericSequence > 0 ? numericSequence : undefined
    })
  }, [catalogFile, name, plan, equipmentChoice, groupChoice, siteCode, commissionedAt, sequence])

  const planInfo = catalogFile?.plans.find(item => item.id === plan)
  const canShowPreview = Boolean(
    analysis?.status === 'matched' &&
    analysis.canPrepareId &&
    !analysis.requiresUserConfirmation &&
    analysis.previewId
  )

  return <div className="modal-backdrop smart-id-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section className="modal smart-id-tool-modal">
      <div className="modal-head">
        <div>
          <div className="eyebrow">BAOTRI MINI · CÔNG CỤ THỬ NGHIỆM</div>
          <h2><Hash size={18}/> Công cụ sinh mã thiết bị</h2>
          <p>Thử nhận diện tên và xem cấu trúc mã theo Plan A/B/C/D.</p>
        </div>
        <button className="icon-btn" aria-label="Đóng công cụ sinh mã" onClick={onClose}><X size={17}/></button>
      </div>

      <div className="smart-id-simulation-warning">
        <b>Chế độ mô phỏng — không cấp mã chính thức</b>
        <span>Dữ liệu dùng danh mục chuẩn công khai v{catalogFile?.dataVersion || '…'}. Số thứ tự bên dưới chỉ là số minh họa; không gọi Supabase, không giữ số và không lưu thiết bị.</span>
      </div>

      {loadError && <div className="auth-error">{loadError}</div>}
      {!catalogFile && !loadError && <p className="muted">Đang tải danh mục chuẩn…</p>}

      {catalogFile && <>
        <div className="smart-id-tool-grid">
          <label className="field">Gói sử dụng
            <select value={plan} onChange={event => {
              setPlan(event.target.value as PlanCode)
              setGroupChoice('')
              setEquipmentChoice('')
            }}>
              {catalogFile.plans.map(item => <option key={item.id} value={item.id}>Plan {item.id} · {item.name}</option>)}
            </select>
            <small>{planInfo?.maxDevices === null ? 'Không giới hạn thiết bị' : 'Tối đa ' + (planInfo?.maxDevices ?? 0).toLocaleString('vi-VN') + ' thiết bị'}</small>
          </label>

          <label className="field">Tên thiết bị cần nhận diện *
            <input value={name} onChange={event => {
              setName(event.target.value)
              setEquipmentChoice('')
              setGroupChoice('')
            }} placeholder="Ví dụ: Máy bơm nước làm mát"/>
          </label>

          {analysis?.status === 'ambiguous' && <label className="field smart-id-wide">Chọn loại thiết bị phù hợp *
            <select required value={equipmentChoice} onChange={event => {
              setEquipmentChoice(event.target.value)
              setGroupChoice('')
            }}>
              <option value="">-- Chọn loại thiết bị --</option>
              {analysis.matches.map((match, index) => <option key={match.shortCode + index} value={match.shortCode}>{match.standardName} · {match.shortCode}</option>)}
            </select>
          </label>}

          {plan !== 'A' && <label className="field">Nhóm thiết bị *
            <select required value={groupChoice} onChange={event => setGroupChoice(event.target.value)}>
              <option value="">-- Chọn / xác nhận nhóm --</option>
              {availableGroups.map(group => <option key={group.code} value={group.code}>{group.name} · {group.code}</option>)}
            </select>
            {analysis?.group && <small>Gợi ý từ điển: {analysis.group.name}. Bạn vẫn cần tự xác nhận nhóm.</small>}
          </label>}

          {(plan === 'C' || plan === 'D') && <>
            <label className="field">Mã cơ sở (2 chữ số) *
              <input inputMode="numeric" maxLength={2} pattern="[0-9]{2}" value={siteCode} onChange={event => setSiteCode(event.target.value)}/>
            </label>
            <label className="field">Ngày đưa vào sử dụng *
              <input type="date" value={commissionedAt} onChange={event => setCommissionedAt(event.target.value)}/>
            </label>
          </>}

          <label className="field">Số thứ tự minh họa
            <input type="number" min="1" step="1" value={sequence} onChange={event => setSequence(event.target.value)}/>
            <small>Cho phép thử số lớn hơn 999; không phải bộ đếm của tổ chức.</small>
          </label>
        </div>

        {analysis && analysis.status !== 'matched' && <div className="auth-error smart-id-status">{analysis.message}</div>}
        {analysis?.status === 'matched' && analysis.requiresUserConfirmation && <div className="smart-id-pending">
          {plan === 'A' ? analysis.message : 'Đã nhận diện được loại thiết bị. Hãy chọn và xác nhận nhóm trước khi xem mã.'}
        </div>}
        {canShowPreview && <div className="smart-id-result">
          <small>MÃ QUẢN LÝ MINH HỌA · PLAN {plan}</small>
          <strong>{analysis?.previewId}</strong>
          <span>{analysis?.normalizedName} · Loại {analysis?.equipmentCode}{analysis?.groupCode ? ' · Nhóm ' + analysis.groupCode : ''}</span>
          <span>Định dạng: {plan === 'A' ? 'LOẠI-SỐ THỨ TỰ' : plan === 'B' ? 'LOẠI-NHÓM-SỐ THỨ TỰ' : 'LOẠI-NHÓM-CƠ SỞ-SỐ THỨ TỰ-MMYY'}</span>
        </div>}
      </>}

      <div className="modal-actions">
        <button className="soft-btn" onClick={onClose}>Đóng</button>
      </div>
    </section>
  </div>
}
