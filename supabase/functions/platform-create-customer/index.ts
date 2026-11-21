import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const OWNER_EMAIL='tuanluongpham1980@gmail.com'
const ORIGIN='https://baotri.vieclamhp247.com'
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':origin===ORIGIN||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'?origin:ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')
  if(!token)return response({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!key)return response({error:'Server configuration missing'},500,origin)
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||auth.user.email?.toLowerCase()!==OWNER_EMAIL)return response({error:'Only the verified platform owner can create customer organizations.'},403,origin)

  const body=await req.json()
  const organizationName=String(body.organizationName??'').trim()
  const adminEmail=String(body.adminEmail??'').trim().toLowerCase()
  const adminName=String(body.adminName??'').trim().slice(0,120)
  const planCode=String(body.planCode??'').trim().toUpperCase()
  if(organizationName.length<2||organizationName.length>120||!/^\S+@\S+\.\S+$/.test(adminEmail))return response({error:'Tên tổ chức hoặc email Admin không hợp lệ.'},400,origin)
  if(!['A','B','C','D'].includes(planCode))return response({error:'Bạn phải chọn Plan A, B, C hoặc D trước khi tạo doanh nghiệp.'},400,origin)

  let target=null
  for(let page=1;page<=20;page++){
   const {data,error}=await admin.auth.admin.listUsers({page,perPage:500})
   if(error)throw error
   target=(data.users??[]).find(u=>u.email?.toLowerCase()===adminEmail)??null
   if(target||(data.users??[]).length<500)break
  }
  let createdAuthUser=false
  if(!target){
   const {data,error}=await admin.auth.admin.inviteUserByEmail(adminEmail,{data:{display_name:adminName||adminEmail.split('@')[0],must_set_password:true},redirectTo:ORIGIN+'/'})
   if(error)throw new Error('Không gửi được email mời: '+error.message)
   target=data.user
   createdAuthUser=true
  }
  if(!target)throw new Error('Không xác định được tài khoản Auth Admin.')

  const {data:profile,error:profileError}=await admin.from('profiles').select('id').eq('id',target.id).maybeSingle()
  if(profileError)throw profileError
  if(!profile)throw new Error('Tài khoản Auth chưa có profile; chưa khởi tạo doanh nghiệp. Có thể thử lại sau khi Auth trigger hoàn tất.')

  // One database transaction creates the Organization, seeds its three roles,
  // assigns the first Admin and copies the selected Plan's catalog snapshot.
  const {data:provision,error:provisionError}=await admin.rpc('platform_provision_customer',{
   p_organization_name:organizationName,
   p_actor_user_id:auth.user.id,
   p_admin_user_id:target.id,
   p_admin_email:adminEmail,
   p_plan_code:planCode
  })
  if(provisionError)throw new Error('Không thể khởi tạo doanh nghiệp và Catalog Snapshot: '+provisionError.message)
  if(!provision?.organizationId||provision.planCode!==planCode||!provision.sourceDataVersion){
   throw new Error('Backend không trả về kết quả khởi tạo doanh nghiệp hợp lệ.')
  }

  const message=createdAuthUser
   ?'Đã tạo tổ chức, gán Plan và gửi email mời; Admin cần xác nhận email và tự đặt mật khẩu.'
   :provision.status==='active'
    ?'Đã tạo tổ chức, gán Plan và khởi tạo Catalog Snapshot; email Admin đã được xác nhận.'
    :'Đã tạo tổ chức, gán Plan và khởi tạo Catalog Snapshot; membership Admin sẽ kích hoạt sau khi xác nhận email.'
  return response({...provision,adminEmail,createdAuthUser,message},200,origin)
 }catch(error){
  return response({error:error instanceof Error?error.message:String(error)},400,origin)
 }
})
