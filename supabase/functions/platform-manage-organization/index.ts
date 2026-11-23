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
  const token=req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if(!token)return response({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if(!url||!serviceKey||!publicKey)return response({error:'Server configuration missing'},500,origin)

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||auth.user.email?.toLowerCase()!==OWNER_EMAIL||!auth.user.email_confirmed_at)
   return response({error:'Chỉ Super Admin đã xác thực email mới được quản trị tổ chức.'},403,origin)

  const body=await req.json()
  const action=String(body.action??'')
  const organizationId=String(body.organizationId??'')
  const password=String(body.password??'')
  const confirmation=String(body.confirmation??'')
  const organizationName=String(body.organizationName??'')
  const confirmName=String(body.confirmName??'')

  if(!['suspend','reactivate','delete'].includes(action))return response({error:'Thao tác không hợp lệ.'},400,origin)
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId))
   return response({error:'Mã tổ chức không hợp lệ.'},400,origin)
  if(!password)return response({error:'Cần nhập lại mật khẩu Super Admin.'},400,origin)
  if(confirmation!=='yes')return response({error:'Thao tác chưa được xác nhận bằng lựa chọn Có.'},400,origin)

  const verifier=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:verified,error:passwordError}=await verifier.auth.signInWithPassword({email:OWNER_EMAIL,password})
  if(passwordError||verified.user?.id!==auth.user.id||!verified.user.email_confirmed_at)
   return response({error:'Mật khẩu Super Admin không chính xác hoặc không thể xác thực.'},401,origin)

  const {data:organization,error:readError}=await admin.from('organizations').select('id,name,status').eq('id',organizationId).maybeSingle()
  if(readError)throw readError
  if(!organization)return response({error:'Không tìm thấy tổ chức hoặc tổ chức đã bị xóa.'},404,origin)
  if(organizationName!==organization.name)return response({error:'Thông tin tổ chức đã thay đổi. Hãy tải lại danh sách.'},409,origin)

  if(action==='suspend'){
   if(organization.status==='suspended')return response({ok:true,action,organizationName:organization.name,status:'suspended',message:'Tổ chức đã tạm ngưng từ trước.'},200,origin)
   const {data,error}=await admin.from('organizations').update({status:'suspended'}).eq('id',organizationId).eq('status','active').select('id,name,status').maybeSingle()
   if(error)throw error
   if(!data)throw new Error('Không thể tạm ngưng tổ chức; trạng thái có thể vừa thay đổi.')
   return response({ok:true,action,organizationName:data.name,status:data.status,message:'Đã tạm ngưng tổ chức. Dữ liệu được giữ nguyên.'},200,origin)
  }

  if(action==='reactivate'){
   if(organization.status==='active')return response({ok:true,action,organizationName:organization.name,status:'active',message:'Tổ chức đã hoạt động từ trước.'},200,origin)
   const {data,error}=await admin.from('organizations').update({status:'active'}).eq('id',organizationId).eq('status','suspended').select('id,name,status').maybeSingle()
   if(error)throw error
   if(!data)throw new Error('Không thể kích hoạt tổ chức; trạng thái có thể vừa thay đổi.')
   return response({ok:true,action,organizationName:data.name,status:data.status,message:'Đã kích hoạt lại tổ chức.'},200,origin)
  }

  if(confirmName!==organization.name)return response({error:'Tên nhập xác nhận không khớp chính xác với tên tổ chức.'},400,origin)
  const {data,error}=await admin.rpc('platform_delete_organization',{p_organization_id:organizationId,p_confirm_name:confirmName})
  if(error)throw error
  return response({ok:true,action,organizationName:organization.name,status:'deleted',deleted:data?.deleted??{},message:'Đã xóa vĩnh viễn tổ chức và dữ liệu Cloud liên quan. Tài khoản Auth và hồ sơ cá nhân của các thành viên được giữ nguyên.'},200,origin)
 }catch(error){
  const detail=error as {message?:unknown;code?:unknown}
  const message=typeof detail?.message==='string'?detail.message:String(error)
  const status=detail?.code==='23503'?409:400
  return response({error:message,code:typeof detail?.code==='string'?detail.code:undefined},status,origin)
 }
})
