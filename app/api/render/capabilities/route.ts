export const runtime='edge';

type Env={AI_RENDER_SERVICE_URL?:string;RENDER_SERVICE_URL?:string};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as unknown as {env:Env}).env}

export async function GET(){
 const e=await env();
 return Response.json({aiMusicVideo:Boolean(e.AI_RENDER_SERVICE_URL),backgroundVisualizer:Boolean(e.RENDER_SERVICE_URL)},{headers:{'cache-control':'no-store'}});
}
