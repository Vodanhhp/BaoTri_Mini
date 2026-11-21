import type { SupabaseClient } from '@supabase/supabase-js'

export type OrganizationContext = {
  id: string
  name: string
  membershipId: string
  roleCodes: string[]
  permissions: string[]
  isAdmin: boolean
}

export async function loadOrganizationContext(client: SupabaseClient, userId: string): Promise<OrganizationContext[]> {
  const {data: memberships,error}=await client.from('organization_members')
    .select('id,organization_id,role,status')
    .eq('user_id',userId).eq('status','active')
  if(error) throw new Error('Không đọc được tổ chức/tư cách thành viên: '+error.message)
  if(!memberships?.length) return []
  const orgIds=memberships.map(m=>m.organization_id)
  const {data:organizations,error:orgError}=await client.from('organizations')
    .select('id,name,status').in('id',orgIds).eq('status','active')
  if(orgError) throw new Error('Không đọc được thông tin tổ chức: '+orgError.message)
  const orgMap=new Map((organizations??[]).map(o=>[o.id,o]))
  const results:OrganizationContext[]=[]
  for(const m of memberships){
    const org=orgMap.get(m.organization_id)
    if(!org) continue
    const {data:assignments,error:roleError}=await client.from('member_roles')
      .select('role_id,roles(code,name)').eq('organization_id',m.organization_id).eq('member_id',m.id)
    if(roleError) throw new Error('Không đọc được vai trò: '+roleError.message)
    const roleCodes=(assignments??[]).map(a=>{
      const role=a.roles as unknown as {code?:string}|null
      return role?.code ?? ''
    }).filter(Boolean)
    const roleIds=(assignments??[]).map(a=>a.role_id)
    const {data:grants,error:grantError}=roleIds.length
      ? await client.from('role_permissions').select('permission_code').eq('organization_id',m.organization_id).in('role_id',roleIds)
      : {data:[],error:null}
    if(grantError) throw new Error('Không đọc được quyền: '+grantError.message)
    results.push({id:org.id,name:org.name,membershipId:m.id,roleCodes,permissions:[...new Set((grants??[]).map(g=>g.permission_code))],isAdmin:roleCodes.includes('admin')})
  }
  return results
}
