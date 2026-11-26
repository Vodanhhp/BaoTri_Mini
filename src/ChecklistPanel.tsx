import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, Check, ClipboardCheck, Download, History, Plus, Settings2, ShieldCheck, X } from 'lucide-react'
import ExcelJS from 'exceljs'
import { db, now, uid, type Asset, type ChecklistCategoryKey, type ChecklistCategorySetting, type ChecklistDefinition, type ChecklistFrequency, type ChecklistQuestion, type ChecklistRun, type ChecklistTask } from './db'
import { ensureChecklistOccurrences, checklistLocalDateKey, CHECKLIST_GRACE_PERIOD_MS } from './lib/checklistSchedule'

type Props = {
  organizationId: string
  organizationName: string
  userLabel: string
  userId: string
  canView: boolean
  canManage: boolean
  canExecute: boolean
  assets: Asset[]
}

const FREQUENCIES: ChecklistFrequency[] = ['Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','Hàng năm','Linh hoạt']
const CATEGORIES: Array<{key:ChecklistCategoryKey;label:string;description:string;icon:string;questions:string[]}> = [
  {key:'infrastructure',label:'Cơ sở hạ tầng',description:'Khu vực, kết cấu, cửa, mái, lối đi và điều kiện chung.',icon:'🏢',questions:['Khu vực kiểm tra sạch sẽ, thông thoáng và không có vật cản?','Tường, trần, mái, cửa và nền không có dấu hiệu hư hỏng bất thường?','Lối đi và cửa thoát hiểm không bị che chắn?']},
  {key:'electrical',label:'Hệ thống điện',description:'Tủ điện, nguồn cấp, dây dẫn và điều kiện an toàn điện.',icon:'⚡',questions:['Tủ điện đóng kín, có nhãn nhận diện và không có dấu hiệu bất thường?','Không phát hiện mùi khét, tiếng kêu, phát nhiệt hoặc phóng điện bất thường?','Khu vực trước tủ điện khô ráo, thông thoáng và không bị che chắn?']},
  {key:'water',label:'Hệ thống nước',description:'Đường ống, van, bơm, bể chứa và dấu hiệu rò rỉ.',icon:'💧',questions:['Đường ống, van và các mối nối không có dấu hiệu rò rỉ?','Áp lực/lưu lượng nước ở trạng thái bình thường?','Khu vực bơm và bể chứa sạch sẽ, không có dấu hiệu bất thường?']},
  {key:'fire',label:'Phòng cháy chữa cháy',description:'Lối thoát nạn, phương tiện PCCC và dấu hiệu mất an toàn.',icon:'🧯',questions:['Lối thoát nạn và đường tiếp cận phương tiện chữa cháy thông thoáng?','Bình chữa cháy và phương tiện PCCC ở đúng vị trí, dễ tiếp cận?','Thiết bị/đèn báo PCCC không có dấu hiệu hư hỏng hoặc cảnh báo bất thường?']}
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(item=>[item.key,item.label])) as Record<ChecklistCategoryKey,string>
const blankSetting = (organizationId:string,key:ChecklistCategoryKey):ChecklistCategorySetting => ({id:organizationId+':'+key,organizationId,categoryKey:key,enabled:false,frequency:key==='infrastructure'?'Hàng tuần':'Hàng ngày',assignee:'Admin',executionTime:'09:00',updatedAt:now()})
const dueText = (frequency:ChecklistFrequency) => frequency==='Linh hoạt'?'Không có lịch cố định':frequency
const dateTime = (value:string) => new Date(value).toLocaleString('vi-VN')
const dateOnly = () => new Date().toLocaleDateString('en-CA')
const makeQuestions = (lines:string[]):ChecklistQuestion[] => lines.map(label=>({id:uid(),label:label.trim(),required:true})).filter(item=>item.label)

export function ChecklistDashboardSummary({organizationId,onOpen}:{organizationId:string;onOpen:()=>void}) {
 const [tasks,setTasks]=useState<ChecklistTask[]>([])
 useEffect(()=>{let active=true;void ensureChecklistOccurrences(organizationId).then(()=>db.checklistTasks.where('organizationId').equals(organizationId).toArray()).then(rows=>{if(active)setTasks(rows)}).catch(()=>{});return()=>{active=false}},[organizationId])
 const currentMs=Date.now()
 const actionable=tasks.filter(item=>(item.status==='Chờ thực hiện'||item.status==='Đang thực hiện')&&new Date(item.dueAt).getTime()<=currentMs&&currentMs-new Date(item.dueAt).getTime()<CHECKLIST_GRACE_PERIOD_MS)
 const missed=tasks.filter(item=>item.status==='Không Checklist')
 return <section className="overview-section"><div className="overview-section-head"><div><div className="eyebrow">KIỂM TRA ĐỊNH KỲ</div><h2>Checklist</h2><p>Chỉ hiển thị lượt đã đến hạn; lượt bị bỏ qua được lưu riêng trong lịch sử.</p></div><button type="button" className="text-btn" onClick={onOpen}>Mở Checklist →</button></div><div className="stat-grid checklist-dashboard-stats"><div className="stat-card"><div><small>Đến hạn cần làm</small><strong>{actionable.length}</strong><span>Trong thời gian cho phép</span></div></div><div className="stat-card"><div><small>Không Checklist</small><strong>{missed.length}</strong><span>Đã quá thời gian cho phép</span></div></div></div>{actionable.length>0&&<div className="checklist-definition-list">{actionable.slice(0,5).map(task=><article className="checklist-definition-row" key={task.id}><div><b>{task.title}</b><small>{task.targetLabel} · Hạn: {dateTime(task.dueAt)} · {task.assignee}</small><span className="checklist-outcome">{task.status}</span></div></article>)}</div>}</section>
}

