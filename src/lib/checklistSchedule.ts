import { db, now, type ChecklistDefinition, type ChecklistFrequency, type ChecklistTask } from '../db'
export const CHECKLIST_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000
const localDateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const atExecutionTime=(date:Date,executionTime='09:00')=>{const value=new Date(date);const match=/^(\d{2}):(\d{2})$/.exec(executionTime);value.setHours(match?Math.min(23,Number(match[1])):9,match?Math.min(59,Number(match[2])):0,0,0);return value}
const addMonthsClamped=(anchor:Date,monthOffset:number,executionTime:string)=>{const first=new Date(anchor.getFullYear(),anchor.getMonth()+monthOffset,1);const lastDay=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();first.setDate(Math.min(anchor.getDate(),lastDay));return atExecutionTime(first,executionTime)}
const scheduledDates=(definition:ChecklistDefinition,end:Date):Date[]=>{
 const anchor=new Date(definition.scheduleStartedAt||definition.createdAt);if(Number.isNaN(anchor.getTime()))return []
 const frequency:ChecklistFrequency=definition.frequency;const executionTime=definition.executionTime||'09:00';const dates:Date[]=[]
 const pushIfValid=(candidate:Date)=>{if(candidate>=anchor&&candidate<=end)dates.push(candidate)}
 if(frequency==='Hàng ngày'){const first=atExecutionTime(anchor,executionTime);if(first<anchor)first.setDate(first.getDate()+1);for(const cursor=new Date(first);cursor<=end;cursor.setDate(cursor.getDate()+1))dates.push(new Date(cursor))}
 else if(frequency==='Hàng tuần'){let candidate=atExecutionTime(anchor,executionTime);if(candidate<anchor)candidate.setDate(candidate.getDate()+7);for(;candidate<=end;candidate=new Date(candidate.getTime()+7*86400000))dates.push(new Date(candidate))}
 else if(frequency==='Hàng tháng'){for(let offset=0;offset<=18;offset++)pushIfValid(addMonthsClamped(anchor,offset,executionTime))}
 else if(frequency==='Hàng quý'){for(let offset=0;offset<=6;offset++)pushIfValid(addMonthsClamped(anchor,offset*3,executionTime))}
 else if(frequency==='Hàng năm'){for(let offset=0;offset<=2;offset++){const candidate=new Date(anchor.getFullYear()+offset,anchor.getMonth(),1);const lastDay=new Date(candidate.getFullYear(),candidate.getMonth()+1,0).getDate();candidate.setDate(Math.min(anchor.getDate(),lastDay));pushIfValid(atExecutionTime(candidate,executionTime))}}
 return dates
}
export async function ensureChecklistOccurrences(organizationId:string){
 if(!organizationId)return
 const definitions=await db.checklistDefinitions.where('organizationId').equals(organizationId).toArray()
 const settings=await db.checklistCategorySettings.where('organizationId').equals(organizationId).toArray()
 const active=definitions.filter(item=>item.enabled&&item.frequency!=='Linh hoạt'&&(item.source!=='starter'||settings.some(setting=>setting.categoryKey===item.categoryKey&&setting.enabled)))
 const activeIds=new Set(active.map(item=>item.id));const current=new Date();const currentMs=current.getTime()
 const horizon=new Date(current.getFullYear()+1,current.getMonth(),current.getDate(),23,59,59,999)
 const storedTasks=await db.checklistTasks.where('organizationId').equals(organizationId).toArray()
 const runs=await db.checklistRuns.where('organizationId').equals(organizationId).toArray()
 const sameSchedulePeriod=(frequency:ChecklistFrequency,dueDate:string,completedAt:string)=>{
  const completedDate=localDateKey(new Date(completedAt))
  if(frequency==='Hàng ngày')return completedDate===dueDate
  if(frequency==='Hàng tháng')return completedDate.slice(0,7)===dueDate.slice(0,7)
  if(frequency==='Hàng quý'){
   const due=new Date(dueDate+'T12:00:00');const completed=new Date(completedDate+'T12:00:00')
   return due.getFullYear()===completed.getFullYear()&&Math.floor(due.getMonth()/3)===Math.floor(completed.getMonth()/3)
  }
  if(frequency==='Hàng năm')return completedDate.slice(0,4)===dueDate.slice(0,4)
  if(frequency==='Hàng tuần'){
   const weekStart=(value:string)=>{const date=new Date(value+'T12:00:00');date.setDate(date.getDate()-((date.getDay()+6)%7));return localDateKey(date)}
   return weekStart(completedDate)===weekStart(dueDate)
  }
  return false
 }
 const existing=storedTasks.map(task=>{
  if(!activeIds.has(task.checklistId)||task.status==='Hoàn thành'||task.status==='Không Checklist')return task
  const dueMs=new Date(task.dueAt).getTime()
  const matchingRun=runs.filter(run=>run.checklistId===task.checklistId&&sameSchedulePeriod(task.frequency,task.dueDate,run.completedAt)&&new Date(run.completedAt).getTime()<=dueMs+CHECKLIST_GRACE_PERIOD_MS).sort((a,b)=>b.completedAt.localeCompare(a.completedAt))[0]
  return matchingRun?{...task,status:'Hoàn thành' as const,completedAt:matchingRun.completedAt,runId:matchingRun.id,claimedBy:undefined,claimedByUserId:undefined,claimedAt:undefined,updatedAt:matchingRun.completedAt}:task
 })
 const reconciled=existing.filter((task,index)=>task.status==='Hoàn thành'&&storedTasks[index].status!=='Hoàn thành')
 if(reconciled.length)await db.checklistTasks.bulkPut(reconciled)
 const currentById=new Map(active.map(item=>[item.id,item]))
 const obsolete=existing.filter(task=>task.status!=='Hoàn thành'&&task.status!=='Không Checklist'&&(!activeIds.has(task.checklistId)||(task.status!=='Đang thực hiện'&&currentById.has(task.checklistId)&&(()=>{const definition=currentById.get(task.checklistId)!;return definition.frequency!==task.frequency||(definition.executionTime||'09:00')!==(task.executionTime||'09:00')||definition.title!==task.title||definition.targetLabel!==task.targetLabel||definition.assignee!==task.assignee||definition.categoryKey!==task.definitionSnapshot.categoryKey||JSON.stringify(definition.questions)!==JSON.stringify(task.definitionSnapshot.questions)})())))
 if(obsolete.length)await db.checklistTasks.bulkDelete(obsolete.map(item=>item.id))
 const retained=existing.filter(item=>!obsolete.some(row=>row.id===item.id));const known=new Set(retained.map(item=>item.id));const additions:ChecklistTask[]=[]
 for(const definition of active){const executionTime=definition.executionTime||'09:00';for(const dueAt of scheduledDates(definition,horizon)){const dueDate=localDateKey(dueAt);const id=`${definition.id}@${dueDate}`;if(known.has(id))continue;const missed=currentMs-dueAt.getTime()>=CHECKLIST_GRACE_PERIOD_MS;additions.push({id,organizationId,checklistId:definition.id,title:definition.title,targetLabel:definition.targetLabel,frequency:definition.frequency,dueAt:dueAt.toISOString(),dueDate,executionTime,assignee:definition.assignee,status:missed?'Không Checklist':'Chờ thực hiện',definitionSnapshot:{categoryKey:definition.categoryKey,questions:definition.questions.map(question=>({...question}))},createdAt:now(),updatedAt:now()});known.add(id)}}
 if(additions.length)await db.checklistTasks.bulkAdd(additions)
 const expired=existing.filter(task=>task.status!=='Hoàn thành'&&task.status!=='Không Checklist'&&currentMs-new Date(task.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS)
 if(expired.length)await db.checklistTasks.bulkPut(expired.map(task=>({...task,status:'Không Checklist' as const,claimedBy:undefined,claimedByUserId:undefined,claimedAt:undefined,assignmentEvents:task.status==='Đang thực hiện'?[...(task.assignmentEvents||[]),{action:'Hủy thực hiện' as const,actor:'Hệ thống',at:now()}]:task.assignmentEvents,updatedAt:now()})))
 const stillInGrace=existing.filter(task=>task.status==='Quá hạn'&&currentMs-new Date(task.dueAt).getTime()<CHECKLIST_GRACE_PERIOD_MS)
 if(stillInGrace.length)await db.checklistTasks.bulkPut(stillInGrace.map(task=>({...task,status:'Chờ thực hiện' as const,updatedAt:now()})))
}
export const checklistLocalDateKey=localDateKey
