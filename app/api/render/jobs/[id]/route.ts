export const runtime='edge';

export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 const{id}=await context.params;
 // Durable persistence is connected in the next Cloudflare resource step.
 // Until then return an explicit provisioning state rather than pretending a browser job is running in background.
 return Response.json({id,status:'provisioning',progress:0,message:'Background renderer is waiting for Queue/D1/R2 provisioning.'},{headers:{'cache-control':'no-store'}});
}
