import { NextRequest, NextResponse } from 'next/server';
import { createMediaToken } from '../../lib/media-token';

function validSunoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com')); }
  catch { return false; }
}
const UUID_RE='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
function clipIdFromUrl(value:string){try{return new URL(value).pathname.match(new RegExp(`/(?:song|clip)/(${UUID_RE})(?:/|$)`,'i'))?.[1]??null}catch{return null}}
function clipIdFromPage(html:string){
 const patterns=[
  new RegExp(`https?:\\/\\/(?:www\\.)?suno\\.com\\/(?:song|clip)\\/(${UUID_RE})`,'i'),
  new RegExp(`https?:\\\\/\\\\/(?:www\\.)?suno\\.com\\\\/(?:song|clip)\\\\/(${UUID_RE})`,'i'),
  new RegExp(`["'](?:clip_id|clipId|song_id|songId)["']\\s*:\\s*["'](${UUID_RE})["']`,'i')
 ];
 for(const p of patterns){const m=html.match(p);if(m?.[1])return m[1]} return null;
}
async function resolveClipId(input:string){
 const direct=clipIdFromUrl(input); if(direct)return direct;
 const r=await fetch(input,{headers:{accept:'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9','user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'},redirect:'follow',cache:'no-store'});
 if(!r.ok)throw new Error(`Không thể đọc trang Suno (HTTP ${r.status}).`);
 const redirected=clipIdFromUrl(r.url); if(redirected)return redirected;
 return clipIdFromPage(await r.text());
}
function firstString(...values:unknown[]){return values.find(v=>typeof v==='string'&&v.trim()) as string|undefined}
export async function POST(request:NextRequest){
 try{
  const {input}=await request.json();
  if(!validSunoUrl(input))return NextResponse.json({error:'Vui lòng nhập một liên kết Suno hợp lệ.'},{status:400});
  const clipId=await resolveClipId(input);
  if(!clipId)return NextResponse.json({error:'Không tìm thấy mã bài hát trong link Suno.'},{status:502});
  const clipResponse=await fetch(`https://studio-api-prod.suno.com/api/clip/${clipId}`,{headers:{accept:'application/json','user-agent':'Mozilla/5.0'},cache:'no-store'});
  if(!clipResponse.ok)return NextResponse.json({error:`Không lấy được metadata bài hát từ Suno (HTTP ${clipResponse.status}).`},{status:502});
  const clip=await clipResponse.json() as Record<string,unknown>;
  const metadata=clip.metadata&&typeof clip.metadata==='object'?clip.metadata as Record<string,unknown>:null;
  const mediaUrls=Array.isArray(clip.media_urls)?clip.media_urls as Array<Record<string,unknown>>:[];
  const audioSource=mediaUrls.find(m=>typeof m.url==='string'&&String(m.content_type).startsWith('m4a'))?.url??mediaUrls.find(m=>typeof m.url==='string'&&String(m.content_type).startsWith('mp3'))?.url??clip.audio_url;
  if(typeof audioSource!=='string'||audioSource.includes('/api/forbidden'))return NextResponse.json({error:'Suno chưa cung cấp nguồn âm thanh cho bài này.'},{status:502});
  const videoSource=typeof clip.video_url==='string'&&clip.video_url.startsWith('https://')?clip.video_url:null;
  const picture=typeof clip.image_large_url==='string'?clip.image_large_url:typeof clip.image_url==='string'?clip.image_url:null;
  const [audioToken,videoToken,pictureToken]=await Promise.all([createMediaToken(audioSource,'audio'),videoSource?createMediaToken(videoSource,'audio'):null,picture?createMediaToken(picture,'image'):null]);
  const audio=`/api/audio?token=${encodeURIComponent(audioToken)}`;
  const lyrics=firstString(metadata?.prompt,metadata?.lyrics,clip.lyrics,clip.prompt);
  const description=firstString(clip.description,metadata?.description);
  return NextResponse.json({
   id:clipId,title:firstString(clip.title)||'Suno audio',picture:pictureToken?`/api/image?token=${encodeURIComponent(pictureToken)}`:null,
   audio,sourceAudio:audio,video:videoToken?`/api/audio?token=${encodeURIComponent(videoToken)}`:null,
   description:description||null,lyrics:lyrics||null,
   style:firstString(metadata?.tags,clip.display_tags)||null,tags:firstString(metadata?.tags,clip.display_tags)||null,
   duration:typeof metadata?.duration==='number'?metadata.duration:typeof clip.duration==='number'?clip.duration:null,
   creator:firstString(clip.display_name,clip.handle)||null,handle:firstString(clip.handle)||null,
   createdAt:typeof clip.created_at==='string'?clip.created_at:null,isPublic:typeof clip.is_public==='boolean'?clip.is_public:null
  });
 }catch(cause){return NextResponse.json({error:cause instanceof Error?cause.message:'Dịch vụ đang bận. Vui lòng thử lại sau.'},{status:500})}
}
