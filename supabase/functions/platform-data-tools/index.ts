import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const OWNER=()=>Deno.env.get('PLATFORM_OWNER_EMAIL')?.trim().toLowerCase()??''
const ORIGIN='https://baotri.vieclamhp247.com'
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':origin===ORIGIN||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'?origin:ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const today=()=>new Date().toISOString().slice(0,10)
const planRank:Record<string,number>={A:1,B:2,C:3,D:4}

const inventorySamples=[
 ['Cầu chì ống 5A','Vật tư điện','Cái','FUSE-5A','5x20 mm',5,12000],
 ['Cầu chì ống 10A','Vật tư điện','Cái','FUSE-10A','5x20 mm',5,12000],
 ['Aptomat MCB 1P 10A','Vật tư điện','Cái','MCB-1P-10','6kA',2,65000],
 ['Aptomat MCB 1P 16A','Vật tư điện','Cái','MCB-1P-16','6kA',2,65000],
 ['Aptomat MCB 3P 32A','Vật tư điện','Cái','MCB-3P-32','6kA',1,210000],
 ['Contactor 9A','Vật tư điện','Cái','CONTACTOR-9','220VAC',1,185000],
 ['Contactor 18A','Vật tư điện','Cái','CONTACTOR-18','220VAC',1,295000],
 ['Rơ le nhiệt 4-6A','Vật tư điện','Cái','THERMAL-4-6','4–6A',1,165000],
 ['Rơ le trung gian 8 chân','Vật tư điện','Cái','RELAY-8','220VAC',3,45000],
 ['Đế rơ le 8 chân','Vật tư điện','Cái','RELAY-SOCKET-8','8 chân',3,18000],
 ['Nút nhấn xanh NO','Vật tư điện','Cái','PB-GREEN','Ø22',3,28000],
 ['Nút nhấn đỏ NC','Vật tư điện','Cái','PB-RED','Ø22',3,28000],
 ['Đèn báo pha màu đỏ','Vật tư điện','Cái','PILOT-RED','220VAC Ø22',3,25000],
 ['Cảm biến tiệm cận M18','Điện - tự động hóa','Cái','PROX-M18','NPN NO',1,145000],
 ['Cảm biến quang','Điện - tự động hóa','Cái','PHOTO-SENSOR','12–24VDC',1,195000],
 ['Công tắc hành trình','Điện - tự động hóa','Cái','LIMIT-SW','Con lăn',2,85000],
 ['Nguồn tổ ong 24V 5A','Linh kiện điện tử','Bộ','PSU-24-5','24VDC 5A',1,185000],
 ['Nguồn tổ ong 12V 5A','Linh kiện điện tử','Bộ','PSU-12-5','12VDC 5A',1,145000],
 ['Tụ điện 100uF 25V','Linh kiện điện tử','Cái','CAP-100-25','100µF 25V',10,5000],
 ['Tụ điện 1000uF 35V','Linh kiện điện tử','Cái','CAP-1000-35','1000µF 35V',5,12000],
 ['Diode chỉnh lưu 1N4007','Linh kiện điện tử','Cái','DIODE-4007','1A 1000V',20,1000],
 ['Cầu diode KBPC3510','Linh kiện điện tử','Cái','BRIDGE-3510','35A 1000V',2,38000],
 ['Dây điện đơn 1.5mm²','Dây cáp điện','Mét','WIRE-1.5','1.5mm²',30,6500],
 ['Dây điện đơn 2.5mm²','Dây cáp điện','Mét','WIRE-2.5','2.5mm²',30,9500],
 ['Đầu cos kim 1.5mm²','Vật tư điện','Túi','FERRULE-1.5','1.5mm²',2,35000],
 ['Ốc vít M6x20','Cơ khí','Cái','BOLT-M6-20','M6x20',20,800],
 ['Bulong + đai ốc M8','Cơ khí','Bộ','BOLT-M8','M8',20,1500],
 ['Băng tan PTFE','Vật tư đường ống','Cuộn','PTFE-TAPE','12mm',5,8000],
 ['Mỡ bò đa dụng','Dầu mỡ bôi trơn','Hộp','GREASE-MULTI','400g',2,65000],
 ['Dầu máy nén khí','Dầu mỡ bôi trơn','Lít','COMP-OIL','ISO VG 46',2,95000]
] as const

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const ownerEmail=OWNER()
  const token=req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const url=Deno.env.get('SUPABASE_URL')
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!ownerEmail||!token||!url||!serviceKey)return response({error:'Server configuration or access token missing.'},500,origin)
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||!auth.user.email_confirmed_at||auth.user.email?.trim().toLowerCase()!==ownerEmail)
   return response({error:'Chỉ Superadmin đã xác thực email mới được sử dụng công cụ dữ liệu.'},403,origin)

  const body=await req.json()
  const action=String(body.action??'preview')
  const organizationId=String(body.organizationId??'')
  if(!uuid(organizationId))return response({error:'Doanh nghiệp đích không hợp lệ.'},400,origin)
  if(!['preview','create'].includes(action))return response({error:'Thao tác không hợp lệ.'},400,origin)

  const [{data:organization,error:orgError},{data:catalog,error:catalogError},{count:assetCount,error:assetError},{count:inventoryCount,error:inventoryError}]=await Promise.all([
   admin.from('organizations').select('id,name,status').eq('id',organizationId).maybeSingle(),
   admin.from('organization_equipment_catalog').select('plan_code,source_data_version,snapshot').eq('organization_id',organizationId).maybeSingle(),
   admin.from('assets').select('id',{count:'exact',head:true}).eq('organization_id',organizationId),
   admin.from('inventory_items').select('id',{count:'exact',head:true}).eq('organization_id',organizationId)
  ])
  if(orgError)throw orgError
  if(catalogError)throw catalogError
  if(assetError)throw assetError
  if(inventoryError)throw inventoryError
  if(!organization||organization.status!=='active')return response({error:'Không tìm thấy doanh nghiệp hoặc doanh nghiệp đang tạm ngưng.'},404,origin)
  if(!catalog||!['A','B','C','D'].includes(catalog.plan_code)||!Array.isArray(catalog.snapshot?.equipmentDictionary)||!Array.isArray(catalog.snapshot?.equipmentGroups))
   return response({error:'Doanh nghiệp chưa có Catalog Snapshot hợp lệ.'},409,origin)
  const plan=catalog.snapshot.plan??{}
  const maxDevices=typeof plan.maxDevices==='number'?plan.maxDevices:null
  const currentAssets=assetCount??0
  const remaining=maxDevices===null?null:Math.max(0,maxDevices-currentAssets)
  const summary={organizationId,organizationName:organization.name,planCode:catalog.plan_code,planName:plan.name??'Plan '+catalog.plan_code,maxDevices,currentAssets,remainingDevices:remaining,currentInventory:inventoryCount??0,sourceDataVersion:catalog.source_data_version}
  if(action==='preview')return response({ok:true,...summary,availableGroups:catalog.snapshot.equipmentGroups.filter((g:any)=>planRank[g.availableFromPlan??'B']<=planRank[catalog.plan_code]).length,availableEquipmentTypes:catalog.snapshot.equipmentDictionary.length},200,origin)

  const assetCountRequested=body.createAssets===true?30:0
  const inventoryCountRequested=body.createInventory===true?30:0
  const siteCode=String(body.siteCode??'01')
  if(!assetCountRequested&&!inventoryCountRequested)return response({error:'Chọn ít nhất một loại dữ liệu cần tạo.'},400,origin)
  if(assetCountRequested&&remaining!==null&&remaining<assetCountRequested)return response({error:'Không đủ hạn mức thiết bị còn lại của Plan. Không có dữ liệu nào được tạo.'},409,origin)
  if(assetCountRequested&&['C','D'].includes(catalog.plan_code)&&!/^\d{2}$/.test(siteCode))return response({error:'Plan C/D yêu cầu mã cơ sở gồm đúng 2 chữ số.'},400,origin)

  const allowedGroups=catalog.snapshot.equipmentGroups.filter((g:any)=>planRank[g.availableFromPlan??'B']<=planRank[catalog.plan_code])
  const assets:any[]=[]
  if(assetCountRequested){
   const dictionary=catalog.snapshot.equipmentDictionary
   if(dictionary.length<30)return response({error:'Catalog Snapshot không đủ 30 loại thiết bị để tạo dữ liệu thử nghiệm.'},409,origin)
   for(let i=0;i<30;i++){
    const entry=dictionary[i]
    const suggested=allowedGroups.find((g:any)=>String(g.code).toUpperCase()===String(entry.suggestedGroup??'').toUpperCase())
    const group=catalog.plan_code==='A'?(suggested??allowedGroups[0]):(suggested??allowedGroups[0])
    if(catalog.plan_code!=='A'&&!group)return response({error:'Catalog Snapshot không có nhóm thiết bị phù hợp với Plan.'},409,origin)
    const category=group?.name??'Thiết bị chung'
    assets.push({
     id:crypto.randomUUID(),reservationId:crypto.randomUUID(),name:entry.standardName+' - Mẫu thử '+String(i+1).padStart(2,'0'),
     equipmentCode:entry.shortCode,category,groupCode:catalog.plan_code==='A'?'':group.code,
     siteCode:['C','D'].includes(catalog.plan_code)?siteCode:'',commissionedAt:today(),
     brand:['Mitsubishi','Schneider Electric','LS','Panasonic','Omron'][i%5],
     model:'TEST-'+String(i+1).padStart(3,'0'),serial:'SN-TEST-'+String(i+1).padStart(4,'0'),
     location:['Phòng máy','Khu sản xuất','Tủ điện tổng','Trạm bơm','Kho kỹ thuật'][i%5],
     power:['0.75 kW','1.5 kW','2.2 kW','3.7 kW','5.5 kW'][i%5],
     cycle:['Hàng tháng','Hàng quý','Hàng năm'][i%3],
     notes:'Dữ liệu thử nghiệm do Superadmin tạo.'
    })
   }
  }
  const inventory=inventoryCountRequested?inventorySamples.map((row,i)=>({
   id:crypto.randomUUID(),mutationId:crypto.randomUUID(),name:row[0],group:row[1],unit:row[2],
   partNumber:row[3],size:row[4],minQuantity:row[5],unitPrice:row[6],
   location:['Tủ vật tư điện','Kho cơ điện','Kệ linh kiện'][i%3],
   supplier:['Nhà cung cấp mẫu A','Nhà cung cấp mẫu B','Nhà cung cấp mẫu C'][i%3]
  })):[]
  const runId=crypto.randomUUID()
  const {data:result,error:seedError}=await admin.rpc('platform_seed_organization_data',{
   p_run_id:runId,p_organization_id:organizationId,p_actor_user_id:auth.user.id,p_assets:assets,p_inventory_items:inventory
  })
  if(seedError)throw seedError
  return response({ok:true,...summary,...result,createdBy:'Superadmin',message:'Đã tạo dữ liệu thử nghiệm theo Plan hiện tại của doanh nghiệp.'},200,origin)
 }catch(error){
  const detail=error as {message?:unknown;code?:unknown}
  return response({error:typeof detail?.message==='string'?detail.message:String(error),code:typeof detail?.code==='string'?detail.code:undefined},400,origin)
 }
})
