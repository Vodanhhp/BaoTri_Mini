import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const OWNER_EMAIL='tuanluongpham1980@gmail.com'
const ORIGIN='https://baotri.vieclamhp247.com'
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':origin===ORIGIN||origin==='https://baotri-mini-new-preview-l8hhedfwf-tuanluongpham-8256.vercel.app'||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'?origin:ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')
  if(!token)return response({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!key)return response({error:'Server configuration missing'},500,origin)
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await admin.auth.getUser(token)
  if(authError||!auth.user||!auth.user.email_confirmed_at||auth.user.email?.toLowerCase()!==OWNER_EMAIL)return response({error:'Only the verified platform owner can view platform statistics.'},403,origin)

  const [{data:organizations,error:orgError},{data:members,error:memberError},{data:catalogs,error:catalogError}]=await Promise.all([
   admin.from('organizations').select('id,name,status,created_at').order('created_at',{ascending:false}),
   admin.from('organization_members').select('id,organization_id,user_id,status'),
   admin.from('organization_equipment_catalog').select('organization_id,plan_code,source_data_version,snapshot')
  ])
  if(orgError)throw orgError
  if(memberError)throw memberError
  if(catalogError)throw catalogError
  const catalogByOrganization=new Map((catalogs??[]).map(catalog=>[catalog.organization_id,catalog]))

  let authAccountsTotal=0,confirmedAccounts=0
  for(let page=1;page<=100;page++){
   const {data,error}=await admin.auth.admin.listUsers({page,perPage:500})
   if(error)throw error
   const users=data.users??[]
   authAccountsTotal+=users.length
   confirmedAccounts+=users.filter(user=>Boolean(user.email_confirmed_at)).length
   if(users.length<500)break
   if(page===100)throw new Error('Auth account count exceeded the safe pagination limit.')
  }

  const memberships=members??[]
  const rows=(organizations??[]).map(org=>{
   const own=memberships.filter(member=>member.organization_id===org.id)
   const catalog=catalogByOrganization.get(org.id)
   return {
    id:org.id,name:org.name,status:org.status,createdAt:org.created_at,
    totalMembers:own.length,
    activeMembers:own.filter(member=>member.status==='active').length,
    invitedMembers:own.filter(member=>member.status==='invited').length,
    suspendedMembers:own.filter(member=>member.status==='suspended').length,
    uniqueUsers:new Set(own.map(member=>member.user_id)).size,
    planCode:catalog?.plan_code??null,
    planName:catalog?.snapshot?.plan?.name??null,
    planMaxDevices:catalog?catalog.snapshot?.plan?.maxDevices??null:null,
    equipmentGroups:Array.isArray(catalog?.snapshot?.equipmentGroups)?catalog.snapshot.equipmentGroups.length:0,
    equipmentDictionary:Array.isArray(catalog?.snapshot?.equipmentDictionary)?catalog.snapshot.equipmentDictionary.length:0,
    industries:Array.isArray(catalog?.snapshot?.industries)?catalog.snapshot.industries.length:0,
    sourceDataVersion:catalog?.source_data_version??null
   }
  })
  return response({
   organizationsTotal:rows.length,
   organizationsActive:rows.filter(org=>org.status==='active').length,
   organizationsSuspended:rows.filter(org=>org.status==='suspended').length,
   authAccountsTotal,confirmedAccounts,unconfirmedAccounts:authAccountsTotal-confirmedAccounts,
   membershipsTotal:memberships.length,
   activeMemberships:memberships.filter(member=>member.status==='active').length,
   invitedMemberships:memberships.filter(member=>member.status==='invited').length,
   suspendedMemberships:memberships.filter(member=>member.status==='suspended').length,
   organizations:rows
  },200,origin)
 }catch(error){return response({error:error instanceof Error?error.message:String(error)},400,origin)}
})
