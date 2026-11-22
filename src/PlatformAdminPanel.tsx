import {useCallback,useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import { isPcPlatform } from './lib/platform'

type Props={client:SupabaseClient;onClose:()=>void}
type PlanCode='A'|'B'|'C'|'D'
type PlanOption={id:PlanCode;name:string;maxDevices:number|null;features:{equipmentGroups:boolean;multipleSites:boolean};idRule:string}
type PlanCatalogConfig={dataVersion:string;plans:PlanOption[];industries:{plan?:PlanCode}[];equipmentGroups:{availableFromPlan?:PlanCode}[];equipmentDictionary:unknown[]}
type Created={organizationId:string;organizationName:string;adminEmail:string;status:string;createdAuthUser:boolean;planCode:string;planName:string;maxDevices:number|null;sourceDataVersion:string;equipmentGroups:number;equipmentDictionary:number;industries:number;message:string}
type OrganizationRow={id:string;name:string;status:string;createdAt:string;totalMembers:number;activeMembers:number;invitedMembers:number;suspendedMembers:number;uniqueUsers:number;planCode:string|null;planName:string|null;planMaxDevices?:number|null;equipmentGroups?:number;equipmentDictionary?:number;industries?:number;sourceDataVersion:string|null}
type Overview={organizationsTotal:number;organizationsActive:number;organizationsSuspended:number;authAccountsTotal:number;confirmedAccounts:number;unconfirmedAccounts:number;membershipsTotal:number;activeMemberships:number;invitedMemberships:number;suspendedMemberships:number;organizations:OrganizationRow[]}
type LifecycleAction='suspend'|'reactivate'|'delete'

const number=(value:number)=>new Intl.NumberFormat('vi-VN').format(value)
const date=(value:string)=>value?new Date(value).toLocaleDateString('vi-VN'):'—'
const planRank:Record<PlanCode,number>={A:1,B:2,C:3,D:4}

const PROVISION_DRAFT_KEY='baotri-platform-provision-draft-v1'
const readProvisionDraft=()=>{
 try{
  const value=JSON.parse(sessionStorage.getItem(PROVISION_DRAFT_KEY)||'null')
  if(!value||typeof value!=='object')return null
  return value as {requestId?:string;organizationName?:string;adminEmail?:string;adminName?:string;planCode?:PlanCode;businessType?:string}
 }catch{return null}
}

export default function PlatformAdminPanel({client,onClose}:Props){
 const [savedProvisionDraft]=useState(readProvisionDraft)
 const [organizationName,setOrganizationName]=useState(savedProvisionDraft?.organizationName??'')
 const [businessType,setBusinessType]=useState(savedProvisionDraft?.businessType??'')
 const [adminEmail,setAdminEmail]=useState(savedProvisionDraft?.adminEmail??'')
 const [adminName,setAdminName]=useState(savedProvisionDraft?.adminName??'')
 const [planCode,setPlanCode]=useState<PlanOption['id']|''>(savedProvisionDraft?.planCode??'')
 const [provisionRequestId,setProvisionRequestId]=useState(savedProvisionDraft?.requestId??'')
 const [registrationStep,setRegistrationStep]=useState(1)
 const [planOptions,setPlanOptions]=useState<PlanOption[]>([])
 const [planCatalog,setPlanCatalog]=useState<PlanCatalogConfig|null>(null)
 const [planLoadError,setPlanLoadError]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [created,setCreated]=useState<Created|null>(null)
 const [overview,setOverview]=useState<Overview|null>(null)
 const [loadingOverview,setLoadingOverview]=useState(true)
 const [overviewError,setOverviewError]=useState('')
 const [management,setManagement]=useState<{organization:OrganizationRow;action:LifecycleAction}|null>(null)
 const [managementPassword,setManagementPassword]=useState('')
 const [managementAnswer,setManagementAnswer]=useState('')
 const [typedOrganizationName,setTypedOrganizationName]=useState('')
 const [managementBusy,setManagementBusy]=useState(false)
 const [managementError,setManagementError]=useState('')
 const [managementSuccess,setManagementSuccess]=useState('')
 useEffect(()=>{
  try{
   if(!provisionRequestId){sessionStorage.removeItem(PROVISION_DRAFT_KEY);return}
   sessionStorage.setItem(PROVISION_DRAFT_KEY,JSON.stringify({
    requestId:provisionRequestId,organizationName,businessType,adminEmail,adminName,planCode
   }))
  }catch{
   // Provisioning remains protected by the in-memory request key for this open panel.
  }
 },[provisionRequestId,organizationName,businessType,adminEmail,adminName,planCode])

 const loadOverview=useCallback(async()=>{
  setLoadingOverview(true);setOverviewError('')
  try{
   const {data,error}=await client.functions.invoke('platform-get-overview',{body:{}})
   if(error)throw new Error(error.message)
   if(data?.error)throw new Error(data.error)
   setOverview(data as Overview)
  }catch(e){setOverviewError(e instanceof Error?e.message:String(e))}
  finally{setLoadingOverview(false)}
 },[client])
 useEffect(()=>{if(isPcPlatform())void loadOverview()},[loadOverview])
 useEffect(()=>{
  let active=true
  fetch(`${import.meta.env.BASE_URL}data/baotri-config.json`)
   .then(async response=>{if(!response.ok)throw new Error('Không tải được danh mục Plan chuẩn.');return response.json()})
   .then(config=>{if(active&&Array.isArray(config.plans)){setPlanCatalog(config as PlanCatalogConfig);setPlanOptions(config.plans as PlanOption[])}})
   .catch(error=>{if(active)setPlanLoadError(error instanceof Error?error.message:String(error))})
  return()=>{active=false}
 },[])
 const selectedPlan=planOptions.find(plan=>plan.id===planCode)
 const selectedPlanStats=selectedPlan&&planCatalog?{
  groups:planCatalog.equipmentGroups.filter(group=>planRank[group.availableFromPlan??'B']<=planRank[selectedPlan.id]).length,
  industries:planCatalog.industries.filter(industry=>planRank[industry.plan??'A']<=planRank[selectedPlan.id]).length,
  dictionary:planCatalog.equipmentDictionary.length
 }:null

 const beginManagement=(organization:OrganizationRow,action:LifecycleAction)=>{
  setManagement({organization,action});setManagementPassword('');setManagementAnswer('');setTypedOrganizationName('');setManagementError('');setManagementSuccess('')
 }
 const cancelManagement=()=>{
  setManagement(null);setManagementPassword('');setManagementAnswer('');setTypedOrganizationName('');setManagementError('')
 }
 const submitManagement=async(e:FormEvent)=>{
  e.preventDefault()
  if(!management||managementBusy)return
  setManagementError('')
  if(managementAnswer==='no'){cancelManagement();return}
  if(managementAnswer!=='yes'){setManagementError('Bạn cần chọn Có để xác nhận thao tác.');return}
  if(!managementPassword){setManagementError('Hãy nhập mật khẩu Super Admin.');return}
  if(management.action==='delete'&&typedOrganizationName!==management.organization.name){setManagementError('Tên tổ chức nhập lại chưa khớp chính xác.');return}
  setManagementBusy(true)
  try{
   const {data,error}=await client.functions.invoke('platform-manage-organization',{body:{
    action:management.action,
    organizationId:management.organization.id,
    organizationName:management.organization.name,
    confirmName:typedOrganizationName,
    password:managementPassword,
    confirmation:managementAnswer
   }})
   if(error)throw new Error(error.message)
   if(data?.error)throw new Error(data.error)
   const label=management.action==='suspend'?'đã tạm ngưng':management.action==='reactivate'?'đã kích hoạt lại':'đã xóa vĩnh viễn'
   setManagementSuccess(`Tổ chức "${management.organization.name}" ${label} thành công.`)
   cancelManagement()
   await loadOverview()
  }catch(e){setManagementError(e instanceof Error?e.message:String(e))}
  finally{setManagementBusy(false)}
 }

 const submit=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setCreated(null)
  const requestId=provisionRequestId||crypto.randomUUID()
  if(!provisionRequestId)setProvisionRequestId(requestId)
  try{
   const {data,error:invokeError}=await client.functions.invoke('platform-create-customer',{body:{requestId,organizationName:organizationName.trim(),adminEmail:adminEmail.trim(),adminName:adminName.trim(),planCode}})
   if(invokeError)throw new Error(invokeError.message)
   if(data?.error)throw new Error(data.error)
   setCreated(data as Created)
   try{sessionStorage.removeItem(PROVISION_DRAFT_KEY)}catch{/* Storage may be disabled; the server request has still succeeded. */}
   setProvisionRequestId('')
   setOrganizationName('');setBusinessType('');setAdminEmail('');setAdminName('');setPlanCode('');setRegistrationStep(1)
   await loadOverview()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 if(!isPcPlatform())return <div className="modal-backdrop"><section className="modal member-modal"><div className="modal-head"><div><div className="eyebrow">GIỚI HẠN NỀN TẢNG</div><h2>Chỉ hỗ trợ trên PC</h2><p>Quản trị nền tảng chỉ sử dụng được trên máy tính để bàn hoặc máy tính xách tay.</p></div><button className="icon-btn" onClick={onClose}>×</button></div><div className="auth-note">Vui lòng sử dụng trình duyệt trên PC để quản trị tổ chức.</div><div className="modal-actions"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button></div></section></div>
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal member-modal platform-admin-modal" style={{width:'min(780px,96vw)',maxHeight:'90vh',overflowY:'auto',padding:'18px 20px'}}>
  <div className="modal-head"><div><div className="eyebrow">CHỦ SỞ HỮU NỀN TẢNG</div><h2>Quản trị nền tảng</h2><p>Theo dõi toàn bộ doanh nghiệp và tài khoản trong BAOTRI Mini.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>

  <style>{`.platform-admin-modal{font-size:13px;line-height:1.45}.platform-admin-modal h2{font-size:21px}.platform-admin-modal h3{font-size:15px}.platform-admin-modal p,.platform-admin-modal small{font-size:12px}.platform-admin-modal .stat-card{padding:12px;gap:10px}.platform-admin-modal .stat-card strong{font-size:21px}.platform-admin-modal .stat-card span{font-size:11px;line-height:1.4}.platform-admin-modal .stat-card small{font-size:11px}.platform-org-table{overflow-x:auto;border:1px solid var(--border,#e5e7eb);border-radius:10px}.platform-org-table table{width:100%;min-width:850px;border-collapse:collapse;font-size:12px}.platform-org-table th{font-size:11px;font-weight:650;white-space:nowrap;background:var(--surface-2,#f8fafc);padding:10px 9px}.platform-org-table td{padding:9px;vertical-align:middle;white-space:nowrap}.platform-org-table td:first-child{white-space:normal;min-width:155px;max-width:220px}.platform-org-table td:first-child b{font-size:12px}.platform-org-table .status{font-size:11px;padding:4px 7px}.platform-org-actions{display:flex;gap:5px;flex-wrap:nowrap}.platform-org-actions button{font-size:11px;padding:6px 9px;min-height:29px;white-space:nowrap}.platform-admin-modal .auth-note{font-size:11px;line-height:1.5;padding:9px 11px}.platform-onboarding-intro{display:grid;gap:14px;padding:16px;border:1px solid var(--border,#dbe1e8);border-radius:12px;background:var(--surface-2,#f8fafc)}.platform-onboarding-kicker,.platform-onboarding-section>span{font-size:10px;font-weight:750;letter-spacing:.09em;color:var(--primary,#2563eb)}.platform-onboarding-intro h4,.platform-onboarding-section h4,.platform-onboarding-review h4,.platform-onboarding-success h4{font-size:16px;margin:5px 0}.platform-onboarding-intro p,.platform-onboarding-section p{font-size:12px;color:var(--muted,#64748b);margin:0;line-height:1.5}.platform-onboarding-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.platform-onboarding-step{display:flex;align-items:center;gap:7px;min-width:0;color:var(--muted,#64748b);font-size:11px}.platform-onboarding-step span{width:25px;height:25px;flex:0 0 25px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--border,#cbd5e1);font-weight:750}.platform-onboarding-step.current{color:var(--primary,#2563eb)}.platform-onboarding-step.current span,.platform-onboarding-step.complete span{background:var(--primary,#2563eb);border-color:var(--primary,#2563eb);color:white}.platform-onboarding-section{padding:4px 0}.platform-onboarding-section h4{margin:4px 0}.platform-plan-card-top{display:flex;align-items:center;justify-content:space-between;width:100%;gap:6px}.platform-plan-selected{font-size:9px;font-weight:700;color:var(--primary,#2563eb)}.platform-plan-summary p{margin:6px 0 0}.platform-onboarding-review{display:grid;gap:9px;padding:13px;border:1px solid var(--border,#dbe1e8);border-radius:10px}.platform-onboarding-review>div{display:flex;justify-content:space-between;gap:14px;font-size:12px}.platform-onboarding-review>div span{color:var(--muted,#64748b)}.platform-onboarding-review>div b{text-align:right;overflow-wrap:anywhere}.platform-onboarding-success{display:flex;gap:12px;padding:14px;border:1px solid rgba(22,163,74,.35);border-radius:11px;background:rgba(22,163,74,.06)}.platform-onboarding-success-icon{width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:grid;place-items:center;background:#16a34a;color:white;font-weight:800}.platform-onboarding-success p{font-size:12px;margin:5px 0;line-height:1.5}@media(max-width:520px){.platform-onboarding-steps{grid-template-columns:1fr;gap:6px}.platform-onboarding-review>div{display:grid;gap:2px}.platform-onboarding-review>div b{text-align:left}}.platform-plan-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.platform-plan-card{display:flex;flex-direction:column;align-items:flex-start;gap:7px;text-align:left;min-width:0;padding:12px;border:1px solid var(--border,#dbe1e8);border-radius:11px;background:var(--surface,#fff);color:var(--text,#172033);cursor:pointer;transition:border-color .15s,background .15s}.platform-plan-card[aria-pressed=true]{border:2px solid var(--primary,#2563eb);padding:11px;background:var(--primary-soft,rgba(37,99,235,.06))}.platform-plan-card:focus-visible{outline:2px solid var(--primary,#2563eb);outline-offset:2px}.platform-plan-card strong{font-size:14px}.platform-plan-card small{font-size:11px;color:var(--muted,#64748b);line-height:1.4}.platform-plan-capacity{font-size:17px;font-weight:750;line-height:1.2}.platform-plan-details{display:flex;flex-wrap:wrap;gap:6px}.platform-plan-details span{font-size:10px;border-radius:20px;padding:3px 7px;background:var(--surface-2,#f1f5f9)}.platform-plan-summary{font-size:11px;line-height:1.5;padding:10px 12px;border:1px solid var(--border,#e5e7eb);border-radius:9px;background:var(--surface-2,#f8fafc)}@media(max-width:760px){.platform-plan-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:440px){.platform-plan-grid{grid-template-columns:1fr}}.platform-action-backdrop{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(2px)}.platform-action-dialog{width:min(490px,96vw);max-height:90vh;overflow-y:auto;background:var(--card,#fff);color:var(--text,#172033);border:1px solid var(--border,#e5e7eb);border-radius:15px;box-shadow:0 22px 70px rgba(0,0,0,.28);padding:20px;font-size:13px}.platform-action-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:15px}.platform-action-kicker{font-size:10px;letter-spacing:.08em;font-weight:700;color:var(--muted,#64748b)}.platform-action-head h3{font-size:18px;margin:5px 0}.platform-action-head p{font-size:13px;font-weight:600;margin:0;overflow-wrap:anywhere}.platform-action-note,.platform-action-danger{font-size:12px;line-height:1.55;padding:11px 12px;border-radius:9px;margin-bottom:15px;background:var(--surface-2,#f1f5f9)}.platform-action-danger{background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.25);color:var(--danger,#b91c1c)}.platform-action-form{display:grid;gap:13px}.platform-action-form .field{font-size:12px;gap:6px}.platform-action-form input:not([type=radio]){font-size:13px;min-height:38px}.platform-confirm-choice{border:1px solid var(--border,#e5e7eb);border-radius:9px;padding:10px 12px;display:flex;gap:16px;flex-wrap:wrap;margin:0}.platform-confirm-choice legend{font-size:12px;font-weight:600;padding:0 4px}.platform-confirm-choice label{font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer}.platform-action-buttons{display:flex;justify-content:flex-end;gap:8px;margin-top:3px}.platform-action-buttons button{min-width:105px;font-size:12px}.platform-action-buttons .danger-btn{background:var(--danger,#b91c1c);color:white;border:0;border-radius:8px;padding:9px 14px;font-weight:600;cursor:pointer}.platform-action-buttons button:disabled{opacity:.55;cursor:not-allowed}`/* Compact, polished customer onboarding */
.platform-admin-modal .platform-create-form{gap:10px;margin-top:10px}
.platform-admin-modal .platform-onboarding-intro{grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:linear-gradient(120deg,var(--surface-2,#f8fafc),var(--surface,#fff))}
.platform-admin-modal .platform-onboarding-intro h4{font-size:15px;margin:3px 0}
.platform-admin-modal .platform-onboarding-intro p{max-width:560px;font-size:11px;line-height:1.4}
.platform-admin-modal .platform-onboarding-steps{gap:6px}
.platform-admin-modal .platform-onboarding-step{gap:6px;font-size:10px;white-space:nowrap}
.platform-admin-modal .platform-onboarding-step span{width:22px;height:22px;flex-basis:22px;font-size:10px}
.platform-admin-modal .platform-onboarding-section{padding:2px 0;display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:baseline}
.platform-admin-modal .platform-onboarding-section>span{grid-row:1/3;font-size:9px;white-space:nowrap}
.platform-admin-modal .platform-onboarding-section h4{font-size:14px;margin:0}
.platform-admin-modal .platform-onboarding-section p{font-size:11px;line-height:1.35}
.platform-admin-modal .platform-create-form .field input{min-height:37px;padding:8px 10px}
.platform-admin-modal .platform-create-form .auth-note{padding:8px 10px;font-size:10px;line-height:1.4}
.platform-admin-modal .platform-plan-grid{gap:7px}
.platform-admin-modal .platform-plan-card{gap:5px;padding:9px 10px;border-radius:9px}
.platform-admin-modal .platform-plan-card[aria-pressed=true]{padding:8px 9px}
.platform-admin-modal .platform-plan-card strong{font-size:13px}
.platform-admin-modal .platform-plan-capacity{font-size:15px}
.platform-admin-modal .platform-plan-card small{font-size:10px;line-height:1.3}
.platform-admin-modal .platform-plan-details{gap:4px}
.platform-admin-modal .platform-plan-details span{font-size:9px;padding:2px 6px}
.platform-admin-modal .platform-plan-summary{padding:8px 10px;font-size:10px;line-height:1.4}
.platform-admin-modal .platform-plan-summary p{font-size:10px;margin:4px 0 0}
.platform-admin-modal .platform-onboarding-review{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 14px;padding:10px 12px}
.platform-admin-modal .platform-onboarding-review h4{grid-column:1/-1;font-size:13px;margin:0 0 2px}
.platform-admin-modal .platform-onboarding-review>div{font-size:11px;align-items:baseline}
.platform-admin-modal .platform-onboarding-review>div span{font-size:10px}
.platform-admin-modal .platform-create-form:has(.platform-onboarding-review)>label.field{grid-column:span 1}
.platform-admin-modal .platform-create-form:has(.platform-onboarding-review)>.platform-onboarding-section,
.platform-admin-modal .platform-create-form:has(.platform-onboarding-review)>.platform-onboarding-review,
.platform-admin-modal .platform-create-form:has(.platform-onboarding-review)>.auth-note,
.platform-admin-modal .platform-create-form:has(.platform-onboarding-review)>.modal-actions{grid-column:1/-1}
.platform-admin-modal .platform-create-form .modal-actions{padding-top:2px}
.platform-admin-modal .platform-create-form .modal-actions button{min-height:35px;padding:8px 12px;font-size:11px}
@media(max-width:760px){
 .platform-admin-modal .platform-onboarding-intro{grid-template-columns:1fr}
 .platform-admin-modal .platform-onboarding-steps{grid-template-columns:repeat(3,minmax(0,1fr))}
 .platform-admin-modal .platform-onboarding-step{white-space:normal}
 .platform-admin-modal .platform-create-form:has(.platform-onboarding-review)>label.field{grid-column:1/-1}
 .platform-admin-modal .platform-onboarding-review{grid-template-columns:1fr 1fr}
}
@media(max-width:480px){
 .platform-admin-modal .platform-onboarding-steps{grid-template-columns:1fr}
 .platform-admin-modal .platform-onboarding-review{grid-template-columns:1fr}
 .platform-admin-modal .platform-onboarding-review h4{grid-column:auto}
}.platform-admin-modal .platform-create-form{gap:8px;margin-top:8px;grid-template-columns:repeat(2,minmax(0,1fr))}
.platform-admin-modal .platform-onboarding-compact{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:12px;padding:8px 12px;margin:0}
.platform-admin-modal .platform-onboarding-compact h4{font-size:14px;margin:0}
.platform-admin-modal .platform-onboarding-compact .platform-onboarding-steps{display:flex;justify-content:flex-end;gap:14px}
.platform-admin-modal .platform-onboarding-compact .platform-onboarding-step{font-size:10px;gap:5px}
.platform-admin-modal .platform-onboarding-compact .platform-onboarding-step span{width:20px;height:20px;flex-basis:20px}
.platform-admin-modal .platform-onboarding-section{padding:0;display:flex;align-items:center;gap:9px}
.platform-admin-modal .platform-onboarding-section h4{font-size:13px;margin:0}
.platform-admin-modal .platform-onboarding-section>span{font-size:9px}
.platform-admin-modal .platform-create-form .field{gap:4px;font-size:11px}
.platform-admin-modal .platform-create-form .field input,.platform-admin-modal .platform-create-form .field select{min-height:34px;padding:6px 9px;font-size:12px}
.platform-admin-modal .platform-create-form .auth-note{padding:7px 9px;font-size:10px;line-height:1.35}
.platform-admin-modal .platform-plan-summary{padding:9px 11px;font-size:11px}
.platform-admin-modal .platform-plan-summary p{font-size:10px;margin:3px 0 0}
.platform-admin-modal .platform-plan-inline{display:block;color:var(--muted,#64748b);font-size:10px;margin-top:2px}
.platform-admin-modal .platform-onboarding-review{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;padding:9px 11px}
.platform-admin-modal .platform-onboarding-review h4{grid-column:1/-1;font-size:12px;margin:0}
.platform-admin-modal .platform-onboarding-review>div{font-size:10px}
.platform-admin-modal .platform-onboarding-review>div span{font-size:10px}
.platform-admin-modal .platform-create-form .modal-actions{padding-top:0}
.platform-admin-modal .platform-create-form .modal-actions button{min-height:33px;padding:7px 11px;font-size:11px}
@media(max-width:620px){.platform-admin-modal .platform-create-form{grid-template-columns:1fr}.platform-admin-modal .platform-onboarding-compact{grid-template-columns:1fr;gap:6px}.platform-admin-modal .platform-onboarding-compact .platform-onboarding-steps{justify-content:space-between}.platform-admin-modal .platform-create-form .field{grid-column:1/-1}}`}</style>
  <div className="panel-head" style={{marginTop:8}}><div><h3>Tổng quan hệ thống</h3><p>Số liệu trực tiếp từ Supabase Auth và cơ sở dữ liệu.</p></div><button type="button" className="soft-btn" onClick={()=>void loadOverview()} disabled={loadingOverview}>{loadingOverview?'Đang tải…':'Làm mới số liệu'}</button></div>
  {overviewError&&<div className="auth-error">{overviewError}</div>}
  {loadingOverview&&!overview&&<div className="auth-note">Đang tải thống kê nền tảng…</div>}
  {overview&&<>
   <div className="stat-grid platform-admin-stats" style={{gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))'}}>
    <div className="stat-card"><div className="stat-icon blue">DN</div><div><small>Tổng doanh nghiệp</small><strong>{number(overview.organizationsTotal)}</strong><span>{number(overview.organizationsActive)} đang hoạt động · {number(overview.organizationsSuspended)} tạm khóa</span></div></div>
    <div className="stat-card"><div className="stat-icon purple">TK</div><div><small>Tài khoản Auth duy nhất</small><strong>{number(overview.authAccountsTotal)}</strong><span>{number(overview.confirmedAccounts)} đã xác nhận · {number(overview.unconfirmedAccounts)} chưa xác nhận</span></div></div>
    <div className="stat-card"><div className="stat-icon orange">TV</div><div><small>Tổng lượt tham gia</small><strong>{number(overview.membershipsTotal)}</strong><span>Không phải số tài khoản duy nhất</span></div></div>
    <div className="stat-card"><div className="stat-icon green">OK</div><div><small>Membership hoạt động</small><strong>{number(overview.activeMemberships)}</strong><span>{number(overview.invitedMemberships)} chờ xác nhận · {number(overview.suspendedMemberships)} tạm ngưng</span></div></div>
   </div>
   <div className="table-wrap platform-org-table" style={{marginTop:14}}><table><thead><tr><th>Doanh nghiệp</th><th>Trạng thái</th><th>Plan / Snapshot</th><th>Tài khoản trong DN</th><th>Đang hoạt động</th><th>Chờ xác nhận</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
    {overview.organizations.map(org=><tr key={org.id}><td><b>{org.name}</b></td><td><span className={'status '+(org.status==='active'?'green':'gray')}>{org.status==='active'?'Đang hoạt động':'Tạm ngưng'}</span></td><td>{org.planCode?<><b>Plan {org.planCode}</b><small style={{display:'block',color:'var(--muted,#64748b)'}}>{org.planName||'Đã gán'} · v{org.sourceDataVersion||'—'}</small><small style={{display:'block',color:'var(--muted,#64748b)'}}>{typeof org.planMaxDevices==='number'?number(org.planMaxDevices)+' thiết bị':org.planMaxDevices===null?'Không giới hạn':'Đang tải hạn mức'} · {typeof org.equipmentGroups==='number'?number(org.equipmentGroups):'—'} nhóm · {typeof org.equipmentDictionary==='number'?number(org.equipmentDictionary):'—'} loại · {typeof org.industries==='number'?number(org.industries):'—'} ngành</small></>:<span className="status gray">Chưa khởi tạo</span>}</td><td>{number(org.uniqueUsers)}</td><td>{number(org.activeMembers)}</td><td>{number(org.invitedMembers)}</td><td>{date(org.createdAt)}</td><td><div className="platform-org-actions">{org.status==='active'?<button type="button" className="soft-btn" onClick={()=>beginManagement(org,'suspend')}>Tạm ngưng</button>:<button type="button" className="soft-btn" onClick={()=>beginManagement(org,'reactivate')}>Kích hoạt</button>}<button type="button" className="soft-btn" style={{color:'var(--danger,#b91c1c)'}} onClick={()=>beginManagement(org,'delete')}>Xóa</button></div></td></tr>)}
    {!overview.organizations.length&&<tr><td colSpan={8}>Chưa có doanh nghiệp nào.</td></tr>}
   </tbody></table></div>
   <div className="auth-note" style={{marginTop:10}}>Tài khoản Auth được đếm duy nhất trên toàn nền tảng. Một tài khoản tham gia nhiều doanh nghiệp chỉ tính một lần ở tổng Auth, nhưng được tính một lượt trong từng doanh nghiệp.</div>
  </>}
  {managementSuccess&&<div className="cloud-message" style={{marginTop:12}}>{managementSuccess}</div>}
  {management&&<div className="platform-action-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!managementBusy)cancelManagement()}}>
   <section className="platform-action-dialog" role="dialog" aria-modal="true" aria-labelledby="platform-action-title">
    <div className="platform-action-head"><div><span className="platform-action-kicker">QUẢN TRỊ TỔ CHỨC</span><h3 id="platform-action-title">{management.action==='suspend'?'Tạm ngưng tổ chức':management.action==='reactivate'?'Kích hoạt tổ chức':'Xóa vĩnh viễn tổ chức'}</h3><p>{management.organization.name}</p></div><button type="button" className="icon-btn" onClick={cancelManagement} disabled={managementBusy} aria-label="Đóng">×</button></div>
    {management.action==='suspend'&&<div className="platform-action-note">Tổ chức sẽ bị chặn truy cập. Dữ liệu Cloud vẫn được giữ nguyên và có thể kích hoạt lại sau.</div>}
    {management.action==='reactivate'&&<div className="platform-action-note">Tổ chức sẽ hoạt động trở lại. Thành viên có quyền truy cập hợp lệ có thể sử dụng Cloud.</div>}
    {management.action==='delete'&&<div className="platform-action-danger"><b>Không thể hoàn tác.</b> Dữ liệu Cloud của tổ chức, thiết bị, thành viên và phân quyền sẽ bị xóa. Tài khoản Auth, hồ sơ cá nhân và bản Local trên thiết bị thành viên không bị xóa.</div>}
    <form className="platform-action-form" onSubmit={submitManagement}>
     {management.action==='delete'&&<label className="field">Nhập chính xác tên tổ chức *<input required value={typedOrganizationName} onChange={e=>setTypedOrganizationName(e.target.value)} placeholder={management.organization.name}/></label>}
     <label className="field">Mật khẩu Super Admin *<input required type="password" autoComplete="current-password" value={managementPassword} onChange={e=>setManagementPassword(e.target.value)} placeholder="Nhập mật khẩu tài khoản Super Admin"/></label>
     <fieldset className="platform-confirm-choice"><legend>Bạn có chắc chắn muốn {management.action==='suspend'?'tạm ngưng':management.action==='reactivate'?'kích hoạt lại':'xóa vĩnh viễn'} tổ chức này?</legend><label><input type="radio" name="platform-confirm" value="yes" checked={managementAnswer==='yes'} onChange={()=>setManagementAnswer('yes')}/> Có, xác nhận</label><label><input type="radio" name="platform-confirm" value="no" checked={managementAnswer==='no'} onChange={()=>setManagementAnswer('no')}/> Không, hủy thao tác</label></fieldset>
     {managementError&&<div className="auth-error">{managementError}</div>}
     <div className="platform-action-buttons"><button type="button" className="soft-btn" onClick={cancelManagement} disabled={managementBusy}>Hủy</button><button type="submit" className={management.action==='delete'?'danger-btn':'primary-btn'} disabled={managementBusy||!managementAnswer}>{managementBusy?'Đang xác thực…':management.action==='delete'?'Xóa tổ chức':management.action==='suspend'?'Tạm ngưng tổ chức':'Kích hoạt tổ chức'}</button></div>
    </form>
   </section>
  </div>}

  <div className="divider" style={{margin:'22px 0',borderTop:'1px solid var(--border,#e5e7eb)'}}/>
  <div className="panel-head"><div><h3>Tạo khách hàng mới</h3><p>Tạo tổ chức riêng và cấp quyền Admin đầu tiên cho khách hàng.</p></div></div>
  <form className="form-grid platform-create-form" onSubmit={submit}>
   <div className="platform-onboarding-intro full-field platform-onboarding-compact">
    <div><span className="platform-onboarding-kicker">KHỞI TẠO DOANH NGHIỆP</span><h4>Thông tin khởi tạo</h4></div>
    <div className="platform-onboarding-steps" aria-label="Tiến trình đăng ký">
     {[['1','Doanh nghiệp'],['2','Gói'],['3','Admin']].map(([n,label])=><div key={n} className={registrationStep===Number(n)?'platform-onboarding-step current':registrationStep>Number(n)?'platform-onboarding-step complete':'platform-onboarding-step'}><span>{registrationStep>Number(n)?'✓':n}</span><b>{label}</b></div>)}
    </div>
   </div>
   {registrationStep===1&&<>
    <div className="platform-onboarding-section full-field"><span>BƯỚC 1 / 3</span><h4>Doanh nghiệp</h4></div>
    <label className="field">Tên doanh nghiệp *<input autoFocus required minLength={2} maxLength={120} value={organizationName} onChange={e=>setOrganizationName(e.target.value)} placeholder="Ví dụ: Công ty ABC"/></label>
    <label className="field">Loại hình hoạt động *<select required value={businessType} onChange={e=>setBusinessType(e.target.value)}><option value="">Chọn lĩnh vực doanh nghiệp</option><option value="Y tế">Y tế · Phòng khám · Bệnh viện</option><option value="Bán lẻ">Cửa hàng tiện lợi · Bán lẻ</option><option value="Ẩm thực">Nhà hàng · Quán ăn · Đồ uống</option><option value="Sản xuất">Công ty sản xuất · Nhà máy</option><option value="Kho vận">Kho hàng · Logistics</option><option value="Văn phòng - dịch vụ">Văn phòng · Dịch vụ</option><option value="Giáo dục">Trường học · Đào tạo</option><option value="Khác">Loại hình khác</option></select></label>
    <div className="auth-note full-field">Loại hình này giúp định hướng danh mục thiết bị và quy tắc mã phù hợp ở bước cấu hình tiếp theo. Việc chọn loại hình hiện chưa tự thay đổi quy tắc sinh mã đang gắn với Plan.</div>
    <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={onClose}>Đóng</button><button type="button" className="primary-btn" disabled={organizationName.trim().length<2||!businessType} onClick={()=>{setError('');setRegistrationStep(2)}}>Tiếp tục: Chọn Plan →</button></div>
   </>}
   {registrationStep===2&&<>
    <div className="platform-onboarding-section full-field"><span>BƯỚC 2 / 3</span><h4>Gói sử dụng</h4></div>
    {planLoadError&&<div className="auth-error full-field">{planLoadError}</div>}
    {!planCatalog&&!planLoadError&&<div className="auth-note full-field">Đang tải danh mục Plan chuẩn…</div>}
    <label className="field full-field">Chọn Plan *<select required value={planCode} onChange={e=>setPlanCode(e.target.value as PlanOption['id']|'')} disabled={!planOptions.length}><option value="">Chọn gói sử dụng</option>{planOptions.map(plan=><option key={plan.id} value={plan.id}>Plan {plan.id} — {plan.name} · {plan.maxDevices===null?'Không giới hạn':number(plan.maxDevices)+' thiết bị'}</option>)}</select></label>
    {selectedPlan&&<div className="platform-plan-summary full-field"><b>Plan {selectedPlan.id} — {selectedPlan.name}</b><span className="platform-plan-inline">{selectedPlan.maxDevices===null?'Không giới hạn thiết bị':number(selectedPlan.maxDevices)+' thiết bị tối đa'} · {selectedPlan.features.equipmentGroups?'Có phân nhóm':'Không phân nhóm'} · {selectedPlan.features.multipleSites?'Nhiều cơ sở':'Một cơ sở'}</span><p>Snapshot v{planCatalog?.dataVersion}: {number(selectedPlanStats?.groups??0)} nhóm · {number(selectedPlanStats?.dictionary??0)} loại · {number(selectedPlanStats?.industries??0)} ngành. Quy tắc mã: {selectedPlan.idRule.replace('PLAN_','Plan ')}.</p></div>}
    <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={()=>setRegistrationStep(1)}>← Quay lại</button><button type="button" className="primary-btn" disabled={!selectedPlan||!!planLoadError} onClick={()=>{setError('');setRegistrationStep(3)}}>Tiếp tục: Admin đầu tiên →</button></div>
   </>}
   {registrationStep===3&&<>
    <div className="platform-onboarding-section full-field"><span>BƯỚC 3 / 3</span><h4>Khai báo Admin đầu tiên</h4><p>Admin là người quản trị doanh nghiệp, quản lý thành viên, phân quyền và thiết bị.</p></div>
    <label className="field">Email Admin đầu tiên *<input autoFocus type="email" required value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@company.com"/></label>
    <label className="field">Tên người đại diện<input maxLength={120} value={adminName} onChange={e=>setAdminName(e.target.value)} placeholder="Họ và tên"/></label>
    <div className="platform-onboarding-review full-field"><h4>Kiểm tra trước khi khởi tạo</h4><div><span>Doanh nghiệp</span><b>{organizationName.trim()}</b></div><div><span>Loại hình</span><b>{businessType||'—'}</b></div><div><span>Gói sử dụng</span><b>Plan {selectedPlan?.id} — {selectedPlan?.name}</b></div><div><span>Hạn mức thiết bị</span><b>{selectedPlan?.maxDevices===null?'Không giới hạn':selectedPlan?number(selectedPlan.maxDevices)+' thiết bị':'—'}</b></div><div><span>Email Admin</span><b>{adminEmail.trim()||'Chưa nhập'}</b></div>{selectedPlanStats&&<div><span>Snapshot v{planCatalog?.dataVersion}</span><b>{selectedPlanStats.groups} nhóm · {selectedPlanStats.dictionary} loại · {selectedPlanStats.industries} ngành</b></div>}</div>
    <div className="auth-note full-field">Nếu email đã có tài khoản BAOTRI, hệ thống sẽ gắn tài khoản đó vào tổ chức mới. Nếu chưa có, hệ thống gửi thư mời để Admin xác nhận email và tự đặt mật khẩu. Không gửi mật khẩu qua biểu mẫu này. Nếu mất kết nối sau khi gửi, giữ nguyên thông tin và bấm lại; hệ thống dùng mã yêu cầu đã lưu để tránh tạo trùng doanh nghiệp.</div>
    {error&&<div className="auth-error full-field">{error}</div>}
    <div className="modal-actions full-field"><button type="button" className="soft-btn" onClick={()=>setRegistrationStep(2)} disabled={busy}>← Quay lại</button><button type="submit" className="primary-btn" disabled={busy||!selectedPlan||!!planLoadError||!adminEmail.trim()}>{busy?'Đang khởi tạo…':'Xác nhận và tạo khách hàng'}</button></div>
   </>}
   {created&&<div className="platform-onboarding-success full-field"><div className="platform-onboarding-success-icon">✓</div><div><h4>Khởi tạo doanh nghiệp thành công</h4><p><b>{created.organizationName}</b> · Plan {created.planCode} — {created.planName}</p><p>Admin: {created.adminEmail} · {created.status}</p><p>Catalog Snapshot v{created.sourceDataVersion}: {number(created.equipmentGroups)} nhóm · {number(created.equipmentDictionary)} loại · {number(created.industries)} ngành.</p><p>Hạn mức: {created.maxDevices===null?'Không giới hạn':number(created.maxDevices)+' thiết bị'}.</p><p>{created.message}</p></div></div>}
  </form>
 </section></div>
}
