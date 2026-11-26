import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, Check, ClipboardCheck, Download, History, Plus, QrCode, Settings2, ShieldCheck, X } from 'lucide-react'
import { downloadExcelReport } from './lib/excelExport'
import { db, now, uid, type Asset, type ChecklistCategoryKey, type ChecklistCategorySetting, type ChecklistDefinition, type ChecklistFrequency, type ChecklistQuestion, type ChecklistRun, type ChecklistTask } from './db'
import { ensureChecklistOccurrences, checklistLocalDateKey, CHECKLIST_GRACE_PERIOD_MS } from './lib/checklistSchedule'
import ChecklistQrScanner from './ChecklistQrScanner'
import { supabase } from './lib/supabase'
import { isPcPlatform } from './lib/platform'
import { loadChecklistCloud, saveChecklistCategorySetting, saveChecklistDefinition, claimChecklistTask, releaseChecklistTask, completeChecklistTask, completeChecklistManualRun } from './lib/checklistCloud'

type Props = {
  organizationId: string
  organizationName: string
  userLabel: string
  userId: string
  canView: boolean
  canManage: boolean
  canExecute: boolean
  assets: Asset[]
  initialAssetId?: string | null
  onInitialAssetHandled?: () => void
}

const FREQUENCIES: ChecklistFrequency[] = ['Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','Hàng năm','Linh hoạt']
const MANDATORY_EQUIPMENT_CHECKS = [
  'Kiểm tra hình thức bên ngoài: vỏ máy, nắp che, khung đỡ và các bộ phận có dấu hiệu nứt vỡ, biến dạng hoặc hư hỏng?',
  'Kiểm tra vệ sinh, bụi bẩn, độ thông thoáng và dấu hiệu nước/ẩm xâm nhập vào thiết bị?',
  'Kiểm tra dây/cáp nguồn, phích cắm, đầu nối, tiếp địa và dấu hiệu bong tróc hoặc lỏng bất thường bằng quan sát an toàn?',
  'Kiểm tra nguồn cấp và điện áp vận hành có phù hợp thông số thiết bị; ghi nhận giá trị đo khi đủ điều kiện và người thực hiện đủ chuyên môn?'
]
const normalizeChecklistText=(value:string)=>value.trim().toLocaleLowerCase('vi')

const CATEGORIES: Array<{key:ChecklistCategoryKey;label:string;description:string;icon:string;questions:string[]}> = [
  {key:'infrastructure',label:'Cơ sở hạ tầng',description:'Khu vực, kết cấu, cửa, mái, lối đi và điều kiện chung.',icon:'🏢',questions:['Kiểm tra sàn, nền và lối đi có nứt vỡ, trơn trượt, sụt lún hoặc vật cản?','Kiểm tra tường, vách và lớp sơn có nứt, bong tróc hoặc thấm nước?','Kiểm tra trần, mái, máng xối và dấu hiệu dột, võng hoặc hư hỏng?','Kiểm tra cửa đi, cửa sổ, khóa, bản lề và phụ kiện hoạt động bình thường?','Kiểm tra cầu thang, lan can, tay vịn và các vị trí có nguy cơ mất an toàn?','Kiểm tra hành lang, lối thoát hiểm và lối tiếp cận luôn thông thoáng?','Kiểm tra hệ thống chiếu sáng khu vực và đèn sự cố hoạt động bình thường?']},
  {key:'electrical',label:'Hệ thống điện',description:'Tủ điện, nguồn cấp, dây dẫn và điều kiện an toàn điện.',icon:'⚡',questions:['Kiểm tra tủ điện đóng kín, khóa và biển cảnh báo đầy đủ?','Kiểm tra dấu hiệu phát nhiệt, mùi khét, tiếng phóng điện hoặc đổi màu?','Kiểm tra đèn báo pha, đồng hồ đo và thiết bị hiển thị?','Kiểm tra điện áp và dòng tải các pha theo điều kiện vận hành an toàn?','Kiểm tra aptomat, contactor, relay và dấu hiệu tiếp điểm bất thường bằng quan sát?','Kiểm tra đầu cos, thanh cái, dây dẫn và lớp cách điện nhìn thấy được?','Kiểm tra nối đất vỏ tủ, khu vực trước tủ khô ráo và thông thoáng?']},
  {key:'water',label:'Hệ thống nước',description:'Đường ống, van, bơm, bể chứa và dấu hiệu rò rỉ.',icon:'💧',questions:['Kiểm tra đường ống, mặt bích, van và mối nối có rò rỉ?','Kiểm tra áp lực nước đầu vào và đầu ra theo thông số vận hành?','Kiểm tra lưu lượng cấp nước có ổn định?','Kiểm tra van khóa, van một chiều và tình trạng đóng mở?','Kiểm tra máy bơm cấp nước, bơm tăng áp và bơm dự phòng?','Kiểm tra bể chứa, nắp bể, phao điện và cảm biến mức?','Kiểm tra hệ thống thoát nước, phễu thu và dấu hiệu tắc nghẽn?']},
  {key:'fire',label:'Phòng cháy chữa cháy',description:'Lối thoát nạn, phương tiện PCCC và dấu hiệu mất an toàn.',icon:'🧯',questions:['Kiểm tra lối thoát nạn và đường tiếp cận phương tiện chữa cháy thông thoáng?','Kiểm tra bình chữa cháy đúng vị trí, niêm phong và còn hạn kiểm tra?','Kiểm tra tủ/họng chữa cháy, cuộn vòi, lăng phun và van ở tình trạng sẵn sàng?','Kiểm tra tủ trung tâm báo cháy và trạng thái nguồn điện, cảnh báo?','Kiểm tra đầu báo, nút nhấn khẩn cấp bằng quan sát bên ngoài?','Kiểm tra chuông, còi, đèn báo cháy và đèn EXIT?','Kiểm tra đèn chiếu sáng sự cố, cửa chống cháy và biển chỉ dẫn thoát nạn?']}
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(item=>[item.key,item.label])) as Record<ChecklistCategoryKey,string>
const blankSetting = (organizationId:string,key:ChecklistCategoryKey):ChecklistCategorySetting => ({id:organizationId+':'+key,organizationId,categoryKey:key,enabled:false,frequency:key==='infrastructure'?'Hàng tuần':'Hàng ngày',assignee:'Admin',executionTime:'09:00',updatedAt:now()})
const dueText = (frequency:ChecklistFrequency) => frequency==='Linh hoạt'?'Không có lịch cố định':frequency
const dateTime = (value:string) => new Date(value).toLocaleString('vi-VN')
const dateOnly = () => new Date().toLocaleDateString('en-CA')
const checklistPeriodRange = (period:'day'|'week'|'month'|'quarter',reference=new Date()) => {
 const start=new Date(reference);start.setHours(0,0,0,0)
 const end=new Date(start)
 if(period==='day')end.setDate(end.getDate()+1)
 else if(period==='week'){const day=end.getDay()||7;start.setDate(start.getDate()-day+1);end.setTime(start.getTime());end.setDate(end.getDate()+7)}
 else if(period==='month'){start.setDate(1);end.setFullYear(start.getFullYear(),start.getMonth()+1,1)}
 else {const quarter=Math.floor(start.getMonth()/3);start.setMonth(quarter*3,1);end.setFullYear(start.getFullYear(),quarter*3+3,1)}
 return {start:checklistLocalDateKey(start),end:checklistLocalDateKey(end)}
}
const makeQuestions = (lines:string[]):ChecklistQuestion[] => lines.map(label=>({id:uid(),label:label.trim(),required:true})).filter(item=>item.label)

