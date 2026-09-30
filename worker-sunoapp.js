import baseWorker, {
  MusicUserStore,
  PublicMusicDirectory,
  SubtitleStore,
} from './worker-picai.js';

export { MusicUserStore, PublicMusicDirectory, SubtitleStore };

async function updateRenderJob(env,id,status,progress,error=null,resultUrl=null,resultKey=null){
  await env.RENDER_DB.prepare(
    'UPDATE render_jobs SET status=?,progress=?,error=?,result_url=?,result_key=?,updated_at=? WHERE id=?',
  ).bind(status,progress,error,resultUrl,resultKey,Date.now(),id).run();
}

async function dispatchRenderJob(env,id){
  const row=await env.RENDER_DB.prepare(
    'SELECT input_json,status FROM render_jobs WHERE id=?',
  ).bind(id).first();

  if(!row||row.status==='completed'||row.status==='failed')return 'done';

  const input=JSON.parse(row.input_json);
  if(!env.RENDERER){
    await updateRenderJob(env,id,'failed',0,'Renderer riêng của SunoApp chưa được cấu hình.');
    return 'done';
  }

  await updateRenderJob(env,id,'preparing',5);
  const response=await env.RENDERER.fetch('https://renderer/render',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({jobId:id,input}),
  });

  if(response.status===202){
    await updateRenderJob(env,id,'rendering',20);
    return 'pending';
  }

  if(!response.ok){
    const detail=(await response.text()).slice(0,500);
    throw new Error(`Renderer HTTP ${response.status}${detail?`: ${detail}`:''}`);
  }

  const contentType=response.headers.get('content-type')||'';
  if(contentType.includes('video/')){
    await updateRenderJob(env,id,'uploading',95);
    const key=`renders/${id}.mp4`;
    await env.RENDER_RESULTS.put(key,response.body,{
      httpMetadata:{contentType:'video/mp4',cacheControl:'private, max-age=604800'},
    });
    await updateRenderJob(env,id,'completed',100,null,`/api/render/results/${id}`,key);
    return 'done';
  }

  const data=await response.json();
  if(data.status==='failed'){
    await updateRenderJob(env,id,'failed',20,String(data.error||'Renderer thất bại'));
    return 'done';
  }
  if(data.resultUrl){
    await updateRenderJob(env,id,'completed',100,null,String(data.resultUrl),data.resultKey||null);
    return 'done';
  }
  throw new Error(data.error||'Renderer không trả về video');
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if((request.method==='GET'||request.method==='HEAD')&&!url.pathname.startsWith('/api/')){
      return env.ASSETS.fetch(request);
    }
    return baseWorker.fetch(request,env,ctx);
  },
  async queue(batch,env){
    for(const message of batch.messages){
      try{
        const state=await dispatchRenderJob(env,message.body.jobId);
        if(state==='pending')await env.RENDER_QUEUE.send(message.body,{delaySeconds:30});
        message.ack();
      }catch(error){
        console.error('sunoapp render dispatch',error);
        await updateRenderJob(
          env,message.body.jobId,'rendering',20,
          error instanceof Error?error.message:'Render failed',
        );
        message.retry({delaySeconds:30});
      }
    }
  },
};
