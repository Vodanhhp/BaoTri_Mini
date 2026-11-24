import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const ownerEmail=()=>Deno.env.get('PLATFORM_OWNER_EMAIL')?.trim().toLowerCase()??''
const ORIGIN='https://baotri.vieclamhp247.com'
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':origin===ORIGIN||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'?origin:ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const owner=ownerEmail(),token=req.headers.get('Authorization')?.match(/^Bearer\\s+(.+)$/i)?.[1]?.trim()
  if(!owner)return response({error:'Server configuration missing'},500,origin)
  if(!token)return response({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),publicKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if(!url||!serviceKey||!publicKey)return response({error:'Server configuration missing'},500,origin)
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||!auth.user.email_confirmed_at||auth.user.email?.toLowerCase()!==owner)return response({error:'Chỉ Super Admin đã xác thực mới được xử lý yêu cầu.'},403,origin)
  const body=await req.json(),action=String(body.action??'')
  if(action==='list'){
   const {data,error}=await admin.rpc('list_organization_name_change_requests',{p_organization_id:null})
   if(error)throw error
   return response({ok:true,requests:Array.isArray(data)?data:[]},200,origin)
  }
  if(!['approve','reject'].includes(action))return response({error:'Thao tác không hợp lệ.'},400,origin)
  const requestId=String(body.requestId??''),password=String(body.password??''),confirmation=String(body.confirmation??''),reviewNote=String(body.reviewNote??'').trim().slice(0,1000)
  if(!uuid(requestId))return response({error:'Mã yêu cầu không hợp lệ.'},400,origin)
  if(!password)return response({error:'Cần nhập lại mật khẩu Super Admin.'},400,origin)
  if(confirmation!=='yes')return response({error:'Cần xác nhận đã kiểm tra yêu cầu.'},400,origin)
  if(action==='reject'&&!reviewNote)return response({error:'Bắt buộc nhập lý do từ chối.'},400,origin)
  const verifier=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:verified,error:passwordError}=await verifier.auth.signInWithPassword({email:owner,password})
  if(passwordError||verified.user?.id!==auth.user.id||!verified.user.email_confirmed_at)return response({error:'Mật khẩu Super Admin không chính xác.'},401,origin)
  const {data,error}=await admin.rpc('review_organization_name_change_request',{p_request_id:requestId,p_reviewer_user_id:auth.user.id,p_decision:action,p_review_note:reviewNote})
  if(error)throw error
  return response({ok:true,result:data,message:action==='approve'?'Đã duyệt và cập nhật tên doanh nghiệp.':'Đã từ chối yêu cầu đổi tên.'},200,origin)
 }catch(error){return response({error:error instanceof Error?error.message:String(error)},400,origin)}
})
