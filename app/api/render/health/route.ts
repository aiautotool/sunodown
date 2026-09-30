export const runtime='edge';

type Env={RENDERER?:Fetcher};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as unknown as {env:Env}).env}

export async function GET(){
  const e=await env();
  if(!e.RENDERER)return Response.json({ok:false,error:'renderer_binding_missing'},{status:503});
  const response=await e.RENDERER.fetch('https://renderer/health',{headers:{'cache-control':'no-cache'}});
  const text=await response.text();
  return new Response(text,{status:response.status,headers:{'content-type':response.headers.get('content-type')||'application/json','cache-control':'no-store'}});
}
