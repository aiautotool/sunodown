import { NextResponse } from 'next/server';

export const runtime='nodejs';

export async function POST(request:Request){
 const endpoint=process.env.UVR_SERVICE_URL;
 if(!endpoint)return NextResponse.json({error:'UVR backend chưa được cấu hình.'},{status:503});
 try{
  const input=await request.formData(); const audio=input.get('audio');
  if(!(audio instanceof File))return NextResponse.json({error:'Thiếu file audio.'},{status:400});
  const body=new FormData();body.append('audio',audio,audio.name);body.append('stem','vocals');
  const upstream=await fetch(endpoint,{method:'POST',body,headers:process.env.UVR_SERVICE_TOKEN?{Authorization:`Bearer ${process.env.UVR_SERVICE_TOKEN}`}:undefined});
  const data=await upstream.json().catch(()=>null);
  if(!upstream.ok)return NextResponse.json({error:data?.error||'UVR xử lý thất bại.'},{status:upstream.status});
  return NextResponse.json(data);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'UVR unavailable'},{status:502})}
}