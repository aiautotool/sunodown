export const runtime='edge';

type Env={RENDER_DB:D1Database;RENDER_QUEUE:Queue};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as any).env as Env}

export async function POST(request:Request){
 try{
  const input=await request.json() as Record<string,unknown>;
  const installationId=String(input.installationId||'');
  if(!installationId)return Response.json({error:'Thiếu installationId.'},{status:400});
  const e=await env(),id=crypto.randomUUID(),now=Date.now(),expires=now+7*24*60*60*1000,title=String(input.title||'Suno video');
  await e.RENDER_DB.prepare('INSERT INTO render_jobs (id,installation_id,status,progress,title,input_json,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,installationId,'queued',0,title,JSON.stringify(input),now,now,expires).run();
  await e.RENDER_QUEUE.send({jobId:id});
  return Response.json({id,status:'queued',progress:0,title,createdAt:now,updatedAt:now},{status:202,headers:{'cache-control':'no-store'}});
 }catch(error){console.error('create render job',error);return Response.json({error:'Không thể tạo job render ngầm.'},{status:500})}
}