const CHECKLIST_SUGGESTIONS:Record<string,string[]> = {
  pump:[
    'Kiểm tra tình trạng khởi động, dừng và khả năng vận hành của máy bơm?',
    'Kiểm tra áp suất đầu hút, đầu đẩy có nằm trong giới hạn vận hành?',
    'Kiểm tra lưu lượng nước/chất lỏng có ổn định, đúng yêu cầu?',
    'Kiểm tra rò rỉ tại phớt cơ khí, trục bơm, mặt bích và các đầu nối?',
    'Kiểm tra tiếng ồn, rung động bất thường khi máy chạy?',
    'Kiểm tra nhiệt độ ổ bi, thân bơm và động cơ?',
    'Kiểm tra tình trạng chân đế, bu lông neo và khớp nối trục?',
    'Kiểm tra chiều quay động cơ có đúng chiều quy định?',
    'Kiểm tra van hút, van đẩy và van một chiều hoạt động bình thường?',
    'Kiểm tra lưới lọc/rọ hút không bị tắc nghẽn?',
    'Kiểm tra đồng hồ áp suất, lưu lượng và thiết bị đo còn hoạt động?',
    'Kiểm tra tình trạng dầu mỡ bôi trơn theo hướng dẫn của nhà sản xuất?',
    'Kiểm tra dây/cáp điện, đầu cos và hộp cực động cơ?',
    'Kiểm tra dòng điện các pha, điện áp và dấu hiệu mất cân bằng?',
    'Kiểm tra khu vực đặt bơm khô ráo, sạch sẽ, không bị ngập nước?'
  ],
  compressor:[
    'Kiểm tra áp suất khí nén đầu ra và áp suất cài đặt đóng/ngắt?',
    'Kiểm tra rò rỉ khí tại đường ống, van, khớp nối và đầu nối nhanh?',
    'Kiểm tra mức dầu bôi trơn và tình trạng dầu theo khuyến cáo?',
    'Kiểm tra nhiệt độ đầu nén, dầu và khí xả?',
    'Kiểm tra tiếng ồn, rung động bất thường khi vận hành?',
    'Kiểm tra lọc gió đầu vào và dấu hiệu tắc bẩn?',
    'Kiểm tra lọc dầu, lọc tách dầu và dấu hiệu chênh áp bất thường?',
    'Kiểm tra bộ làm mát, quạt giải nhiệt và đường thoát nhiệt?',
    'Kiểm tra bộ xả nước ngưng tự động và bình chứa khí?',
    'Kiểm tra van an toàn, van một chiều và van xả áp?',
    'Kiểm tra dây đai/khớp nối, độ căng và tình trạng mài mòn?',
    'Kiểm tra dòng điện, điện áp và tình trạng đóng cắt contactor?',
    'Kiểm tra rơ le áp suất, cảm biến áp suất và tín hiệu cảnh báo?',
    'Kiểm tra chân đế, bu lông liên kết và độ chắc chắn của máy?',
    'Ghi nhận thời gian chạy, số lần khởi động và cảnh báo trên bộ điều khiển?'
  ],
  motor:[
    'Kiểm tra tiếng ồn và rung động bất thường của động cơ?',
    'Kiểm tra nhiệt độ vỏ động cơ và ổ bi khi vận hành?',
    'Kiểm tra dòng điện từng pha và so sánh độ cân bằng?',
    'Kiểm tra điện áp cấp và tình trạng mất pha/quá áp/thấp áp?',
    'Kiểm tra đầu cốt, hộp cực và độ chắc chắn của các mối nối?',
    'Kiểm tra cáp nguồn, ống luồn và lớp cách điện bên ngoài?',
    'Kiểm tra quạt làm mát, cánh quạt và lưới che gió?',
    'Kiểm tra bụi bẩn, dầu mỡ và tình trạng thông gió?',
    'Kiểm tra chân đế, bu lông và khớp nối với máy công tác?',
    'Kiểm tra dấu hiệu cọ sát, lệch trục hoặc hư hỏng cơ khí?',
    'Kiểm tra thiết bị bảo vệ quá tải, mất pha và nối đất?',
    'Kiểm tra chiều quay và tốc độ theo yêu cầu vận hành?'
  ],
  generator:[
    'Kiểm tra mức nhiên liệu và dấu hiệu rò rỉ tại đường cấp?',
    'Kiểm tra mức dầu bôi trơn và áp suất dầu?',
    'Kiểm tra nước làm mát, két nước, ống dẫn và dấu hiệu rò rỉ?',
    'Kiểm tra tình trạng dây curoa, quạt và két tản nhiệt?',
    'Kiểm tra ắc quy, điện áp ắc quy, đầu cọc và bộ sạc?',
    'Kiểm tra bộ khởi động và khả năng khởi động động cơ?',
    'Kiểm tra rò rỉ dầu, nhiên liệu, nước và khí xả?',
    'Kiểm tra tiếng ồn, rung động và khói xả bất thường?',
    'Kiểm tra điện áp, tần số và dòng điện khi chạy thử theo quy trình?',
    'Kiểm tra bộ điều khiển, đèn báo và cảnh báo lỗi?',
    'Kiểm tra ATS, chế độ Auto/Manual và tín hiệu điều khiển?',
    'Kiểm tra tiếp địa, đầu nối điện và tình trạng cách điện bên ngoài?',
    'Kiểm tra mức nhiên liệu dự trữ và tình trạng thông thoáng phòng máy?',
    'Ghi nhận giờ chạy máy và lịch sử cảnh báo?'
  ],
  electrical:[
    'Kiểm tra tủ điện đóng kín, khóa và biển cảnh báo đầy đủ?',
    'Kiểm tra dấu hiệu phát nhiệt, mùi khét, tiếng phóng điện hoặc đổi màu?',
    'Kiểm tra đèn báo pha, đồng hồ đo và thiết bị hiển thị?',
    'Kiểm tra điện áp các pha và điện áp pha-trung tính?',
    'Kiểm tra dòng tải các pha, dấu hiệu quá tải hoặc lệch pha?',
    'Kiểm tra contactor, relay, aptomat và dấu hiệu tiếp điểm bất thường?',
    'Kiểm tra đầu cos, thanh cái và mối nối có dấu hiệu lỏng?',
    'Kiểm tra dây dẫn, máng cáp và lớp cách điện nhìn thấy được?',
    'Kiểm tra quạt, lọc gió và nhiệt độ bên trong tủ?',
    'Kiểm tra nối đất vỏ tủ và dây PE?',
    'Kiểm tra nhãn mạch, sơ đồ điện và ký hiệu thiết bị?',
    'Kiểm tra khu vực trước tủ điện khô ráo, thông thoáng, không bị che chắn?',
    'Kiểm tra nút dừng khẩn cấp và liên động an toàn theo quy trình?',
    'Ghi nhận cảnh báo hoặc bất thường phát hiện trong ca?'
  ],
  water:[
    'Kiểm tra đường ống, mặt bích, van và mối nối có rò rỉ?',
    'Kiểm tra áp lực nước đầu vào và đầu ra?',
    'Kiểm tra lưu lượng cấp nước có ổn định?',
    'Kiểm tra tình trạng hoạt động của van khóa và van một chiều?',
    'Kiểm tra bơm cấp nước, bơm tăng áp và bơm dự phòng?',
    'Kiểm tra bể chứa, nắp bể và dấu hiệu thấm/rò rỉ?',
    'Kiểm tra phao điện, cảm biến mức và tín hiệu điều khiển?',
    'Kiểm tra đồng hồ áp lực, đồng hồ lưu lượng và đồng hồ nước?',
    'Kiểm tra giá đỡ ống, chống rung và tình trạng ăn mòn?',
    'Kiểm tra khu vực kỹ thuật khô ráo, sạch sẽ và thoát nước tốt?'
  ],
  fire:[
    'Kiểm tra lối thoát nạn và đường tiếp cận phương tiện chữa cháy thông thoáng?',
    'Kiểm tra bình chữa cháy đúng vị trí, còn niêm phong và dễ tiếp cận?',
    'Kiểm tra áp suất bình chữa cháy trong vùng cho phép?',
    'Kiểm tra tem kiểm định, hạn kiểm tra và hướng dẫn sử dụng?',
    'Kiểm tra tủ/họng chữa cháy, cuộn vòi, lăng phun và van?',
    'Kiểm tra bơm chữa cháy chính, dự phòng và bơm bù áp?',
    'Kiểm tra áp lực đường ống và tình trạng rò rỉ?',
    'Kiểm tra tủ trung tâm báo cháy và trạng thái nguồn điện?',
    'Kiểm tra đầu báo khói, đầu báo nhiệt và nút nhấn khẩn?',
    'Kiểm tra chuông, còi, đèn báo cháy và đèn exit?',
    'Kiểm tra đèn chiếu sáng sự cố và nguồn dự phòng?',
    'Kiểm tra cửa chống cháy, tay co và cơ cấu tự đóng?',
    'Kiểm tra biển chỉ dẫn thoát nạn và sơ đồ thoát hiểm?',
    'Ghi nhận lỗi/cảnh báo trên hệ thống PCCC và báo người phụ trách?'
  ],
  infrastructure:[
    'Kiểm tra sàn, nền và lối đi có nứt vỡ, trơn trượt hoặc vật cản?',
    'Kiểm tra tường, vách và lớp sơn có nứt, bong tróc hoặc thấm nước?',
    'Kiểm tra trần, mái và dấu hiệu dột, võng hoặc hư hỏng?',
    'Kiểm tra cửa đi, cửa sổ, khóa và bản lề hoạt động bình thường?',
    'Kiểm tra cầu thang, lan can và tay vịn chắc chắn?',
    'Kiểm tra hành lang, lối thoát hiểm không bị chiếm dụng?',
    'Kiểm tra hệ thống chiếu sáng khu vực hoạt động bình thường?',
    'Kiểm tra thông gió, điều hòa và điều kiện nhiệt độ khu vực?',
    'Kiểm tra hệ thống thoát nước sàn, phễu thu và mùi bất thường?',
    'Kiểm tra dấu hiệu côn trùng, động vật gây hại hoặc mất vệ sinh?',
    'Kiểm tra biển báo, sơ đồ khu vực và nhãn nhận diện?',
    'Kiểm tra khu vực sạch sẽ, thông thoáng và được sắp xếp đúng quy định?'
  ],
  generalEquipment:[
    'Kiểm tra tình trạng hoạt động và khả năng khởi động/dừng thiết bị?',
    'Kiểm tra tiếng ồn, rung động, nhiệt độ bất thường?',
    'Kiểm tra dấu hiệu rò rỉ dầu, nước, khí hoặc hóa chất?',
    'Kiểm tra dây điện, đầu nối và thiết bị bảo vệ bên ngoài?',
    'Kiểm tra che chắn an toàn, nắp bảo vệ và nút dừng khẩn cấp?',
    'Kiểm tra bu lông, chân đế, khung máy và liên kết cơ khí?',
    'Kiểm tra vệ sinh, bụi bẩn và điều kiện thông gió?',
    'Kiểm tra đồng hồ, cảm biến, đèn báo và cảnh báo lỗi?',
    'Kiểm tra khu vực xung quanh thiết bị thông thoáng, không có vật cản?',
    'Ghi nhận thông số vận hành và bất thường so với trạng thái bình thường?'
  ],
  generalArea:[
    'Kiểm tra khu vực sạch sẽ, thông thoáng và không có vật cản?',
    'Kiểm tra sàn, tường, trần và cửa không có dấu hiệu hư hỏng?',
    'Kiểm tra chiếu sáng và thông gió khu vực?',
    'Kiểm tra lối đi, lối thoát hiểm và biển chỉ dẫn?',
    'Kiểm tra dấu hiệu thấm dột, rò rỉ nước hoặc đọng nước?',
    'Kiểm tra ổ cắm, công tắc và dây dẫn nhìn thấy được an toàn?',
    'Kiểm tra phương tiện PCCC tại khu vực dễ tiếp cận?',
    'Kiểm tra vệ sinh, mùi lạ, côn trùng và điều kiện môi trường?',
    'Kiểm tra hệ thống thoát nước và khả năng thoát nước?',
    'Ghi nhận các hư hỏng cần xử lý hoặc theo dõi?'
  ]
}
const checklistSuggestionSet=(targetKind:'equipment'|'other',asset:Asset|undefined,category:ChecklistCategoryKey|'equipment'|'custom',target:string)=>{
 const subject=((asset?.name||'')+' '+(asset?.category||'')+' '+target).toLocaleLowerCase('vi')
 if(targetKind==='equipment'){
  if(/bơm|pump/.test(subject))return {label:'Gợi ý cho máy bơm',items:CHECKLIST_SUGGESTIONS.pump}
  if(/nén khí|máy nén|compressor|sấy khí/.test(subject))return {label:'Gợi ý cho máy nén khí',items:CHECKLIST_SUGGESTIONS.compressor}
  if(/động cơ|motor/.test(subject))return {label:'Gợi ý cho động cơ điện',items:CHECKLIST_SUGGESTIONS.motor}
  if(/máy phát|generator/.test(subject))return {label:'Gợi ý cho máy phát điện',items:CHECKLIST_SUGGESTIONS.generator}
  return {label:'Gợi ý kiểm tra thiết bị',items:CHECKLIST_SUGGESTIONS.generalEquipment}
 }
 if(category==='electrical'||/tủ điện|điện|cáp điện/.test(subject))return {label:'Gợi ý cho hệ thống điện',items:CHECKLIST_SUGGESTIONS.electrical}
 if(category==='water'||/nước|đường ống|bể chứa/.test(subject))return {label:'Gợi ý cho hệ thống nước',items:CHECKLIST_SUGGESTIONS.water}
 if(category==='fire'||/pccc|phòng cháy|chữa cháy|báo cháy/.test(subject))return {label:'Gợi ý cho PCCC',items:CHECKLIST_SUGGESTIONS.fire}
 return {label:'Gợi ý cho cơ sở hạ tầng / khu vực',items:CHECKLIST_SUGGESTIONS.infrastructure.concat(CHECKLIST_SUGGESTIONS.generalArea)}
}

