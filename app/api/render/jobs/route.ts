export const runtime='edge';

type Job={id:string;status:string;progress:number;title:string;createdAt:number;updatedAt:number;input:Record<string,unknown>};
const jobs=new Map<string,Job>();

export async function POST(request:Request){
 try{
  const input=await request.json() as Record<string,unknown>;
  const id=crypto.randomUUID();
  const now=Date.now();
  const job:Job={id,status:'queued',progress:0,title:String(input.title||'Suno video'),createdAt:now,updatedAt:now,input};
  jobs.set(id,job);
  return Response.json(job,{status:202,headers:{'cache-control':'no-store'}});
 }catch{return Response.json({error:'Dữ liệu render không hợp lệ.'},{status:400})}
}

export {jobs};
