import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ChecklistCategoryKey, ChecklistCategorySetting, ChecklistDefinition, ChecklistFrequency,
  ChecklistQuestion, ChecklistRun, ChecklistTask
} from '../db'

type Row = Record<string, any>
type CloudBundle = {
  settings: ChecklistCategorySetting[]
  definitions: ChecklistDefinition[]
  tasks: ChecklistTask[]
  runs: ChecklistRun[]
}

const GRACE_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 1000
const CATEGORY_LABELS: Record<string,string> = {
  infrastructure:'Cơ sở hạ tầng', electrical:'Hệ thống điện', water:'Hệ thống nước',
  fire:'Phòng cháy chữa cháy', equipment:'Thiết bị', custom:'Tùy chỉnh'
}
const asRows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : []
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const atTime = (date: Date, time='09:00') => {
  const result=new Date(date),match=/^(\\d{2}):(\\d{2})$/.exec(time)
  result.setHours(match?Math.min(23,Number(match[1])):9,match?Math.min(59,Number(match[2])):0,0,0)
  return result
}
const addMonths = (anchor: Date, offset: number, time: string) => {
  const value=new Date(anchor.getFullYear(),anchor.getMonth()+offset,1)
  value.setDate(Math.min(anchor.getDate(),new Date(value.getFullYear(),value.getMonth()+1,0).getDate()))
  return atTime(value,time)
}
function occurrenceDates(definition: ChecklistDefinition,end: Date): Date[] {
  const anchor=new Date(definition.scheduleStartedAt||definition.createdAt)
  if(Number.isNaN(anchor.getTime()))return []
  const time=definition.executionTime||'09:00',out:Date[]=[]
  const push=(date:Date)=>{if(date.getTime()>=anchor.getTime()-GRACE_MS&&date<=end)out.push(date)}
  if(definition.frequency==='Hàng ngày'){
    const first=atTime(anchor,time)
    if(first<anchor&&Date.now()-first.getTime()>=GRACE_MS)first.setDate(first.getDate()+1)
    for(const d=new Date(first);d<=end;d.setDate(d.getDate()+1))out.push(new Date(d))
  }else if(definition.frequency==='Hàng tuần'){
    let d=atTime(anchor,time)
    if(d<anchor&&Date.now()-d.getTime()>=GRACE_MS)d.setDate(d.getDate()+7)
    for(;d<=end;d=new Date(d.getTime()+7*86400000))out.push(new Date(d))
  }else if(definition.frequency==='Hàng tháng'){
    for(let i=0;i<=18;i++)push(addMonths(anchor,i,time))
  }else if(definition.frequency==='Hàng quý'){
    for(let i=0;i<=6;i++)push(addMonths(anchor,i*3,time))
  }else if(definition.frequency==='Hàng năm'){
    for(let i=0;i<=2;i++){
      const d=new Date(anchor.getFullYear()+i,anchor.getMonth(),1)
      d.setDate(Math.min(anchor.getDate(),new Date(d.getFullYear(),d.getMonth()+1,0).getDate()))
      push(atTime(d,time))
    }
  }
  return out
}
function mapQuestionRows(value: unknown): ChecklistQuestion[] {
  return asRows(value).map(row=>({
    id:String(row.id||''),label:String(row.label||''),required:row.required!==false
  })).filter(row=>row.id&&row.label)
}
function mapDefinition(row: Row, organizationId: string): ChecklistDefinition {
  if(String(row.organization_id)!==organizationId)throw new Error('Cloud trả mẫu Checklist sai tổ chức.')
  return {
    id:String(row.id),organizationId,title:String(row.title),categoryKey:String(row.category_key) as ChecklistDefinition['categoryKey'],
    targetLabel:String(row.target_label),...(row.target_asset_id?{targetAssetId:String(row.target_asset_id)}:{}),
    frequency:row.frequency as ChecklistFrequency,enabled:Boolean(row.enabled),assignee:String(row.assignee||'Admin'),
    executionTime:String(row.execution_time||'09:00'),questions:mapQuestionRows(row.questions),
    source:row.source as ChecklistDefinition['source'],createdAt:String(row.created_at),updatedAt:String(row.updated_at),
    ...(row.last_completed_at?{lastCompletedAt:String(row.last_completed_at)}:{}),
    ...(row.schedule_started_at?{scheduleStartedAt:String(row.schedule_started_at)}:{})
  }
}
function mapTask(row: Row, organizationId: string, events: Row[], definitions: ChecklistDefinition[]): ChecklistTask {
  if(String(row.organization_id)!==organizationId)throw new Error('Cloud trả lượt Checklist sai tổ chức.')
  const snapshot=row.definition_snapshot&&typeof row.definition_snapshot==='object'?row.definition_snapshot:{}
  const definition=definitions.find(item=>item.id===String(row.definition_id))
  const taskEvents=events.filter(event=>event.task_id===row.id).sort((a,b)=>String(a.occurred_at).localeCompare(String(b.occurred_at)))
  const claimEvents=taskEvents.filter(event=>event.event_type==='Nhận việc')
  const latestClaim=claimEvents[claimEvents.length-1]
  const assignmentEvents=taskEvents.filter(event=>event.event_type!=='Hoàn thành').map(event=>({
    action:String(event.event_type) as 'Nhận việc'|'Trả lại nhóm'|'Hủy thực hiện',
    actor:String(event.actor_label||''),actorUserId:event.actor_user_id?String(event.actor_user_id):undefined,
    at:String(event.occurred_at)
  }))
  return {
    id:String(row.id),organizationId,checklistId:String(row.definition_id),title:String(snapshot.title||definition?.title||''),
    targetLabel:String(snapshot.targetLabel||definition?.targetLabel||''),frequency:(snapshot.frequency||definition?.frequency) as ChecklistFrequency,
    dueAt:String(row.due_at),dueDate:String(row.due_date),executionTime:String(snapshot.executionTime||definition?.executionTime||'09:00'),
    assignee:String(row.assignee||snapshot.assignee||definition?.assignee||'Admin'),...(row.claimed_by_user_id?{claimedByUserId:String(row.claimed_by_user_id)}:{}),
    ...(row.claimed_at?{claimedAt:String(row.claimed_at)}:{}),
    ...(row.status==='Đang thực hiện'&&latestClaim?.actor_label?{claimedBy:String(latestClaim.actor_label)}:{}),
    assignmentEvents,status:row.status as ChecklistTask['status'],
    definitionSnapshot:{
      categoryKey:String(snapshot.categoryKey||definition?.categoryKey||'custom') as ChecklistDefinition['categoryKey'],
      questions:mapQuestionRows(snapshot.questions||definition?.questions)
    },
    ...(row.completed_at?{completedAt:String(row.completed_at)}:{}),...(row.run_id?{runId:String(row.run_id)}:{}),
    createdAt:String(row.created_at),updatedAt:String(row.updated_at)
  }
}
function mapRun(row: Row, organizationId: string, events: Row[]): ChecklistRun {
  if(String(row.organization_id)!==organizationId)throw new Error('Cloud trả lịch sử Checklist sai tổ chức.')
  const answers=asRows(row.answers).map(answer=>({
    questionId:String(answer.questionId||answer.question_id||''),question:String(answer.question||''),
    result:String(answer.result||'Bỏ qua') as ChecklistRun['answers'][number]['result'],note:String(answer.note||'')
  }))
  const taskEvents=events.filter(event=>event.task_id===row.task_id).sort((a,b)=>String(a.occurred_at).localeCompare(String(b.occurred_at)))
  return {
    id:String(row.id),organizationId,checklistId:String(row.definition_id),checklistTitle:String(row.checklist_title),
    categoryLabel:CATEGORY_LABELS[String(row.category_label)]||String(row.category_label),
    targetLabel:String(row.target_label),frequency:row.frequency as ChecklistFrequency,answers,
    outcome:row.outcome as ChecklistRun['outcome'],inspector:String(row.inspector),completedAt:String(row.completed_at),
    repairRequestCreated:Boolean(row.repair_request_created),...(row.no_repair_reason?{noRepairReason:String(row.no_repair_reason)}:{}),
    assignmentHistory:taskEvents.filter(event=>event.event_type!=='Hoàn thành').map(event=>({
      action:String(event.event_type) as 'Nhận việc'|'Trả lại nhóm'|'Hủy thực hiện',
      actor:String(event.actor_label||''),actorUserId:event.actor_user_id?String(event.actor_user_id):undefined,
      at:String(event.occurred_at)
    })),
    checklistSnapshot:mapQuestionRows(row.checklist_snapshot)
  }
}
function assertOnline(): void {
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('Mất Internet. Checklist chỉ hoạt động khi có kết nối Cloud.')
}
async function fetchAllRows(
  client:SupabaseClient,table:string,organizationId:string,orderColumn:string,ascending=true,minimumDueAt?:string
):Promise<Row[]>{
  const rows:Row[]=[]
  for(let offset=0;;offset+=PAGE_SIZE){
    let query=client.from(table as any).select('*').eq('organization_id',organizationId)
    if(minimumDueAt)query=query.gte('due_at',minimumDueAt)
    query=query.order(orderColumn,{ascending}).range(offset,offset+PAGE_SIZE-1)
    const {data,error}=await query
    if(error)throw new Error('Tải '+table+' từ Cloud: '+error.message)
    const batch=asRows(data);rows.push(...batch)
    if(batch.length<PAGE_SIZE)break
  }
  return rows
}
async function checked<T>(promise: PromiseLike<{data:T|null;error:any}>, label: string): Promise<T> {
  const {data,error}=await promise
  if(error)throw new Error(label+': '+error.message)
  if(data==null)throw new Error(label+': Cloud không trả dữ liệu.')
  return data
}