export function ChecklistDashboardSummary({organizationId,onOpen}:{organizationId:string;onOpen:()=>void}) {
 const [tasks,setTasks]=useState<ChecklistTask[]>([])
 useEffect(()=>{let active=true
   const load=async()=>{try{if(organizationId==='local-preview'){await ensureChecklistOccurrences(organizationId);const rows=await db.checklistTasks.where('organizationId').equals(organizationId).toArray();if(active)setTasks(rows)}else if(supabase&&navigator.onLine){const bundle=await loadChecklistCloud(supabase,organizationId,false);if(active)setTasks(bundle.tasks)}}catch{}}
   void load();const timer=window.setInterval(()=>void load(),60_000);return()=>{active=false;window.clearInterval(timer)}
 },[organizationId])
 const currentMs=Date.now()
 const actionable=tasks.filter(item=>(item.status==='Chờ thực hiện'||item.status==='Đang thực hiện')&&new Date(item.dueAt).getTime()<=currentMs&&currentMs-new Date(item.dueAt).getTime()<CHECKLIST_GRACE_PERIOD_MS)
 const missed=tasks.filter(item=>item.status==='Không Checklist')
 return <section className="overview-section"><div className="overview-section-head"><div><div className="eyebrow">KIỂM TRA ĐỊNH KỲ</div><h2>Checklist</h2><p>Chỉ hiển thị lượt đã đến hạn; lượt bị bỏ qua được lưu riêng trong lịch sử.</p></div><button type="button" className="text-btn" onClick={onOpen}>Mở Checklist →</button></div><div className="stat-grid checklist-dashboard-stats"><div className="stat-card"><div><small>Đến hạn cần làm</small><strong>{actionable.length}</strong><span>Trong thời gian cho phép</span></div></div><div className="stat-card"><div><small>Không Checklist</small><strong>{missed.length}</strong><span>Đã quá thời gian cho phép</span></div></div></div>{actionable.length>0&&<div className="checklist-definition-list">{actionable.slice(0,5).map(task=><article className="checklist-definition-row" key={task.id}><div><b>{task.title}</b><small>{task.targetLabel} · Hạn: {dateTime(task.dueAt)} · {task.assignee}</small><span className="checklist-outcome">{task.status}</span></div></article>)}</div>}</section>
}
export default function ChecklistPanel({organizationId,organizationName,userLabel,userId,canView,canManage,canExecute,assets,initialAssetId,onInitialAssetHandled}:Props) {
  const [settings,setSettings]=useState<ChecklistCategorySetting[]>([])
  const [definitions,setDefinitions]=useState<ChecklistDefinition[]>([])
  const [runs,setRuns]=useState<ChecklistRun[]>([])
  const [tasks,setTasks]=useState<ChecklistTask[]>([])
  const [runningTaskId,setRunningTaskId]=useState<string|null>(null)
  const [runningManualRunId,setRunningManualRunId]=useState<string|null>(null)
  const [savingRun,setSavingRun]=useState(false)
  const [tab,setTab]=useState<'overview'|'builder'|'history'|'reports'>('overview')
  const [workPeriod,setWorkPeriod]=useState<'day'|'week'|'month'|'quarter'>('day')
  const [showSuggestions,setShowSuggestions]=useState(false)
  const [showStarterGroups,setShowStarterGroups]=useState(false)
  const [showBuilderForm,setShowBuilderForm]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [editing,setEditing]=useState<ChecklistDefinition|null>(null)
  const [running,setRunning]=useState<ChecklistDefinition|null>(null)
  const [answers,setAnswers]=useState<Record<string,{result:'Đạt'|'Không đạt'|'Bỏ qua'|'';note:string}>>({})
  const [repairCreated,setRepairCreated]=useState(false)
  const [noRepairReason,setNoRepairReason]=useState('')
  const [title,setTitle]=useState('')
  const [target,setTarget]=useState('')
  const [targetKind,setTargetKind]=useState<'equipment'|'other'>('other')
  const [targetAssetId,setTargetAssetId]=useState('')
  const [category,setCategory]=useState<ChecklistCategoryKey|'equipment'|'custom'>('custom')
  const [frequency,setFrequency]=useState<ChecklistFrequency>('Hàng tháng')
  const [executionTime,setExecutionTime]=useState('09:00')
  const [questionText,setQuestionText]=useState('')
  const [selectedSuggestionLabels,setSelectedSuggestionLabels]=useState<string[]>([])
  const [assignee,setAssignee]=useState('Admin')
  const [search,setSearch]=useState('')
  const [reportFrom,setReportFrom]=useState('')
  const [reportTo,setReportTo]=useState('')
  const [printingRun,setPrintingRun]=useState<ChecklistRun|null>(null)
  const [qrOpen,setQrOpen]=useState(false)
  const [qrSearching,setQrSearching]=useState(false)
  const [qrAssetLabel,setQrAssetLabel]=useState('')
  const [qrCandidates,setQrCandidates]=useState<Array<{definition:ChecklistDefinition;task:ChecklistTask}>>([])
  const [isOnline,setIsOnline]=useState(()=>typeof navigator==='undefined'?false:navigator.onLine)
  const canExecuteHere=canExecute&&isOnline&&!isPcPlatform()
  useEffect(()=>{
    const updateOnline=()=>setIsOnline(navigator.onLine)
    window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline)
    return()=>{window.removeEventListener('online',updateOnline);window.removeEventListener('offline',updateOnline)}
  },[])

  useEffect(()=>{if(!canExecuteHere)setQrOpen(false)},[canExecuteHere])

  const refresh=async(ensureCloudSchedule=false)=>{
    setLoading(true)
    try{
      if(organizationId!=='local-preview'){
        if(!supabase)throw new Error('Chưa kết nối Supabase. Không thể tải Checklist Cloud.')
        const bundle=await loadChecklistCloud(supabase,organizationId,canManage,ensureCloudSchedule)
        const merged=CATEGORIES.map(item=>bundle.settings.find(row=>row.categoryKey===item.key)||blankSetting(organizationId,item.key))
        setSettings(merged);setDefinitions(bundle.definitions.sort((a,b)=>a.title.localeCompare(b.title,'vi')))
        setRuns(bundle.runs);setTasks(bundle.tasks)
      }else{
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
      }
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
    finally{setLoading(false)}
  }
  const runManagementAction=async(action:()=>Promise<unknown>)=>{
    try{setError('');await action()}
    catch(cause){setError(cause instanceof Error?cause.message:String(cause));await refresh()}
  }
  useEffect(()=>{void refresh(true)},[organizationId,userId,canManage])
  useEffect(()=>{const timer=window.setInterval(()=>{if(organizationId==='local-preview'){void ensureChecklistOccurrences(organizationId).then(()=>db.checklistTasks.where('organizationId').equals(organizationId).toArray()).then(setTasks).catch(()=>{})}else if(navigator.onLine){void refresh()}},60_000);return()=>window.clearInterval(timer)},[organizationId,canManage,userId])
  useEffect(()=>{
    if(!printingRun)return
    const handleAfterPrint=()=>setPrintingRun(null)
    window.addEventListener('afterprint',handleAfterPrint)
    const frame=window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>window.print()))
    return()=>{window.cancelAnimationFrame(frame);window.removeEventListener('afterprint',handleAfterPrint)}
  },[printingRun])

  const enabledCount=settings.filter(item=>item.enabled).length
  const todayRuns=runs.filter(item=>checklistLocalDateKey(new Date(item.completedAt))===dateOnly())
  const reportRuns=useMemo(()=>runs.filter(item=>{const day=checklistLocalDateKey(new Date(item.completedAt));return (!reportFrom||day>=reportFrom)&&(!reportTo||day<=reportTo)}),[runs,reportFrom,reportTo])
  const reportMissedTasks=useMemo(()=>tasks.filter(item=>item.status==='Không Checklist'&&(!reportFrom||item.dueDate>=reportFrom)&&(!reportTo||item.dueDate<=reportTo)),[tasks,reportFrom,reportTo])
  const currentMs=Date.now()
  const periodRange=checklistPeriodRange(workPeriod)
  const periodFrequency:Record<typeof workPeriod,ChecklistFrequency>={day:'Hàng ngày',week:'Hàng tuần',month:'Hàng tháng',quarter:'Hàng quý'}
  const selectedFrequency=periodFrequency[workPeriod]
  const periodTasks=tasks.filter(item=>item.frequency===selectedFrequency&&(item.status==='Chờ thực hiện'||item.status==='Đang thực hiện')&&item.dueDate>=periodRange.start&&item.dueDate<periodRange.end&&currentMs-new Date(item.dueAt).getTime()<CHECKLIST_GRACE_PERIOD_MS).sort((a,b)=>a.dueAt.localeCompare(b.dueAt))
  const missedTasks=tasks.filter(item=>item.frequency===selectedFrequency&&item.status==='Không Checklist'&&item.dueDate>=periodRange.start&&item.dueDate<periodRange.end).sort((a,b)=>b.dueAt.localeCompare(a.dueAt))
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

  const saveSetting=async(key:ChecklistCategoryKey,patch:Partial<ChecklistCategorySetting>,refreshAfterSave=true)=>{
    if(!canManage)return
    const current=settings.find(item=>item.categoryKey===key)||blankSetting(organizationId,key)
    const next={...current,...patch,updatedAt:now()}
    if(organizationId!=='local-preview'){
      if(!supabase)throw new Error('Chưa kết nối Supabase.')
      const client=supabase
      await saveChecklistCategorySetting(client,organizationId,userId,next)
      if((patch.frequency&&patch.frequency!==current.frequency)||(patch.executionTime&&patch.executionTime!==(current.executionTime||'09:00'))){
        const defs=definitions.filter(item=>item.categoryKey===key&&item.source==='starter')
        await Promise.all(defs.map(item=>saveChecklistDefinition(client,organizationId,{...item,...(patch.frequency?{frequency:patch.frequency}:{}),...(patch.executionTime?{executionTime:patch.executionTime}:{}),scheduleStartedAt:now(),updatedAt:now()})))
      }
    }else{
      await db.checklistCategorySettings.put(next)
      if((patch.frequency&&patch.frequency!==current.frequency)||(patch.executionTime&&patch.executionTime!==(current.executionTime||'09:00'))){
        const defs=definitions.filter(item=>item.categoryKey===key&&item.source==='starter')
        await Promise.all(defs.map(item=>db.checklistDefinitions.update(item.id,{...(patch.frequency?{frequency:patch.frequency}:{}),...(patch.executionTime?{executionTime:patch.executionTime}:{}),scheduleStartedAt:now(),updatedAt:now()})))
      }
    }
    if(refreshAfterSave)await refresh(true)
  }
  const createDefinition=async(data:{title:string;targetLabel:string;targetAssetId?:string;categoryKey:ChecklistDefinition['categoryKey'];frequency:ChecklistFrequency;executionTime?:string;questions:ChecklistQuestion[];source:ChecklistDefinition['source']})=>{
    if(!canManage)return
    if(!data.title.trim()||!data.targetLabel.trim()||!data.questions.length)throw new Error('Cần nhập tên Checklist, đối tượng kiểm tra và ít nhất một nội dung kiểm tra.')
    const record:ChecklistDefinition={id:uid(),organizationId,title:data.title.trim(),targetLabel:data.targetLabel.trim(),...(data.targetAssetId?{targetAssetId:data.targetAssetId}:{}),categoryKey:data.categoryKey,frequency:data.frequency,enabled:true,assignee:organizationId==='local-preview'?assignee:'Admin',executionTime:data.executionTime||executionTime,questions:data.questions,source:data.source,createdAt:now(),updatedAt:now(),scheduleStartedAt:now()}
    const saved=organizationId!=='local-preview'
      ? await (supabase?saveChecklistDefinition(supabase,organizationId,record):Promise.reject(new Error('Chưa kết nối Supabase.')))
      : (await db.checklistDefinitions.add(record),record)
    await refresh(true)
    return saved
  }
  const toggleCategory=async(key:ChecklistCategoryKey)=>{
    const setting=settings.find(item=>item.categoryKey===key)||blankSetting(organizationId,key)
    const enable=!setting.enabled
    await saveSetting(key,{enabled:enable},false)
    const starters=definitions.filter(item=>item.categoryKey===key&&item.source==='starter')
    if(organizationId!=='local-preview'&&supabase){const client=supabase;await Promise.all(starters.map(item=>saveChecklistDefinition(client,organizationId,{...item,scheduleStartedAt:now(),updatedAt:now()})))}
    else await Promise.all(starters.map(item=>db.checklistDefinitions.update(item.id,{scheduleStartedAt:now(),updatedAt:now()})))
    if(enable&&!definitions.some(item=>item.categoryKey===key)){
      const meta=CATEGORIES.find(item=>item.key===key)!
      await createDefinition({title:'Kiểm tra '+meta.label.toLocaleLowerCase('vi'),targetLabel:meta.label,categoryKey:key,frequency:setting.frequency,executionTime:setting.executionTime||'09:00',questions:makeQuestions(meta.questions),source:'starter'})
      setNotice('Đã bật nhóm gợi ý. Hãy rà soát nội dung và chu kỳ trước khi áp dụng chính thức.')
    }
    await refresh(true)
  }
  const toggleDefinitionEnabled=async(item:ChecklistDefinition)=>{
    if(!canManage)return
    const updated={...item,enabled:!item.enabled,updatedAt:now()}
    try{
      if(organizationId!=='local-preview'){
        if(!supabase)throw new Error('Chưa kết nối Supabase.')
        await saveChecklistDefinition(supabase,organizationId,updated)
      }else await db.checklistDefinitions.update(item.id,{enabled:updated.enabled,updatedAt:updated.updatedAt})
      await refresh(true)
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
  }

  const activeEquipment=assets.filter(asset=>(!asset.archivedAt&&!asset.deletedAt&&asset.status!=='Thanh lý')||asset.id===editing?.targetAssetId)
  const assetTargetLabel=(asset:Asset)=>[asset.name,asset.code?`(${asset.code})`: '',asset.location?`– ${asset.location}`:''].filter(Boolean).join(' ')
  const openNew=(asset?:Asset)=>{setEditing(null);setSelectedSuggestionLabels([]);setTargetKind('equipment');setTargetAssetId(asset?.id||'');setTitle(asset?`Kiểm tra ${asset.name}`:'');setTarget(asset?assetTargetLabel(asset):'');setCategory('equipment');setFrequency('Hàng tháng');setExecutionTime('09:00');setAssignee('Admin');setQuestionText('');setShowBuilderForm(true);setTab('builder')}
  const openEdit=(item:ChecklistDefinition)=>{
    setSelectedSuggestionLabels([]);setEditing(item);setTitle(item.title);setTarget(item.targetLabel);setTargetKind(item.targetAssetId?'equipment':'other');setTargetAssetId(item.targetAssetId||'');setCategory(item.categoryKey);setFrequency(item.frequency);setExecutionTime(item.executionTime||'09:00');setAssignee(item.assignee);setQuestionText(item.questions.map(q=>q.label).filter(label=>!MANDATORY_EQUIPMENT_CHECKS.some(required=>normalizeChecklistText(required)===normalizeChecklistText(label))).join('\n'));setShowBuilderForm(true);setTab('builder')
  }
  useEffect(()=>{if(!initialAssetId)return;const selected=assets.find(asset=>asset.id===initialAssetId&&!asset.archivedAt&&!asset.deletedAt&&asset.status!=='Thanh lý');if(!selected)return;openNew(selected);onInitialAssetHandled?.()},[initialAssetId,assets]);
  const suggestionAsset=targetKind==='equipment'?activeEquipment.find(asset=>asset.id===targetAssetId):undefined
  const suggestionSet=checklistSuggestionSet(targetKind,suggestionAsset,category,target)
  const addSelectedSuggestions=()=>{const selected=suggestionSet.items.filter(item=>selectedSuggestionLabels.includes(item));if(!selected.length)return;const existing=(questionText?questionText.split('\n'):[]).map(item=>item.trim().toLocaleLowerCase('vi'));const additions=selected.filter(item=>!existing.includes(item.trim().toLocaleLowerCase('vi')));setQuestionText(current=>[current,...additions].filter(Boolean).join('\n'));setSelectedSuggestionLabels([])}
  const saveEditor=async(event:FormEvent)=>{
    event.preventDefault()
    if(!canManage)return
    try{
      const optionalQuestions=questionText.split('\n').filter(line=>line.trim());const questionLabels=targetKind==='equipment'?[...MANDATORY_EQUIPMENT_CHECKS,...optionalQuestions]:optionalQuestions;const questions=makeQuestions(questionLabels);if(targetKind==='other'&&questions.length<5)throw new Error('Mẫu Checklist theo hệ thống phải có tối thiểu 5 tiêu chí kiểm tra.')
      if(editing){
        const selectedAsset=targetKind==='equipment'?activeEquipment.find(asset=>asset.id===targetAssetId):undefined
        const targetLabel=selectedAsset?assetTargetLabel(selectedAsset):target.trim()
        if(!targetLabel)throw new Error('Hãy chọn thiết bị hoặc nhập đối tượng kiểm tra.')
        const updated:ChecklistDefinition={...editing,title:title.trim(),targetLabel,...(selectedAsset?{targetAssetId:selectedAsset.id}:{targetAssetId:undefined}),categoryKey:targetKind==='equipment'?'equipment':category,frequency,executionTime,assignee:organizationId==='local-preview'?assignee:'Admin',questions,...(frequency!==editing.frequency||executionTime!==(editing.executionTime||'09:00')?{scheduleStartedAt:now()}:{}),updatedAt:now()}
        if(organizationId!=='local-preview'){if(!supabase)throw new Error('Chưa kết nối Supabase.');await saveChecklistDefinition(supabase,organizationId,updated)}
        else await db.checklistDefinitions.update(editing.id,updated)
        await refresh(true);setEditing(null);setShowBuilderForm(false);setNotice('Đã cập nhật Checklist.')
      }else{
        const selectedAsset=targetKind==='equipment'?activeEquipment.find(asset=>asset.id===targetAssetId):undefined
        const targetLabel=selectedAsset?assetTargetLabel(selectedAsset):target.trim()
        if(!targetLabel)throw new Error('Hãy chọn thiết bị hoặc nhập đối tượng kiểm tra.')
        await createDefinition({title,targetLabel,targetAssetId:selectedAsset?.id,categoryKey:targetKind==='equipment'?'equipment':category,frequency,executionTime,questions,source:targetKind==='equipment'?'equipment-suggestion':'custom'})
        setTitle('');setTarget('');setQuestionText('');setShowBuilderForm(false);setNotice('Đã tạo Checklist.')
      }
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
  }
  const startRun=(item:ChecklistDefinition, taskId:string|null=null)=>{
    setRunning(item);setRunningTaskId(taskId);setRunningManualRunId(taskId?null:uid());setAnswers(Object.fromEntries(item.questions.map(q=>[q.id,{result:'',note:''}])))
    setRepairCreated(false);setNoRepairReason('');setError('')
  }
  const handleQrDetected=async(code:string)=>{
    setQrOpen(false)
    if(!canExecuteHere||!supabase||!navigator.onLine){setError('Cần điện thoại có Internet và tài khoản được quyền thực hiện Checklist.');return}
    setQrSearching(true);setError('');setQrCandidates([])
    try{
      const {data:asset,error:assetError}=await supabase.from('assets').select('id,code,name').eq('organization_id',organizationId).eq('code',code.trim()).is('archived_at',null).is('deleted_at',null).neq('status','Thanh lý').maybeSingle()
      if(assetError)throw assetError
      if(!asset)throw new Error('Không tìm thấy thiết bị có mã QR '+code+'. Hãy kiểm tra đúng tổ chức hoặc tem QR.')
      const latest=await loadChecklistCloud(supabase,organizationId,canManage,canManage)
      setDefinitions(latest.definitions.sort((a,b)=>a.title.localeCompare(b.title,'vi')))
      setTasks(latest.tasks)
      const candidates=latest.tasks.filter(task=>{
        const due=Date.parse(task.dueAt),nowMs=Date.now()
        return task.definitionSnapshot.targetKind==='equipment'&&task.definitionSnapshot.targetAssetId===asset.id&&(task.status==='Chờ thực hiện'||task.status==='Đang thực hiện')&&due<=nowMs&&nowMs-due<CHECKLIST_GRACE_PERIOD_MS
      }).flatMap(task=>{
        const definition=latest.definitions.find(item=>item.id===task.checklistId)
        if(!definition)return []
        return [{definition:{...definition,title:task.title,targetLabel:task.targetLabel,frequency:task.frequency,assignee:task.assignee,categoryKey:task.definitionSnapshot.categoryKey,targetAssetId:task.definitionSnapshot.targetAssetId,questions:task.definitionSnapshot.questions},task}]
      })
      if(!candidates.length)throw new Error('Đã tìm thấy thiết bị '+asset.code+' – '+asset.name+', nhưng hiện không có Checklist thiết bị đến hạn để thực hiện.')
      setQrAssetLabel(asset.code+' – '+asset.name);setQrCandidates(candidates)
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
    finally{setQrSearching(false)}
  }
  const isGroupAssignee=(value:string)=>value.trim().toLocaleLowerCase('vi').startsWith('nhóm')
  const claimTask=async(task:ChecklistTask)=>{
    if(!canExecuteHere||!userId||!isGroupAssignee(task.assignee))return
    if(organizationId!=='local-preview'){
      if(!supabase)return
      try{await claimChecklistTask(supabase,organizationId,task.id);await refresh()}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
      return
    }
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
    if(organizationId!=='local-preview'){
      if(!supabase)return
      try{await releaseChecklistTask(supabase,organizationId,taskId);await refresh()}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
      return
    }
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
    if(!canExecuteHere)return
    if(organizationId!=='local-preview'){
      if(!supabase)return
      const current=tasks.find(row=>row.id===task.id)
      if(!current||current.status==='Hoàn thành'||current.status==='Không Checklist')return
      if(Date.now()-new Date(current.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS){await refresh();return}
      if(current.status==='Đang thực hiện'&&current.claimedByUserId!==userId){setNotice('Công việc đang được một tài khoản khác thực hiện.');return}
      try{if(current.status!=='Đang thực hiện')await claimChecklistTask(supabase,organizationId,current.id);startRun(item,current.id);void refresh()}
      catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
      return
    }
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
    setRunning(null);setRunningTaskId(null);setRunningManualRunId(null);await refresh()
  }
  const completeRun=async(event:FormEvent)=>{
    event.preventDefault()
    if(!running||!canExecuteHere)return
    const missing=running.questions.filter(q=>q.required&&!answers[q.id]?.result)
    if(missing.length){setError('Còn '+missing.length+' nội dung chưa có kết quả.');return}
    const failed=running.questions.some(q=>answers[q.id]?.result==='Không đạt');const passed=running.questions.some(q=>answers[q.id]?.result==='Đạt')
    if(failed&&!repairCreated&&!noRepairReason.trim()){setError('Checklist có mục Không đạt. Hãy ghi lý do chưa tạo Phiếu yêu cầu sửa chữa.');return}
    if(runningTaskId&&organizationId==='local-preview')await ensureChecklistOccurrences(organizationId)
    const taskSnapshot=runningTaskId?(organizationId==='local-preview'?await db.checklistTasks.get(runningTaskId):tasks.find(task=>task.id===runningTaskId)):undefined
    if(runningTaskId&&taskSnapshot&&Date.now()-new Date(taskSnapshot.dueAt).getTime()>=CHECKLIST_GRACE_PERIOD_MS){setError('Đã quá thời gian cho phép. Lượt này được ghi nhận là Không Checklist, không thể lưu kết quả kiểm tra muộn.');await refresh();return}
    if(runningTaskId&&(!taskSnapshot||taskSnapshot.organizationId!==organizationId||taskSnapshot.status!=='Đang thực hiện'||taskSnapshot.claimedByUserId!==userId)){setError('Bạn không còn là người nhận công việc này. Hãy tải lại danh sách trước khi lưu.');return}
    const record:ChecklistRun={
      id:uid(),organizationId,checklistId:running.id,checklistTitle:running.title,categoryLabel:running.categoryKey in CATEGORY_LABEL?CATEGORY_LABEL[running.categoryKey as ChecklistCategoryKey]:running.categoryKey==='equipment'?'Thiết bị':'Tùy chỉnh',
      targetLabel:running.targetLabel,frequency:running.frequency,
      answers:running.questions.map(q=>({questionId:q.id,question:q.label,result:(answers[q.id]?.result||'Bỏ qua') as 'Đạt'|'Không đạt'|'Bỏ qua',note:answers[q.id]?.note||''})),
      outcome:failed?'Không đạt':passed?'Đạt':'Bỏ qua',inspector:userLabel,completedAt:now(),repairRequestCreated:failed&&repairCreated,noRepairReason:failed&&!repairCreated?noRepairReason.trim():undefined,
      assignmentHistory:taskSnapshot?.assignmentEvents||[],
      checklistSnapshot:running.questions.map(q=>({...q}))
    }
    if(organizationId!=='local-preview'){
      if(savingRun)return
      setSavingRun(true)
      try{
        if(!supabase)throw new Error('Chưa kết nối Supabase.')
        const payload={run_id:runningManualRunId,answers:record.answers,inspector:userLabel,checklist_title:record.checklistTitle,category_label:record.categoryLabel,target_label:record.targetLabel,frequency:record.frequency,repair_request_created:record.repairRequestCreated,no_repair_reason:record.noRepairReason||null,checklist_snapshot:record.checklistSnapshot}
        if(runningTaskId)await completeChecklistTask(supabase,organizationId,runningTaskId,payload)
        else await completeChecklistManualRun(supabase,organizationId,running.id,payload)
      }catch(cause){setError(cause instanceof Error?cause.message:String(cause));setSavingRun(false);return}
      setSavingRun(false)
    }else if(runningTaskId){
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
    setRunning(null);setRunningTaskId(null);setRunningManualRunId(null);setNotice('Đã lưu kết quả kiểm tra lên Cloud và cập nhật lịch sử Checklist.');await refresh()
  }
  const exportExcel=async()=>{
    const headers=['Ngày giờ','Tên Checklist','Đối tượng kiểm tra','Kết quả','Người kiểm tra','Phiếu yêu cầu sửa chữa','Lý do chưa tạo phiếu']
    const rows=[
      ...reportRuns.map(row=>({
        'Ngày giờ':dateTime(row.completedAt),
        'Tên Checklist':row.checklistTitle,
        'Đối tượng kiểm tra':row.targetLabel,
        'Kết quả':row.outcome,
        'Người kiểm tra':row.inspector,
        'Phiếu yêu cầu sửa chữa':row.repairRequestCreated?'Đã tạo':row.outcome==='Không đạt'?'Không tạo':'Không phát sinh',
        'Lý do chưa tạo phiếu':row.noRepairReason||''
      })),
      ...reportMissedTasks.map(row=>({
        'Ngày giờ':dateTime(row.dueAt),
        'Tên Checklist':row.title,
        'Đối tượng kiểm tra':row.targetLabel,
        'Kết quả':'Không Checklist',
        'Người kiểm tra':'—',
        'Phiếu yêu cầu sửa chữa':'—',
        'Lý do chưa tạo phiếu':'Quá thời gian cho phép; không thực hiện kiểm tra'
      }))
    ]
    await downloadExcelReport(rows,'bao-cao-checklist.xlsx','BÁO CÁO KIỂM TRA ĐỊNH KỲ (CHECKLIST)','Báo cáo Checklist',headers,'landscape',organizationName)
  }

  if(!canView)return <div className="panel"><p>Tài khoản chưa được cấp quyền xem Checklist.</p></div>
  return <div className="checklist-workspace">
    <section className="welcome checklist-welcome"><div><div className="eyebrow">BAOTRI MINI · KIỂM TRA ĐỊNH KỲ</div><h2>Checklist</h2><p>Thiết lập nội dung kiểm tra và lưu kết quả độc lập với lịch sử thiết bị.</p><small>{organizationName}</small></div><div className="welcome-icon"><ClipboardCheck size={40}/></div></section>
    <div className="checklist-connectivity-notice" data-online-guard={!isOnline?"offline":isPcPlatform()?"desktop":"online"}>{!isOnline?"Mất kết nối Internet. Các thao tác thực hiện Checklist đã bị khóa.":isPcPlatform()?"Trên PC chỉ quản lý mẫu, xem lịch sử, báo cáo và in. Thực hiện Checklist bằng điện thoại.":"Đang trực tuyến · Có thể thực hiện Checklist trên điện thoại."}</div>
    <div className="checklist-tabs">
      <button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><ClipboardCheck size={15}/> Tổng quan</button>
      <button className={tab==='builder'?'active':''} onClick={()=>setTab('builder')}><Settings2 size={15}/> Quản lý mẫu</button>
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
          <div className="stat-card"><div><small>Không đạt</small><strong>{runs.filter(item=>item.outcome==='Không đạt').length}</strong><span>Không tự chuyển thành đạt</span></div><div><small>Bỏ qua</small><strong>{runs.filter(item=>item.outcome==='Bỏ qua').length}</strong><span>Không tính là Đạt</span></div></div>
        </div>
        <section className="panel checklist-section">
          <div className="panel-head"><div><h2>Công việc cần thực hiện</h2><p>Chỉ hiển thị Checklist có chu kỳ tương ứng với kỳ đã chọn (Ngày: Hàng ngày, Tuần: Hàng tuần, Tháng: Hàng tháng, Quý: Hàng quý). Công việc hoàn thành sẽ ẩn khỏi danh sách; quá 24 giờ sau giờ đến hạn sẽ chuyển thành Không Checklist. Checklist Hàng năm xem trong Lịch sử và Báo cáo.</p></div></div>
          <div className="checklist-upcoming-filters checklist-period-tabs"><button type="button" className={workPeriod==='day'?'soft-btn active':'soft-btn'} onClick={()=>setWorkPeriod('day')}>Ngày</button><button type="button" className={workPeriod==='week'?'soft-btn active':'soft-btn'} onClick={()=>setWorkPeriod('week')}>Tuần</button><button type="button" className={workPeriod==='month'?'soft-btn active':'soft-btn'} onClick={()=>setWorkPeriod('month')}>Tháng</button><button type="button" className={workPeriod==='quarter'?'soft-btn active':'soft-btn'} onClick={()=>setWorkPeriod('quarter')}>Quý</button></div>
          {!isPcPlatform()&&<div className="checklist-qr-actions"><button type="button" className="primary-btn" onClick={()=>setQrOpen(true)} disabled={!canExecuteHere||qrSearching}><QrCode size={16}/> {qrSearching?'Đang tìm thiết bị…':'Quét QR thiết bị'}</button><small>Checklist thiết bị chỉ mở từ mã QR trên tem. Checklist hệ thống vẫn chọn thủ công bên dưới.</small></div>}
          <div className="checklist-report-summary"><div><small>Công việc {selectedFrequency.toLocaleLowerCase('vi')} trong kỳ</small><b>{periodTasks.length}</b></div><div><small>Không Checklist trong kỳ</small><b>{missedTasks.length}</b></div></div>
          <div className="checklist-definition-list">
            {periodTasks.map(task=>{
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
                  {groupTask&&task.status==='Chờ thực hiện'&&<button className="primary-btn" disabled={!canExecuteHere} onClick={()=>void claimTask(task)}>Nhận việc</button>}
                  {groupTask&&task.status==='Đang thực hiện'&&task.claimedByUserId===userId&&<><button className="primary-btn" disabled={!canExecuteHere} onClick={()=>void beginTask(task,runnable)}>Thực hiện</button><button className="soft-btn" onClick={()=>void releaseTask(task.id).then(()=>refresh())}>Trả lại nhóm</button></>}
                  {groupTask&&task.status==='Đang thực hiện'&&task.claimedByUserId!==userId&&<small>Đang xử lý bởi {task.claimedBy||'thành viên khác'}</small>}
                  {!groupTask&&Boolean(definition?.targetAssetId)&&<small>Checklist thiết bị: quét mã QR trên tem để thực hiện</small>}
                  {!groupTask&&!definition?.targetAssetId&&directAllowed&&<button className="primary-btn" disabled={!canExecuteHere} onClick={()=>void beginTask(task,runnable)}>Thực hiện thủ công</button>}
                  {!groupTask&&!definition?.targetAssetId&&!directAllowed&&<small>Chỉ người được giao hoặc Admin thực hiện</small>}
                  {!groupTask&&task.status==='Đang thực hiện'&&task.claimedByUserId!==userId&&<small>Đang xử lý bởi {task.claimedBy}</small>}
                </div>
              </article>
            })}
            {periodTasks.length===0&&<div className="table-empty-state">Không có công việc Checklist cần thực hiện trong kỳ này.</div>}
          </div>
        </section>
        {organizationId==='local-preview'&&suggestions.filter(item=>!todayRuns.some(run=>run.checklistTitle===item.title&&run.targetLabel===item.target)).slice(0,3).length>0&&<section className="panel checklist-section">
          <div className="panel-head"><div><h2>Công việc nên làm hôm nay</h2><p>Gợi ý tự nguyện, không tạo lịch bắt buộc. Bỏ qua không bị tính quá hạn.</p></div><button className="soft-btn" type="button" onClick={()=>setShowSuggestions(value=>!value)}>{showSuggestions?'Thu gọn':'Xem gợi ý thiết bị'}</button></div>
          {showSuggestions&&suggestions.filter(item=>!todayRuns.some(run=>run.checklistTitle===item.title&&run.targetLabel===item.target)).slice(0,3).map(item=><div className="checklist-suggestion-row" key={item.title}>
            <div><b>{item.title}</b><small>{item.count} thiết bị phù hợp: {item.target}</small></div>
            <button className="soft-btn" disabled={!canExecute} onClick={()=>startRun({id:uid(),organizationId,title:item.title,targetLabel:item.target,categoryKey:'equipment',frequency:'Linh hoạt',enabled:true,assignee:userLabel,questions:makeQuestions(item.questions),source:'equipment-suggestion',createdAt:now(),updatedAt:now()})}>Thực hiện ngay</button>
          </div>)}
        </section>}
        
      </>}
      {tab==='builder'&&<>
        <section className="panel checklist-section">
          <div className="panel-head"><div><h2>Quản lý mẫu Checklist</h2><p>Chọn mẫu để sửa. Với mẫu tự tạo, bạn có thể tạm ngừng lịch khi không còn cần kiểm tra định kỳ; dữ liệu lịch sử vẫn được giữ.</p></div>{canManage&&<button className="primary-btn" onClick={()=>openNew()}><Plus size={15}/> Tạo Checklist</button>}</div>
          <div className="checklist-search"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Tìm theo tên mẫu hoặc đối tượng kiểm tra…"/></div>
          <div className="checklist-template-help"><b>Trạng thái lịch là gì?</b><span>Đang tạo lịch: hệ thống tiếp tục sinh các lượt kiểm tra theo chu kỳ. Tạm ngừng lịch: không sinh lượt mới từ mẫu này; bạn có thể tiếp tục lại bất cứ lúc nào. Các lượt đã hoàn thành và lịch sử không bị xóa.</span></div><div className="checklist-definition-list">{definitions.filter(item=>!search.trim()||[item.title,item.targetLabel,item.categoryKey].join(' ').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))).map(item=><article className="checklist-definition-row" key={item.id}>
            <div><b>{item.title}</b><small>{item.targetLabel} · {dueText(item.frequency)} · Phụ trách: {item.assignee}</small><span>{item.questions.length} nội dung kiểm tra · {item.source==='starter'&&!settings.some(setting=>setting.categoryKey===item.categoryKey&&setting.enabled)?'Nhóm khởi tạo chưa được bật':item.enabled?'Đang tạo lịch':'Đã tạm ngừng lịch'}</span></div>
            <div className="top-actions">{canManage&&<><button className="primary-btn" onClick={()=>openEdit(item)}>Sửa nội dung</button>{item.source!=='starter'&&<button className="soft-btn" title={item.enabled?'Tạm ngừng tạo các lượt kiểm tra mới từ mẫu này':'Tiếp tục tạo lịch kiểm tra theo chu kỳ đã cài đặt'} onClick={()=>void toggleDefinitionEnabled(item)}>{item.enabled?'Tạm ngừng lịch':'Tiếp tục lịch'}</button>}</>}</div>
          </article>)}{definitions.length===0&&<div className="table-empty-state">Chưa có mẫu Checklist. Bạn có thể tạo mẫu mới hoặc bật nhóm khởi tạo bên dưới.</div>}</div>
        </section>
        <section className="panel checklist-section">
          <div className="panel-head"><div><h2>Nhóm mẫu khởi tạo</h2><p>Các mẫu có sẵn để tham khảo. Chỉ bật nhóm thực sự cần dùng; sau đó có thể sửa nội dung như mẫu bình thường.</p></div><button className="soft-btn" type="button" onClick={()=>setShowStarterGroups(value=>!value)}>{showStarterGroups?'Thu gọn':'Cấu hình nhóm mẫu'}</button></div>
          {showStarterGroups&&<div className="checklist-category-grid">{CATEGORIES.map(item=>{
            const setting=settings.find(row=>row.categoryKey===item.key)||blankSetting(organizationId,item.key)
            return <article className={'checklist-category-card'+(setting.enabled?' enabled':'')} key={item.key}>
              <div className="checklist-category-top"><span className="checklist-category-icon">{item.icon}</span><span className={'checklist-enabled-tag'+(setting.enabled?' on':'')}>{setting.enabled?'Đang bật':'Chưa bật'}</span></div>
              <h3>{item.label}</h3><p>{item.description}</p>
              <label className="checklist-inline-field"><span>Chu kỳ</span><select value={setting.frequency} disabled={!canManage} onChange={event=>void runManagementAction(()=>saveSetting(item.key,{frequency:event.target.value as ChecklistFrequency}))}>{FREQUENCIES.map(value=><option key={value}>{value}</option>)}</select></label>
              <label className="checklist-inline-field"><span>Giờ thực hiện</span><input type="time" value={setting.executionTime||'09:00'} disabled={!canManage} onChange={event=>void runManagementAction(()=>saveSetting(item.key,{executionTime:event.target.value}))}/></label>
              <button className={setting.enabled?'soft-btn':'primary-btn'} disabled={!canManage} onClick={()=>void runManagementAction(()=>toggleCategory(item.key))}>{setting.enabled?'Tắt nhóm':'Bật nhóm'}</button>
            </article>
          })}</div>}
        </section>
        {showBuilderForm&&<div className="checklist-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget){setShowBuilderForm(false);setEditing(null)}}}><section className="checklist-editor-modal" role="dialog" aria-modal="true" aria-labelledby="checklist-editor-title">
          <div className="panel-head"><div><h2 id="checklist-editor-title">{editing?'Sửa nội dung Checklist':'Tạo mẫu Checklist'}</h2><p>Thêm, sửa hoặc xóa từng nội dung kiểm tra. Các lượt đã phát sinh vẫn giữ nguyên bản chụp cũ.</p></div><button type="button" className="soft-btn" onClick={()=>{setShowBuilderForm(false);setEditing(null)}}>Đóng</button></div>
          {!canManage?<p>Tài khoản chỉ có quyền xem cấu hình.</p>:<form className="checklist-builder-form" onSubmit={saveEditor}>
            <label className="field">Đối tượng kiểm tra *<select value={targetKind} onChange={event=>{const kind=event.target.value as 'equipment'|'other';setTargetKind(kind);setTargetAssetId('');setTarget('');setSelectedSuggestionLabels([]);if(kind==='equipment')setCategory('equipment');else setCategory('custom')}}><option value="equipment">Thiết bị trong danh mục</option><option value="other">Hạ tầng / khu vực / hệ thống khác</option></select></label>
            {targetKind==='equipment'?<label className="field">Chọn thiết bị *<select required value={targetAssetId} onChange={event=>{const id=event.target.value;setTargetAssetId(id);setSelectedSuggestionLabels([]);const asset=activeEquipment.find(item=>item.id===id);if(asset){setTarget(assetTargetLabel(asset));if(!title.trim())setTitle(`Kiểm tra ${asset.name}`)}}}><option value="">-- Chọn thiết bị đã khai báo --</option>{activeEquipment.map(asset=><option key={asset.id} value={asset.id}>{asset.code} · {asset.name}{asset.location?` · ${asset.location}`:''}</option>)}</select>{activeEquipment.length===0&&<small>Chưa có thiết bị đang quản lý để chọn. Hãy khai báo thiết bị trước hoặc chọn đối tượng khác.</small>}</label>:<label className="field">Tên hạ tầng / khu vực / hệ thống *<input required value={target} onChange={event=>setTarget(event.target.value)} placeholder="Ví dụ: Tủ điện tầng 1, khu vực kho…"/></label>}
            <label className="field">Tên Checklist *<input required value={title} onChange={event=>setTitle(event.target.value)} placeholder="Ví dụ: Kiểm tra máy nén khí"/></label>
            {targetKind==='other'&&<label className="field">Nhóm<input value={category} onChange={event=>setCategory(event.target.value as typeof category)} list="checklist-category-options" /><datalist id="checklist-category-options">{CATEGORIES.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}<option value="custom">Tùy chỉnh</option></datalist></label>}
            {targetKind==='equipment'&&<div className="checklist-builder-note full-field">Đang kiểm tra một thiết bị đã khai báo. Chu kỳ Checklist được Admin chọn riêng, không lấy theo chu kỳ bảo trì của thiết bị.</div>}
            <label className="field">Chu kỳ<select value={frequency} onChange={event=>setFrequency(event.target.value as ChecklistFrequency)}>{FREQUENCIES.map(value=><option key={value}>{value}</option>)}</select></label>
            <label className="field">Giờ thực hiện<input type="time" value={executionTime} onChange={event=>setExecutionTime(event.target.value)}/></label>
            {organizationId!=='local-preview'?<label className="field">Người phụ trách<input value="Admin" readOnly/><small>Giai đoạn 1: Admin thực hiện. Phân công KTV sẽ bổ sung ở giai đoạn 2.</small></label>:<label className="field">Người phụ trách<input value={assignee} onChange={event=>setAssignee(event.target.value)} placeholder="Admin, tên KTV hoặc Nhóm KTV"/></label>}
            <div className="field full-field checklist-suggestion-picker"><span>Nội dung gợi ý · {suggestionSet.label}</span><p>Chọn những mục phù hợp với thiết bị hoặc khu vực đang kiểm tra. Bạn có thể chọn nhiều mục rồi thêm vào biểu mẫu; nội dung không phù hợp chỉ cần bỏ dấu chọn.</p>
              <div className="checklist-suggestion-options">{suggestionSet.items.map((item,index)=><label className="checklist-suggestion-option" key={item}><input type="checkbox" checked={selectedSuggestionLabels.includes(item)} onChange={event=>setSelectedSuggestionLabels(current=>event.target.checked?[...current,item]:current.filter(value=>value!==item))}/><span>{index+1}. {item}</span></label>)}</div>
              <div className="checklist-suggestion-actions"><button type="button" className="soft-btn checklist-add-selected-btn" disabled={!selectedSuggestionLabels.length} onClick={addSelectedSuggestions}>Thêm {selectedSuggestionLabels.length||''} nội dung đã chọn</button><small>{suggestionSet.items.length} nội dung gợi ý · Có thể tiếp tục thêm nội dung riêng bên dưới</small></div>
            </div>
            <div className="field full-field"><span>Nội dung Checklist đang sử dụng *</span>{targetKind==='equipment'&&<div className="checklist-mandatory-block"><div className="checklist-mandatory-heading"><ShieldCheck size={15}/> 4 NỘI DUNG BẮT BUỘC CHO THIẾT BỊ</div><p>Các mục này tự động có trong mọi Checklist thiết bị, luôn được áp dụng và không thể sửa hoặc xóa.</p><ol>{MANDATORY_EQUIPMENT_CHECKS.map((item,index)=><li key={item}>{index+1}. {item}</li>)}</ol></div>}<p>Các nội dung bổ sung bên dưới có thể sửa trực tiếp, xóa mục không cần hoặc tự thêm câu hỏi riêng.</p>
              <div className="checklist-question-editor">{(questionText?questionText.split('\n'):['']).map((line,index)=><div className="checklist-question-edit-row" key={index}><span>{index+1}.</span><input value={line} onChange={event=>setQuestionText(current=>{const lines=current?current.split('\n'):[''];lines[index]=event.target.value;return lines.join('\n')})} placeholder="Nhập nội dung cần kiểm tra"/><button type="button" className="soft-btn" onClick={()=>setQuestionText(current=>{const lines=current?current.split('\n'):[''];lines.splice(index,1);return lines.join('\n')})}>Xóa</button></div>)}</div>
              <button type="button" className="soft-btn" onClick={()=>setQuestionText(current=>current?current+'\n':'')}>+ Thêm nội dung kiểm tra riêng</button>
            </div>
            <div className="checklist-builder-note"><ShieldCheck size={16}/> Thay đổi biểu mẫu chỉ áp dụng cho lần kiểm tra sau. Kết quả cũ giữ nguyên nội dung đã thực hiện.</div>
            <div className="modal-actions"><button type="submit" className="primary-btn"><Check size={15}/> {editing?'Lưu nội dung Checklist':'Tạo Checklist'}</button></div>
          </form>}
        </section></div>}
      </>}{tab==='history'&&<section className="panel checklist-section"><div className="panel-head"><div><h2>Lịch sử Checklist</h2><p>Lưu độc lập theo tổ chức. Phân biệt lượt không thực hiện với kết quả kiểm tra Không đạt.</p></div></div>
        {missedTasks.length>0&&<><h3 className="checklist-history-subtitle">Không Checklist ({missedTasks.length})</h3><div className="checklist-missed-history">{missedTasks.map(task=><article className="checklist-history-row checklist-missed-row" key={task.id}><div><b>{task.title}</b><small>{task.targetLabel} · Hạn: {dateTime(task.dueAt)} · Phụ trách: {task.assignee}</small><span className="checklist-outcome fail">Không Checklist</span><small>Không thực hiện trong thời gian cho phép (24 giờ).</small></div></article>)}</div></>}
        <h3 className="checklist-history-subtitle">Kết quả đã kiểm tra ({runs.length})</h3>
        <div className="checklist-history-list">{runs.map(row=><article className="checklist-history-row" key={row.id}><div><b>{row.checklistTitle}</b><small>{row.targetLabel} · {dateTime(row.completedAt)} · {row.inspector}</small><span className={row.outcome==='Không đạt'?'checklist-outcome fail':'checklist-outcome pass'}>{row.outcome}</span></div><details><summary>Xem nội dung</summary><ul>{row.answers.map(answer=><li key={answer.questionId}><b>{answer.result}</b> · {answer.question}{answer.note?' — '+answer.note:''}</li>)}</ul>{row.assignmentHistory&&row.assignmentHistory.length>0&&<><b>Lịch sử phân công</b><ul>{row.assignmentHistory.map((event,index)=><li key={index}>{event.action} · {event.actor} · {dateTime(event.at)}</li>)}</ul></>}{row.outcome==='Không đạt'&&<p>{row.repairRequestCreated?'Đã đánh dấu có tạo Phiếu yêu cầu sửa chữa.':'Chưa tạo Phiếu yêu cầu: '+row.noRepairReason}</p>}</details></article>)}{runs.length===0&&<div className="table-empty-state">Chưa có kết quả kiểm tra.</div>}</div>
      </section>}
      {tab==='reports'&&<section className="panel checklist-section"><div className="panel-head"><div><h2>Báo cáo Checklist</h2><p>Tổng hợp kết quả, người kiểm tra và quyết định tạo Phiếu yêu cầu sửa chữa.</p></div><button className="primary-btn" onClick={()=>void exportExcel()} disabled={!reportRuns.length&&!reportMissedTasks.length}><Download size={15}/> Xuất Excel</button></div>
        <div className="checklist-report-filters"><label>Từ ngày<input type="date" value={reportFrom} max={reportTo||undefined} onChange={event=>setReportFrom(event.target.value)}/></label><label>Đến ngày<input type="date" value={reportTo} min={reportFrom||undefined} onChange={event=>setReportTo(event.target.value)}/></label><button className="soft-btn" onClick={()=>{setReportFrom('');setReportTo('')}}>Toàn bộ thời gian</button></div>
        <div className="checklist-report-summary"><div><small>Tổng lượt kiểm tra</small><b>{reportRuns.length}</b></div><div><small>Đạt</small><b>{reportRuns.filter(row=>row.outcome==='Đạt').length}</b></div><div><small>Không đạt</small><b>{reportRuns.filter(row=>row.outcome==='Không đạt').length}</b></div><div><small>Bỏ qua</small><b>{reportRuns.filter(row=>row.outcome==='Bỏ qua').length}</b></div><div><small>Không Checklist</small><b>{reportMissedTasks.length}</b></div><div><small>Đã tạo Phiếu YC</small><b>{reportRuns.filter(row=>row.repairRequestCreated).length}</b></div><div><small>Không tạo Phiếu YC</small><b>{reportRuns.filter(row=>row.outcome==='Không đạt'&&!row.repairRequestCreated).length}</b></div></div>
        <div className="checklist-report-table-wrap"><table className="table-standard"><thead><tr><th>Thời gian</th><th>Checklist</th><th>Đối tượng</th><th>Kết quả</th><th>Người kiểm tra</th><th>Phiếu YC sửa chữa</th><th>Phiếu Checklist</th></tr></thead><tbody>{reportRuns.map(row=><tr key={row.id}><td>{dateTime(row.completedAt)}</td><td>{row.checklistTitle}</td><td>{row.targetLabel}</td><td>{row.outcome}</td><td>{row.inspector}</td><td>{row.repairRequestCreated?'Đã tạo':row.outcome==='Không đạt'?'Không tạo: '+row.noRepairReason:'Không phát sinh'}</td><td><button type="button" className="soft-btn checklist-print-action" onClick={()=>setPrintingRun(row)}>In phiếu A4</button></td></tr>)}</tbody></table>{reportRuns.length===0&&<div className="table-empty-state">Không có kết quả kiểm tra trong khoảng thời gian đã chọn.</div>}</div>
        {reportMissedTasks.length>0&&<div className="checklist-report-table-wrap checklist-missed-report"><h3>Danh sách Không Checklist</h3><table className="table-standard"><thead><tr><th>Hạn thực hiện</th><th>Checklist</th><th>Đối tượng</th><th>Trạng thái</th><th>Phụ trách</th></tr></thead><tbody>{reportMissedTasks.map(row=><tr key={row.id}><td>{dateTime(row.dueAt)}</td><td>{row.title}</td><td>{row.targetLabel}</td><td className="danger">Không Checklist</td><td>{row.assignee}</td></tr>)}</tbody></table></div>}
      </section>}
    </>}
    {printingRun&&<div className="checklist-print-sheet"><div className="asset-print-report equipment-print-report checklist-print-report">
      <header className="equipment-print-org"><div className="equipment-print-org-name">{organizationName||'Đơn vị sử dụng'}</div><div className="equipment-print-brand">BAOTRI MINI · PHIẾU KIỂM TRA ĐỊNH KỲ</div></header>
      <div className="equipment-print-title-row"><div><h1 className="asset-print-form-title">PHIẾU KẾT QUẢ KIỂM TRA ĐỊNH KỲ</h1><h2 className="asset-print-device-name">{printingRun.checklistTitle}</h2><p className="equipment-print-code">Mã phiếu: <strong>{printingRun.id}</strong></p></div><div className="checklist-print-result-stamp">{printingRun.outcome.toLocaleUpperCase('vi')}</div></div>
      <h3 className="equipment-print-section">I. THÔNG TIN KIỂM TRA</h3>
      <table className="equipment-print-info"><tbody>{[['Đối tượng kiểm tra',printingRun.targetLabel],['Nhóm kiểm tra',printingRun.categoryLabel],['Chu kỳ Checklist',printingRun.frequency],['Thời gian hoàn thành',dateTime(printingRun.completedAt)],['Người kiểm tra',printingRun.inspector],['Kết quả tổng thể',printingRun.outcome]].map(([label,value])=><tr key={label}><th>{label}</th><td>{value||'—'}</td></tr>)}</tbody></table>
      <h3 className="equipment-print-section">II. NỘI DUNG VÀ KẾT QUẢ KIỂM TRA</h3>
      <table className="checklist-print-table"><thead><tr><th style={{width:'7%'}}>STT</th><th style={{width:'43%'}}>Nội dung kiểm tra</th><th style={{width:'21%'}}>Kết quả</th><th>Ghi chú / thông số đo</th></tr></thead><tbody>{printingRun.answers.map((answer,index)=><tr key={answer.questionId}><td className="checklist-print-center">{index+1}</td><td>{answer.question}</td><td className="checklist-print-center">{answer.result==='Đạt'?'☑ Đạt':answer.result==='Không đạt'?'☑ Không đạt':(answer.result==='Bỏ qua'||answer.result==='Không áp dụng')?'☑ Bỏ qua':'Chưa ghi nhận'}</td><td>{answer.note||'—'}</td></tr>)}</tbody></table>
      {printingRun.outcome==='Không đạt'&&<><h3 className="equipment-print-section">III. XỬ LÝ NỘI DUNG KHÔNG ĐẠT</h3><div className="equipment-print-notes"><p>{printingRun.repairRequestCreated?'Đã đánh dấu tạo Phiếu yêu cầu sửa chữa riêng.':'Chưa tạo Phiếu yêu cầu sửa chữa.'}</p>{printingRun.noRepairReason&&<p><b>Lý do chưa tạo phiếu:</b> {printingRun.noRepairReason}</p>}</div></>}
      <footer className="equipment-print-footer checklist-print-signatures"><span>Phiếu được lập từ kết quả Checklist đã lưu trên BAOTRI MINI. Các nội dung và kết quả là bản ghi tại thời điểm kiểm tra.</span><strong>Người kiểm tra: {printingRun.inspector}</strong><div className="checklist-print-signature-grid"><div>Người kiểm tra<br/><br/><br/><b>{printingRun.inspector}</b></div><div>Người xác nhận<br/><br/><br/><b>(Ký, ghi rõ họ tên)</b></div></div></footer>
    </div></div>}
    {qrOpen&&<ChecklistQrScanner onDetected={handleQrDetected} onClose={()=>setQrOpen(false)}/>}
    {qrCandidates.length>0&&<div className="checklist-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setQrCandidates([])}}><section className="checklist-editor-modal checklist-qr-results" role="dialog" aria-modal="true" aria-labelledby="checklist-qr-results-title"><div className="panel-head"><div><h2 id="checklist-qr-results-title">Checklist của thiết bị</h2><p>{qrAssetLabel}</p></div><button type="button" className="soft-btn" onClick={()=>setQrCandidates([])}>Đóng</button></div><div className="checklist-definition-list">{qrCandidates.map(({definition,task})=><article className="checklist-definition-row" key={task.id}><div><b>{definition.title}</b><small>{definition.frequency} · Hạn: {dateTime(task.dueAt)} · {task.status}</small><span>{definition.questions.length} tiêu chí kiểm tra</span></div><button type="button" className="primary-btn" disabled={!canExecuteHere||(task.status==='Đang thực hiện'&&task.claimedByUserId!==userId)} onClick={()=>{setQrCandidates([]);void beginTask(task,definition)}}>{task.status==='Đang thực hiện'?'Tiếp tục kiểm tra':'Thực hiện Checklist'}</button></article>)}</div></section></div>}
    {running&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)void cancelRun()}}><section className="modal checklist-run-modal"><div className="modal-head"><div><div className="eyebrow">PHIẾU KIỂM TRA</div><h2>{running.title}</h2><p>{running.targetLabel}</p></div><button className="icon-btn" onClick={()=>void cancelRun()}><X size={17}/></button></div>
      <form onSubmit={completeRun} className="checklist-run-form">
        {running.questions.map((question,index)=><div className="checklist-question" key={question.id}><b>{index+1}. {question.label}</b><div className="checklist-answer-options">{(['Đạt','Không đạt','Bỏ qua'] as const).map(value=><button type="button" className={(answers[question.id]?.result===value?'selected ':'')+(value==='Không đạt'?'bad':'')} key={value} disabled={!canExecuteHere} onClick={()=>setAnswers(current=>({...current,[question.id]:{...current[question.id],result:value}}))}>{value}</button>)}</div><input value={answers[question.id]?.note||''} disabled={!canExecuteHere} onChange={event=>setAnswers(current=>({...current,[question.id]:{...current[question.id],note:event.target.value}}))} placeholder="Ghi chú / thông số đo (nếu có)"/></div>)}
        {running.questions.some(q=>answers[q.id]?.result==='Không đạt')&&<div className="checklist-failure-box"><b>Có nội dung kiểm tra Không đạt</b><label><input type="checkbox" checked={repairCreated} onChange={event=>setRepairCreated(event.target.checked)}/> Đã tạo Phiếu yêu cầu sửa chữa riêng</label>{!repairCreated&&<label className="field">Lý do chưa tạo Phiếu yêu cầu *<textarea rows={2} value={noRepairReason} onChange={event=>setNoRepairReason(event.target.value)} required/></label>}<small>Phiếu Checklist vẫn lưu kết quả Không đạt. Việc đánh dấu này không tự tạo Phiếu YC trong phân hệ Bảo dưỡng – Sửa chữa.</small></div>}
        <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>void cancelRun()}>Hủy</button><button type="submit" className="primary-btn" disabled={!canExecuteHere||savingRun}><Check size={15}/> {savingRun?'Đang lưu…':'Lưu kết quả'}</button></div>
      </form>
    </section></div>}
  </div>
}
