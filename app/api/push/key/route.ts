export const runtime='edge';
export async function GET(){const mod=await import('cloudflare:workers'),e=(mod as any).env as {VAPID_PUBLIC_KEY?:string};if(!e.VAPID_PUBLIC_KEY)return Response.json({error:'Web Push chưa được cấu hình.'},{status:503});return Response.json({publicKey:e.VAPID_PUBLIC_KEY},{headers:{'cache-control':'public, max-age=3600'}})}
