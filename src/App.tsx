import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, Archive, Building2, Check, Hash, LayoutDashboard, LogOut, Plus, Search, ShieldCheck, SlidersHorizontal, Settings, UserRound, Wrench, X, RotateCcw, ImagePlus, Menu, Trash2 } from 'lucide-react'
import AuthScreen from './AuthScreen'
import CloudAssetsPanel from './CloudAssetsPanel'
import ImageLightbox from './ImageLightbox'
import OrganizationMembersPanel from './OrganizationMembersPanel'
import AccountProfilePanel from './AccountProfilePanel'
import PlatformAdminPanel from './PlatformAdminPanel'
import { OrganizationPlanPanel } from './PlanChangePanels'
import PasswordRecoveryScreen from './PasswordRecoveryScreen'
import { db, now, uid, type Asset, type AssetDraft, type AssetStatus, type AssetMutationPayload, type AssetHistory } from './db'
import { loadOrganizationContext, type OrganizationContext } from './lib/organizationContext'
import { acquireCloudAssetLock, applyCloudAssetMutation, heartbeatCloudAssetLock, releaseCloudAssetLock, listCloudAssets, syncCloudAssetsToLocal, getLocalDeviceId, getDeviceLabel, retryCloudAssetMutation } from './lib/cloudAssets'
import { supabase } from './lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeEquipmentName } from './lib/smartEquipmentId'
import { loadOrganizationEquipmentCatalog, reserveSmartEquipmentId, confirmSmartEquipmentIdReservation, releaseSmartEquipmentIdReservation, type OrganizationEquipmentCatalogRecord, type SmartEquipmentIssuance } from './lib/smartEquipmentIdClient'

const STATUSES: AssetStatus[] = ['Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý', 'Lưu kho']

const ASSET_CATEGORY_GROUPS = [
 {label:'Điện – điện tử – tự động hóa',items:['Thiết bị điện','Tủ điện','Tủ điện tổng','Tủ điện phân phối','Tủ điều khiển','Biến tần','UPS','Máy biến áp','Thiết bị đo lường','Động cơ điện','Bộ chuyển nguồn ATS','Tủ tụ bù','PLC','HMI','Cảm biến','Bộ nguồn điện','Thiết bị điện tử','Bo mạch điện tử','Rơ le – contactor']},
 {label:'Cơ khí – máy móc – truyền động',items:['Máy bơm','Thiết bị xưởng','Thang máy','Hộp giảm tốc','Băng tải','Máy tiện','Máy phay','Máy khoan bàn','Máy cưa','Máy ép','Máy dập','Máy CNC','Máy nén thủy lực','Hệ thống thủy lực','Thiết bị nâng hạ','Pa lăng – tời','Cầu trục','Xe nâng']},
 {label:'Công cụ – dụng cụ điện',items:['Công cụ điện cầm tay','Máy khoan cầm tay','Máy mài','Máy cắt','Máy siết bu lông','Máy chà nhám','Máy thổi bụi','Máy hút bụi công nghiệp','Dụng cụ đo điện','Dụng cụ cơ khí']},
 {label:'Hàn – cắt – gia công',items:['Máy hàn','Máy hàn xung','Máy hàn MIG/MAG','Máy hàn TIG','Máy hàn que','Máy cắt plasma','Máy cắt gas','Máy cắt kim loại','Máy uốn','Máy đột lỗ']},
 {label:'Quạt công nghiệp',items:['Quạt công nghiệp','Quạt hút','Quạt cấp','Quạt thông gió','Quạt làm mát','Quạt hướng trục','Quạt ly tâm']},
 {label:'Khí nén – nhiệt – lạnh – HVAC',items:['Máy nén khí','Máy sấy khí','Bộ lọc khí nén','Khí nén','Kho lạnh','Điều hòa thông gió','Chiller','Tháp giải nhiệt','Nồi hơi','Nồi hấp','Máy lạnh','Máy hút ẩm','Máy sưởi','Hệ thống HVAC']},
 {label:'Nguồn điện – an toàn – PCCC',items:['Máy phát điện','Phòng cháy chữa cháy','Hệ thống tiếp địa','Chống sét','Đèn chiếu sáng','Thiết bị an toàn']},
 {label:'Thiết bị sản xuất – đóng gói – phụ trợ',items:['Máy đóng gói','Máy chiết rót','Máy dán nhãn','Máy in công nghiệp','Máy trộn','Máy nghiền','Máy sàng','Máy sấy công nghiệp','Máy ép nhựa','Robot công nghiệp','Thiết bị xử lý nước','Hệ thống lọc bụi']},
 {label:'Nhóm khác',items:['Khác']}
] as const
const ASSET_CYCLES = ['Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','Hàng năm'] as const
const emptyAsset = (): Asset => ({
  id: uid(), localScope: 'local-preview', code: '', name: '', category: '', brand: '', model: '', serial: '',
  location: '', commissionedAt: '', power: '', cycle: '', transferredFromOtherFacility: false,
  status: 'Đang hoạt động', notes: '', images: [], createdAt: now(), updatedAt: now()
})
const displayAssetName = (asset: Pick<Asset,'name'|'transferredFromOtherFacility'>) => asset.transferredFromOtherFacility && !asset.name.endsWith('*') ? asset.name + '*' : asset.name
const dateText = (value: string) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN') : '—'
const imageToDataUrl = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('Chỉ chấp nhận tệp hình ảnh.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể xử lý hình ảnh trên trình duyệt này.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) return reject(new Error('Không thể nén hình ảnh.'))
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Không đọc được hình ảnh.'))
    reader.readAsDataURL(blob)
  }, 'image/jpeg', 0.78))
}

