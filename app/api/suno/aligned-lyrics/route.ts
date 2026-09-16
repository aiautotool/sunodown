import { NextRequest,NextResponse } from 'next/server';
export const runtime='edge';
const ID=/^[0-9a-f-]{20,64}$/i;
export async function GET(req:NextRequest){
 const songId=req.nextUrl.searchParams.get('songId')?.trim()||'';
 if(!ID.test(songId))return NextResponse.json({error:'songId không hợp lệ'},{status:400});
 const auth=req.headers.get('x-suno-authorization')||'';
 if(!auth)return NextResponse.json({available:false,reason:'Suno alignment cần phiên xác thực; không dùng API trả phí.'},{status:200});
 const r=await fetch(`https://studio-api.prod.suno.com/api/gen/${encodeURIComponent(songId)}/aligned_lyrics/v2/`,{headers:{Authorization:auth.startsWith('Bearer ')?auth:`Bearer ${auth}`,Accept:'application/json'},cache:'no-store'});
 if(!r.ok)return NextResponse.json({available:false,status:r.status},{status:200});
 const data=await r.json();return NextResponse.json({available:Boolean(data?.aligned_words?.length||data?.aligned_lyrics?.length),...data});
}
