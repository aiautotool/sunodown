export const runtime='edge';
type Env={RENDER_DB:D1Database};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as any).env as Env}
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 const{id}=await context.params,e=await env();
 const row=await e.RENDER_DB.prepare('SELECT id,status,progress,title,result_url,error,created_at,updated_at FROM render_jobs WHERE id=?').bind(id).first<any>();
 if(!row)return Response.json({error:'Không tìm thấy render job.'},{status:404});
 return Response.json({id:row.id,status:row.status,progress:row.progress,title:row.title,resultUrl:row.result_url||null,error:row.error||null,createdAt:row.created_at,updatedAt:row.updated_at},{headers:{'cache-control':'no-store'}});
}