type ActiveCloudLease = { assetId:string; token:string; expectedCloudUpdatedAt:string; deviceId:string; lost:boolean }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [organizationContexts,setOrganizationContexts]=useState<OrganizationContext[]>([])
  const [organizationId,setOrganizationId]=useState('')
  const [organizationReady,setOrganizationReady]=useState(false)
  const [equipmentCatalog,setEquipmentCatalog]=useState<OrganizationEquipmentCatalogRecord|null>(null)
  const [equipmentCatalogLoading,setEquipmentCatalogLoading]=useState(false)
  const [equipmentCatalogError,setEquipmentCatalogError]=useState('')
  const [smartEquipmentChoice,setSmartEquipmentChoice]=useState('')
  const [smartGroupChoice,setSmartGroupChoice]=useState('')
  const [smartSiteCode,setSmartSiteCode]=useState('00')
  const [cloudPanel,setCloudPanel]=useState(false)
  const [membersPanel,setMembersPanel]=useState(false)
  const [profilePanel,setProfilePanel]=useState(false)
  const [platformPanel,setPlatformPanel]=useState(false)
  const [organizationPlanPanel,setOrganizationPlanPanel]=useState(false)
  const [settingsOpen,setSettingsOpen]=useState(false)
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false)
  const [cloudLease,setCloudLease]=useState<ActiveCloudLease|null>(null)
  const [passwordRecovery,setPasswordRecovery]=useState(false)
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [localPreview, setLocalPreview] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [localPreviewAssets, setLocalPreviewAssets] = useState<Asset[]>([])
  const [cloudSyncMessage,setCloudSyncMessage] = useState('')
  const [recoverableDrafts, setRecoverableDrafts] = useState<AssetDraft[]>([])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Tất cả nhóm')
  const [locationFilter, setLocationFilter] = useState('Tất cả vị trí')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [editing, setEditing] = useState<Asset | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)
  const [imageViewer, setImageViewer] = useState<{ images: string[]; index: number } | null>(null)
  const [printAssetMode, setPrintAssetMode] = useState<null | 'sticker' | 'detail'>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [assetHistory, setAssetHistory] = useState<AssetHistory[]>([])
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [selectedAssetStatus, setSelectedAssetStatus] = useState<AssetStatus>('Đang hoạt động')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reservationReleaseBusy,setReservationReleaseBusy]=useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return
        if (sessionError) setError('Không khôi phục được phiên đăng nhập: ' + sessionError.message)
        setSession(data.session)
        setSessionReady(true)
      })
      .catch(cause => {
        if (!active) return
        setError('Không kết nối được dịch vụ đăng nhập Supabase: ' + (cause instanceof Error ? cause.message : String(cause)))
        setSessionReady(true)
      })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') {
        setOrganizationContexts([])
        setOrganizationId('')
        setOrganizationReady(false)
        setPasswordRecovery(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadProfileName = async () => {
      if (!session?.user.id || !supabase) { setProfileDisplayName(''); return }
      const { data } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle()
      if (active) setProfileDisplayName(data?.display_name?.trim() || String(session.user.user_metadata?.full_name || '').trim())
    }
    void loadProfileName()
    return () => { active = false }
  }, [session?.user.id, session?.user.user_metadata?.full_name])

  useEffect(()=>{
    let active=true
    if(!session?.user.id||!supabase){setOrganizationContexts([]);setOrganizationId('');setOrganizationReady(true);return}
    // Clear the previous user's tenant context immediately to prevent stale cross-account rendering.
    setOrganizationReady(false)
    setOrganizationContexts([])
    setOrganizationId('')
    setError('')
    loadOrganizationContext(supabase,session.user.id).then(contexts=>{
      if(!active)return
      setOrganizationContexts(contexts)
      // One active organization is selected automatically; multiple organizations require an explicit choice after login.
      setOrganizationId(contexts.length===1?contexts[0].id:'')
    }).catch(err=>{if(active)setError(err instanceof Error?err.message:String(err))})
      .finally(()=>{if(active)setOrganizationReady(true)})
    return ()=>{active=false}
  },[session?.user.id])

  useEffect(()=>{
    let active=true
    if(!session?.user.id||!supabase||!organizationId){
      setEquipmentCatalog(null);setEquipmentCatalogError('');setEquipmentCatalogLoading(false)
      return
    }
    setEquipmentCatalog(null);setEquipmentCatalogError('');setEquipmentCatalogLoading(true)
    loadOrganizationEquipmentCatalog(supabase,organizationId)
      .then(record=>{if(active)setEquipmentCatalog(record)})
      .catch(err=>{if(active)setEquipmentCatalogError(err instanceof Error?err.message:String(err))})
      .finally(()=>{if(active)setEquipmentCatalogLoading(false)})
    return()=>{active=false}
  },[session?.user.id,organizationId])

  const localScope=localPreview?'local-preview':organizationId
  const loadAssets = async (scope=localScope) => {
    if(!scope){setAssets([]);return}
    setAssets(await db.assets.where('localScope').equals(scope).toArray())
  }
  useEffect(() => { if (localPreview || (session&&organizationId)) void loadAssets(localPreview?'local-preview':organizationId); else setAssets([]) }, [session?.user.id,localPreview,organizationId])
  useEffect(()=>{
    if(!session?.user.id||!organizationId||localPreview){setLocalPreviewAssets([]);return}
    let active=true
    db.assets.where('localScope').equals('local-preview').toArray()
      .then(rows=>{if(active)setLocalPreviewAssets(rows)})
      .catch(cause=>{if(active)setError('Không tải được dữ liệu Local Preview cũ: '+(cause instanceof Error?cause.message:String(cause)))})
    return()=>{active=false}
  },[session?.user.id,organizationId,localPreview])
  useEffect(()=>{
    if(!session?.user.id||!supabase||!organizationReady||!organizationId||localPreview){
      setCloudSyncMessage('')
      return
    }
    const client=supabase!
    const context=organizationContexts.find(item=>item.id===organizationId)
    if(!context?.permissions.includes('assets.view')){setCloudSyncMessage('Tài khoản không có quyền xem thiết bị của tổ chức; bỏ qua đồng bộ Cloud.');return}
    let active=true
    let running=false
    const runSync=async()=>{
      if(!active||running||!navigator.onLine)return
      running=true
      setCloudSyncMessage('Đang tự động tải và đối chiếu thiết bị từ Cloud…')
      try{
        const summary=await syncCloudAssetsToLocal(supabase,organizationId,{shouldContinue:()=>active})
        if(!active)return
        let retried=0
        let retryFailed=0
        if(context.permissions.includes('assets.update')){
          const pending=await db.assetMutations.where('organizationId').equals(organizationId)
            .filter(m=>m.status==='pending'||(m.status==='processing'&&Date.now()-new Date(m.updatedAt).getTime()>60000)).toArray()
          for(const mutation of pending){
            if(!active||!navigator.onLine)break
            try{
              await retryCloudAssetMutation(supabase,organizationId,mutation.mutationId)
              retried++
            }catch{
              retryFailed++
            }
          }
        }
        if(!active)return
        await loadAssets(organizationId)
        if(!active)return
        setCloudSyncMessage('Cloud → Local hoàn tất: '+summary.downloaded+' mới, '+summary.updated+' cập nhật, '+summary.unchanged+' đã khớp, '+summary.protectedLocal+' được bảo vệ, '+summary.conflicts+' xung đột. Tự retry: '+retried+' thành công, '+retryFailed+' chưa xác nhận.')
      }catch(cause){
        if(active)setCloudSyncMessage('Đồng bộ Cloud chưa hoàn tất: '+(cause instanceof Error?cause.message:String(cause)))
      }finally{
        running=false
      }
    }
    void runSync()
    window.addEventListener('online',runSync)
    return()=>{active=false;window.removeEventListener('online',runSync)}
  },[session?.user.id,organizationReady,organizationId,localPreview,organizationContexts])

  useEffect(()=>{
    if(!session?.user.id||!organizationId||localPreview){setRecoverableDrafts([]);return}
    let active=true
    const loadDrafts=async()=>{
      const rows=await db.assetDrafts.where('[organizationId+userId]').equals([organizationId,session.user.id]).toArray()
      const pending:AssetDraft[]=[]
      for(const row of rows){
        const saved=await db.assets.get(row.id)
        if(saved){await db.assetDrafts.delete(row.id);continue}
        pending.push(row)
      }
      if(active)setRecoverableDrafts(pending.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)))
    }
    void loadDrafts().catch(cause=>{if(active)setError('Không tải được thao tác cấp mã đang dở: '+(cause instanceof Error?cause.message:String(cause)))})
    return()=>{active=false}
  },[session?.user.id,organizationId,localPreview])
  useEffect(()=>{
    const client=supabase
    if(!session?.user.id||!client||!organizationId)return
    let active=true
    const retryPendingLocalReservations=async()=>{
      if(!navigator.onLine)return
      const pending=await db.assets.where('localScope').equals(organizationId)
        .filter(asset=>asset.idReservationStatus==='reserved'&&Boolean(asset.idReservationId))
        .toArray()
      for(const asset of pending){
        if(!active)break
        if(!asset.idReservationId||!asset.idComponentsSnapshot||!asset.equipmentTypeCode)continue
        try{
          await confirmSmartEquipmentIdReservation(client,{
            organizationId,reservationId:asset.idReservationId,assetId:asset.id,equipmentId:asset.code,
            originalName:asset.originalName||asset.name,
            normalizedNameAtCreation:asset.normalizedNameAtCreation||asset.name,
            equipmentTypeCode:asset.equipmentTypeCode,
            components:asset.idComponentsSnapshot
          })
          await db.assets.update(asset.id,{idReservationStatus:'confirmed'})
        }catch{
          // Keep the Local record and reservation pending; a later online retry can confirm it.
        }
      }
      if(active)await loadAssets(organizationId)
    }
    void retryPendingLocalReservations()
    window.addEventListener('online',retryPendingLocalReservations)
    return()=>{active=false;window.removeEventListener('online',retryPendingLocalReservations)}
  },[session?.user.id,organizationId])

  const isNewAssetDraft=Boolean(editing&&!assets.some(a=>a.id===editing.id))
  const isNewSmartAsset=Boolean(editing&&!localPreview&&!assets.some(a=>a.id===editing.id))
  const smartAnalysis=useMemo(()=>{
    if(!editing||!isNewSmartAsset||!equipmentCatalog)return null
    const dictionary=equipmentCatalog.snapshot.equipmentDictionary
    const selectedDictionary=smartEquipmentChoice
      ? dictionary.filter(entry=>entry.shortCode.replace(/[^A-Za-z0-9]/g,'').toUpperCase()===smartEquipmentChoice.replace(/[^A-Za-z0-9]/g,'').toUpperCase())
      : dictionary
    return analyzeEquipmentName({
      name:editing.name,
      plan:equipmentCatalog.plan_code,
      catalog:{...equipmentCatalog.snapshot,equipmentDictionary:selectedDictionary},
      selectedGroupCode:smartGroupChoice||undefined,
      siteCode:smartSiteCode,
      commissionedAt:editing.commissionedAt||undefined
    })
  },[editing?.name,editing?.commissionedAt,isNewSmartAsset,equipmentCatalog,smartEquipmentChoice,smartGroupChoice,smartSiteCode])
  const smartAvailableGroups=useMemo(()=>{
    if(!equipmentCatalog||equipmentCatalog.plan_code==='A')return []
    const rank={A:1,B:2,C:3,D:4}
    return equipmentCatalog.snapshot.equipmentGroups.filter(group=>rank[group.availableFromPlan??'B']<=rank[equipmentCatalog.plan_code])
  },[equipmentCatalog])
  const smartSelectedGroup=smartAvailableGroups.find(group=>group.code===smartGroupChoice)
    ?? smartAnalysis?.group
  const currentViewAssets = useMemo(() => assets.filter(a => Boolean(a.deletedAt) === showDeleted && (showDeleted || Boolean(a.archivedAt) === showArchived) && (!a.deletedAt || organizationContexts.find(o=>o.id===organizationId)?.isAdmin)), [assets, showDeleted, showArchived, organizationContexts, organizationId])
  const categories = useMemo(() => [...new Set(currentViewAssets.map(a => a.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [currentViewAssets])
  const locations = useMemo(() => [...new Set(currentViewAssets.map(a => a.location).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [currentViewAssets])
  const visibleAssets = useMemo(() => assets.filter(asset => {
    if (Boolean(asset.deletedAt) !== showDeleted) return false
    if (!organizationContexts.find(o=>o.id===organizationId)?.isAdmin && asset.deletedAt) return false
    if (!showDeleted && Boolean(asset.archivedAt) !== showArchived) return false
    const text = [asset.code, asset.name, asset.category, asset.brand, asset.model, asset.serial, asset.location].join(' ').toLocaleLowerCase('vi')
    return (!query || text.includes(query.toLocaleLowerCase('vi'))) &&
      (categoryFilter === 'Tất cả nhóm' || asset.category === categoryFilter) &&
      (locationFilter === 'Tất cả vị trí' || asset.location === locationFilter) &&
      (statusFilter === 'Tất cả trạng thái' || asset.status === statusFilter)
  }).sort((a,b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name,'vi')
    if (sortBy === 'code') return a.code.localeCompare(b.code,'vi', {numeric:true})
    if (sortBy === 'commissionedAt') return (a.commissionedAt || '').localeCompare(b.commissionedAt || '')
    return b.updatedAt.localeCompare(a.updatedAt)
  }), [assets, query, categoryFilter, locationFilter, statusFilter, sortBy, showArchived, showDeleted, organizationContexts, organizationId])

  const resetFilters = () => { setQuery(''); setCategoryFilter('Tất cả nhóm'); setLocationFilter('Tất cả vị trí'); setStatusFilter('Tất cả trạng thái'); setSortBy('updatedAt') }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const recordAssetHistory = async (before: Asset | undefined, after: Asset, eventType?: AssetHistory['eventType'], summary?: string, eventId?:string) => {
    const labels: Record<string,string> = {name:'Tên thiết bị',category:'Nhóm thiết bị',brand:'Hãng sản xuất',model:'Model',serial:'Số serial',location:'Vị trí lắp đặt',commissionedAt:'Ngày đưa vào sử dụng',power:'Công suất / thông số',cycle:'Chu kỳ bảo trì',cycleStartedAt:'Bắt đầu chu kỳ bảo trì',transferredFromOtherFacility:'Chuyển từ cơ sở khác',status:'Trạng thái',notes:'Ghi chú',archivedAt:'Lưu kho',deletedAt:'Xóa mềm'}
    const fields = Object.keys(labels) as Array<keyof Asset>
    const valueText=(value:unknown)=>value===undefined||value===null||value===''?'—':typeof value==='boolean'?(value?'Có':'Không'):String(value)
    const changes = fields.filter(field => (before?.[field] ?? '') !== (after[field] ?? '')).map(field => ({
      field:String(field),label:labels[String(field)],before:valueText(before?.[field]),after:valueText(after[field])
    }))
    const kind = eventType ?? (!before ? 'created' : before.status !== after.status ? 'status_changed' : 'updated')
    if (before && !changes.length) return
    const entry:AssetHistory={
      id:eventId??uid(),organizationId:organizationId||'local-preview',assetId:after.id,assetCode:after.code,eventType:kind,
      summary:summary ?? (!before?'Thêm thiết bị':kind==='status_changed'?'Thay đổi trạng thái thiết bị':'Cập nhật hồ sơ thiết bị'),
      changes,actorUserId:session?.user.id,actorLabel:profileDisplayName||session?.user.email||'Local Preview',
      occurredAt:now(),syncStatus:localPreview?'synced':'pending'
    }
    await db.assetHistory.put(entry)
    await syncAssetHistoryEntry(entry)
  }
  const syncAssetHistoryEntry = async (entry:AssetHistory) => {
    if(localPreview||!supabase||!navigator.onLine||entry.syncStatus==='synced')return
    try{
      const {error:historyError}=await supabase.rpc('record_cloud_asset_history_event',{
        p_organization_id:organizationId,p_event_id:entry.id,p_asset_code:entry.assetCode,p_event_type:entry.eventType,
        p_summary:entry.summary,p_changes:entry.changes,p_actor_label:entry.actorLabel,p_occurred_at:entry.occurredAt
      })
      if(!historyError)await db.assetHistory.update(entry.id,{syncStatus:'synced'})
    }catch{/* Keep the Local audit event pending; retry after connectivity or migration is ready. */}
  }
  const loadAssetHistory = async (assetId: string, assetCode?:string) => {
    const scope=organizationId||'local-preview'
    const localRows=await db.assetHistory.where('[organizationId+assetId]').equals([scope,assetId]).toArray()
    let merged=localRows
    if(!localPreview&&supabase&&navigator.onLine&&assetCode){
      const {data,error:historyError}=await supabase.rpc('list_cloud_asset_history',{p_organization_id:organizationId,p_asset_code:assetCode,p_limit:150})
      if(!historyError&&Array.isArray(data)){
        const cloudRows=(data as Array<Record<string,unknown>>).map(row=>({
          id:String(row.id),organizationId,assetId,assetCode:String(row.asset_code??assetCode),
          eventType:String(row.event_type) as AssetHistory['eventType'],summary:String(row.summary??''),
          changes:Array.isArray(row.changes)?row.changes as AssetHistory['changes']:[],
          actorUserId:typeof row.actor_user_id==='string'?row.actor_user_id:undefined,
          actorLabel:String(row.actor_label??''),occurredAt:String(row.occurred_at??''),syncStatus:'synced' as const
        }))
        const byId=new Map([...localRows,...cloudRows].map(row=>[row.id,row]))
        merged=[...byId.values()]
      }
    }
    setAssetHistory(merged.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)))
  }
  useEffect(()=>{
    if(localPreview||!supabase||!session?.user.id||!organizationId)return
    let active=true
    const retry=async()=>{
      if(!navigator.onLine||!active)return
      const pending=await db.assetHistory.where('organizationId').equals(organizationId).filter(row=>row.syncStatus==='pending').toArray()
      for(const entry of pending){if(!active)break;try{await syncAssetHistoryEntry(entry)}catch{/* Keep the audit event pending for the next retry. */}}
    }
    void retry()
    window.addEventListener('online',retry)
    return()=>{active=false;window.removeEventListener('online',retry)}
  },[session?.user.id,organizationId,localPreview])

  const assetMutationPayload=(asset:Asset):AssetMutationPayload=>({
    category:asset.category.trim(),name:asset.name.trim(),brand:asset.brand??'',model:asset.model??'',serial:asset.serial??'',location:asset.location??'',
    commissionedAt:asset.commissionedAt||'',power:asset.power??'',cycle:asset.cycle??'',cycleStartedAt:asset.cycleStartedAt||undefined,
    transferredFromOtherFacility:Boolean(asset.transferredFromOtherFacility),status:asset.status,notes:asset.notes??'',archivedAt:asset.archivedAt||undefined,deletedAt:asset.deletedAt||undefined
  })

  const openAssetEditor=async(asset:Asset,statusOverride?:AssetStatus):Promise<boolean>=>{
    if(!localPreview&&!canUpdate){alert('Tài khoản chỉ có quyền xem; không thể chỉnh sửa thiết bị.');return false}
    if(asset.deletedAt){alert('Thiết bị đã bị xóa mềm. Chưa thể chỉnh sửa hồ sơ này.');return false}
    try{
      if(localPreview){setEditing({...asset,...(statusOverride?{status:statusOverride,archivedAt:statusOverride==='Lưu kho'?(asset.archivedAt||now()):undefined}:{}),images:asset.images??[]});setError('');setShowForm(true);return true}
      if(!session||!organizationId||!supabase)throw new Error('Chưa có tổ chức đang hoạt động.')
      const link=await db.assetCloudLinks.get(organizationId+':'+asset.id)
      if(!link){setEditing({...asset,...(statusOverride?{status:statusOverride,archivedAt:statusOverride==='Lưu kho'?(asset.archivedAt||now()):undefined}:{}),images:asset.images??[]});setError('');setShowForm(true);return true}
      if(link.status!=='linked')throw new Error('Liên kết Cloud đang xung đột. Hãy đối chiếu trước khi sửa.')
      const pending=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,asset.id]).filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict').first()
      if(pending)throw new Error('Thiết bị có mutation Cloud chưa được xác nhận. Không mở phiên sửa mới.')
      if(!navigator.onLine)throw new Error('Thiết bị Cloud cần Internet để xác minh quyền sửa.')
      const deviceId=getLocalDeviceId()
      const acquired=await acquireCloudAssetLock(supabase,organizationId,asset.code,deviceId,getDeviceLabel())
      if(!acquired.acquired)throw new Error('Thiết bị đang được sửa bởi '+(acquired.lock.holder_label||'thiết bị khác')+'. Chỉ xem, chưa thể sửa.')
      try{
        const cloudRows=await listCloudAssets(supabase,organizationId)
        const data=cloudRows.find(row=>row.code===link.cloudCode)
        if(!data||data.code!==asset.code)throw new Error('Cloud không khớp mã quản lý của liên kết.')
        if(data.updatedAt!==link.cloudUpdatedAt){await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:now()});throw new Error('Phiên bản Cloud đã đổi. Đã đánh dấu conflict; tải Cloud về và đối chiếu trước khi sửa.')}
        setCloudLease({assetId:asset.code,token:acquired.lease.lock_token,expectedCloudUpdatedAt:data.updatedAt,deviceId,lost:false})
        setEditing({...asset,...(statusOverride?{status:statusOverride,archivedAt:statusOverride==='Lưu kho'?(asset.archivedAt||now()):undefined}:{}),images:asset.images??[]});setError('');setShowForm(true);return true
      }catch(e){await releaseCloudAssetLock(supabase,organizationId,asset.code,acquired.lease.lock_token).catch(()=>false);throw e}
    }catch(e){alert(e instanceof Error?e.message:String(e));return false}
  }

  useEffect(()=>{
    const client=supabase
    if(!cloudLease||cloudLease.lost||!client)return
    const renew=async()=>{
      if(!navigator.onLine){setCloudLease(current=>current?.assetId===cloudLease.assetId?{...current,lost:true}:current);setError('Mất Internet; khóa Cloud không còn được gia hạn. Không lưu hồ sơ.');return}
      try{const ok=await heartbeatCloudAssetLock(client,organizationId,cloudLease.assetId,cloudLease.token);if(!ok){setCloudLease(current=>current?.assetId===cloudLease.assetId?{...current,lost:true}:current);setError('Cloud không xác nhận khóa chỉnh sửa. Không lưu hồ sơ.')}}
      catch(e){setCloudLease(current=>current?.assetId===cloudLease.assetId?{...current,lost:true}:current);setError('Gia hạn khóa thất bại: '+(e instanceof Error?e.message:String(e)))}
    }
    const timer=window.setInterval(()=>void renew(),25000)
    const offline=()=>{setCloudLease(current=>current?.assetId===cloudLease.assetId?{...current,lost:true}:current);setError('Mất Internet; không thể tiếp tục phiên sửa Cloud.')}
    window.addEventListener('offline',offline)
    return()=>{window.clearInterval(timer);window.removeEventListener('offline',offline)}
  },[cloudLease?.assetId,cloudLease?.token,cloudLease?.lost,organizationId])

  const updateSmartDraft=async(patch:Partial<Asset>,afterChange?:()=>void)=>{
    const reservationId=editing?.idReservationId
    if(reservationId&&supabase&&organizationId){
      setReservationReleaseBusy(true)
      try{
        await releaseSmartEquipmentIdReservation(supabase,organizationId,reservationId)
        setEditing(current=>current?{...current,idReservationId:undefined}:current)
        if(editing){
          await db.assetDrafts.delete(editing.id).catch(()=>false)
          setRecoverableDrafts(current=>current.filter(item=>item.id!==editing.id))
        }
      }catch(cause){
        setError('Chưa giải phóng được số thứ tự đang giữ. Kiểm tra kết nối rồi thử lại trước khi đổi thông tin. '+(cause instanceof Error?cause.message:String(cause)))
        return
      }finally{
        setReservationReleaseBusy(false)
      }
    }
    setError('')
    setEditing(current=>current?{...current,...patch,idReservationId:undefined}:current)
    afterChange?.()
  }

  const closeEditor=()=>{
    const draft=editing
    setShowForm(false);setEditing(null);setError('')
    const lease=cloudLease;setCloudLease(null)
    if(lease&&supabase&&!lease.lost)void releaseCloudAssetLock(supabase,organizationId,lease.assetId,lease.token).catch(()=>false)
    // A persisted Local asset keeps its reservation for confirmation retry.
    if(draft?.idReservationId&&supabase&&organizationId){
      const client=supabase
      const orgId=organizationId
      const reservationId=draft.idReservationId
      void db.assets.get(draft.id).then(async existing=>{
        if(!existing)await releaseSmartEquipmentIdReservation(client,orgId,reservationId)
        await db.assetDrafts.delete(draft.id)
        setRecoverableDrafts(current=>current.filter(item=>item.id!==draft.id))
      }).catch(()=>false)
    }
  }

  const resumeAssetDraft=(draft:AssetDraft)=>{
    setEditing({...draft.asset,localScope:organizationId})
    setSmartEquipmentChoice(draft.asset.equipmentTypeCode||'')
    setSmartGroupChoice(draft.asset.groupCodeAtCreation||'')
    setSmartSiteCode(draft.asset.siteCodeAtCreation||'00')
    setError('')
    setShowForm(true)
  }

  const discardAssetDraft=async(draft:AssetDraft)=>{
    if(!localPreview&&!canMutate)return
    try{
      const existing=await db.assets.get(draft.id)
      if(!existing){
        if(!supabase)throw new Error('Cần kết nối Cloud để giải phóng reservation an toàn.')
        await releaseSmartEquipmentIdReservation(supabase,draft.organizationId,draft.reservationId)
      }
      await db.assetDrafts.delete(draft.id)
      setRecoverableDrafts(current=>current.filter(item=>item.id!==draft.id))
      notify('Đã hủy thao tác cấp mã chưa hoàn tất.')
    }catch(cause){
      setError('Chưa thể hủy giữ số trên Cloud. Hãy kiểm tra Internet rồi thử lại. '+(cause instanceof Error?cause.message:String(cause)))
    }
  }

  const saveAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(!localPreview&&!canMutate){setError('Tài khoản chỉ có quyền xem; không thể thay đổi dữ liệu.');return}
    if (!editing || busy) return
    setBusy(true); setError('')
    try {
      const previous = await db.assets.get(editing.id)

      // A Local record saved before a failed reservation confirmation can retry
      // confirmation without reserving a second sequence.
      if(previous?.idReservationId&&previous.idReservationStatus==='reserved'){
        if(!supabase||!organizationId||!navigator.onLine)throw new Error('Thiết bị đã lưu Local; cần Internet để xác nhận lại số thứ tự.')
        if(!previous.idComponentsSnapshot||!previous.equipmentTypeCode)throw new Error('Thiếu snapshot định danh Local; cần Admin kiểm tra trước khi xác nhận.')
        await confirmSmartEquipmentIdReservation(supabase,{
          organizationId,reservationId:previous.idReservationId,assetId:previous.id,equipmentId:previous.code,
          originalName:previous.originalName||previous.name,
          normalizedNameAtCreation:previous.normalizedNameAtCreation||previous.name,
          equipmentTypeCode:previous.equipmentTypeCode,
          components:previous.idComponentsSnapshot
        })
        await db.assets.update(previous.id,{idReservationStatus:'confirmed',updatedAt:now()})
        await loadAssets();setShowForm(false);setEditing(null);notify('Cloud đã xác nhận số thứ tự của thiết bị Local.')
        return
      }

      // New organization assets receive their number from a Cloud reservation,
      // but Local constructs the complete ID and commits the asset first.
      if(!previous&&!localPreview){
        if(!supabase||!organizationId||!session)throw new Error('Cần đăng nhập và chọn tổ chức để cấp mã thiết bị.')
        if(!navigator.onLine)throw new Error('Cần Internet để giữ số thứ tự. Chưa thể cấp mã chính thức khi ngoại tuyến.')

        const reservationId=editing.idReservationId||uid()
        let draftAsset:Asset
        let equipmentCode:string
        let groupCode:string|undefined
        let siteCode:string|undefined
        let standardEquipmentName:string
        let groupNameAtCreation:string|undefined

        // Once a reservation key exists, retry only from its persisted issuance
        // inputs. Do not require the current Catalog/Plan to still expose old fields.
        if(editing.idReservationId&&editing.equipmentTypeCode){
          draftAsset={
            ...editing,localScope,idReservationId:reservationId,
            originalName:editing.originalName||editing.name.trim(),
            normalizedNameAtCreation:editing.normalizedNameAtCreation||editing.name.trim()
          }
          equipmentCode=editing.equipmentTypeCode
          groupCode=draftAsset.groupCodeAtCreation
          siteCode=draftAsset.siteCodeAtCreation
          standardEquipmentName=draftAsset.normalizedNameAtCreation||draftAsset.name
          groupNameAtCreation=draftAsset.category||undefined
        }else{
          if(!equipmentCatalog)throw new Error('Tổ chức chưa được khởi tạo Plan và Catalog Snapshot.')
          if(!smartAnalysis||smartAnalysis.status!=='matched'||!smartAnalysis.canPrepareId||!smartAnalysis.equipmentCode){
            throw new Error(smartAnalysis?.message||'Chưa xác định được loại thiết bị trong Catalog Snapshot.')
          }
          const plan=equipmentCatalog.plan_code
          const selectedGroup=plan==='A'?undefined:smartAvailableGroups.find(group=>group.code===smartGroupChoice)
          if(plan!=='A'&&!selectedGroup)throw new Error('Bạn cần chọn và xác nhận nhóm thiết bị trước khi lưu.')
          if((plan==='C'||plan==='D')&&!editing.commissionedAt)throw new Error('Plan C/D yêu cầu ngày đưa vào sử dụng.')
          equipmentCode=smartAnalysis.equipmentCode
          groupCode=selectedGroup?.code
          siteCode=plan==='C'||plan==='D'?smartSiteCode:undefined
          standardEquipmentName=smartAnalysis.normalizedName||smartAnalysis.matches[0]?.standardName||editing.name.trim()
          groupNameAtCreation=selectedGroup?.name
          draftAsset={
            ...editing,localScope,idReservationId:reservationId,
            originalName:editing.name.trim(),
            normalizedNameAtCreation:standardEquipmentName,
            equipmentTypeCode:equipmentCode,
            groupCodeAtCreation:groupCode,
            siteCodeAtCreation:siteCode,
            category:groupNameAtCreation||'Thiết bị'
          }
        }

        // Persist the draft and idempotency key before calling Cloud. If the
        // response is lost or the browser closes, the same reservation can resume.
        const draftNow=now()
        await db.assetDrafts.put({
          id:draftAsset.id,organizationId,userId:session.user.id,reservationId,
          asset:draftAsset,createdAt:draftNow,updatedAt:draftNow
        })
        setEditing(draftAsset)
        setRecoverableDrafts(current=>[
          ...current.filter(item=>item.id!==draftAsset.id),
          {id:draftAsset.id,organizationId,userId:session.user.id,reservationId,asset:draftAsset,createdAt:draftNow,updatedAt:draftNow}
        ])

        let issuance:SmartEquipmentIssuance
        try{
          issuance=await reserveSmartEquipmentId(supabase,{
            organizationId,reservationId,equipmentCode,groupCode,siteCode,
            commissionedAt:draftAsset.commissionedAt||undefined,
            standardEquipmentName,groupNameAtCreation
          })
        }catch(reservationError){
          // The organization Plan/Catalog may have changed in another session.
          const refreshedCatalog=await loadOrganizationEquipmentCatalog(supabase,organizationId).catch(()=>null)
          if(refreshedCatalog)setEquipmentCatalog(refreshedCatalog)
          throw reservationError
        }
        const value:Asset={
          ...draftAsset,
          localScope,
          code:issuance.equipmentId,
          name:draftAsset.name.trim(),
          category:issuance.components.group_name_at_creation||'Thiết bị',
          originalName:draftAsset.originalName||draftAsset.name.trim(),
          normalizedNameAtCreation:draftAsset.normalizedNameAtCreation||standardEquipmentName,
          equipmentTypeCode:issuance.components.equipment_code,
          groupCodeAtCreation:issuance.components.group_code||undefined,
          siteCodeAtCreation:issuance.components.site_code||undefined,
          idComponentsSnapshot:{...issuance.components,reservation_id:reservationId},
          idReservationId:reservationId,
          idReservationStatus:'reserved',
          createdByLabel:draftAsset.transferredFromOtherFacility?'Chuyển nơi khác tới':(draftAsset.createdByLabel||session.user.email||''),
          createdByUserId:draftAsset.createdByUserId||session.user.id,
          updatedAt:now()
        }
        const duplicate=await db.assets.where('[localScope+code]').equals([localScope,value.code]).first()
        if(duplicate&&duplicate.id!==value.id){
          let released=false
          try{
            await releaseSmartEquipmentIdReservation(supabase,organizationId,reservationId)
            released=true
            setEditing(current=>current?.id===editing.id?{...current,idReservationId:undefined}:current)
          }catch{
            // Keep the reservation and draft key so a later retry can reconcile it.
          }
          if(released){
            await db.assetDrafts.delete(value.id).catch(()=>false)
            setRecoverableDrafts(current=>current.filter(item=>item.id!==value.id))
          }
          throw new Error('Mã vừa được giữ đã tồn tại trong Local. Không lưu hồ sơ; hãy thử lại để nhận số khác.')
        }
        try{
          await db.assets.add(value)
          await recordAssetHistory(undefined,value,'created','Thêm thiết bị mới')
        }catch(localError){
          // Another tab may have committed this same persisted draft first.
          // Reuse that exact Local snapshot; never release its reservation.
          const savedByOtherTab=await db.assets.get(value.id)
          if(savedByOtherTab?.idReservationId===reservationId){
            if(savedByOtherTab.code!==value.code||!savedByOtherTab.idComponentsSnapshot||!savedByOtherTab.equipmentTypeCode){
              throw new Error('Draft đã được lưu ở phiên khác nhưng snapshot định danh không khớp. Không giải phóng reservation; cần Admin kiểm tra.')
            }
            await confirmSmartEquipmentIdReservation(supabase,{
              organizationId,reservationId,assetId:savedByOtherTab.id,equipmentId:savedByOtherTab.code,
              originalName:savedByOtherTab.originalName||savedByOtherTab.name,
              normalizedNameAtCreation:savedByOtherTab.normalizedNameAtCreation||savedByOtherTab.name,
              equipmentTypeCode:savedByOtherTab.equipmentTypeCode,
              components:savedByOtherTab.idComponentsSnapshot
            })
            await db.assets.update(savedByOtherTab.id,{idReservationStatus:'confirmed'})
            await db.assetDrafts.delete(value.id).catch(()=>false)
            setRecoverableDrafts(current=>current.filter(item=>item.id!==value.id))
            await loadAssets();setShowForm(false);setEditing(null)
            notify('Thiết bị đã được lưu và xác nhận từ phiên khác.')
            return
          }
          let released=false
          try{
            await releaseSmartEquipmentIdReservation(supabase,organizationId,reservationId)
            released=true
            setEditing(current=>current?.id===editing.id?{...current,idReservationId:undefined}:current)
          }catch{
            // Keep the reservation and draft key if Cloud could not confirm release.
          }
          if(released){
            await db.assetDrafts.delete(value.id).catch(()=>false)
            setRecoverableDrafts(current=>current.filter(item=>item.id!==value.id))
          }
          throw localError
        }
        // Local now owns the saved record. Draft cleanup must never release its
        // reservation; startup reconciliation can safely remove a stale draft.
        await db.assetDrafts.delete(value.id).catch(()=>false)
        setRecoverableDrafts(current=>current.filter(item=>item.id!==value.id))
        try{
          await confirmSmartEquipmentIdReservation(supabase,{
            organizationId,reservationId,assetId:value.id,equipmentId:value.code,
            originalName:value.originalName||value.name,
            normalizedNameAtCreation:value.normalizedNameAtCreation||value.name,
            equipmentTypeCode:value.equipmentTypeCode||'',
            components:value.idComponentsSnapshot!
          })
          await db.assets.update(value.id,{idReservationStatus:'confirmed'})
          await loadAssets();setShowForm(false);setEditing(null)
          notify('Đã lưu Local và Cloud xác nhận số thứ tự: '+value.code)
        }catch(confirmError){
          await loadAssets()
          setEditing(value)
          throw confirmError
        }
        return
      }

      const link=!localPreview&&organizationId?await db.assetCloudLinks.get(organizationId+':'+editing.id):undefined
      const isAdmin=Boolean(organizationContexts.find(o=>o.id===organizationId)?.isAdmin)
      const value:Asset={
        ...editing,
        localScope,
        createdByLabel:!previous&&editing.transferredFromOtherFacility?'Chuyển nơi khác tới':(editing.createdByLabel||previous?.createdByLabel||session?.user.email||(localPreview?'Chế độ thử nghiệm Local':'')), 
        createdByUserId:editing.createdByUserId||previous?.createdByUserId||session?.user.id,
        code:previous?.code??editing.code.trim().toUpperCase(),
        name:editing.name.trim(),
        category:previous&&!isAdmin?previous.category:editing.category.trim(),
        updatedAt:now()
      }
      if(!value.code||!value.name||!value.category)throw new Error('Cần nhập mã, tên và nhóm thiết bị.')
      const duplicate=await db.assets.where('[localScope+code]').equals([localScope,value.code]).first()
      if(duplicate&&duplicate.id!==value.id)throw new Error('Mã thiết bị đã tồn tại trong phạm vi Local này, kể cả hồ sơ lưu kho.')

      if(link){
        const lease=cloudLease
        if(!lease||lease.assetId!==value.code||lease.lost||!supabase)throw new Error('Không còn khóa Cloud hợp lệ; không lưu.')
        const payload=assetMutationPayload(value)
        const groupChanged=Boolean(previous&&isAdmin&&previous.category!==value.category)
        const groupChangeId=groupChanged?uid():undefined
        const pending=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,value.id]).filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict').first()
        let mutationId:string
        if(pending){
          const pendingPayload=JSON.parse(JSON.stringify(pending.payload)) as Record<string,unknown>
          if(typeof pendingPayload.category!=='string')pendingPayload.category=previous?.category??value.category
          if(pending.status==='conflict'||JSON.stringify(pendingPayload)!==JSON.stringify(payload))throw new Error('Có mutation chưa xác nhận với snapshot khác. Chỉ retry đúng snapshot cũ.')
          mutationId=pending.mutationId
        }else{
          mutationId=uid()
          await db.transaction('rw',[db.assets,db.assetMutations,db.assetGroupChanges],async()=>{
            await db.assets.put(value)
            await db.assetMutations.add({mutationId,organizationId,assetId:value.id,payload,expectedCloudUpdatedAt:lease.expectedCloudUpdatedAt,localUpdatedAt:value.updatedAt,status:'pending',attempts:0,createdAt:now(),updatedAt:now()})
            if(groupChanged)await db.assetGroupChanges.add({
              id:groupChangeId!,organizationId,assetId:value.id,oldCategory:previous!.category,newCategory:value.category,
              changedByUserId:session?.user.id,mutationId,changedAt:value.updatedAt,syncStatus:'pending'
            })
          })
        }
        await db.assetMutations.update(mutationId,{status:'processing',attempts:(pending?.attempts??0)+1,updatedAt:now(),lastError:undefined})
        try{
          const applied=await applyCloudAssetMutation(supabase,organizationId,value,lease.token,mutationId,lease.expectedCloudUpdatedAt,payload)
          await recordAssetHistory(previous,value,undefined,undefined,mutationId)
          const at=now()
          await db.transaction('rw',[db.assetMutations,db.assetCloudLinks,db.assetGroupChanges],async()=>{
            await db.assetMutations.update(mutationId,{status:'applied',appliedAt:at,cloudUpdatedAt:applied.asset.updatedAt,updatedAt:at,lastError:undefined})
            await db.assetCloudLinks.update(link.id,{cloudUpdatedAt:applied.asset.updatedAt,lastSyncedLocalUpdatedAt:value.updatedAt,status:'linked',lastVerifiedAt:at})
            const linkedAudit=groupChangeId
              ? await db.assetGroupChanges.get(groupChangeId)
              : await db.assetGroupChanges.filter(change=>change.mutationId===mutationId&&change.syncStatus==='pending').first()
            if(linkedAudit)await db.assetGroupChanges.update(linkedAudit.id,{syncStatus:'synced'})
          })
          setCloudLease(null);setShowForm(false);setEditing(null);await loadAssets();notify('Cloud xác nhận cập nhật thiết bị.')
          await releaseCloudAssetLock(supabase,organizationId,value.code,lease.token).catch(()=>false)
          return
        }catch(cloudError){
          await db.assetMutations.update(mutationId,{status:'pending',lastError:cloudError instanceof Error?cloudError.message:String(cloudError),updatedAt:now()})
          throw new Error('Local đã lưu snapshot, nhưng Cloud chưa xác nhận. Giữ mutation để retry đúng nội dung. '+(cloudError instanceof Error?cloudError.message:String(cloudError)))
        }
      }

      const groupChanged=Boolean(previous&&isAdmin&&previous.category!==value.category)
      if(groupChanged){
        await db.transaction('rw',[db.assets,db.assetGroupChanges],async()=>{
          await db.assets.put(value)
          await db.assetGroupChanges.add({
            id:uid(),organizationId,assetId:value.id,oldCategory:previous!.category,newCategory:value.category,
            changedByUserId:session?.user.id,changedAt:value.updatedAt,syncStatus:'pending'
          })
        })
      }else{
        await db.assets.put(value)
      }
      await recordAssetHistory(previous,value)
      await loadAssets();setShowForm(false);setEditing(null);notify(groupChanged?'Đã lưu Local và ghi lịch sử đổi nhóm thiết bị.':'Đã lưu hồ sơ thiết bị Local.')
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
    finally{setBusy(false)}
  }

  const addImages = async (files: FileList | null) => {
    if (!editing || !files?.length) return
    setError('')
    try {
      const remaining = 8 - (editing.images?.length || 0)
      if (remaining <= 0) throw new Error('Mỗi thiết bị được lưu tối đa 8 ảnh.')
      const converted = await Promise.all(Array.from(files).slice(0, remaining).map(imageToDataUrl))
      setEditing({ ...editing, images: [...(editing.images || []), ...converted] })
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  const deleteAsset = async (asset: Asset) => {
    if(!currentOrganization?.isAdmin||!session||!supabase||!organizationId){alert('Chỉ Admin mới được xóa thiết bị.');return}
    if(asset.deletedAt)return
    if(!window.confirm('Đánh dấu xóa thiết bị '+asset.code+' – '+asset.name+'? Hồ sơ và lịch sử sẽ được giữ nguyên; thiết bị sẽ đồng bộ trạng thái xóa lên Cloud.'))return
    const link=await db.assetCloudLinks.get(organizationId+':'+asset.id)
    if(!link||link.status!=='linked'){alert('Thiết bị chưa liên kết Cloud hoặc đang xung đột. Hãy đồng bộ/đối chiếu Cloud trước khi xóa.');return}
    if(!navigator.onLine){alert('Cần kết nối Internet để xác thực quyền và đồng bộ xóa thiết bị lên Cloud.');return}
    const pending=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,asset.id]).filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict').first()
    if(pending){alert('Thiết bị đang có mutation chưa được xác nhận. Hãy xử lý mutation trước khi xóa.');return}
    let lease:{token:string;expectedCloudUpdatedAt:string}|null=null
    try{
      const got=await acquireCloudAssetLock(supabase,organizationId,asset.code,getLocalDeviceId(),getDeviceLabel())
      if(!got.acquired)throw new Error('Thiết bị đang được khóa bởi '+got.lock.holder_label+'.')
      lease={token:got.lease.lock_token,expectedCloudUpdatedAt:link.cloudUpdatedAt}
      const cloudRows=await listCloudAssets(supabase,organizationId)
      const cloud=cloudRows.find(row=>row.code===asset.code)
      if(!cloud||cloud.deletedAt||cloud.updatedAt!==link.cloudUpdatedAt){await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:now()});throw new Error('Phiên bản Cloud đã thay đổi hoặc thiết bị không còn hợp lệ. Hãy đồng bộ/đối chiếu trước khi xóa.')}
      const candidate={...asset,deletedAt:now(),updatedAt:now()}
      const payload=assetMutationPayload(candidate);const mutationId=uid()
      await db.transaction('rw',[db.assets,db.assetMutations],async()=>{
        await db.assets.put(candidate)
        await db.assetMutations.add({mutationId,organizationId,assetId:asset.id,payload,expectedCloudUpdatedAt:lease!.expectedCloudUpdatedAt,localUpdatedAt:candidate.updatedAt,status:'pending',attempts:0,createdAt:now(),updatedAt:now()})
      })
      await db.assetMutations.update(mutationId,{status:'processing',attempts:1,updatedAt:now()})
      try{
        const applied=await applyCloudAssetMutation(supabase,organizationId,candidate,lease.token,mutationId,lease.expectedCloudUpdatedAt,payload)
        await recordAssetHistory(asset,candidate,'deleted','Admin đánh dấu xóa mềm thiết bị',mutationId)
        await db.transaction('rw',[db.assetMutations,db.assetCloudLinks],async()=>{
          await db.assetMutations.update(mutationId,{status:'applied',appliedAt:now(),cloudUpdatedAt:applied.asset.updatedAt,updatedAt:now()})
          await db.assetCloudLinks.update(link.id,{cloudUpdatedAt:applied.asset.updatedAt,lastSyncedLocalUpdatedAt:candidate.updatedAt,status:'linked',lastVerifiedAt:now()})
        })
        notify('Đã đánh dấu xóa thiết bị và đồng bộ Cloud.')
      }catch(cloudError){
        await db.assetMutations.update(mutationId,{status:'pending',lastError:cloudError instanceof Error?cloudError.message:String(cloudError),updatedAt:now()})
        throw new Error('Local đã đánh dấu xóa nhưng Cloud chưa xác nhận. Mutation được giữ lại để retry: '+(cloudError instanceof Error?cloudError.message:String(cloudError)))
      }
    }catch(e){alert(e instanceof Error?e.message:String(e))}
    finally{if(lease)await releaseCloudAssetLock(supabase,organizationId,asset.code,lease.token).catch(()=>false);await loadAssets()}
  }

  const archiveAsset = async (asset: Asset) => {
    if(!localPreview&&!canMutate){alert('Tài khoản chỉ có quyền xem; không thể lưu kho thiết bị.');return}
    if (!window.confirm('Đưa thiết bị ' + asset.code + ' – ' + asset.name + ' vào Lưu kho? Hồ sơ sẽ được giữ lại và có thể khôi phục.')) return
    const link=!localPreview&&organizationId?await db.assetCloudLinks.get(organizationId+':'+asset.id):undefined
    if(link){await mutateLinkedArchive(asset,true);return}
    const archived={...asset,archivedAt:now(),status:'Lưu kho' as AssetStatus,updatedAt:now()}
    await db.assets.put(archived);await recordAssetHistory(asset,archived,'archived','Đưa thiết bị vào Lưu kho')
    await loadAssets();notify('Đã đưa thiết bị vào Lưu kho Local.')
  }
  const restoreAsset = async (asset: Asset) => {
    if(!localPreview&&!canMutate){alert('Tài khoản chỉ có quyền xem; không thể khôi phục thiết bị.');return}
    const link=!localPreview&&organizationId?await db.assetCloudLinks.get(organizationId+':'+asset.id):undefined
    if(link){await mutateLinkedArchive(asset,false);return}
    const restored={...asset,archivedAt:undefined,status:asset.status==='Lưu kho'?'Đang hoạt động' as AssetStatus:asset.status,updatedAt:now()}
    await db.assets.put(restored);await recordAssetHistory(asset,restored,'restored','Khôi phục thiết bị khỏi Lưu kho')
    await loadAssets();notify('Đã khôi phục thiết bị Local.')
  }
  const mutateLinkedArchive=async(asset:Asset,archived:boolean)=>{
    if(!supabase||!organizationId||!navigator.onLine){alert('Thiết bị Cloud cần kết nối Internet.');return}
    const link=await db.assetCloudLinks.get(organizationId+':'+asset.id)
    if(!link||link.status!=='linked'){alert('Liên kết Cloud đang xung đột.');return}
    const pending=await db.assetMutations.where('[organizationId+assetId]').equals([organizationId,asset.id]).filter(m=>m.status==='pending'||m.status==='processing'||m.status==='conflict').first()
    if(pending){alert('Có mutation chưa được Cloud xác nhận.');return}
    let lease: {token:string;expectedCloudUpdatedAt:string}|null=null
    try{
      const got=await acquireCloudAssetLock(supabase,organizationId,asset.code,getLocalDeviceId(),getDeviceLabel())
      if(!got.acquired){alert('Thiết bị đang được khóa bởi '+got.lock.holder_label);return}
      lease={token:got.lease.lock_token,expectedCloudUpdatedAt:link.cloudUpdatedAt}
      const cloudRows=await listCloudAssets(supabase,organizationId)
      const data=cloudRows.find(row=>row.code===link.cloudCode)
      if(!data||data.code!==asset.code||data.updatedAt!==link.cloudUpdatedAt){await db.assetCloudLinks.update(link.id,{status:'conflict',lastVerifiedAt:now()});throw new Error('Phiên bản Cloud thay đổi; cần đồng bộ/đối chiếu trước.')}
      const candidate={...asset,archivedAt:archived?now():undefined,status:archived?'Lưu kho' as AssetStatus:(asset.status==='Lưu kho'?'Đang hoạt động' as AssetStatus:asset.status),updatedAt:now()}
      const payload=assetMutationPayload(candidate);const mutationId=uid()
      await db.transaction('rw',[db.assets,db.assetMutations],async()=>{
        await db.assets.put(candidate);await db.assetMutations.add({mutationId,organizationId,assetId:asset.id,payload,expectedCloudUpdatedAt:lease!.expectedCloudUpdatedAt,localUpdatedAt:candidate.updatedAt,status:'pending',attempts:0,createdAt:now(),updatedAt:now()})
      })
      const applied=await applyCloudAssetMutation(supabase,organizationId,candidate,lease.token,mutationId,lease.expectedCloudUpdatedAt,payload)
      await recordAssetHistory(asset,candidate,archived?'archived':'restored',archived?'Đưa thiết bị vào Lưu kho':'Khôi phục thiết bị khỏi Lưu kho',mutationId)
      await db.transaction('rw',[db.assetMutations,db.assetCloudLinks],async()=>{
        await db.assetMutations.update(mutationId,{status:'applied',appliedAt:now(),cloudUpdatedAt:applied.asset.updatedAt,updatedAt:now()})
        await db.assetCloudLinks.update(link.id,{cloudUpdatedAt:applied.asset.updatedAt,lastSyncedLocalUpdatedAt:candidate.updatedAt,status:'linked',lastVerifiedAt:now()})
      })
      notify(archived?'Cloud đã lưu kho thiết bị.':'Cloud đã khôi phục thiết bị.')
    }catch(e){alert(e instanceof Error?e.message:String(e))}
    finally{if(lease)await releaseCloudAssetLock(supabase,organizationId,asset.code,lease.token).catch(()=>false);await loadAssets()}
  }
  const signOut = async () => { if(cloudLease&&supabase&&!cloudLease.lost)await releaseCloudAssetLock(supabase,organizationId,cloudLease.assetId,cloudLease.token).catch(()=>false); await supabase?.auth.signOut(); setSession(null); setLocalPreview(false);setCloudLease(null);setOrganizationContexts([]);setOrganizationId('') }
  const printAsset = (mode: 'sticker' | 'detail') => { setPrintAssetMode(mode); window.setTimeout(() => window.print(), 180) }

  if (!sessionReady) return <div className="loading-screen">Đang kiểm tra phiên đăng nhập…</div>
  if(session&&supabase&&(passwordRecovery||session.user.user_metadata?.must_set_password===true))return <PasswordRecoveryScreen client={supabase} onDone={()=>{setPasswordRecovery(false);setSession(null)}}/>
  if(session&&supabase&&session.user.email?.toLowerCase()==='tuanluongpham1980@gmail.com'&&Boolean(session.user.email_confirmed_at))return <PlatformAdminPanel client={supabase} onClose={()=>{}} fullPage/>
  if (!session && !localPreview) return <AuthScreen client={supabase} errorMessage={error} onLocalPreview={() => setLocalPreview(true)}/>
  if(session&&!organizationReady)return <div className="loading-screen">Đang tải tổ chức và quyền tài khoản…</div>
  if(session&&organizationContexts.length===0)return <main className="auth-page"><section className="auth-card"><h1>Tài khoản chưa được cấp tổ chức</h1><p className="auth-intro">Đăng nhập thành công, nhưng chưa có membership đang hoạt động. Admin cần khởi tạo tổ chức và gán vai trò cho tài khoản này.</p>{error&&<div className="auth-error">{error}</div>}<button className="auth-submit" onClick={()=>void signOut()}>Đăng xuất</button></section></main>

  if(session&&organizationContexts.length>1&&!organizationId)return <main className="auth-page"><section className="auth-card org-chooser-card"><div className="auth-brand"><span><Building2 size={25}/></span><div><b>BAOTRI</b><small>QUẢN LÝ BẢO TRÌ</small></div></div><h1>Chọn tổ chức làm việc</h1><p className="auth-intro">Tài khoản này có quyền truy cập nhiều tổ chức. Hãy chọn doanh nghiệp bạn muốn làm việc.</p><div className="org-choice-list">{organizationContexts.map(org=><button type="button" className="org-choice" key={org.id} onClick={()=>setOrganizationId(org.id)}><span className="org-choice-icon"><Building2 size={19}/></span><span className="org-choice-copy"><b>{org.name}</b><small>Vai trò: {org.roleCodes.join(', ')||'Chưa xác định'}</small></span><span className="org-choice-arrow">›</span></button>)}</div><button className="auth-link" type="button" onClick={()=>void signOut()}>Đăng xuất</button></section></main>

  const currentOrganization=organizationContexts.find(o=>o.id===organizationId)
  const isKtv=Boolean(currentOrganization?.roleCodes.some(code=>['ktv','technician','maintenance_technician'].includes(code.toLowerCase())))
  const canMutate=Boolean(localPreview||currentOrganization?.isAdmin||isKtv)
  const canImport=Boolean(canMutate&&currentOrganization?.permissions.includes('assets.import'))
  const canUpdate=Boolean(canMutate&&currentOrganization?.permissions.includes('assets.update'))
  const canView=Boolean(currentOrganization?.permissions.includes('assets.view'))
  const canCreate=Boolean(canMutate&&currentOrganization?.permissions.includes('assets.create'))
  const canDelete=Boolean(currentOrganization?.isAdmin)
  const canChangeStatus=Boolean(localPreview||(canMutate&&currentOrganization?.permissions.includes('assets.update')))
  const activeAssets = assets.filter(item => !item.archivedAt && !item.deletedAt && item.status !== 'Thanh lý')
  const stoppedCount = assets.filter(item => item.status === 'Ngừng sử dụng' && !item.archivedAt && !item.deletedAt).length
  const repairingCount = assets.filter(item => item.status === 'Đang sửa chữa' && !item.archivedAt && !item.deletedAt).length

  return <div className="app-shell">
    {mobileMenuOpen&&<button type="button" className="mobile-menu-backdrop" aria-label="Đóng menu" onClick={()=>setMobileMenuOpen(false)}/>}
    <aside className={"sidebar"+(mobileMenuOpen?" mobile-open":"")}>
      <button type="button" className="mobile-menu-close" aria-label="Đóng menu" onClick={()=>setMobileMenuOpen(false)}><X size={18}/><span>Đóng menu</span></button>
      <div className="brand"><span className="brand-icon"><Wrench size={21}/></span><div><b>BAOTRI</b><small>QUẢN LÝ BẢO TRÌ</small></div></div>
      <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
      <button className="nav-item active"><LayoutDashboard size={17}/><span>Tổng quan thiết bị</span></button>
      <button className="nav-item"><Building2 size={17}/><span>Danh mục thiết bị</span></button>
      {session&&<div className="sidebar-settings">
        <button className={'nav-item'+(settingsOpen?' active':'')} aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(value=>!value)}><Settings size={17}/><span>Cài đặt</span><span className="nav-chevron">{settingsOpen?'−':'+'}</span></button>
        {settingsOpen&&<div className="sidebar-settings-submenu">
{canMutate&&<button className="nav-subitem" onClick={()=>{setProfilePanel(true);setSettingsOpen(false);setMobileMenuOpen(false)}}><UserRound size={15}/><span>Hồ sơ cá nhân</span></button>}
          {currentOrganization?.isAdmin&&<button className="nav-subitem" onClick={()=>{setMembersPanel(true);setSettingsOpen(false);setMobileMenuOpen(false)}}><UserRound size={15}/><span>Quản lý tài khoản</span></button>}
          {currentOrganization?.isAdmin&&<button className="nav-subitem" onClick={()=>{setOrganizationPlanPanel(true);setSettingsOpen(false);setMobileMenuOpen(false)}}><Building2 size={15}/><span>Gói dịch vụ</span></button>}
          {session.user.email?.toLowerCase()==='tuanluongpham1980@gmail.com'&&Boolean(session.user.email_confirmed_at)&&<button className="nav-subitem" onClick={()=>{setPlatformPanel(true);setSettingsOpen(false);setMobileMenuOpen(false)}}><ShieldCheck size={15}/><span>Quản trị nền tảng</span></button>}
        </div>}
      </div>}
      <div className="sidebar-bottom"><ShieldCheck size={15}/> Dữ liệu thiết bị Local</div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button type="button" className="mobile-menu-toggle" aria-label="Mở menu" aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(true)}><Menu size={20}/></button>
        <div className="page-heading"><div className="eyebrow">QUẢN LÝ TÀI SẢN & THIẾT BỊ</div><h1>Danh mục thiết bị</h1>{cloudSyncMessage&&<div className="auth-note" style={{marginTop:6,fontSize:11}}>{cloudSyncMessage}</div>}{session&&currentOrganization?.name&&<div className="organization-name" title={currentOrganization.name}><Building2 size={13}/><span>{currentOrganization.name}</span></div>}</div>
        <div className="top-actions">{session&&organizationId&&<button className="soft-btn" onClick={()=>setCloudPanel(true)}>Local ↔ Cloud</button>}<span className="sync-status"><i/>Đang lưu Local</span><button type="button" className="profile-chip profile-chip-button" onClick={()=>setProfilePanel(true)} disabled={!canMutate} title="Chỉnh sửa hồ sơ cá nhân"><span className="avatar"><UserRound size={17}/></span><span className="profile-text"><b>{profileDisplayName || session?.user.email || 'Chế độ thử nghiệm Local'}</b><small>{localPreview ? 'Không kết nối Cloud' : (currentOrganization?.roleCodes.join(', ')||'Đã đăng nhập')}</small></span></button><button className="icon-btn" title="Đăng xuất" onClick={signOut}><LogOut size={17}/></button></div>
      </header>
      <div className="content">
        <section className="welcome"><div><div className="eyebrow">BAOTRI MINI · THIẾT BỊ</div><h2>Quản lý thiết bị tập trung</h2><p>Theo dõi hồ sơ, vị trí và tình trạng vận hành thiết bị.</p>{session&&organizationId&&<div className="plan-context-strip">{equipmentCatalogLoading?'Đang tải gói sử dụng…':equipmentCatalog?<><b>Plan {equipmentCatalog.plan_code} · {equipmentCatalog.snapshot.plan?.name||'Gói sử dụng'}</b><span>{equipmentCatalog.snapshot.plan?.maxDevices===null?'Không giới hạn thiết bị':equipmentCatalog.snapshot.plan?.maxDevices?`Tối đa ${equipmentCatalog.snapshot.plan.maxDevices.toLocaleString('vi-VN')} thiết bị`:'Hạn mức theo cấu hình Plan'}</span><span>{equipmentCatalog.snapshot.equipmentGroups.length} nhóm · {equipmentCatalog.snapshot.equipmentDictionary.length} loại chuẩn</span><span>Catalog v{equipmentCatalog.source_data_version}</span></>:equipmentCatalogError?<span>Không tải được Plan: {equipmentCatalogError}</span>:<span>Doanh nghiệp chưa có Plan / Catalog Snapshot. Liên hệ Super Admin để khởi tạo.</span>}</div>}</div><div className="welcome-icon"><Wrench size={42}/></div></section>
        {!showForm&&!localPreview&&recoverableDrafts.length>0&&<div className="panel">
          <div className="panel-head"><div><h2>Thao tác cấp mã chưa hoàn tất</h2><p>Draft được lưu trên thiết bị này để có thể tiếp tục sau khi đóng hoặc tải lại trình duyệt.</p></div></div>
          <div className="asset-toolbar">{canMutate&&recoverableDrafts.map(draft=><div className="draft-recovery-row" key={draft.id}>
            <div><b>{draft.asset.name||draft.asset.originalName||'Thiết bị chưa đặt tên'}</b><small>Reservation {draft.reservationId.slice(0,8)} · {new Date(draft.updatedAt).toLocaleString('vi-VN')}</small></div>
            <div className="top-actions"><button className="primary-btn" onClick={()=>resumeAssetDraft(draft)}>Tiếp tục</button><button className="soft-btn" onClick={()=>void discardAssetDraft(draft)}>Hủy giữ số</button></div>
          </div>)}</div>
        </div>}
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-icon blue"><Building2 size={20}/></div><div><small>Tổng thiết bị đang quản lý</small><strong>{activeAssets.length}</strong><span>Không tính hồ sơ lưu kho / thanh lý</span></div></div>
          <div className="stat-card"><div className="stat-icon orange"><Archive size={20}/></div><div><small>Đã lưu kho</small><strong>{assets.filter(item=>Boolean(item.archivedAt)&&!item.deletedAt).length}</strong><span>Có thể khôi phục</span></div></div>
          <div className="stat-card"><div className="stat-icon purple"><Activity size={20}/></div><div><small>Đang hoạt động</small><strong>{activeAssets.filter(item=>item.status==='Đang hoạt động').length}</strong><span>Thiết bị sẵn sàng</span></div></div>
          <div className="stat-card"><div className="stat-icon red"><SlidersHorizontal size={20}/></div><div><small>Đang sửa chữa</small><strong>{repairingCount}</strong><span>{stoppedCount} thiết bị ngừng sử dụng</span></div></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><h2>{showDeleted?'Thiết bị đã xóa':showArchived?'Thiết bị trong Lưu kho':'Danh sách thiết bị'}</h2><p>Tra cứu, phân loại và cập nhật hồ sơ thiết bị tại cơ sở.</p></div><div className="top-actions">{!showArchived&&!showDeleted&&(localPreview||canCreate)&&<button className="primary-btn" onClick={()=>{setEditing({...emptyAsset(),localScope});setSmartEquipmentChoice('');setSmartGroupChoice('');setSmartSiteCode('00');setError('');setShowForm(true)}}><Plus size={16}/> Thêm thiết bị</button>}{!showDeleted&&<button className={showArchived?'soft-btn active':'soft-btn'} onClick={()=>{setShowArchived(v=>!v);resetFilters()}}>{showArchived?'Danh sách đang quản lý':'Mở Lưu kho'}</button>}{canDelete&&<button className={showDeleted?'soft-btn active':'soft-btn'} onClick={()=>{setShowDeleted(v=>!v);setShowArchived(false);resetFilters()}}>{showDeleted?'Quay lại danh sách':'Thiết bị đã xóa'}</button>}</div></div>
          <div className="asset-toolbar asset-toolbar-panel">
            <label className="searchbar asset-searchbar"><Search size={17}/><input aria-label="Tìm kiếm thiết bị" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tìm theo mã quản lý, tên thiết bị, nhóm hoặc vị trí…"/></label>
            <div className="asset-filter-row">
              <label className="asset-filter-field"><span>Nhóm thiết bị</span><select aria-label="Lọc theo nhóm thiết bị" value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option>Tất cả nhóm</option>{categories.map(item=><option key={item}>{item}</option>)}</select></label>
              <label className="asset-filter-field"><span>Vị trí</span><select aria-label="Lọc theo vị trí" value={locationFilter} onChange={event=>setLocationFilter(event.target.value)}><option>Tất cả vị trí</option>{locations.map(item=><option key={item}>{item}</option>)}</select></label>
              <label className="asset-filter-field"><span>Trạng thái</span><select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option>Tất cả trạng thái</option>{STATUSES.map(item=><option key={item}>{item}</option>)}</select></label>
              <label className="asset-filter-field"><span>Sắp xếp</span><select aria-label="Sắp xếp danh sách thiết bị" value={sortBy} onChange={event=>setSortBy(event.target.value)}><option value="updatedAt">Mới cập nhật</option><option value="code">Theo mã thiết bị</option><option value="name">Theo tên thiết bị</option><option value="commissionedAt">Ngày đưa vào sử dụng</option></select></label>
              <button type="button" className="soft-btn asset-reset-btn" onClick={resetFilters}><RotateCcw size={14}/> Đặt lại</button>
            </div>
          </div>
          <div className="table-wrap table-standard-wrap"><table className="table-standard"><thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
            {visibleAssets.length===0&&<tr><td colSpan={6}><div className="table-empty-state">{query.trim()||categoryFilter!=='Tất cả nhóm'||locationFilter!=='Tất cả vị trí'||statusFilter!=='Tất cả trạng thái'?'Không tìm thấy thiết bị phù hợp với điều kiện lọc.':showDeleted?'Chưa có thiết bị nào trong danh sách đã xóa.':showArchived?'Chưa có thiết bị nào trong Lưu kho.':'Chưa có thiết bị trong danh sách quản lý.'}</div></td></tr>}
            {visibleAssets.map(asset=><tr key={asset.id} className={asset.deletedAt?'asset-deleted-row':''}>
              <td><button className="asset-title-btn" onClick={()=>{setDetailAsset(asset);setSelectedAssetStatus(asset.archivedAt?'Lưu kho':asset.status);setStatusPickerOpen(false);void loadAssetHistory(asset.id,asset.code)}}><b>{asset.code}</b><small>{displayAssetName(asset)}</small></button></td>
              <td>{asset.category}</td><td>{asset.location||'—'}</td><td>{dateText(asset.commissionedAt)}</td>
              <td><span className={'status '+(asset.deletedAt?'red':asset.archivedAt?'gray':asset.status==='Đang hoạt động'?'green':asset.status==='Đang sửa chữa'?'orange':asset.status==='Thanh lý'?'red':'gray')}>{asset.deletedAt?'ĐÃ XÓA':asset.archivedAt?'Đã lưu kho':asset.status}</span></td>
              <td className="actions">{showDeleted?null:showArchived ? ((localPreview||canUpdate) ? <button className="text-btn success-text" onClick={()=>void restoreAsset(asset)}><RotateCcw size={13}/> Khôi phục</button> : null) : <>{(localPreview||canUpdate)&&<button className="text-btn" onClick={()=>void openAssetEditor(asset)}>Sửa</button>}{(localPreview||canUpdate)&&<button className="text-btn danger" onClick={()=>void archiveAsset(asset)} title="Đưa hồ sơ vào lưu kho"><Archive size={14}/> Lưu kho</button>}{canDelete&&!asset.deletedAt&&<button className="text-btn danger" onClick={()=>void deleteAsset(asset)} title="Đánh dấu xóa mềm"><Trash2 size={14}/> Xóa</button>}</>}</td>
            </tr>)}
          </tbody></table></div>
        </div>
        <div className="footnote"><ShieldCheck size={15}/> Thiết bị Local thuộc phạm vi tổ chức hiện chọn. Dùng Local ↔ Cloud để nhập hoặc tải hồ sơ có kiểm soát. Ảnh chưa đồng bộ Cloud.</div>
      </div>
    </main>
    {showForm&&editing&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy&&!reservationReleaseBusy)closeEditor()}}><section className="modal"><div className="modal-head"><div><h2>{assets.some(item=>item.id===editing.id)?'Cập nhật thiết bị':'Thêm thiết bị mới'}</h2><p>Nhập thông tin hồ sơ thiết bị.</p></div><button className="icon-btn" onClick={closeEditor} disabled={busy||reservationReleaseBusy}><X size={17}/></button></div>
      <form className="form-grid" onSubmit={saveAsset}>
        {isNewSmartAsset ? <>
          <label className="field full-field">Tên thiết bị *<input required disabled={reservationReleaseBusy} value={editing.name} onChange={event=>{
            void updateSmartDraft({name:event.target.value},()=>{setSmartEquipmentChoice('');setSmartGroupChoice('')})
          }} placeholder="Ví dụ: Máy bơm nước làm mát"/></label>
          {equipmentCatalogLoading&&<div className="field full-field muted">Đang tải danh mục thiết bị của tổ chức…</div>}
          {equipmentCatalogError&&<div className="auth-error full-field">{equipmentCatalogError}</div>}
          {!equipmentCatalogLoading&&!equipmentCatalog&&<div className="auth-error full-field">Tổ chức chưa được khởi tạo Plan và Catalog Snapshot. Chưa thể cấp mã thiết bị.</div>}
          {equipmentCatalog&&<>
            <div className="field full-field"><span>Smart Equipment ID · Plan {equipmentCatalog.plan_code}</span><small>Hệ thống phân tích tên theo Snapshot riêng của tổ chức. Số thứ tự chỉ được giữ khi bạn lưu hồ sơ.</small></div>
            {smartAnalysis?.status==='ambiguous'&&<label className="field full-field">Chọn loại thiết bị *<select required value={smartEquipmentChoice} onChange={event=>{const value=event.target.value;void updateSmartDraft({},()=>setSmartEquipmentChoice(value))}}><option value="">-- Chọn loại phù hợp --</option>{smartAnalysis.matches.map(match=><option key={match.shortCode} value={match.shortCode}>{match.standardName} · {match.shortCode}</option>)}</select></label>}
            {smartAnalysis?.status==='matched'&&<div className="field full-field"><span>Loại chuẩn đề xuất</span><b>{smartAnalysis.normalizedName} · {smartAnalysis.equipmentCode}</b></div>}
            {smartAnalysis&&smartAnalysis.status!=='matched'&&smartAnalysis.status!=='ambiguous'&&<div className="auth-error full-field">{smartAnalysis.message}</div>}
            {equipmentCatalog.plan_code!=='A'&&<label className="field">Nhóm thiết bị *<select required disabled={reservationReleaseBusy} value={smartGroupChoice} onChange={event=>{
              const value=event.target.value
              void updateSmartDraft({},()=>setSmartGroupChoice(value))
            }}><option value="">-- Chọn / xác nhận nhóm --</option>{smartAvailableGroups.map(group=><option key={group.code} value={group.code}>{group.name} · {group.code}</option>)}</select>{smartAnalysis?.group&&<small>Gợi ý từ điển: {smartAnalysis.group.name}. Hãy chọn nhóm trong danh sách để xác nhận.</small>}</label>}
            {equipmentCatalog.plan_code==='A'&&<div className="field"><span>Nhóm thiết bị</span><b>Không áp dụng trong Plan A</b></div>}
            {(equipmentCatalog.plan_code==='C'||equipmentCatalog.plan_code==='D')&&<label className="field">Mã cơ sở (2 chữ số) *<input required inputMode="numeric" maxLength={2} pattern="[0-9]{2}" value={smartSiteCode} disabled={reservationReleaseBusy} onChange={event=>{
              const value=event.target.value
              void updateSmartDraft({},()=>setSmartSiteCode(value))
            }}/></label>}
            <div className="field full-field"><span>Mã quản lý dự kiến</span><b>{smartAnalysis?.status==='matched'?'Sẽ được Local ghép sau khi giữ số thứ tự':'Chờ xác nhận loại và nhóm thiết bị'}</b><small>Cloud chỉ cấp số thứ tự; mã hoàn chỉnh được tạo và lưu tại Local.</small></div>
          </>}
        </> : <>
          <label className="field">Mã quản lý thiết bị *<input required disabled={Boolean(assets.some(item=>item.id===editing.id))} value={editing.code} onChange={event=>setEditing({...editing,code:event.target.value})} placeholder="Nhập mã quản lý"/></label>
          <label className="field">Tên thiết bị *<input required value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})} placeholder="Tên thiết bị"/></label>
          <label className="field">Nhóm thiết bị *<select required disabled={Boolean(assets.some(item=>item.id===editing.id))&&!currentOrganization?.isAdmin} value={editing.category} onChange={event=>setEditing({...editing,category:event.target.value})}><option value="">-- Chọn nhóm thiết bị --</option>{ASSET_CATEGORY_GROUPS.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(item=><option key={item} value={item}>{item}</option>)}</optgroup>)}{editing.category&&!ASSET_CATEGORY_GROUPS.some(group=>group.items.some(item=>item===editing.category))&&<option value={editing.category}>{editing.category} · danh mục cũ</option>}</select></label>
        </>}
        <label className="field">Vị trí lắp đặt<input value={editing.location} onChange={event=>setEditing({...editing,location:event.target.value})} placeholder="Tầng / khu vực"/></label>
        <label className="field">Hãng sản xuất<input value={editing.brand} onChange={event=>setEditing({...editing,brand:event.target.value})}/></label>
        <label className="field">Model<input value={editing.model} onChange={event=>setEditing({...editing,model:event.target.value})}/></label>
        <label className="field">Số serial<input value={editing.serial} onChange={event=>setEditing({...editing,serial:event.target.value})}/></label>
        <label className="field">Công suất / thông số<input value={editing.power} onChange={event=>setEditing({...editing,power:event.target.value})}/></label>
        <label className="field">Ngày đưa vào sử dụng{isNewSmartAsset&&equipmentCatalog&&(equipmentCatalog.plan_code==='C'||equipmentCatalog.plan_code==='D')?' *':''}<input type="date" required={Boolean(isNewSmartAsset&&equipmentCatalog&&(equipmentCatalog.plan_code==='C'||equipmentCatalog.plan_code==='D'))} value={editing.commissionedAt} disabled={reservationReleaseBusy} onChange={event=>{
          const value=event.target.value
          void updateSmartDraft({commissionedAt:value})
        }}/></label>
        <label className="field">Chu kỳ bảo trì<select value={editing.cycle} onChange={event=>setEditing({...editing,cycle:event.target.value})}><option value="">Chưa thiết lập</option>{ASSET_CYCLES.map(item=><option key={item} value={item}>{item}</option>)}{editing.cycle&&!ASSET_CYCLES.includes(editing.cycle as typeof ASSET_CYCLES[number])&&<option value={editing.cycle}>{editing.cycle} · giá trị cũ</option>}</select></label>
        <label className="field">Trạng thái<select value={editing.archivedAt?'Lưu kho':editing.status} onChange={event=>setEditing({...editing,status:event.target.value as AssetStatus,archivedAt:event.target.value==='Lưu kho'?(editing.archivedAt||now()):undefined})}>{STATUSES.map(item=><option key={item}>{item}</option>)}</select></label>
        {isNewAssetDraft?<label className="field full-field"><span><input type="checkbox" checked={editing.transferredFromOtherFacility} onChange={event=>setEditing({...editing,transferredFromOtherFacility:event.target.checked,createdByLabel:event.target.checked?'Chuyển nơi khác tới':undefined})}/> Thiết bị được chuyển từ cơ sở khác đến</span><small>Khi chọn, tên thiết bị sẽ hiển thị thêm dấu * và trường Người thêm ghi “Chuyển nơi khác tới”. Mã quản lý vẫn sinh theo quy tắc bình thường.</small></label>:editing.transferredFromOtherFacility?<div className="field full-field muted">* Thiết bị được chuyển từ cơ sở khác đến</div>:null}
        <label className="field full-field">Ghi chú<textarea rows={3} value={editing.notes} onChange={event=>setEditing({...editing,notes:event.target.value})}/></label>
        <div className="field full-field"><span>Ảnh thiết bị ({editing.images?.length || 0}/8)</span><label className="image-upload-btn"><ImagePlus size={16}/> Thêm ảnh<input type="file" accept="image/*" multiple disabled={(editing.images?.length || 0)>=8} onChange={event=>{void addImages(event.target.files);event.target.value=''}}/></label><div className="asset-image-grid">{(editing.images || []).map((src,index)=><div className="asset-image-item" key={index}><button type="button" className="asset-image-open" title="Xem ảnh phóng to" onClick={()=>setImageViewer({images:editing.images || [],index})}><img src={src} alt={'Ảnh thiết bị '+(index+1)}/></button><button type="button" className="asset-image-remove" title="Xóa ảnh" onClick={()=>setEditing({...editing,images:editing.images.filter((_,i)=>i!==index)})}>×</button></div>)}</div><small>Ảnh được thu nhỏ và lưu trong trình duyệt hiện tại; chưa đồng bộ Cloud.</small></div>
        {error&&<div className="auth-error full-field">{error}</div>}
        <div className="modal-actions"><button type="button" className="soft-btn" onClick={closeEditor} disabled={busy||reservationReleaseBusy}>Hủy</button><button type="submit" className="primary-btn" disabled={busy||reservationReleaseBusy||(cloudLease?.assetId===editing.id&&cloudLease.lost)}>{busy?'Đang lưu…':<><Check size={15}/> Lưu thiết bị</>}</button></div>
      </form>
    </section></div>}
    {organizationPlanPanel&&session&&supabase&&organizationId&&currentOrganization?.isAdmin&&<OrganizationPlanPanel client={supabase} organizationId={organizationId} onCatalogLoaded={setEquipmentCatalog} onClose={()=>setOrganizationPlanPanel(false)}/>}
    {profilePanel&&session&&supabase&&canMutate&&<AccountProfilePanel client={supabase} onClose={()=>{setProfilePanel(false);if(session?.user.id&&supabase)void supabase.from('profiles').select('display_name').eq('id',session.user.id).maybeSingle().then(({data})=>setProfileDisplayName(data?.display_name?.trim()||String(session.user.user_metadata?.full_name||'').trim()))}}/>}
    
    {membersPanel&&session&&supabase&&organizationId&&currentOrganization?.isAdmin&&<OrganizationMembersPanel client={supabase} organizationId={organizationId} onClose={()=>setMembersPanel(false)}/>}
    {cloudPanel&&session&&supabase&&organizationId&&<CloudAssetsPanel client={supabase} organizationId={organizationId} localAssets={assets} localPreviewAssets={localPreviewAssets} canImport={canImport} canView={canView} canUpdate={canUpdate} onClose={()=>setCloudPanel(false)} onChanged={()=>{void loadAssets();void db.assets.where('localScope').equals('local-preview').toArray().then(setLocalPreviewAssets)}}/>}
    {detailAsset&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setDetailAsset(null)}}><section className="modal detail-modal"><div className="modal-head"><div><div className="eyebrow">HỒ SƠ THIẾT BỊ</div><h2>{displayAssetName(detailAsset)}</h2><p>{detailAsset.code} · {detailAsset.category}</p></div><button className="icon-btn" onClick={()=>setDetailAsset(null)}><X size={17}/></button></div>
      <div className="detail-status-row"><span className={'status '+(detailAsset.deletedAt?'red':detailAsset.archivedAt?'gray':detailAsset.status==='Đang hoạt động'?'green':detailAsset.status==='Đang sửa chữa'?'orange':detailAsset.status==='Thanh lý'?'red':'gray')}>{detailAsset.deletedAt?'ĐÃ XÓA':detailAsset.archivedAt?'Lưu kho':detailAsset.status}</span><span className="muted">Cập nhật: {dateText(detailAsset.updatedAt.slice(0,10))}</span>{canChangeStatus&&!detailAsset.deletedAt&&<button type="button" className="soft-btn" onClick={()=>setStatusPickerOpen(value=>!value)}>Thay đổi trạng thái</button>}</div>
      {statusPickerOpen&&detailAsset&&canChangeStatus&&<div className="asset-status-editor"><label className="field">Trạng thái mới<select value={selectedAssetStatus} onChange={event=>setSelectedAssetStatus(event.target.value as AssetStatus)}>{STATUSES.map(item=><option key={item} value={item}>{item}</option>)}</select></label><button type="button" className="primary-btn" onClick={async()=>{const selected=detailAsset;const next=selectedAssetStatus;const opened=await openAssetEditor(selected,next);if(opened){setDetailAsset(null);setStatusPickerOpen(false)}}}>Tiếp tục cập nhật</button><small>Hệ thống mở phiên chỉnh sửa có khóa để lưu trạng thái và ghi lịch sử.</small></div>}
      <div className="detail-grid">{[['Mã quản lý',detailAsset.code],['Người thêm',detailAsset.createdByLabel || ''],['Nhóm thiết bị',detailAsset.category],['Vị trí lắp đặt',detailAsset.location],['Hãng sản xuất',detailAsset.brand],['Model',detailAsset.model],['Số serial',detailAsset.serial],['Công suất / thông số',detailAsset.power],['Ngày đưa vào sử dụng',dateText(detailAsset.commissionedAt)],['Chu kỳ bảo trì',detailAsset.cycle],['Chuyển từ cơ sở khác',detailAsset.transferredFromOtherFacility?'Có':'Không'],['Ngày lưu kho',detailAsset.archivedAt?dateText(detailAsset.archivedAt.slice(0,10)):'—']].map(([label,value])=><div className="detail-field" key={label}><small>{label}</small><b>{value || '—'}</b></div>)}</div>
      <div className="detail-notes"><small>Ghi chú</small><p>{detailAsset.notes || 'Chưa có ghi chú.'}</p></div>
      <div className="detail-photos"><h3>Hình ảnh thiết bị ({detailAsset.images?.length || 0})</h3>{detailAsset.images?.length?<div className="detail-photo-grid">{detailAsset.images.map((src,index)=><button type="button" className="detail-photo-open" key={index} title="Xem ảnh phóng to" onClick={()=>setImageViewer({images:detailAsset.images || [],index})}><img src={src} alt={'Ảnh thiết bị '+(index+1)}/></button>)}</div>:<p className="muted">{detailAsset.deletedAt?'Thiết bị đã xóa; không thể bổ sung ảnh.':'Chưa có hình ảnh. Chọn Sửa để bổ sung ảnh.'}</p>}</div>
      <div className="asset-qr-panel"><div><small>MÃ QR THIẾT BỊ</small><b>{detailAsset.code || 'Chưa có mã quản lý'}</b><span>QR hiện mã hóa trực tiếp mã quản lý thiết bị</span></div>{detailAsset.code&&<QRCodeSVG value={detailAsset.code} size={104} level="M" includeMargin/>}</div>
      <div className="asset-photo-actions"><button className="soft-btn" disabled={!detailAsset.code} onClick={()=>printAsset('sticker')}>In tem QR</button><button className="soft-btn" onClick={()=>printAsset('detail')}>In chi tiết</button></div>
      <div className="modal-actions"><button className="soft-btn" onClick={()=>setDetailAsset(null)}>Đóng</button>{!detailAsset.deletedAt&&(localPreview||canUpdate)&&<button className="primary-btn" onClick={()=>{const selected=detailAsset;setDetailAsset(null);void openAssetEditor(selected)}}>Chỉnh sửa hồ sơ</button>}</div>
    </section></div>}
    {printAssetMode&&detailAsset&&<div className={'asset-print-sheet print-'+printAssetMode}>
      {printAssetMode==='sticker'&&<div className="asset-sticker"><QRCodeSVG value={detailAsset.code} size={78} level="M"/><strong>{detailAsset.code}</strong></div>}
      {printAssetMode==='detail'&&<div className="asset-print-report"><h1 className="asset-print-form-title">BẢNG CHI TIẾT THIẾT BỊ</h1><div className="asset-print-header"><div className="company-logo-placeholder"><span className="company-logo-mark">BT</span><span className="company-logo-wording"><strong>BAOTRI</strong><small>LOGO THỬ NGHIỆM</small></span></div><QRCodeSVG className="asset-print-header-qr" value={detailAsset.code} size={104} level="M"/></div><h2 className="asset-print-device-name">{displayAssetName(detailAsset)}</h2><table><tbody>{[['Mã quản lý',detailAsset.code],['Tên thiết bị',displayAssetName(detailAsset)],['Nhóm thiết bị',detailAsset.category],['Vị trí lắp đặt',detailAsset.location],['Hãng sản xuất',detailAsset.brand],['Model',detailAsset.model],['Số serial',detailAsset.serial],['Công suất / thông số',detailAsset.power],['Ngày đưa vào sử dụng',dateText(detailAsset.commissionedAt)],['Chu kỳ bảo trì',detailAsset.cycle],['Trạng thái',detailAsset.archivedAt?'Đã lưu kho':detailAsset.status],['Ghi chú',detailAsset.notes]].map(([label,value])=><tr key={label}><th>{label}</th><td>{value||'—'}</td></tr>)}</tbody></table></div>}
    </div>}
    {imageViewer&&<ImageLightbox images={imageViewer.images} initialIndex={imageViewer.index} onClose={()=>setImageViewer(null)} title="Ảnh thiết bị"/>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}
