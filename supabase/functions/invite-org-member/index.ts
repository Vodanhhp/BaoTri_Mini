import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const allowedOrigins=['https://baotri.vieclamhp247.com','http://localhost:5173','http://127.0.0.1:5173']
const corsFor=(origin:string|null)=>({
 'Access-Control-Allow-Origin':origin&&allowedOrigins.includes(origin)?origin:'https://baotri.vieclamhp247.com',
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
})
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...corsFor(origin),'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsFor(origin)})
 if(req.method!=='POST')return json({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')
  if(!token)return json({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')!
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!serviceKey)return json({error:'Server auth environment is not configured'},500,origin)
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:authData,error:authError}=await admin.auth.getUser(token)
  if(authError||!authData.user)return json({error:'Invalid session'},401,origin)
  const actor=authData.user
  const body=await req.json()
  const organizationId=String(body.organizationId??'')
  const email=String(body.email??'').trim().toLowerCase()
  const displayName=String(body.displayName??'').trim().slice(0,120)
  const roleCode=String(body.roleCode??'')
  if(!organizationId||!email||!email.includes('@')||!['admin','technician','viewer'].includes(roleCode))return json({error:'Organization, valid email and supported role are required'},400,origin)
  const {data:membership,error:memberError}=await admin.from('organization_members').select('id,status').eq('organization_id',organizationId).eq('user_id',actor.id).maybeSingle()
  if(memberError)return json({error:memberError.message},500,origin)
  if(!membership||membership.status!=='active')return json({error:'Active organization membership required'},403,origin)
  const {data:assigned,error:rolesError}=await admin.from('member_roles').select('role_id').eq('organization_id',organizationId).eq('member_id',membership.id)
  if(rolesError)return json({error:rolesError.message},500,origin)
  const roleIds=(assigned??[]).map(x=>x.role_id)
  const {data:roles,error:roleError}=await admin.from('roles').select('id,code').eq('organization_id',organizationId).in('id',roleIds)
  if(roleError)return json({error:roleError.message},500,origin)
  const {data:grants,error:grantError}=await admin.from('role_permissions').select('role_id').eq('organization_id',organizationId).eq('permission_code','users.manage').in('role_id',roleIds)
  if(grantError)return json({error:grantError.message},500,origin)
  if(!(roles??[]).some(r=>r.code==='admin')&&!(grants??[]).length)return json({error:'Missing users.manage permission'},403,origin)
  const {data:organization,error:orgError}=await admin.from('organizations').select('id,status').eq('id',organizationId).maybeSingle()
  if(orgError||!organization||organization.status!=='active')return json({error:'Organization is not active'},404,origin)
  const {data:systemRole,error:systemRoleError}=await admin.from('roles').select('id').eq('organization_id',organizationId).eq('code',roleCode).eq('is_system',true).maybeSingle()
  if(systemRoleError||!systemRole)return json({error:'Role is not seeded for this organization'},400,origin)
  const {data:userList,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000})
  if(listError)return json({error:listError.message},500,origin)
  let invitedUser=(userList.users??[]).find(u=>u.email?.toLowerCase()===email)
  let created=false
  if(!invitedUser){
   const {data:inviteData,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:displayName||email.split('@')[0],must_set_password:true},redirectTo:'https://baotri.vieclamhp247.com/'})
   if(inviteError)return json({error:'Gửi lời mời Auth thất bại: '+inviteError.message},400,origin)
   invitedUser=inviteData.user??undefined
   if(!invitedUser)return json({error:'Auth invite returned no user'},500,origin)
   created=true
  }
  const status=invitedUser.email_confirmed_at?'active':'invited'
  const {data:newMembership,error:insertMemberError}=await admin.from('organization_members').insert({
   organization_id:organizationId,user_id:invitedUser.id,role:roleCode==='admin'?'admin':'user',status,invited_by_user_id:actor.id
  }).select('id').single()
  if(insertMemberError){
   if(created)await admin.auth.admin.deleteUser(invitedUser.id).catch(()=>{})
   return json({error:insertMemberError.message},409,origin)
  }
  const {error:assignError}=await admin.from('member_roles').insert({organization_id:organizationId,member_id:newMembership.id,role_id:systemRole.id,assigned_by_user_id:actor.id})
  if(assignError){
   await admin.from('organization_members').delete().eq('id',newMembership.id)
   if(created)await admin.auth.admin.deleteUser(invitedUser.id).catch(()=>{})
   return json({error:assignError.message},500,origin)
  }
  return json({ok:true,email,roleCode,status,createdAuthUser:created,message:created?'Invitation email sent. User must confirm email and set password.':status==='invited'?'Existing Auth account is unconfirmed; membership is invited, but resend the invitation from Auth Dashboard.':'Existing confirmed Auth user added to organization.'},200,origin)
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},500,origin)}
})