export default function ChecklistPanel({organizationId,organizationName,userLabel,userId,canView,canManage,canExecute,assets}:Props) {
  const [settings,setSettings]=useState<ChecklistCategorySetting[]>([])
  const [definitions,setDefinitions]=useState<ChecklistDefinition[]>([])
  const [runs,setRuns]=useState<ChecklistRun[]>([])
  const [tasks,setTasks]=useState<ChecklistTask[]>([])
  const [runningTaskId,setRunningTaskId]=useState<string|null>(null)
  const [tab,setTab]=useState<'overview'|'builder'|'history'|'reports'>('overview')
  const [upcomingOpen,setUpcomingOpen]=useState(false)
  const [upcomingPeriod,setUpcomingPeriod]=useState<'week'|'month'|'quarter'>('week')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [editing,setEditing]=useState<ChecklistDefinition|null>(null)
  const [running,setRunning]=useState<ChecklistDefinition|null>(null)
  const [answers,setAnswers]=useState<Record<string,{result:'Đạt'|'Không đạt'|'Không áp dụng'|'';note:string}>>({})
  const [repairCreated,setRepairCreated]=useState(false)
  const [noRepairReason,setNoRepairReason]=useState('')
  const [title,setTitle]=useState('')
  const [target,setTarget]=useState('')
  const [category,setCategory]=useState<ChecklistCategoryKey|'equipment'|'custom'>('custom')
  const [frequency,setFrequency]=useState<ChecklistFrequency>('Hàng tháng')
  const [executionTime,setExecutionTime]=useState('09:00')
  const [questionText,setQuestionText]=useState('')
  const [assignee,setAssignee]=useState('Admin')
  const [search,setSearch]=useState('')
  const [reportFrom,setReportFrom]=useState('')
  const [reportTo,setReportTo]=useState('')
  const [printingRun,setPrintingRun]=useState<ChecklistRun|null>(null)

  const refresh=async()=>{
    setLoading(true)
    try{
      await ensureChecklistOccurrences(organizationId)
      const [settingRows,definitionRows,runRows,taskRows]=await Promise.all([
        db.checklistCategorySettings.where('organizationId').equals(organizationId).toArray(),
        db.checklistDefinitions.where('organizationId').equals(organizationId).toArray(),
        db.checklistRuns.where('organizationId').equals(organizationId).toArray(),
        db.checklistTasks.where('organizationId').equals(organizationId).toArray()
      ])
      const merged=CATEGORIES.map(item=>settingRows.find(row=>row.categoryKey===item.key)||blankSetting(organizationId,item.key))
      setSettings(merged);setDefinitions(definitionRows.sort((a,b)=>a.title.localeCompare(b.title,'vi')))
      setRuns(runRows.sort((a,b)=>b.completedAt.localeCompare(a.completedAt)))
      setTasks(taskRows.sort((a,b)=>a.dueAt.localeCompare(b.dueAt)))
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
    finally{setLoading(false)}
  }
  useEffect(()=>{void refresh()},[organizationId])
  useEffect(()=>{if(printingRun){window.print();setPrintingRun(null)}},[printingRun])

  const enabledCount=settings.filter(item=>item.enabled).length
  const todayRuns=runs.filter(item=>checklistLocalDateKey(new Date(item.completedAt))===dateOnly())
  const reportRuns=useMemo(()=>runs.filter(item=>{const day=checklistLocalDateKey(new Date(item.completedAt));return (!reportFrom||day>=reportFrom)&&(!reportTo||day<=reportTo)}),[runs,reportFrom,reportTo])
  const reportMissedTasks=useMemo(()=>tasks.filter(item=>item.status==='Không Checklist'&&(!reportFrom||item.dueDate>=reportFrom)&&(!reportTo||item.dueDate<=reportTo)),[tasks,reportFrom,reportTo])
  const currentMs=Date.now()
  const actionableTasks=tasks.filter(item=>(item.status==='Chờ thực hiện'||item.status==='Đang thực hiện')&&new Date(item.dueAt).getTime()<=currentMs&&currentMs-new Date(item.dueAt).getTime()<CHECKLIST_GRACE_PERIOD_MS).sort((a,b)=>a.dueAt.localeCompare(b.dueAt))
  const missedTasks=tasks.filter(item=>item.status==='Không Checklist').sort((a,b)=>b.dueAt.localeCompare(a.dueAt))
  const upcomingRange=useMemo(()=>{const start=new Date();start.setHours(0,0,0,0);let end=new Date(start);if(upcomingPeriod==='week'){const day=end.getDay()||7;start.setDate(start.getDate()+(8-day));end=new Date(start);end.setDate(end.getDate()+6);end.setHours(23,59,59,999)}else if(upcomingPeriod==='month'){start.setDate(1);start.setMonth(start.getMonth()+1);end=new Date(start.getFullYear(),start.getMonth()+1,0,23,59,59,999)}else{const quarter=Math.floor(start.getMonth()/3);start.setMonth((quarter+1)*3,1);end=new Date(start.getFullYear(),start.getMonth()+3,0,23,59,59,999)}return {start,end}},[upcomingPeriod])
  const upcomingTasks=tasks.filter(item=>item.status==='Chờ thực hiện'&&new Date(item.dueAt)>=upcomingRange.start&&new Date(item.dueAt)<=upcomingRange.end).sort((a,b)=>a.dueAt.localeCompare(b.dueAt))
  const visibleDefinitions=useMemo(()=>definitions.filter(item=>!search.trim()||[item.title,item.targetLabel,item.categoryKey].join(' ').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))),[definitions,search])
  const suggestions=useMemo(()=>{
    const active=assets.filter(asset=>!asset.archivedAt&&!asset.deletedAt&&asset.status!=='Thanh lý')
    const rules=[
      {match:/máy nén khí|máy sấy khí|khí nén/i,title:'Kiểm tra hệ thống khí nén',questions:['Kiểm tra áp suất làm việc và áp suất cài đặt?','Kiểm tra rò rỉ khí tại đường ống và đầu nối?','Kiểm tra mức dầu, nhiệt độ và tiếng ồn bất thường?']},
      {match:/động cơ điện|motor/i,title:'Kiểm tra động cơ điện',questions:['Kiểm tra tiếng ồn, rung động và nhiệt độ vỏ động cơ?','Kiểm tra tình trạng đấu nối và cáp cấp nguồn?','Kiểm tra dấu hiệu rò dầu, bụi bẩn hoặc hư hỏng cơ khí?']},
      {match:/máy bơm/i,title:'Kiểm tra máy bơm',questions:['Kiểm tra áp suất/lưu lượng và tiếng ồn khi vận hành?','Kiểm tra rò rỉ tại phớt, mặt bích và đường ống?','Kiểm tra rung động, nhiệt độ ổ bi và tình trạng chân đế?']},
      {match:/máy phát điện/i,title:'Kiểm tra máy phát điện',questions:['Kiểm tra mức nhiên liệu, dầu bôi trơn và nước làm mát?','Kiểm tra ắc quy, bộ sạc và tình trạng rò rỉ?','Kiểm tra thông số điện áp/tần số khi chạy thử theo quy trình đơn vị?']}
    ]
    return rules.flatMap(rule=>{
      const matched=active.filter(asset=>rule.match.test(asset.category+' '+asset.name))
      return matched.length?[{...rule,target:matched.map(asset=>asset.name+' ('+asset.code+')').join(', '),count:matched.length}]:[]
    })
  },[assets])

  const saveSetting=async(key:ChecklistCategoryKey,patch:Partial<ChecklistCategorySetting>)=>{
    if(!canManage)return
    const current=settings.find(item=>item.categoryKey===key)||blankSetting(organizationId,key)
    const next={...current,...patch,updatedAt:now()}
    await db.checklistCategorySettings.put(next)
    if((patch.frequency&&patch.frequency!==current.frequency)||(patch.executionTime&&patch.executionTime!==(current.executionTime||'09:00'))){
      const defs=definitions.filter(item=>item.categoryKey===key&&item.source==='starter')
      await Promise.all(defs.map(item=>db.checklistDefinitions.update(item.id,{...(patch.frequency?{frequency:patch.frequency}:{}),...(patch.executionTime?{executionTime:patch.executionTime}:{}),scheduleStartedAt:now(),updatedAt:now()})))
    }
    await refresh()
  }
  const createDefinition=async(data:{title:string;targetLabel:string;categoryKey:ChecklistDefinition['categoryKey'];frequency:ChecklistFrequency;executionTime?:string;questions:ChecklistQuestion[];source:ChecklistDefinition['source']})=>{
    if(!canManage)return
    if(!data.title.trim()||!data.targetLabel.trim()||!data.questions.length)throw new Error('Cần nhập tên Checklist, đối tượng kiểm tra và ít nhất một nội dung kiểm tra.')
    const record:ChecklistDefinition={id:uid(),organizationId,title:data.title.trim(),targetLabel:data.targetLabel.trim(),categoryKey:data.categoryKey,frequency:data.frequency,enabled:true,assignee,executionTime:data.executionTime||executionTime,questions:data.questions,source:data.source,createdAt:now(),updatedAt:now(),scheduleStartedAt:now()}
    await db.checklistDefinitions.add(record)
    await refresh()
    return record
  }
  const toggleCategory=async(key:ChecklistCategoryKey)=>{
    const setting=settings.find(item=>item.categoryKey===key)||blankSetting(organizationId,key)
    const enable=!setting.enabled
    await saveSetting(key,{enabled:enable})
    await Promise.all(definitions.filter(item=>item.categoryKey===key&&item.source==='starter').map(item=>db.checklistDefinitions.update(item.id,{scheduleStartedAt:now(),updatedAt:now()})))
    if(enable&&!definitions.some(item=>item.categoryKey===key)){
      const meta=CATEGORIES.find(item=>item.key===key)!
      await createDefinition({title:'Kiểm tra '+meta.label.toLocaleLowerCase('vi'),targetLabel:meta.label,categoryKey:key,frequency:setting.frequency,executionTime:setting.executionTime||'09:00',questions:makeQuestions(meta.questions),source:'starter'})
      setNotice('Đã bật nhóm gợi ý. Hãy rà soát nội dung và chu kỳ trước khi áp dụng chính thức.')
    }
    await refresh()
  }
  const openNew=()=>{setEditing(null);setTitle('');setTarget('');setCategory('custom');setFrequency('Hàng tháng');setExecutionTime('09:00');setAssignee('Admin');setQuestionText('');setTab('builder')}
  const openEdit=(item:ChecklistDefinition)=>{
    setEditing(item);setTitle(item.title);setTarget(item.targetLabel);setCategory(item.categoryKey);setFrequency(item.frequency);setExecutionTime(item.executionTime||'09:00');setAssignee(item.assignee);setQuestionText(item.questions.map(q=>q.label).join('\n'));setTab('builder')
  }
  const saveEditor=async(event:FormEvent)=>{
    event.preventDefault()
    if(!canManage)return
    try{
      const questions=makeQuestions(questionText.split('\n').filter(line=>line.trim()))
      if(editing){
        await db.checklistDefinitions.update(editing.id,{title:title.trim(),targetLabel:target.trim(),categoryKey:category,frequency,executionTime,assignee,questions,...(frequency!==editing.frequency||executionTime!==(editing.executionTime||'09:00')?{scheduleStartedAt:now()}:{}),updatedAt:now()})
        await refresh();setEditing(null);setNotice('Đã cập nhật Checklist.')
      }else{
        await createDefinition({title,targetLabel:target,categoryKey:category,frequency,executionTime,questions,source:category==='equipment'?'equipment-suggestion':'custom'})
        setTitle('');setTarget('');setQuestionText('');setNotice('Đã tạo Checklist.')
      }
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
  }
  const startRun=(item:ChecklistDefinition, taskId:string|null=null)=>{
    setRunning(item);setRunningTaskId(taskId);setAnswers(Object.fromEntries(item.questions.map(q=>[q.id,{result:'',note:''}])))
    setRepairCreated(false);setNoRepairReason('');setError('')
  }
  const isGroupAssignee=(value:string)=>value.trim().toLocaleLowerCase('vi').startsWith('nhóm')
  const claimTask=async(task:ChecklistTask)=>{
    if(!canExecute||!userId||!isGroupAssignee(task.assignee))return
    await ensureChecklistOccurrences(organizationId)
    const claimed=await db.transaction('rw',db.checklistTasks,async()=>{
      const current=await db.checklistTasks.get(task.id)
      if(!current||current.organizationId!==organizationId||current.status!=='Chờ thực hiện'||Date.now()-new Date(current.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS)return false
      const at=now()
      await db.checklistTasks.update(task.id,{status:'Đang thực hiện',claimedBy:userLabel,claimedByUserId:userId,claimedAt:at,assignmentEvents:[...(current.assignmentEvents||[]),{action:'Nhận việc',actor:userLabel,actorUserId:userId,at}],updatedAt:at})
      return true
    })
    if(claimed)await refresh()
    else setNotice('Công việc đã được người khác nhận hoặc không còn khả dụng. Hãy tải lại danh sách.')
  }
  const releaseTask=async(taskId:string)=>{
    const current=await db.checklistTasks.get(taskId)
    if(!current||!userId||current.claimedByUserId!==userId||current.status!=='Đang thực hiện')return
    const returnedToGroup=isGroupAssignee(current.assignee)
    const missed=Date.now()-new Date(current.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS
    const at=now()
    await db.transaction('rw',db.checklistTasks,async()=>{
      const latest=await db.checklistTasks.get(taskId)
      if(!latest||latest.organizationId!==organizationId||latest.claimedByUserId!==userId||latest.status!=='Đang thực hiện')return
      await db.checklistTasks.update(taskId,{status:missed?'Không Checklist':'Chờ thực hiện',claimedBy:undefined,claimedByUserId:undefined,claimedAt:undefined,assignmentEvents:[...(latest.assignmentEvents||[]),{action:returnedToGroup?'Trả lại nhóm':'Hủy thực hiện',actor:userLabel,actorUserId:userId,at}],updatedAt:at})
    })
  }
  const beginTask=async(task:ChecklistTask,item:ChecklistDefinition)=>{
    if(!canExecute)return
    await ensureChecklistOccurrences(organizationId)
    const current=await db.checklistTasks.get(task.id)
    if(!current||current.status==='Hoàn thành'||current.status==='Không Checklist'||current.status==='Quá hạn')return
    if(Date.now()-new Date(current.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS){await refresh();return}
    const group=isGroupAssignee(current.assignee)
    if(group&&(current.status!=='Đang thực hiện'||current.claimedByUserId!==userId))return
    if(!group&&current.assignee!==userLabel&&!canManage)return
    if(current.status==='Đang thực hiện'&&current.claimedByUserId!==userId)return
    if(current.status!=='Đang thực hiện'){
      const claimed=await db.transaction('rw',db.checklistTasks,async()=>{
        const latest=await db.checklistTasks.get(task.id)
        if(!latest||latest.organizationId!==organizationId||latest.status==='Hoàn thành'||latest.status==='Đang thực hiện'||Date.now()-new Date(latest.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS)return false
        const at=now()
        await db.checklistTasks.update(task.id,{status:'Đang thực hiện',claimedBy:userLabel,claimedByUserId:userId,claimedAt:at,assignmentEvents:[...(latest.assignmentEvents||[]),{action:'Nhận việc',actor:userLabel,actorUserId:userId,at}],updatedAt:at})
        return true
      })
      if(!claimed){setNotice('Công việc vừa được người khác nhận.');await refresh();return}
      await refresh()
    }
    startRun(item,task.id)
  }
  const cancelRun=async()=>{
    if(runningTaskId)await releaseTask(runningTaskId)
    setRunning(null);setRunningTaskId(null);await refresh()
  }
  const completeRun=async(event:FormEvent)=>{
    event.preventDefault()
    if(!running||!canExecute)return
    const missing=running.questions.filter(q=>q.required&&!answers[q.id]?.result)
    if(missing.length){setError('Còn '+missing.length+' nội dung chưa có kết quả.');return}
    const failed=running.questions.some(q=>answers[q.id]?.result==='Không đạt')
    if(failed&&!repairCreated&&!noRepairReason.trim()){setError('Checklist có mục Không đạt. Hãy ghi lý do chưa tạo Phiếu yêu cầu sửa chữa.');return}
    if(runningTaskId)await ensureChecklistOccurrences(organizationId)
    const taskSnapshot=runningTaskId?await db.checklistTasks.get(runningTaskId):undefined
    if(runningTaskId&&taskSnapshot&&Date.now()-new Date(taskSnapshot.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS){setError('Đã quá thời gian cho phép. Lượt này được ghi nhận là Không Checklist, không thể lưu kết quả kiểm tra muộn.');await refresh();return}
    if(runningTaskId&&(!taskSnapshot||taskSnapshot.organizationId!==organizationId||taskSnapshot.status!=='Đang thực hiện'||taskSnapshot.claimedByUserId!==userId)){setError('Bạn không còn là người nhận công việc này. Hãy tải lại danh sách trước khi lưu.');return}
    const record:ChecklistRun={
      id:uid(),organizationId,checklistId:running.id,checklistTitle:running.title,categoryLabel:running.categoryKey in CATEGORY_LABEL?CATEGORY_LABEL[running.categoryKey as ChecklistCategoryKey]:running.categoryKey==='equipment'?'Thiết bị':'Tùy chỉnh',
      targetLabel:running.targetLabel,frequency:running.frequency,
      answers:running.questions.map(q=>({questionId:q.id,question:q.label,result:answers[q.id]?.result as 'Đạt'|'Không đạt'|'Không áp dụng',note:answers[q.id]?.note||''})),
      outcome:failed?'Không đạt':'Đạt',inspector:userLabel,completedAt:now(),repairRequestCreated:failed&&repairCreated,noRepairReason:failed&&!repairCreated?noRepairReason.trim():undefined,
      assignmentHistory:taskSnapshot?.assignmentEvents||[],
      checklistSnapshot:running.questions.map(q=>({...q}))
    }
    if(runningTaskId){
      const saved=await db.transaction('rw',db.checklistRuns,db.checklistTasks,db.checklistDefinitions,async()=>{
        const latest=await db.checklistTasks.get(runningTaskId)
        if(!latest||latest.organizationId!==organizationId||latest.status!=='Đang thực hiện'||latest.claimedByUserId!==userId)return false
        await db.checklistRuns.add(record)
        await db.checklistTasks.update(runningTaskId,{status:'Hoàn thành',completedAt:record.completedAt,runId:record.id,updatedAt:record.completedAt})
        await db.checklistDefinitions.update(running.id,{lastCompletedAt:record.completedAt,updatedAt:record.completedAt})
        return true
      })
      if(!saved){setError('Quyền nhận việc đã thay đổi. Kết quả chưa được lưu; hãy tải lại danh sách.');return}
    }else{
      await db.checklistRuns.add(record)
      await db.checklistDefinitions.update(running.id,{lastCompletedAt:record.completedAt,updatedAt:record.completedAt})
    }
    setRunning(null);setRunningTaskId(null);setNotice('Đã lưu kết quả kiểm tra và lịch sử Checklist độc lập.');await refresh()
  }
  const exportExcel=async()=>{
    const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Bao cao Checklist')
    sheet.columns=[{header:'Thời gian',key:'time',width:22},{header:'Checklist',key:'title',width:30},{header:'Đối tượng',key:'target',width:28},{header:'Kết quả',key:'outcome',width:16},{header:'Người kiểm tra',key:'inspector',width:24},{header:'Phiếu sửa chữa',key:'repair',width:20},{header:'Lý do chưa tạo phiếu',key:'reason',width:32}]
    sheet.addRows([...reportRuns.map(row=>({time:dateTime(row.completedAt),title:row.checklistTitle,target:row.targetLabel,outcome:row.outcome,inspector:row.inspector,repair:row.repairRequestCreated?'Đã tạo':row.outcome==='Không đạt'?'Không tạo':'Không phát sinh',reason:row.noRepairReason||''})),...reportMissedTasks.map(row=>({time:dateTime(row.dueAt),title:row.title,target:row.targetLabel,outcome:'Không Checklist',inspector:'—',repair:'—',reason:'Quá thời gian cho phép; không thực hiện kiểm tra'}))])
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF176B5C'}}
    sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:'A1',to:'G1'}
    const buffer=await workbook.xlsx.writeBuffer();const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='Bao-cao-Checklist.xlsx';anchor.click();URL.revokeObjectURL(url)
  }

  if(!canView)return <div className="panel"><p>Tài khoản chưa được cấp quyền xem Checklist.</p></div>
  return <div className="checklist-workspace">
    <section className="welcome checklist-welcome"><div><div className="eyebrow">BAOTRI MINI · KIỂM TRA ĐỊNH KỲ</div><h2>Checklist</h2><p>Thiết lập nội dung kiểm tra và lưu kết quả độc lập với lịch sử thiết bị.</p><small>{organizationName}</small></div><div className="welcome-icon"><ClipboardCheck size={40}/></div></section>
    <div className="checklist-tabs">
      <button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><ClipboardCheck size={15}/> Tổng quan</button>
      <button className={tab==='builder'?'active':''} onClick={()=>setTab('builder')}><Settings2 size={15}/> Checklist Builder</button>
      <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><History size={15}/> Lịch sử</button>
      <button className={tab==='reports'?'active':''} onClick={()=>setTab('reports')}><BarChart3 size={15}/> Báo cáo</button>
    </div>
    {error&&<div className="checklist-alert error">{error}<button onClick={()=>setError('')}><X size={14}/></button></div>}
    {notice&&<div className="checklist-alert success">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
    {loading?<div className="panel">Đang tải dữ liệu Checklist…</div>:<>
      {tab==='overview'&&<>
        <div className="checklist-stat-grid">
          <div className="stat-card"><div><small>Nhóm khởi tạo đã bật</small><strong>{enabledCount}/4</strong><span>Admin tự chọn phạm vi</span></div></div>
          <div className="stat-card"><div><small>Checklist đang hoạt động</small><strong>{definitions.filter(item=>item.enabled).length}</strong><span>Có thể thực hiện</span></div></div>
          <div className="stat-card"><div><small>Đã kiểm tra hôm nay</small><strong>{todayRuns.length}</strong><span>Kết quả đã lưu</span></div></div>
          <div className="stat-card"><div><small>Không đạt</small><strong>{runs.filter(item=>item.outcome==='Không đạt').length}</strong><span>Không tự chuyển thành đạt</span></div></div>
        </div>
        <section className="panel checklist-section">
          <div className="panel-head"><div><h2>Công việc cần thực hiện</h2><p>Mỗi kỳ là một lượt riêng. Việc bỏ lỡ kỳ trước không làm mất hoặc chuyển kỳ đó sang ngày khác.</p></div></div>
          <div className="checklist-report-summary"><div><small>Đến hạn cần làm</small><b>{actionableTasks.length}</b></div><div><small>Không Checklist</small><b>{missedTasks.length}</b></div></div>
          <div className="checklist-definition-list">
            {actionableTasks.map(task=>{
              const definition=definitions.find(item=>item.id===task.checklistId)
              const runnable:ChecklistDefinition=definition?{...definition,title:task.title,targetLabel:task.targetLabel,frequency:task.frequency,assignee:task.assignee,categoryKey:task.definitionSnapshot.categoryKey,questions:task.definitionSnapshot.questions}:{
                id:task.checklistId,organizationId,title:task.title,targetLabel:task.targetLabel,frequency:task.frequency,enabled:true,assignee:task.assignee,questions:task.definitionSnapshot.questions,categoryKey:task.definitionSnapshot.categoryKey,source:'custom',createdAt:task.createdAt,updatedAt:task.updatedAt
              }
              const groupTask=isGroupAssignee(task.assignee)
              const directAllowed=task.assignee===userLabel||canManage
              return <article className="checklist-definition-row" key={task.id}>
                <div><b>{task.title}</b><small>{task.targetLabel} · Hạn: {dateTime(task.dueAt)} · Phụ trách: {task.assignee}{task.claimedBy?' · Đang nhận: '+task.claimedBy:''}</small><span className="checklist-outcome">{task.status}</span></div>
                <div className="top-actions">
                  {task.assignmentEvents&&task.assignmentEvents.length>0&&<details><summary>Lịch sử phân công ({task.assignmentEvents.length})</summary><ul>{task.assignmentEvents.map((event,index)=><li key={index}>{event.action} · {event.actor} · {dateTime(event.at)}</li>)}</ul></details>}
                  {groupTask&&task.status==='Chờ thực hiện'&&<button className="primary-btn" disabled={!canExecute} onClick={()=>void claimTask(task)}>Nhận việc</button>}
                  {groupTask&&task.status==='Đang thực hiện'&&task.claimedByUserId===userId&&<><button className="primary-btn" disabled={!canExecute} onClick={()=>void beginTask(task,runnable)}>Thực hiện</button><button className="soft-btn" onClick={()=>void releaseTask(task.id).then(refresh)}>Trả lại nhóm</button></>}
                  {groupTask&&task.status==='Đang thực hiện'&&task.claimedByUserId!==userId&&<small>Đang xử lý bởi {task.claimedBy||'thành viên khác'}</small>}
                  {!groupTask&&directAllowed&&<button className="primary-btn" disabled={!canExecute} onClick={()=>void beginTask(task,runnable)}>Thực hiện</button>}
                  {!groupTask&&!directAllowed&&<small>Chỉ người được giao hoặc Admin thực hiện</small>}
                  {!groupTask&&task.status==='Đang thực hiện'&&task.claimedByUserId!==userId&&<small>Đang xử lý bởi {task.claimedBy}</small>}
                </div>
              </article>
            })}
            {actionableTasks.length===0&&<div className="table-empty-state">Hiện không có lượt Checklist đến hạn cần thực hiện.</div>}
          </div>
          <div className="checklist-upcoming-toggle"><button type="button" className="soft-btn" onClick={()=>setUpcomingOpen(value=>!value)}>{upcomingOpen?'Ẩn lịch sắp tới':'Lịch sắp tới'}</button></div>
          {upcomingOpen&&<section className="checklist-upcoming-panel"><div className="checklist-upcoming-filters"><button type="button" className={upcomingPeriod==='week'?'soft-btn active':'soft-btn'} onClick={()=>setUpcomingPeriod('week')}>Tuần tới</button><button type="button" className={upcomingPeriod==='month'?'soft-btn active':'soft-btn'} onClick={()=>setUpcomingPeriod('month')}>Tháng tới</button><button type="button" className={upcomingPeriod==='quarter'?'soft-btn active':'soft-btn'} onClick={()=>setUpcomingPeriod('quarter')}>Quý tới</button></div><div className="checklist-definition-list">{upcomingTasks.map(task=><article className="checklist-definition-row" key={task.id}><div><b>{task.title}</b><small>{task.targetLabel} · Hạn: {dateTime(task.dueAt)} · Phụ trách: {task.assignee}</small><span className="checklist-outcome">{task.status}</span></div></article>)}{upcomingTasks.length===0&&<div className="table-empty-state">Không có lịch Checklist trong khoảng thời gian này.</div>}</div></section>
        </section>
        {suggestions.filter(item=>!todayRuns.some(run=>run.checklistTitle===item.title&&run.targetLabel===item.target)).slice(0,3).length>0&&<section className="panel checklist-section">
          <div className="panel-head"><div><h2>Công việc nên làm hôm nay</h2><p>Gợi ý tự nguyện từ một số thiết bị quan trọng đã khai báo. Bỏ qua không bị tính quá hạn và không tạo lịch bắt buộc.</p></div></div>
          {suggestions.filter(item=>!todayRuns.some(run=>run.checklistTitle===item.title&&run.targetLabel===item.target)).slice(0,3).map(item=><div className="checklist-suggestion-row" key={item.title}>
            <div><b>{item.title}</b><small>{item.count} thiết bị phù hợp: {item.target}</small></div>
            <button className="soft-btn" disabled={!canExecute} onClick={()=>startRun({id:uid(),organizationId,title:item.title,targetLabel:item.target,categoryKey:'equipment',frequency:'Linh hoạt',enabled:true,assignee:userLabel,questions:makeQuestions(item.questions),source:'equipment-suggestion',createdAt:now(),updatedAt:now()})}>Thực hiện ngay</button>
          </div>)}
        </section>}
        <section className="panel checklist-section">
          <div className="panel-head"><div><h2>Nhóm kiểm tra khởi tạo</h2><p>Bật những nhóm phù hợp với đơn vị. Đây là gợi ý cấu hình, không phải kết luận về nghĩa vụ pháp lý.</p></div></div>
          <div className="checklist-category-grid">{CATEGORIES.map(item=>{
            const setting=settings.find(row=>row.categoryKey===item.key)||blankSetting(organizationId,item.key)
            return <article className={'checklist-category-card'+(setting.enabled?' enabled':'')} key={item.key}>
              <div className="checklist-category-top"><span className="checklist-category-icon">{item.icon}</span><span className={'checklist-enabled-tag'+(setting.enabled?' on':'')}>{setting.enabled?'Đang bật':'Chưa bật'}</span></div>
              <h3>{item.label}</h3><p>{item.description}</p>
              <label className="checklist-inline-field"><span>Chu kỳ gợi ý</span><select value={setting.frequency} disabled={!canManage} onChange={event=>void saveSetting(item.key,{frequency:event.target.value as ChecklistFrequency})}>{FREQUENCIES.map(value=><option key={value}>{value}</option>)}</select></label>
              <label className="checklist-inline-field"><span>Giờ thực hiện</span><input type="time" value={setting.executionTime||'09:00'} disabled={!canManage} onChange={event=>void saveSetting(item.key,{executionTime:event.target.value})}/></label>
              <button className={setting.enabled?'soft-btn':'primary-btn'} disabled={!canManage} onClick={()=>void toggleCategory(item.key)}>{setting.enabled?'Tắt nhóm':'Bật nhóm'}</button>
            </article>
          })}</div>
        </section>
        <section className="panel checklist-section">
          <div className="panel-head"><div><h2>Danh sách Checklist</h2><p>Mỗi Checklist có đối tượng, chu kỳ và biểu mẫu riêng.</p></div><div className="top-actions">{canManage&&<button className="primary-btn" onClick={openNew}><Plus size={15}/> Tạo Checklist</button>}</div></div>
          <div className="checklist-search"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Tìm Checklist hoặc đối tượng kiểm tra…"/></div>
          <div className="checklist-definition-list">{visibleDefinitions.map(item=><article className="checklist-definition-row" key={item.id}>
            <div><b>{item.title}</b><small>{item.targetLabel} · {dueText(item.frequency)} · Phụ trách: {item.assignee}</small><span>{item.questions.length} nội dung kiểm tra · {item.enabled?'Đang hoạt động':'Đã tắt'}</span></div>
            <div className="top-actions">{canManage&&<><button className="soft-btn" onClick={()=>openEdit(item)}>Sửa</button><button className="soft-btn" onClick={()=>void db.checklistDefinitions.update(item.id,{enabled:!item.enabled,updatedAt:now()}).then(refresh)}>{item.enabled?'Tắt':'Bật'}</button></>}{item.enabled&&<button className="primary-btn" onClick={()=>startRun(item)} disabled={!canExecute}>Thực hiện</button>}</div>
          </article>)}{visibleDefinitions.length===0&&<div className="table-empty-state">Chưa có Checklist phù hợp. Bật nhóm khởi tạo hoặc dùng Checklist Builder.</div>}</div>
        </section>
        {suggestions.length>0&&<section className="panel checklist-section"><div className="panel-head"><div><h2>Gợi ý từ danh mục thiết bị</h2><p>Chỉ đề xuất một số loại thiết bị quan trọng đã có trong danh mục; Admin quyết định thêm hay bỏ qua.</p></div></div>
          {suggestions.map((item,index)=><div className="checklist-suggestion-row" key={item.title}><div><b>{item.title}</b><small>{item.count} thiết bị phù hợp: {item.target}</small></div>{canManage&&<button className="soft-btn" onClick={()=>void createDefinition({title:item.title,targetLabel:item.target,categoryKey:'equipment',frequency:'Hàng tuần',executionTime:'09:00',questions:makeQuestions(item.questions),source:'equipment-suggestion'}).then(()=>setNotice('Đã thêm gợi ý vào danh sách Checklist.')).catch(e=>setError(String(e)))}>Thêm Checklist</button>}</div>)}
        </section>}
      </>}
      {tab==='builder'&&<section className="panel checklist-section">
        <div className="panel-head"><div><h2>{editing?'Chỉnh sửa Checklist':'Checklist Builder'}</h2><p>Tạo biểu mẫu từ các nhóm gợi ý, loại thiết bị hoặc nội dung riêng của doanh nghiệp.</p></div>{editing&&<button className="soft-btn" onClick={()=>setEditing(null)}>Checklist mới</button>}</div>
        {!canManage?<p>Tài khoản chỉ có quyền xem cấu hình.</p>:<form className="checklist-builder-form" onSubmit={saveEditor}>
          <label className="field">Tên Checklist *<input required value={title} onChange={event=>setTitle(event.target.value)} placeholder="Ví dụ: Kiểm tra máy nén khí"/></label>
          <label className="field">Đối tượng kiểm tra *<input required value={target} onChange={event=>setTarget(event.target.value)} placeholder="Tên hệ thống, khu vực hoặc loại thiết bị"/></label>
          <label className="field">Nhóm<input value={category} onChange={event=>setCategory(event.target.value as typeof category)} list="checklist-category-options" /><datalist id="checklist-category-options">{CATEGORIES.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}<option value="equipment">Thiết bị</option><option value="custom">Tùy chỉnh</option></datalist></label>
          <label className="field">Chu kỳ<select value={frequency} onChange={event=>setFrequency(event.target.value as ChecklistFrequency)}>{FREQUENCIES.map(value=><option key={value}>{value}</option>)}</select></label>
          <label className="field">Giờ thực hiện<input type="time" value={executionTime} onChange={event=>setExecutionTime(event.target.value)}/></label>
          <label className="field">Người phụ trách<input value={assignee} onChange={event=>setAssignee(event.target.value)} placeholder="Admin, tên KTV hoặc Nhóm KTV"/></label>
          <label className="field full-field">Nội dung kiểm tra *<textarea required rows={7} value={questionText} onChange={event=>setQuestionText(event.target.value)} placeholder={'Mỗi dòng là một nội dung kiểm tra.\nVí dụ: Kiểm tra rò rỉ dầu?\nKiểm tra tiếng ồn bất thường?'} /></label>
          <div className="checklist-builder-note"><ShieldCheck size={16}/> Thay đổi biểu mẫu chỉ áp dụng cho lần kiểm tra sau. Kết quả cũ giữ nguyên nội dung đã thực hiện.</div>
          <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>{setEditing(null);setTitle('');setTarget('');setQuestionText('')}}>Làm mới</button><button type="submit" className="primary-btn"><Check size={15}/> {editing?'Lưu thay đổi':'Tạo Checklist'}</button></div>
        </form>}
      </section>}
      {tab==='history'&&<section className="panel checklist-section"><div className="panel-head"><div><h2>Lịch sử Checklist</h2><p>Lưu độc lập theo tổ chức. Phân biệt lượt không thực hiện với kết quả kiểm tra Không đạt.</p></div></div>
        {missedTasks.length>0&&<><h3 className="checklist-history-subtitle">Không Checklist ({missedTasks.length})</h3><div className="checklist-missed-history">{missedTasks.map(task=><article className="checklist-history-row checklist-missed-row" key={task.id}><div><b>{task.title}</b><small>{task.targetLabel} · Hạn: {dateTime(task.dueAt)} · Phụ trách: {task.assignee}</small><span className="checklist-outcome fail">Không Checklist</span><small>Không thực hiện trong thời gian cho phép (24 giờ).</small></div></article>)}</div></>}
        <h3 className="checklist-history-subtitle">Kết quả đã kiểm tra ({runs.length})</h3>
        <div className="checklist-history-list">{runs.map(row=><article className="checklist-history-row" key={row.id}><div><b>{row.checklistTitle}</b><small>{row.targetLabel} · {dateTime(row.completedAt)} · {row.inspector}</small><span className={row.outcome==='Không đạt'?'checklist-outcome fail':'checklist-outcome pass'}>{row.outcome}</span></div><button className="soft-btn" onClick={()=>setPrintingRun(row)}>In A4</button><details><summary>Xem nội dung</summary><ul>{row.answers.map(answer=><li key={answer.questionId}><b>{answer.result}</b> · {answer.question}{answer.note?' — '+answer.note:''}</li>)}</ul>{row.assignmentHistory&&row.assignmentHistory.length>0&&<><b>Lịch sử phân công</b><ul>{row.assignmentHistory.map((event,index)=><li key={index}>{event.action} · {event.actor} · {dateTime(event.at)}</li>)}</ul></>}{row.outcome==='Không đạt'&&<p>{row.repairRequestCreated?'Đã đánh dấu có tạo Phiếu yêu cầu sửa chữa.':'Chưa tạo Phiếu yêu cầu: '+row.noRepairReason}</p>}</details></article>)}{runs.length===0&&<div className="table-empty-state">Chưa có kết quả kiểm tra.</div>}</div>
      </section>}
      {tab==='reports'&&<section className="panel checklist-section"><div className="panel-head"><div><h2>Báo cáo Checklist</h2><p>Tổng hợp kết quả, người kiểm tra và quyết định tạo Phiếu yêu cầu sửa chữa.</p></div><button className="primary-btn" onClick={()=>void exportExcel()} disabled={!reportRuns.length&&!reportMissedTasks.length}><Download size={15}/> Xuất Excel</button></div>
        <div className="checklist-report-filters"><label>Từ ngày<input type="date" value={reportFrom} max={reportTo||undefined} onChange={event=>setReportFrom(event.target.value)}/></label><label>Đến ngày<input type="date" value={reportTo} min={reportFrom||undefined} onChange={event=>setReportTo(event.target.value)}/></label><button className="soft-btn" onClick={()=>{setReportFrom('');setReportTo('')}}>Toàn bộ thời gian</button></div>
        <div className="checklist-report-summary"><div><small>Tổng lượt kiểm tra</small><b>{reportRuns.length}</b></div><div><small>Đạt</small><b>{reportRuns.filter(row=>row.outcome==='Đạt').length}</b></div><div><small>Không đạt</small><b>{reportRuns.filter(row=>row.outcome==='Không đạt').length}</b></div><div><small>Không Checklist</small><b>{reportMissedTasks.length}</b></div><div><small>Đã tạo Phiếu YC</small><b>{reportRuns.filter(row=>row.repairRequestCreated).length}</b></div><div><small>Không tạo Phiếu YC</small><b>{reportRuns.filter(row=>row.outcome==='Không đạt'&&!row.repairRequestCreated).length}</b></div></div>
        <div className="checklist-report-table-wrap"><table className="table-standard"><thead><tr><th>Thời gian</th><th>Checklist</th><th>Đối tượng</th><th>Kết quả</th><th>Người kiểm tra</th><th>Phiếu YC sửa chữa</th></tr></thead><tbody>{reportRuns.map(row=><tr key={row.id}><td>{dateTime(row.completedAt)}</td><td>{row.checklistTitle}</td><td>{row.targetLabel}</td><td>{row.outcome}</td><td>{row.inspector}</td><td>{row.repairRequestCreated?'Đã tạo':row.outcome==='Không đạt'?'Không tạo: '+row.noRepairReason:'Không phát sinh'}</td></tr>)}</tbody></table>{reportRuns.length===0&&<div className="table-empty-state">Không có kết quả kiểm tra trong khoảng thời gian đã chọn.</div>}</div>
        {reportMissedTasks.length>0&&<div className="checklist-report-table-wrap checklist-missed-report"><h3>Danh sách Không Checklist</h3><table className="table-standard"><thead><tr><th>Hạn thực hiện</th><th>Checklist</th><th>Đối tượng</th><th>Trạng thái</th><th>Phụ trách</th></tr></thead><tbody>{reportMissedTasks.map(row=><tr key={row.id}><td>{dateTime(row.dueAt)}</td><td>{row.title}</td><td>{row.targetLabel}</td><td className="danger">Không Checklist</td><td>{row.assignee}</td></tr>)}</tbody></table></div>}
      </section>}
    </>}
    {printingRun&&<section className="checklist-print-sheet"><header><div><strong>{organizationName}</strong><h1>PHIẾU KẾT QUẢ KIỂM TRA ĐỊNH KỲ</h1></div><div className="checklist-print-meta"><b>{printingRun.outcome}</b><span>Mã phiếu: {printingRun.id}</span></div></header><h2>{printingRun.checklistTitle}</h2><p><b>Đối tượng:</b> {printingRun.targetLabel}</p><p><b>Thời gian:</b> {dateTime(printingRun.completedAt)}　 <b>Người kiểm tra:</b> {printingRun.inspector}</p><table><thead><tr><th style={{width:'7%'}}>STT</th><th>Nội dung kiểm tra</th><th style={{width:'20%'}}>Kết quả</th><th>Ghi chú / thông số</th></tr></thead><tbody>{printingRun.answers.map((answer,index)=><tr key={answer.questionId}><td>{index+1}</td><td>{answer.question}</td><td>{answer.result}</td><td>{answer.note||'—'}</td></tr>)}</tbody></table>{printingRun.outcome==='Không đạt'&&<section className="checklist-print-failure"><b>Xử lý nội dung không đạt</b><p>{printingRun.repairRequestCreated?'Đã đánh dấu tạo Phiếu yêu cầu sửa chữa riêng.':'Chưa tạo Phiếu yêu cầu sửa chữa.'}</p>{printingRun.noRepairReason&&<p><b>Lý do:</b> {printingRun.noRepairReason}</p>}</section>}<footer><div>Người kiểm tra<br/><br/><br/><b>{printingRun.inspector}</b></div><div>Người xác nhận<br/><br/><br/><b>(Ký, ghi rõ họ tên)</b></div></footer></section>}
    {running&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)void cancelRun()}}><section className="modal checklist-run-modal"><div className="modal-head"><div><div className="eyebrow">PHIẾU KIỂM TRA</div><h2>{running.title}</h2><p>{running.targetLabel}</p></div><button className="icon-btn" onClick={()=>void cancelRun()}><X size={17}/></button></div>
      <form onSubmit={completeRun} className="checklist-run-form">
        {running.questions.map((question,index)=><div className="checklist-question" key={question.id}><b>{index+1}. {question.label}</b><div className="checklist-answer-options">{(['Đạt','Không đạt','Không áp dụng'] as const).map(value=><button type="button" className={(answers[question.id]?.result===value?'selected ':'')+(value==='Không đạt'?'bad':'')} key={value} onClick={()=>setAnswers(current=>({...current,[question.id]:{...current[question.id],result:value}}))}>{value}</button>)}</div><input value={answers[question.id]?.note||''} onChange={event=>setAnswers(current=>({...current,[question.id]:{...current[question.id],note:event.target.value}}))} placeholder="Ghi chú / thông số đo (nếu có)"/></div>)}
        {running.questions.some(q=>answers[q.id]?.result==='Không đạt')&&<div className="checklist-failure-box"><b>Có nội dung kiểm tra Không đạt</b><label><input type="checkbox" checked={repairCreated} onChange={event=>setRepairCreated(event.target.checked)}/> Đã tạo Phiếu yêu cầu sửa chữa riêng</label>{!repairCreated&&<label className="field">Lý do chưa tạo Phiếu yêu cầu *<textarea rows={2} value={noRepairReason} onChange={event=>setNoRepairReason(event.target.value)} required/></label>}<small>Phiếu Checklist vẫn lưu kết quả Không đạt. Việc đánh dấu này không tự tạo Phiếu YC trong phân hệ Bảo dưỡng – Sửa chữa.</small></div>}
        <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>void cancelRun()}>Hủy</button><button type="submit" className="primary-btn"><Check size={15}/> Lưu kết quả</button></div>
      </form>
    </section></div>}
  </div>
}
