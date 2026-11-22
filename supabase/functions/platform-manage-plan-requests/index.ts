import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const OWNER_EMAIL='tuanluongpham1980@gmail.com'
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
  const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if(!url||!serviceKey||!publicKey)return response({error:'Server configuration missing'},500,origin)
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||!auth.user.email_confirmed_at||auth.user.email?.toLowerCase()!==OWNER_EMAIL)
   return response({error:'Chỉ Super Admin đã xác thực email mới được quản lý yêu cầu Plan.'},403,origin)

  const body=await req.json()
  const action=String(body.action??'')
  if(action==='list'){
   const {data,error}=await admin.rpc('list_organization_plan_change_requests',{p_organization_id:null})
   if(error)throw error
   return response({ok:true,requests:Array.isArray(data)?data:[]},200,origin)
  }
  if(!['approve','reject'].includes(action))return response({error:'Thao tác không hợp lệ.'},400,origin)
  const requestId=String(body.requestId??'')
  const password=String(body.password??'')
  const confirmation=String(body.confirmation??'')
  const reviewNote=String(body.reviewNote??'').trim().slice(0,1000)
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
   return response({error:'Mã yêu cầu không hợp lệ.'},400,origin)
  if(!password)return response({error:'Cần nhập lại mật khẩu Super Admin.'},400,origin)
  if(confirmation!=='yes')return response({error:'Cần xác nhận đã kiểm tra điều kiện thương mại/thanh toán.'},400,origin)

  const verifier=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:verified,error:passwordError}=await verifier.auth.signInWithPassword({email:OWNER_EMAIL,password})
  if(passwordError||verified.user?.id!==auth.user.id||!verified.user.email_confirmed_at)
   return response({error:'Mật khẩu Super Admin không chính xác hoặc không thể xác thực.'},401,origin)

  const {data,error}=await admin.rpc('review_organization_plan_change_request',{
   p_request_id:requestId,
   p_reviewer_user_id:auth.user.id,
   p_decision:action,
   p_review_note:reviewNote
  })
  if(error)throw error
  return response({ok:true,result:data,message:action==='approve'?'Đã duyệt và áp dụng Plan mới.':'Đã từ chối yêu cầu đổi Plan.'},200,origin)
 }catch(error){
  return response({error:error instanceof Error?error.message:String(error)},400,origin)
 }
})