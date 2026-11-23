// Reset is request-and-approval only. This legacy endpoint fails closed for older clients.
Deno.serve(async(req)=>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'https://baotri.vieclamhp247.com','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 return new Response(JSON.stringify({error:'Reset trực tiếp đã bị vô hiệu hóa. Admin doanh nghiệp phải gửi yêu cầu; Superadmin duyệt tại mục Duyệt yêu cầu.'}),{status:410,headers})
})
