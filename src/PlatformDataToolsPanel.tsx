import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type OrganizationOption = {
  id: string
  name: string
  status: string
  planCode: string | null
  planName: string | null
  planMaxDevices?: number | null
}
type Preview = {
  organizationId: string
  organizationName: string
  planCode: string
  planName: string
  maxDevices: number | null
  currentAssets: number
  remainingDevices: number | null
  currentInventory: number
  sourceDataVersion: string
  availableGroups: number
  availableEquipmentTypes: number
}
type Result = {
  runId: string
  assetsCreated: number
  inventoryCreated: number
  createdBy: string
  message: string
  assetCodes?: string[]
  inventoryCodes?: string[]
}
type Props = { client: SupabaseClient; organizations: OrganizationOption[]; onCreated: () => void }

const count = (value: number | null) => value === null ? 'Không giới hạn' : new Intl.NumberFormat('vi-VN').format(value)

export default function PlatformDataToolsPanel({ client, organizations, onCreated }: Props) {
  const [organizationId, setOrganizationId] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [createAssets, setCreateAssets] = useState(true)
  const [createInventory, setCreateInventory] = useState(true)
  const [siteCode, setSiteCode] = useState('01')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [runId, setRunId] = useState(() => crypto.randomUUID())

  useEffect(() => {
    if (!organizations.some(item => item.id === organizationId && item.status === 'active')) {
      setOrganizationId(organizations.find(item => item.status === 'active')?.id ?? '')
      setPreview(null)
      setResult(null)
    }
  }, [organizations, organizationId])

  const loadPreview = async () => {
    if (!organizationId || loading) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data, error: invokeError } = await client.functions.invoke('platform-data-tools', {
        body: { action: 'preview', organizationId }
      })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(data.error)
      setPreview(data as Preview)
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally { setLoading(false) }
  }

  const create = async () => {
    if (!preview || loading || (!createAssets && !createInventory)) return
    const parts = [createAssets ? '30 thiết bị' : '', createInventory ? '30 vật tư' : ''].filter(Boolean).join(' và ')
    if (!window.confirm('Tạo ' + parts + ' cho doanh nghiệp "' + preview.organizationName + '" theo Plan ' + preview.planCode + '? Người tạo sẽ ghi là Superadmin.')) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data, error: invokeError } = await client.functions.invoke('platform-data-tools', {
        body: { action: 'create', organizationId, createAssets, createInventory, siteCode, runId }
      })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(data.error)
      setResult(data as Result)
      setRunId(crypto.randomUUID())
      await loadPreviewAfterCreate()
      onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally { setLoading(false) }
  }

  const loadPreviewAfterCreate = async () => {
    const { data, error: invokeError } = await client.functions.invoke('platform-data-tools', {
      body: { action: 'preview', organizationId }
    })
    if (invokeError) throw new Error(invokeError.message)
    if (data?.error) throw new Error(data.error)
    setPreview(data as Preview)
  }

  const selected = organizations.find(item => item.id === organizationId)
  const canCreateAssets = !preview || preview.remainingDevices === null || preview.remainingDevices >= 30

  return <section className="panel platform-data-tools">
    <div className="panel-head">
      <div><div className="eyebrow">SUPERADMIN · CÔNG CỤ NỘI BỘ</div><h3>Công cụ dữ liệu thử nghiệm</h3><p>Tạo dữ liệu mẫu trực tiếp cho doanh nghiệp được chọn. Công cụ này không xuất hiện trong tài khoản Admin/KTV.</p></div>
      <span className="status purple">Chỉ Superadmin</span>
    </div>
    <div className="form-grid">
      <label className="field full-field">Doanh nghiệp đích *
        <select value={organizationId} onChange={event => { setOrganizationId(event.target.value); setPreview(null); setResult(null); setError('') }}>
          <option value="">Chọn doanh nghiệp</option>
          {organizations.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.name} · {item.planCode ? 'Plan '+item.planCode : 'Chưa có Plan'}</option>)}
        </select>
      </label>
      {selected && <div className="auth-note full-field">Doanh nghiệp được chọn: <b>{selected.name}</b>. Hạn mức thiết bị theo dữ liệu tổng quan: {selected.planMaxDevices === null ? 'Không giới hạn' : typeof selected.planMaxDevices === 'number' ? count(selected.planMaxDevices)+' thiết bị' : 'Chưa có dữ liệu'}.</div>}
      <div className="field full-field">
        <b>Loại dữ liệu cần tạo</b>
        <label><input type="checkbox" checked={createAssets} onChange={event => setCreateAssets(event.target.checked)}/> 30 thiết bị mẫu theo từ điển và quy tắc mã của Plan</label>
        <label><input type="checkbox" checked={createInventory} onChange={event => setCreateInventory(event.target.checked)}/> 30 vật tư mẫu, mã vật tư do hệ thống cấp</label>
      </div>
      {preview && ['C','D'].includes(preview.planCode) && createAssets && <label className="field">Mã cơ sở (2 chữ số) *<input inputMode="numeric" maxLength={2} pattern="[0-9]{2}" value={siteCode} onChange={event => setSiteCode(event.target.value)}/><small>Áp dụng theo quy tắc mã thiết bị của Plan {preview.planCode}.</small></label>}
      {preview && <div className="platform-onboarding-review full-field">
        <h4>Thông tin Plan và hạn mức hiện tại</h4>
        <div><span>Doanh nghiệp</span><b>{preview.organizationName}</b></div>
        <div><span>Gói hiện tại</span><b>Plan {preview.planCode} — {preview.planName}</b></div>
        <div><span>Thiết bị hiện có</span><b>{count(preview.currentAssets)}</b></div>
        <div><span>Thiết bị còn được phép tạo</span><b>{count(preview.remainingDevices)}</b></div>
        <div><span>Vật tư hiện có</span><b>{count(preview.currentInventory)}</b></div>
        <div><span>Danh mục thiết bị của Plan</span><b>{count(preview.availableEquipmentTypes)} loại · {count(preview.availableGroups)} nhóm</b></div>
        <div><span>Catalog Snapshot</span><b>{preview.sourceDataVersion}</b></div>
      </div>}
      {preview && createAssets && !canCreateAssets && <div className="auth-error full-field">Không đủ hạn mức thiết bị còn lại để tạo 30 thiết bị. Hệ thống sẽ không tạo một phần.</div>}
      {error && <div className="auth-error full-field">{error}</div>}
      {result && <div className="platform-onboarding-success full-field"><div className="platform-onboarding-success-icon">✓</div><div><h4>Đã tạo dữ liệu thành công</h4><p>{result.message}</p><p>Thiết bị: <b>{result.assetsCreated}</b> · Vật tư: <b>{result.inventoryCreated}</b> · Người tạo: <b>{result.createdBy}</b></p><small>Mã lượt tạo: {result.runId}</small></div></div>}
      <div className="modal-actions full-field">
        <button type="button" className="soft-btn" onClick={() => void loadPreview()} disabled={!organizationId || loading}>{loading ? 'Đang xử lý…' : 'Kiểm tra doanh nghiệp và Plan'}</button>
        <button type="button" className="primary-btn" onClick={() => void create()} disabled={!preview || loading || (!createAssets && !createInventory) || (createAssets && !canCreateAssets) || (preview.planCode==='C'||preview.planCode==='D') && createAssets && !/^\d{2}$/.test(siteCode)}>{loading ? 'Đang tạo…' : 'Tạo dữ liệu mẫu'}</button>
      </div>
    </div>
    <div className="auth-note" style={{marginTop:12}}>Mỗi lượt tạo được ghi nhật ký Superadmin. Thiết bị tuân thủ mã và hạn mức Plan; vật tư bắt đầu với tồn kho 0. Dữ liệu được tạo trên Cloud và phát sự kiện đồng bộ để các thiết bị Local nhận về.</div>
  </section>
}
