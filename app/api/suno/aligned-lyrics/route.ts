import { NextRequest,NextResponse } from 'next/server';
export const runtime='edge';
const ID=/^[0-9a-f-]{20,64}$/i;
export async function GET(req:NextRequest){
 const songId=req.nextUrl.searchParams.get('songId')?.trim()||'';
 if(!ID.test(songId))return NextResponse.json({error:'songId không hợp lệ'},{status:400});
 const auth=req.headers.get('x-suno-authorization')||'';
 const headers:Record<string,string>={
  Accept:'application/json',
  'user-agent':'SunoDown/23 (+https://picai.online)',
 };
 if(auth)headers.Authorization=auth.startsWith('Bearer ')?auth:`Bearer ${auth}`;
 const r=await fetch(`https://studio-api.prod.suno.com/api/gen/${encodeURIComponent(songId)}/aligned_lyrics/v2/`,{headers,cache:'no-store'});
 if(!r.ok)return NextResponse.json({available:false,status:r.status,requiresAuth:r.status===401||r.status===403},{status:200});
 const data=await r.json();return NextResponse.json({available:Boolean(data?.aligned_words?.length||data?.aligned_lyrics?.length),...data});
}