export async function saveChecklistCategorySetting(
  client: SupabaseClient,organizationId: string,userId: string,setting: ChecklistCategorySetting
): Promise<void> {
  assertOnline()
  await checked(client.from('checklist_category_settings').upsert({
    organization_id:organizationId,category_key:setting.categoryKey,enabled:setting.enabled,
    frequency:setting.frequency,execution_time:setting.executionTime||'09:00',assignee:setting.assignee||'Admin',
    updated_by:userId,updated_at:new Date().toISOString()
  },{onConflict:'organization_id,category_key'}).select('id').single(),'Lưu cấu hình nhóm Checklist')
}
export async function saveChecklistDefinition(
  client: SupabaseClient,organizationId: string,definition: ChecklistDefinition
): Promise<ChecklistDefinition> {
  assertOnline()
  const payload={
    title:definition.title,target_kind:definition.targetAssetId?'equipment':'system',
    target_label:definition.targetLabel,target_asset_id:definition.targetAssetId||null,
    category_key:definition.categoryKey,frequency:definition.frequency,execution_time:definition.executionTime||'09:00',
    assignee:definition.assignee||'Admin',enabled:definition.enabled,questions:definition.questions,source:definition.source,
    schedule_started_at:definition.scheduleStartedAt||definition.createdAt
  }
  const data=await checked(client.rpc('checklist_save_definition',{
    p_organization_id:organizationId,p_definition_id:definition.id,p_payload:payload
  }),'Lưu mẫu Checklist')
  return mapDefinition(data as Row,organizationId)
}
export async function loadChecklistCloud(
  client: SupabaseClient,organizationId: string,canManageOccurrences = false,ensureSchedule = false
): Promise<CloudBundle> {
  assertOnline()
  const [settingRows,definitionRows]=await Promise.all([
    fetchAllRows(client,'checklist_category_settings',organizationId,'category_key'),
    fetchAllRows(client,'checklist_definitions',organizationId,'title')
  ])
  const settings=settingRows.map(row=>({
    id:organizationId+':'+String(row.category_key),organizationId,categoryKey:String(row.category_key) as ChecklistCategoryKey,
    enabled:Boolean(row.enabled),frequency:row.frequency as ChecklistFrequency,assignee:String(row.assignee||'Admin'),
    executionTime:String(row.execution_time||'09:00'),updatedAt:String(row.updated_at)
  }))
  const definitions=definitionRows.map(row=>mapDefinition(row,organizationId))
  const active=definitions.filter(def=>def.enabled&&def.frequency!=='Linh hoạt'&&(def.source!=='starter'||settings.some(s=>s.categoryKey===def.categoryKey&&s.enabled)))
  const horizon=new Date();horizon.setFullYear(horizon.getFullYear()+1);horizon.setHours(23,59,59,999)
  if(canManageOccurrences){
    const occurrenceInputs=ensureSchedule?active.flatMap(def=>occurrenceDates(def,horizon).map(d=>({definition_id:def.id,due_at:d.toISOString(),due_date:dateKey(d)}))):[]
    if(occurrenceInputs.length===0){
      await checked(client.rpc('checklist_ensure_occurrences',{p_organization_id:organizationId,p_occurrences:[]}),'Cập nhật trạng thái lịch Checklist trên Cloud')
    }else{
      for(let i=0;i<occurrenceInputs.length;i+=PAGE_SIZE){
        const batch=occurrenceInputs.slice(i,i+PAGE_SIZE)
        await checked(client.rpc('checklist_ensure_occurrences',{p_organization_id:organizationId,p_occurrences:batch}),'Tạo lịch Checklist trên Cloud')
      }
    }
  }
  const minimumDueAt=new Date(Date.now()-366*86400000).toISOString()
  const [taskRows,runRows,events]=await Promise.all([
    fetchAllRows(client,'checklist_tasks',organizationId,'due_at',true,minimumDueAt),
    fetchAllRows(client,'checklist_runs',organizationId,'completed_at',false),
    fetchAllRows(client,'checklist_task_events',organizationId,'occurred_at')
  ])
  return {
    settings,definitions,
    tasks:taskRows.map(row=>mapTask(row,organizationId,events,definitions)).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)),
    runs:runRows.map(row=>mapRun(row,organizationId,events)).sort((a,b)=>b.completedAt.localeCompare(a.completedAt))
  }
}
export async function claimChecklistTask(client:SupabaseClient,organizationId:string,taskId:string):Promise<void>{
  assertOnline()
  await checked(client.rpc('checklist_claim_task',{p_organization_id:organizationId,p_task_id:taskId}),'Nhận công việc Checklist')
}
export async function releaseChecklistTask(client:SupabaseClient,organizationId:string,taskId:string):Promise<void>{
  assertOnline()
  await checked(client.rpc('checklist_release_task',{p_organization_id:organizationId,p_task_id:taskId}),'Trả công việc Checklist')
}
export async function completeChecklistTask(
  client:SupabaseClient,organizationId:string,taskId:string,payload:Record<string,unknown>
):Promise<void>{
  assertOnline()
  await checked(client.rpc('checklist_complete_task',{p_organization_id:organizationId,p_task_id:taskId,p_payload:payload}),'Lưu kết quả Checklist')
}
export async function completeChecklistManualRun(
  client:SupabaseClient,organizationId:string,definitionId:string,payload:Record<string,unknown>
):Promise<void>{
  assertOnline()
  await checked(client.rpc('checklist_complete_manual_run',{p_organization_id:organizationId,p_definition_id:definitionId,p_payload:payload}),'Lưu kết quả Checklist')
}
