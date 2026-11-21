import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const OWNER_EMAIL='tuanluongpham1980@gmail.com'
const ORIGIN='https://baotri.vieclamhp247.com'
const allowedOrigins=[ORIGIN,'http://localhost:5173','http://127.0.0.1:5173']
const cors=(origin:string|null)=>({
 'Access-Control-Allow-Origin':origin&&allowedOrigins.includes(origin)?origin:ORIGIN,
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
})
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return json({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\\s+/i,'')
  if(!token)return json({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!key)return json({error:'Server configuration missing'},500,origin)
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user)return json({error:'Phiên đăng nhập không hợp lệ.'},401,origin)
  const actor=auth.user
  const body=await req.json()
  const action=String(body.action??'')
  const organizationId=String(body.organizationId??'')
  if(!organizationId||!['list','reset_password','suspend','reactivate','remove'].includes(action))return json({error:'Yêu cầu không hợp lệ.'},400,origin)

  const {data:org,error:orgError}=await admin.from('organizations').select('id,name,status').eq('id',organizationId).maybeSingle()
  if(orgError)throw orgError
  if(!org||org.status!=='active')return json({error:'Tổ chức không tồn tại hoặc đang tạm ngừng.'},404,origin)

  const {data:actorMembership,error:actorMemberError}=await admin.from('organization_members').select('id,status').eq('organization_id',organizationId).eq('user_id',actor.id).maybeSingle()
  if(actorMemberError)throw actorMemberError
  if(!actorMembership||actorMembership.status!=='active')return json({error:'Bạn không có quyền truy cập tổ chức này.'},403,origin)
  const {data:actorAssignments,error:actorAssignmentsError}=await admin.from('member_roles').select('role_id').eq('organization_id',organizationId).eq('member_id',actorMembership.id)
  if(actorAssignmentsError)throw actorAssignmentsError
  const actorRoleIds=(actorAssignments??[]).map(row=>row.role_id)
  const {data:actorRoles,error:actorRolesError}=await admin.from('roles').select('id,code').eq('organization_id',organizationId).in('id',actorRoleIds)
  if(actorRolesError)throw actorRolesError
  const isAdmin=(actorRoles??[]).some(role=>role.code==='admin')
  const {data:actorGrants,error:actorGrantsError}=await admin.from('role_permissions').select('role_id').eq('organization_id',organizationId).eq('permission_code','users.manage').in('role_id',actorRoleIds)
  if(actorGrantsError)throw actorGrantsError
  if(!isAdmin&&!(actorGrants??[]).length)return json({error:'Bạn không có quyền quản lý tài khoản.'},403,origin)

  if(action==='list'){
   const {data:members,error:membersError}=await admin.from('organization_members').select('id,user_id,status,created_at').eq('organization_id',organizationId).order('created_at',{ascending:true})
   if(membersError)throw membersError
   const memberRows=members??[]
   const memberUserIds=[...new Set(memberRows.map(row=>row.user_id))]
   const [{data:profiles,error:profilesError},{data:orgRoles,error:orgRolesError}]=await Promise.all([
    admin.from('profiles').select('id,display_name').in('id',memberUserIds),
    admin.from('roles').select('id,code').eq('organization_id',organizationId)
   ])
   if(profilesError)throw profilesError
   if(orgRolesError)throw orgRolesError
   const ids=memberRows.map(row=>row.id)
   const {data:assignments,error:assignError}=ids.length?await admin.from('member_roles').select('member_id,role_id').eq('organization_id',organizationId).in('member_id',ids):{data:[],error:null}
   if(assignError)throw assignError
   const roleMap=new Map((orgRoles??[]).map(role=>[role.id,role.code]))
   const roleByMember=new Map<string,string>()
   for(const assignment of assignments??[]){const code=roleMap.get(assignment.role_id);if(code)roleByMember.set(assignment.member_id,code)}
   const profileMap=new Map((profiles??[]).map(profile=>[profile.id,profile]))
   const userMap=new Map<string,any>()
   for(let page=1;page<=100;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:500})
    if(error)throw error
    const users=data.users??[]
    for(const user of users)userMap.set(user.id,user)
    if(users.length<500)break
    if(page===100)throw new Error('Số tài khoản Auth vượt giới hạn phân trang an toàn.')
   }
   const rows=memberRows.map(member=>{
    const user=userMap.get(member.user_id)
    const profile=profileMap.get(member.user_id)
    const email=user?.email??''
    const metadataName=typeof user?.user_metadata?.display_name==='string'?user.user_metadata.display_name:''
    return {
     id:member.id,userId:member.user_id,email,
     displayName:profile?.display_name||metadataName||email.split('@')[0]||'',
     roleCode:roleByMember.get(member.id)||'unknown',
     status:member.status,emailConfirmed:Boolean(user?.email_confirmed_at),createdAt:member.created_at
    }
   })
   return json({ok:true,organization:{id:org.id,name:org.name},members:rows,overview:{
    total:rows.length,active:rows.filter(row=>row.status==='active').length,
    invited:rows.filter(row=>row.status==='invited').length,suspended:rows.filter(row=>row.status==='suspended').length,
    confirmed:rows.filter(row=>row.emailConfirmed).length,unconfirmed:rows.filter(row=>!row.emailConfirmed).length
   }},200,origin)
  }

  const memberId=String(body.memberId??'')
  if(!memberId)return json({error:'Thiếu thành viên cần thao tác.'},400,origin)
  const {data:target,error:targetError}=await admin.from('organization_members').select('id,user_id,status').eq('organization_id',organizationId).eq('id',memberId).maybeSingle()
  if(targetError)throw targetError
  if(!target)return json({error:'Không tìm thấy thành viên trong tổ chức.'},404,origin)
  if(target.user_id===actor.id)return json({error:'Không thể tự khóa hoặc xóa tài khoản đang đăng nhập.'},403,origin)
  const {data:targetAssignments,error:targetAssignmentsError}=await admin.from('member_roles').select('role_id').eq('organization_id',organizationId).eq('member_id',memberId)
  if(targetAssignmentsError)throw targetAssignmentsError
  const targetRoleIds=(targetAssignments??[]).map(row=>row.role_id)
  const {data:targetRoles,error:targetRolesError}=await admin.from('roles').select('code').eq('organization_id',organizationId).in('id',targetRoleIds)
  if(targetRolesError)throw targetRolesError
  if((targetRoles??[]).some(role=>role.code==='admin'))return json({error:'Không thể reset, khóa hoặc xóa Admin bằng mục này.'},403,origin)
  const {data:targetUser,error:targetUserError}=await admin.auth.admin.getUserById(target.user_id)
  if(targetUserError||!targetUser.user)return json({error:'Không tìm thấy tài khoản Auth của thành viên.'},404,origin)

  if(action==='reset_password'){
   if(!targetUser.user.email)return json({error:'Tài khoản không có email để gửi khôi phục.'},400,origin)
   if(!targetUser.user.email_confirmed_at)return json({error:'Tài khoản chưa xác nhận email. Cần hoàn tất lời mời trước khi reset mật khẩu.'},400,origin)
   const {error}=await admin.auth.resetPasswordForEmail(targetUser.user.email,{redirectTo:ORIGIN+'/'})
   if(error)throw error
   return json({ok:true,message:'Đã gửi email đặt lại mật khẩu tới '+targetUser.user.email+'. Người dùng tự mở email và tạo mật khẩu mới.'},200,origin)
  }
  if(action==='suspend'){
   if(target.status==='suspended')return json({ok:true,message:'Tài khoản đã ở trạng thái tạm khóa.'},200,origin)
   const {error}=await admin.from('organization_members').update({status:'suspended',updated_at:new Date().toISOString()}).eq('id',memberId).eq('organization_id',organizationId)
   if(error)throw error
   return json({ok:true,message:'Đã tạm khóa quyền truy cập của thành viên trong tổ chức này.'},200,origin)
  }
  if(action==='reactivate'){
   const nextStatus=targetUser.user.email_confirmed_at?'active':'invited'
   const {error}=await admin.from('organization_members').update({status:nextStatus,updated_at:new Date().toISOString()}).eq('id',memberId).eq('organization_id',organizationId)
   if(error)throw error
   return json({ok:true,message:nextStatus==='active'?'Đã mở lại quyền truy cập.':'Đã chuyển về chờ xác nhận email.'},200,origin)
  }
  if(action==='remove'){
   const {error}=await admin.from('organization_members').delete().eq('id',memberId).eq('organization_id',organizationId)
   if(error)throw error
   return json({ok:true,message:'Đã xóa thành viên khỏi tổ chức. Tài khoản Auth và dữ liệu lịch sử được giữ nguyên.'},200,origin)
  }
  return json({error:'Thao tác không được hỗ trợ.'},400,origin)
 }catch(error){return json({error:error instanceof Error?error.message:String(error)},400,origin)}
})
