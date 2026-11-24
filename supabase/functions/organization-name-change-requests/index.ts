import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const ORIGIN='https://baotri.vieclamhp247.com'
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':origin===ORIGIN||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'?origin:ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.match(/^Bearer\\s+(.+)$/i)?.[1]?.trim()
  if(!token)return response({error:'Cần đăng nhập.'},401,origin)
  const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!serviceKey)return response({error:'Server configuration missing'},500,origin)
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||!auth.user.email_confirmed_at)return response({error:'Phiên đăng nhập không hợp lệ.'},401,origin)
  const body=await req.json(),organizationId=String(body.organizationId??''),action=String(body.action??'')
  if(!uuid(organizationId))return response({error:'Mã doanh nghiệp không hợp lệ.'},400,origin)
  const {data:member,error:memberError}=await admin.from('organization_members').select('role,status')
    .eq('organization_id',organizationId).eq('user_id',auth.user.id).maybeSingle()
  if(memberError)throw memberError
  if(member?.role!=='admin'||member.status!=='active')return response({error:'Chỉ Admin doanh nghiệp mới được gửi yêu cầu đổi tên.'},403,origin)
  if(action==='list'){
   const {data,error}=await admin.rpc('list_organization_name_change_requests',{p_organization_id:organizationId})
   if(error)throw error
   return response({ok:true,requests:Array.isArray(data)?data:[]},200,origin)
  }
  if(action==='submit'){
   const requestedName=String(body.requestedName??'').trim(),note=String(body.note??'').trim().slice(0,1000)
   if(requestedName.length<2||requestedName.length>160)return response({error:'Tên doanh nghiệp phải có từ 2 đến 160 ký tự.'},400,origin)
   const {data,error}=await admin.rpc('create_organization_name_change_request',{
    p_organization_id:organizationId,p_requester_user_id:auth.user.id,p_requested_name:requestedName,p_requester_note:note
   })
   if(error)throw error
   return response({ok:true,request:data,message:'Đã gửi yêu cầu đổi tên. Tên doanh nghiệp chỉ thay đổi sau khi Super Admin phê duyệt.'},200,origin)
  }
  return response({error:'Thao tác không hợp lệ.'},400,origin)
 }catch(error){return response({error:error instanceof Error?error.message:String(error)},400,origin)}
})
