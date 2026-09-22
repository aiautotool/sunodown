import app from './dist/server/index.js';

type AssetsBinding={fetch:(request:Request)=>Promise<Response>};
type Env={RENDER_DB:D1Database;RENDER_RESULTS:R2Bucket;ASSETS?:AssetsBinding;RENDER_SERVICE_URL?:string;RENDER_SERVICE_TOKEN?:string};
type Msg={jobId:string};
async function update(env:Env,id:string,status:string,progress:number,error:string|null=null,resultUrl:string|null=null,resultKey:string|null=null){await env.RENDER_DB.prepare('UPDATE render_jobs SET status=?,progress=?,error=?,result_url=?,result_key=?,updated_at=? WHERE id=?').bind(status,progress,error,resultUrl,resultKey,Date.now(),id).run()}
async function dispatch(env:Env,id:string){const row=await env.RENDER_DB.prepare('SELECT input_json FROM render_jobs WHERE id=?').bind(id).first<{input_json:string}>();if(!row)return; if(!env.RENDER_SERVICE_URL){await update(env,id,'failed',0,'Server renderer chưa được cấu hình.');return}await update(env,id,'preparing',5);const response=await fetch(env.RENDER_SERVICE_URL,{method:'POST',headers:{'content-type':'application/json',...(env.RENDER_SERVICE_TOKEN?{authorization:`Bearer ${env.RENDER_SERVICE_TOKEN}`}:{})},body:JSON.stringify({jobId:id,input:JSON.parse(row.input_json)})});if(!response.ok)throw new Error(`Renderer HTTP ${response.status}`);const contentType=response.headers.get('content-type')||'';if(contentType.includes('video/')){await update(env,id,'uploading',95);const key=`renders/${id}.mp4`;await env.RENDER_RESULTS.put(key,response.body,{httpMetadata:{contentType:'video/mp4',cacheControl:'public, max-age=604800'}});await update(env,id,'completed',100,null,`/api/render/results/${id}`,key);return}const data=await response.json() as any;if(data.resultUrl){await update(env,id,'completed',100,null,String(data.resultUrl),data.resultKey||null);return}throw new Error(data.error||'Renderer không trả về video')}
async function safeFetch(request:Request,env:Env,ctx:ExecutionContext){
  const url=new URL(request.url);
  if(request.method==='GET'&&env.ASSETS&&(url.pathname.startsWith('/_next/static/')||url.pathname==='/favicon.svg'||url.pathname==='/apple-touch-icon.png'||url.pathname==='/og.png'||url.pathname==='/sw.js')){
    return env.ASSETS.fetch(request);
  }
  try{return await app.fetch(request,env,ctx)}catch(error){
    console.error('app fetch failed',error);
    if(request.method==='GET'&&!url.pathname.startsWith('/api/')){
      if(env.ASSETS){const asset=await env.ASSETS.fetch(request);if(asset.status!==404)return asset;const index=await env.ASSETS.fetch(new Request(new URL('/',url),request));if(index.status<500)return index}
    }
    return new Response('SunoDown temporarily unavailable',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
  }
}
export default {fetch:safeFetch,async queue(batch:MessageBatch<Msg>,env:Env){for(const message of batch.messages){try{await dispatch(env,message.body.jobId);message.ack()}catch(error){console.error('render dispatch',error);await update(env,message.body.jobId,'rendering',20,error instanceof Error?error.message:'Render failed');message.retry({delaySeconds:30})}}}} satisfies ExportedHandler<Env,Msg>;
