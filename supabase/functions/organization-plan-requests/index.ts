import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const ORIGIN='https://baotri.vieclamhp247.com'
const ALLOWED_ORIGINS=new Set([ORIGIN,'https://baotri-mini-new-preview-eazlswbhd-tuanluongpham-8256.vercel.app','https://baotri-mini-new-preview-mutqeu613-tuanluongpham-8256.vercel.app','http://localhost:5173','http://127.0.0.1:5173'])
const cors=(origin:string|null)=>({
 'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGINS.has(origin)?origin:ORIGIN,
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{
 status,headers:{...cors(origin),'Content-Type':'application/json'}
})

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if(!token)return response({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!serviceKey)return response({error:'Server configuration missing'},500,origin)
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||!auth.user.email_confirmed_at)
   return response({error:'Cần đăng nhập bằng tài khoản đã xác nhận email.'},401,origin)

  const body=await req.json()
  const action=String(body.action??'')
  const organizationId=String(body.organizationId??'')
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId))
   return response({error:'Mã tổ chức không hợp lệ.'},400,origin)

  const {data:membership,error:membershipError}=await admin.from('organization_members')
   .select('id,role,status').eq('organization_id',organizationId).eq('user_id',auth.user.id).maybeSingle()
  if(membershipError)throw membershipError
  if(!membership||membership.role!=='admin'||membership.status!=='active')
   return response({error:'Chỉ Admin đang hoạt động của doanh nghiệp mới được quản lý yêu cầu Plan.'},403,origin)

  if(action==='list'){
   const {data,error}=await admin.rpc('list_organization_plan_change_requests',{p_organization_id:organizationId})
   if(error)throw error
   return response({ok:true,requests:Array.isArray(data)?data:[]},200,origin)
  }
  if(action==='submit'){
   const requestedPlanCode=String(body.requestedPlanCode??'').trim().toUpperCase()
   const note=String(body.note??'').trim().slice(0,1000)
   if(!['A','B','C','D'].includes(requestedPlanCode))
    return response({error:'Bạn phải chọn Plan A, B, C hoặc D.'},400,origin)
   const {data,error}=await admin.rpc('create_organization_plan_change_request',{
    p_organization_id:organizationId,
    p_actor_user_id:auth.user.id,
    p_requested_plan_code:requestedPlanCode,
    p_request_note:note
   })
   if(error)throw error
   return response({ok:true,request:data,message:'Đã gửi yêu cầu. Plan hiện tại chỉ thay đổi sau khi Super Admin duyệt.'},200,origin)
  }
  return response({error:'Thao tác không hợp lệ.'},400,origin)
 }catch(error){
  return response({error:error instanceof Error?error.message:String(error)},400,origin)
 }
})