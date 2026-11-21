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
  const token=req.headers.get('Authorization')?.replace(/^Bearer\\s+/i,'')
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
  if(organizationName.length<2||organizationName.length>120||!/^\\S+@\\S+\\.\\S+$/.test(adminEmail))return response({error:'Tên tổ chức hoặc email Admin không hợp lệ.'},400,origin)

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
  const {data:profile}=await admin.from('profiles').select('id').eq('id',target.id).maybeSingle()
  if(!profile)throw new Error('Tài khoản Auth chưa có profile; chưa tạo tổ chức để tránh dữ liệu dở dang.')
  const {data:org,error:orgError}=await admin.from('organizations').insert({name:organizationName,created_by:auth.user.id}).select('id,name').single()
  if(orgError)throw orgError
  try{
   const {data:role,error:roleError}=await admin.from('roles').select('id').eq('organization_id',org.id).eq('code','admin').eq('is_system',true).single()
   if(roleError)throw roleError
   const memberStatus=target.email_confirmed_at?'active':'invited'
   const {data:member,error:memberError}=await admin.from('organization_members').insert({organization_id:org.id,user_id:target.id,role:'admin',status:memberStatus,invited_by_user_id:auth.user.id}).select('id').single()
   if(memberError)throw memberError
   const {error:assignmentError}=await admin.from('member_roles').insert({organization_id:org.id,member_id:member.id,role_id:role.id,assigned_by_user_id:auth.user.id})
   if(assignmentError)throw assignmentError
   return response({ok:true,organizationId:org.id,organizationName:org.name,adminEmail,status:memberStatus,createdAuthUser,message:createdAuthUser?'Đã gửi email mời; Admin cần xác nhận email và tự đặt mật khẩu.':memberStatus==='active'?'Email đã có tài khoản xác nhận; đã cấp quyền Admin.':'Email đã có Auth chưa xác nhận; membership chờ xác nhận email.'},200,origin)
  }catch(error){
   const {data:members}=await admin.from('organization_members').select('id').eq('organization_id',org.id)
   const memberIds=(members??[]).map(m=>m.id)
   if(memberIds.length)await admin.from('member_roles').delete().eq('organization_id',org.id).in('member_id',memberIds)
   await admin.from('organization_members').delete().eq('organization_id',org.id)
   await admin.from('role_permissions').delete().eq('organization_id',org.id)
   await admin.from('roles').delete().eq('organization_id',org.id)
   await admin.from('organizations').delete().eq('id',org.id)
   throw error
  }
 }catch(error){return response({error:error instanceof Error?error.message:String(error)},400,origin)}
})
