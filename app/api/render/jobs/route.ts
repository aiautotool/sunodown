export const runtime='edge';

type Env={RENDER_DB:D1Database;RENDER_QUEUE:Queue;RENDER_SERVICE_URL?:string};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as any).env as Env}

export async function POST(request:Request){
 try{
  const input=await request.json() as Record<string,unknown>;
  const installationId=typeof input.installationId==='string'?input.installationId:'';
  if(!installationId)return Response.json({error:'Thiếu installationId.'},{status:400});
  if(input.mode==='ai_music_video'){
   const song=(input.song&&typeof input.song==='object'?input.song:{}) as Record<string,unknown>,audio=typeof song.audio==='string'?song.audio:'',lyrics=typeof input.lyrics==='string'?input.lyrics:typeof song.lyrics==='string'?song.lyrics:'';
   if(!audio||!lyrics)return Response.json({error:'AI Music Video cần audio và lời bài hát.'},{status:400});
   if(lyrics.length>50000)return Response.json({error:'Lời bài hát quá dài.'},{status:413});
   try{const source=new URL(audio),origin=new URL(request.url).origin;if(source.origin!==origin)return Response.json({error:'Nguồn audio không hợp lệ.'},{status:400})}catch{return Response.json({error:'Nguồn audio không hợp lệ.'},{status:400})}
  }
  const e=await env();
  if(input.mode==='visualizer'&&!e.RENDER_SERVICE_URL)return Response.json({error:'Visualizer nền chưa được cấu hình trên máy chủ. Hãy dùng AI Music Video.'},{status:503});
  const id=crypto.randomUUID(),now=Date.now(),expires=now+7*24*60*60*1000,title=typeof input.title==='string'?input.title:'Suno video';
  await e.RENDER_DB.prepare('INSERT INTO render_jobs (id,installation_id,status,progress,title,input_json,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,installationId,'queued',0,title,JSON.stringify(input),now,now,expires).run();
  await e.RENDER_QUEUE.send({jobId:id});
  return Response.json({id,status:'queued',progress:0,title,createdAt:now,updatedAt:now},{status:202,headers:{'cache-control':'no-store'}});
 }catch(error){console.error('create render job',error);return Response.json({error:'Không thể tạo job render ngầm.'},{status:500})}
}
