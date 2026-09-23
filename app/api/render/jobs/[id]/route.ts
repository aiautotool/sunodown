export const runtime='edge';
type Env={RENDER_DB:D1Database;RENDER_QUEUE:Queue};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as any).env as Env}
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 const{id}=await context.params,e=await env();
 const row=await e.RENDER_DB.prepare('SELECT id,status,progress,title,result_url,error,created_at,updated_at FROM render_jobs WHERE id=?').bind(id).first<any>();
 if(!row)return Response.json({error:'Không tìm thấy render job.'},{status:404});
 return Response.json({id:row.id,status:row.status,progress:row.progress,title:row.title,resultUrl:row.result_url||null,error:row.error||null,createdAt:row.created_at,updatedAt:row.updated_at},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const{id}=await context.params,{installationId}=await request.json() as {installationId?:string},e=await env();
  if(!installationId)return Response.json({error:'Thiếu installationId.'},{status:400});
  const row=await e.RENDER_DB.prepare('SELECT installation_id,status FROM render_jobs WHERE id=?').bind(id).first<{installation_id:string;status:string}>();
  if(!row)return Response.json({error:'Không tìm thấy render job.'},{status:404});
  if(row.installation_id!==installationId)return Response.json({error:'Không có quyền chạy lại job này.'},{status:403});
  if(row.status==='completed')return Response.json({id,status:row.status});
  await e.RENDER_DB.prepare('UPDATE render_jobs SET status=?,error=?,updated_at=? WHERE id=?').bind('queued',null,Date.now(),id).run();
  await e.RENDER_QUEUE.send({jobId:id});
  return Response.json({id,status:'queued'},{status:202});
 }catch(error){console.error('resume render job',error);return Response.json({error:'Không thể chạy lại job render.'},{status:500})}
}
