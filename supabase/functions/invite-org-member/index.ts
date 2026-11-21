import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const corsHeaders={
 'Access-Control-Allow-Origin':'https://baotri.vieclamhp247.com',
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 if(req.method!=='POST')return json({error:'Method not allowed'},405)
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')
  if(!token)return json({error:'Missing access token'},401)
  const url=Deno.env.get('SUPABASE_URL')!
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY')
  if(!serviceKey||!anonKey)return json({error:'Server auth environment is not configured'},500)
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:authData,error:authError}=await admin.auth.getUser(token)
  if(authError||!authData.user)return json({error:'Invalid session'},401)
  const actor=authData.user
  const body=await req.json()
  const organizationId=String(body.organizationId??'')
  const email=String(body.email??'').trim().toLowerCase()
  const displayName=String(body.displayName??'').trim().slice(0,120)
  const roleCode=String(body.roleCode??'')
  if(!organizationId||!email||!email.includes('@')||!['admin','technician','viewer'].includes(roleCode))return json({error:'Organization, valid email and supported role are required'},400)
  const {data:membership,error:memberError}=await admin.from('organization_members').select('id,status').eq('organization_id',organizationId).eq('user_id',actor.id).maybeSingle()
  if(memberError)return json({error:memberError.message},500)
  if(!membership||membership.status!=='active')return json({error:'Active organization membership required'},403)
  const {data:assigned,error:rolesError}=await admin.from('member_roles').select('role_id').eq('organization_id',organizationId).eq('member_id',membership.id)
  if(rolesError)return json({error:rolesError.message},500)
  const roleIds=(assigned??[]).map(x=>x.role_id)
  const {data:roles,error:roleError}=await admin.from('roles').select('id,code').eq('organization_id',organizationId).in('id',roleIds)
  if(roleError)return json({error:roleError.message},500)
  const {data:grants,error:grantError}=await admin.from('role_permissions').select('role_id').eq('organization_id',organizationId).eq('permission_code','users.manage').in('role_id',roleIds)
  if(grantError)return json({error:grantError.message},500)
  if(!(roles??[]).some(r=>r.code==='admin')&&!(grants??[]).length)return json({error:'Missing users.manage permission'},403)
  const {data:organization,error:orgError}=await admin.from('organizations').select('id,status').eq('id',organizationId).maybeSingle()
  if(orgError||!organization||organization.status!=='active')return json({error:'Organization is not active'},404)
  const {data:systemRole,error:systemRoleError}=await admin.from('roles').select('id').eq('organization_id',organizationId).eq('code',roleCode).eq('is_system',true).maybeSingle()
  if(systemRoleError||!systemRole)return json({error:'Role is not seeded for this organization'},400)
  const {data:userList,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000})
  if(listError)return json({error:listError.message},500)
  let invitedUser=(userList.users??[]).find(u=>u.email?.toLowerCase()===email)
  let created=false
  if(!invitedUser){
   const {data:inviteData,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:displayName||email.split('@')[0]},redirectTo:'https://baotri.vieclamhp247.com/'})
   if(inviteError)return json({error:'Gửi lời mời Auth thất bại: '+inviteError.message},400)
   invitedUser=inviteData.user??undefined
   if(!invitedUser)return json({error:'Auth invite returned no user'},500)
   created=true
  }
  const status=invitedUser.email_confirmed_at?'active':'invited'
  const {data:newMembership,error:insertMemberError}=await admin.from('organization_members').insert({
   organization_id:organizationId,user_id:invitedUser.id,role:roleCode==='admin'?'admin':'user',status,invited_by_user_id:actor.id
  }).select('id').single()
  if(insertMemberError){
   if(created)await admin.auth.admin.deleteUser(invitedUser.id).catch(()=>{})
   return json({error:insertMemberError.message},409)
  }
  const {error:assignError}=await admin.from('member_roles').insert({organization_id:organizationId,member_id:newMembership.id,role_id:systemRole.id,assigned_by_user_id:actor.id})
  if(assignError){
   await admin.from('organization_members').delete().eq('id',newMembership.id)
   if(created)await admin.auth.admin.deleteUser(invitedUser.id).catch(()=>{})
   return json({error:assignError.message},500)
  }
  return json({ok:true,email,roleCode,status,createdAuthUser:created,message:created?'Invitation sent. User must confirm email and set password.':'Existing Auth user added to organization.'})
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},500)}
})
