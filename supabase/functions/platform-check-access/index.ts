import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'

const ORIGIN='https://baotri.vieclamhp247.com'
const cors=(origin:string|null)=>({
 'Access-Control-Allow-Origin':origin===ORIGIN||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'?origin:ORIGIN,
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
})
const response=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin)
 try{
  const token=req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if(!token)return response({error:'Missing access token'},401,origin)
  const url=Deno.env.get('SUPABASE_URL')
  const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const ownerEmail=Deno.env.get('PLATFORM_OWNER_EMAIL')?.trim().toLowerCase()
  if(!url||!publicKey||!ownerEmail)return response({error:'Server configuration missing'},500,origin)
  const authClient=createClient(url,publicKey,{
   global:{headers:{Authorization:`Bearer ${token}`}},
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  })
  const {data:auth,error:authError}=await authClient.auth.getUser(token)
  if(authError||!auth.user||!auth.user.email_confirmed_at)return response({allowed:false},200,origin)
  return response({allowed:auth.user.email?.trim().toLowerCase()===ownerEmail},200,origin)
 }catch(error){
  return response({error:error instanceof Error?error.message:String(error)},400,origin)
 }
})
