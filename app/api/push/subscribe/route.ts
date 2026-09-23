export const runtime='edge';
type Env={RENDER_DB:D1Database};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as any).env as Env}
export async function POST(request:Request){
 try{const body=await request.json() as any,installationId=String(body.installationId||''),sub=body.subscription;if(!installationId||!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth)return Response.json({error:'Push subscription không hợp lệ.'},{status:400});const e=await env(),now=Date.now(),id=crypto.randomUUID();await e.RENDER_DB.prepare('INSERT INTO push_subscriptions (id,installation_id,endpoint,p256dh,auth,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET installation_id=excluded.installation_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at').bind(id,installationId,sub.endpoint,sub.keys.p256dh,sub.keys.auth,now,now).run();return Response.json({ok:true},{status:201})}catch(error){console.error('push subscribe',error);return Response.json({error:'Không lưu được đăng ký thông báo.'},{status:500})}
}
export async function DELETE(request:Request){try{const{endpoint}=await request.json() as any;if(endpoint){const e=await env();await e.RENDER_DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(endpoint).run()}return Response.json({ok:true})}catch{return Response.json({ok:true})}}
