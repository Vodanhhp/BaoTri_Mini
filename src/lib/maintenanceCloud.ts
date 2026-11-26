import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaintenanceRequest, MaintenanceHistory, MaintenanceTask } from '../db'

type Row=Record<string,any>
const asRows=(value:unknown):Row[]=>Array.isArray(value)?value as Row[]:[]
const todayVietnam=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
function mapRequest(row:Row,organizationId:string):MaintenanceRequest{
 if(String(row.organization_id)!==organizationId)throw new Error('Cloud trả Phiếu yêu cầu sai tổ chức.')
 return {
  id:String(row.id),organizationId,assetId:String(row.asset_id),requestDate:String(row.request_date),...(row.checklist_run_id?{checklistRunId:String(row.checklist_run_id)}:{ }),
  ...(row.due_date?{dueDate:String(row.due_date)}:{}),kind:row.kind as MaintenanceRequest['kind'],
  description:String(row.description||''),parts:String(row.parts||''),readings:String(row.readings||''),
  ...(row.completion_readings?{completionReadings:String(row.completion_readings)}:{}),
  ...(row.condition_after_repair?{conditionAfterRepair:String(row.condition_after_repair)}:{}),
  requestedBy:String(row.requested_by||''),...(row.requested_by_user_id?{requestedByUserId:String(row.requested_by_user_id)}:{}),
  status:row.status as MaintenanceRequest['status'],result:(row.result||'') as MaintenanceRequest['result'],
  performedBy:String(row.performed_by||''),...(row.completed_at?{completedAt:String(row.completed_at)}:{}),
  createdAt:String(row.created_at),updatedAt:String(row.updated_at)
 }
}
function mapEvent(row:Row,organizationId:string):MaintenanceHistory{
 return {id:String(row.id),organizationId,recordType:'request',recordId:String(row.request_id),
  eventType:row.event_type==='completed'?'completed':row.event_type==='created'?'created':row.event_type==='status_changed'?'status_changed':'updated',
  summary:String(row.summary||''),...(row.actor_user_id?{actorUserId:String(row.actor_user_id)}:{}),
  actorLabel:String(row.actor_label||''),occurredAt:String(row.occurred_at),
  ...(row.before_snapshot?{beforeSnapshot:JSON.stringify(row.before_snapshot)}:{}),
  ...(row.after_snapshot?{afterSnapshot:JSON.stringify(row.after_snapshot)}:{})}
}
function online(){if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('Mất Internet. Phiếu yêu cầu Cloud cần kết nối mạng.')}
async function checked<T>(promise:PromiseLike<{data:T|null;error:any}>,label:string):Promise<T>{
 const {data,error}=await promise;if(error)throw new Error(label+': '+error.message);if(data==null)throw new Error(label+': Cloud không trả dữ liệu.');return data
}
export async function loadMaintenanceRequests(client:SupabaseClient,organizationId:string):Promise<{requests:MaintenanceRequest[];tasks:MaintenanceTask[];history:MaintenanceHistory[]}>{
 online()
 const [requests,events,tasks,taskEvents]=await Promise.all([
  client.from('maintenance_requests').select('*').eq('organization_id',organizationId).order('request_date',{ascending:false}).order('created_at',{ascending:false}),
  client.from('maintenance_request_events').select('*').eq('organization_id',organizationId).order('occurred_at',{ascending:false}),
  client.from('maintenance_tasks').select('*').eq('organization_id',organizationId).order('due_date',{ascending:true}),
  client.from('maintenance_task_events').select('*').eq('organization_id',organizationId).order('occurred_at',{ascending:false})
 ])
 if(requests.error)throw new Error('Tải Phiếu yêu cầu Cloud: '+requests.error.message)
 if(events.error)throw new Error('Tải lịch sử Phiếu yêu cầu Cloud: '+events.error.message)
 if(tasks.error)throw new Error('Tải lịch bảo dưỡng Cloud: '+tasks.error.message)
 if(taskEvents.error)throw new Error('Tải lịch sử bảo dưỡng Cloud: '+taskEvents.error.message)
 const mappedTasks=asRows(tasks.data).map(row=>({id:String(row.id),organizationId,assetId:String(row.asset_id),title:String(row.title),dueDate:String(row.due_date),frequency:String(row.frequency),status:(row.status!=='Hoàn thành'&&String(row.due_date)<todayVietnam()?'Quá hạn':row.status) as MaintenanceTask['status'],checklist:String(row.checklist||''),readings:String(row.readings||''),notes:String(row.notes||''),...(row.completed_at?{completedAt:String(row.completed_at)}:{}),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))
 const mappedTaskEvents=asRows(taskEvents.data).map(row=>({...mapEvent({...row,request_id:row.task_id},organizationId),recordType:'task' as const}))
 return {requests:asRows(requests.data).map(row=>mapRequest(row,organizationId)),tasks:mappedTasks,history:[...asRows(events.data).map(row=>mapEvent(row,organizationId)),...mappedTaskEvents]}
}
export async function saveMaintenanceRequest(client:SupabaseClient,organizationId:string,request:MaintenanceRequest,isExisting=false):Promise<MaintenanceRequest>{
 online()
 const row=await checked(client.rpc('maintenance_save_request',{p_organization_id:organizationId,p_request_id:isExisting?request.id:null,p_payload:{
  asset_id:request.assetId,request_date:request.requestDate,due_date:request.dueDate||null,kind:request.kind,
  description:request.description,parts:request.parts,readings:request.readings,requested_by:request.requestedBy
 }}),'Lưu Phiếu yêu cầu')
 return mapRequest(row as Row,organizationId)
}
export async function completeMaintenanceRequest(client:SupabaseClient,organizationId:string,requestId:string,payload:{
 performedBy:string;completionReadings:string;conditionAfterRepair:string;result:'Đạt'|'Không đạt';completedAt?:string
}):Promise<MaintenanceRequest>{
 online()
 const row=await checked(client.rpc('maintenance_complete_request',{p_organization_id:organizationId,p_request_id:requestId,p_payload:{
  performed_by:payload.performedBy,completion_readings:payload.completionReadings,
  condition_after_repair:payload.conditionAfterRepair,result:payload.result,completed_at:payload.completedAt||null
 }}),'Hoàn thành Phiếu yêu cầu')
 return mapRequest(row as Row,organizationId)
}
export async function createMaintenanceRequestFromChecklist(client:SupabaseClient,organizationId:string,runId:string,dueDate?:string):Promise<MaintenanceRequest>{
 online()
 const row=await checked(client.rpc('maintenance_create_request_from_checklist',{p_organization_id:organizationId,p_run_id:runId,p_due_date:dueDate||null}),'Tạo Phiếu yêu cầu từ Checklist')
 return mapRequest(row as Row,organizationId)
}

export async function saveMaintenanceTask(client:SupabaseClient,organizationId:string,task:MaintenanceTask):Promise<MaintenanceTask>{
 online()
 const row=await checked(client.rpc('maintenance_save_task',{p_organization_id:organizationId,p_task_id:task.id,p_payload:{
  asset_id:task.assetId,title:task.title,due_date:task.dueDate,frequency:task.frequency,status:task.status,
  checklist:task.checklist,readings:task.readings,notes:task.notes,completed_at:task.completedAt||null
 }}),'Lưu lịch bảo dưỡng')
 return {id:String((row as Row).id),organizationId,assetId:String((row as Row).asset_id),title:String((row as Row).title),
  dueDate:String((row as Row).due_date),frequency:String((row as Row).frequency),status:(row as Row).status as MaintenanceTask['status'],
  checklist:String((row as Row).checklist||''),readings:String((row as Row).readings||''),notes:String((row as Row).notes||''),
  ...((row as Row).completed_at?{completedAt:String((row as Row).completed_at)}:{}),createdAt:String((row as Row).created_at),updatedAt:String((row as Row).updated_at)}
}
export async function updateMaintenanceTaskStatus(client:SupabaseClient,organizationId:string,taskId:string,status:MaintenanceTask['status']):Promise<void>{
 online()
 await checked(client.rpc('maintenance_update_task_status',{p_organization_id:organizationId,p_task_id:taskId,p_status:status}),'Cập nhật trạng thái lịch bảo dưỡng')
}

export async function importMaintenanceHistory(client:SupabaseClient,organizationId:string,events:MaintenanceHistory[]):Promise<number>{
 online()
 let imported=0
 for(let offset=0;offset<events.length;offset+=200){
  const batch=events.slice(offset,offset+200)
  const payload=batch.map(event=>({id:event.id,record_type:event.recordType,record_id:event.recordId,event_type:event.eventType,
   summary:event.summary,actor_label:event.actorLabel,occurred_at:event.occurredAt,
   before_snapshot:event.beforeSnapshot||null,after_snapshot:event.afterSnapshot||null}))
  imported+=await checked(client.rpc('maintenance_import_legacy_history',{p_organization_id:organizationId,p_events:payload}),'Nhập lịch sử bảo trì cũ')
 }
 return imported
}
export type LegacyMaintenanceImportResult={requestsImported:number;tasksImported:number;historyImported:number;needsReview:number;errors:string[]}
export async function importLegacyMaintenanceData(client:SupabaseClient,organizationId:string,requests:MaintenanceRequest[],tasks:MaintenanceTask[],history:MaintenanceHistory[],existingRequestIds:string[]=[],existingTaskIds:string[]=[]):Promise<LegacyMaintenanceImportResult>{
 const result:LegacyMaintenanceImportResult={requestsImported:0,tasksImported:0,historyImported:0,needsReview:0,errors:[]}
 const readyRequestIds=new Set<string>(existingRequestIds),readyTaskIds=new Set<string>(existingTaskIds)
 for(const row of requests){
  try{
   const saved=await saveMaintenanceRequest(client,organizationId,row,true)
   readyRequestIds.add(saved.id)
   if(row.status==='Hoàn thành'&&saved.status!=='Hoàn thành'){
    if(!row.performedBy||!row.result||!row.completedAt){result.needsReview++;result.errors.push('Phiếu '+row.id.slice(0,8)+' thiếu người thực hiện, kết quả hoặc thời điểm hoàn thành; đã nhập ở trạng thái chờ xử lý.')}
    else await completeMaintenanceRequest(client,organizationId,row.id,{
     performedBy:row.performedBy,completionReadings:row.completionReadings||'Không lưu trong dữ liệu Local cũ',
     conditionAfterRepair:row.conditionAfterRepair||'Không lưu trong dữ liệu Local cũ',
     result:row.result,completedAt:row.completedAt
    })
   }
   result.requestsImported++
  }catch(error){result.errors.push('Phiếu '+row.id.slice(0,8)+': '+(error instanceof Error?error.message:String(error)))}
 }
 for(const row of tasks){
  try{await saveMaintenanceTask(client,organizationId,row);readyTaskIds.add(row.id);result.tasksImported++}
  catch(error){result.errors.push('Lịch '+row.id.slice(0,8)+': '+(error instanceof Error?error.message:String(error)))}
 }
 const historyToImport=history.filter(event=>(event.recordType==='request'?readyRequestIds.has(event.recordId):readyTaskIds.has(event.recordId)))
 for(let offset=0;offset<historyToImport.length;offset+=200){
  try{result.historyImported+=await importMaintenanceHistory(client,organizationId,historyToImport.slice(offset,offset+200))}
  catch(error){result.errors.push('Lịch sử: '+(error instanceof Error?error.message:String(error)));break}
 }
 return result
}
