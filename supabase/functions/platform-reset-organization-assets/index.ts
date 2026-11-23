import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const OWNER_EMAIL='tuanluongpham1980@gmail.com'
const ORIGIN='https://baotri.vieclamhp247.com'
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':origin===ORIGIN||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'?origin:ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if(!token)return response({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if(!url||!serviceKey||!publicKey)return response({error:'Server configuration missing'},500,origin)

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||auth.user.email?.toLowerCase()!==OWNER_EMAIL||!auth.user.email_confirmed_at)
   return response({error:'Chỉ Super Admin đã xác thực email mới được reset thiết bị.'},403,origin)

  const body=await req.json()
  const action=String(body.action??'')
  const organizationId=String(body.organizationId??'')
  const organizationName=String(body.organizationName??'')
  if(!['status','reset'].includes(action))return response({error:'Thao tác không hợp lệ.'},400,origin)
  if(!uuid(organizationId))return response({error:'Mã tổ chức không hợp lệ.'},400,origin)

  const {data:organization,error:readError}=await admin.from('organizations').select('id,name,status').eq('id',organizationId).maybeSingle()
  if(readError)throw readError
  if(!organization)return response({error:'Không tìm thấy tổ chức.'},404,origin)
  if(organizationName!==organization.name)return response({error:'Tên tổ chức đã thay đổi. Hãy tải lại danh sách.'},409,origin)

  if(action==='status'){
   const {data,error}=await admin.rpc('platform_get_organization_asset_reset_status',{p_organization_id:organizationId})
   if(error)throw error
   return response({ok:true,status:data},200,origin)
  }

  const password=String(body.password??'')
  const confirmName=String(body.confirmName??'')
  const confirmation=String(body.confirmation??'')
  const requestId=body.requestId
  if(!password)return response({error:'Cần nhập lại mật khẩu Super Admin.'},400,origin)
  if(confirmation!=='yes')return response({error:'Thao tác chưa được xác nhận bằng lựa chọn Có.'},400,origin)
  if(confirmName!==organization.name)return response({error:'Tên nhập xác nhận không khớp chính xác với tên tổ chức.'},400,origin)
  if(!uuid(requestId))return response({error:'Mã yêu cầu reset không hợp lệ.'},400,origin)

  const verifier=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:verified,error:passwordError}=await verifier.auth.signInWithPassword({email:OWNER_EMAIL,password})
  if(passwordError||verified.user?.id!==auth.user.id||!verified.user.email_confirmed_at)
   return response({error:'Mật khẩu Super Admin không chính xác hoặc không thể xác thực.'},401,origin)

  const {data:reset,error:resetError}=await admin.rpc('platform_reset_organization_assets',{
   p_organization_id:organizationId,p_request_id:requestId,p_actor_user_id:auth.user.id
  })
  if(resetError)throw resetError

  const {data:status,error:statusError}=await admin.rpc('platform_get_organization_asset_reset_status',{p_organization_id:organizationId})
  if(statusError)throw statusError
  return response({ok:true,reset,status},200,origin)
 }catch(error){
  const detail=error as {message?:unknown;code?:unknown}
  const message=typeof detail?.message==='string'?detail.message:String(error)
  const status=detail?.code==='23503'?409:detail?.code==='40001'?409:400
  return response({error:message,code:typeof detail?.code==='string'?detail.code:undefined},status,origin)
 }
})
