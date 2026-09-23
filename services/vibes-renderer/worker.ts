import {Container} from '@cloudflare/containers';
import {env} from 'cloudflare:workers';

type RendererEnv={
  AI_RENDERER:DurableObjectNamespace<RendererContainer>;
  VIBES_META_SESSION?:string;
  RENDER_SERVICE_TOKEN?:string;
};

export class RendererContainer extends Container<RendererEnv>{
  defaultPort=8080;
  sleepAfter='15m';
  envVars={
    VIBES_META_SESSION:String(env.VIBES_META_SESSION||''),
    RENDER_SERVICE_TOKEN:String(env.RENDER_SERVICE_TOKEN||''),
    AUDIO_SOURCE_HOSTS:'suno.aiautotool.com',
  };
}

function pool(jobId:string){let hash=2166136261;for(const char of jobId){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return `renderer-${Math.abs(hash)%3}`}

export default {
  async fetch(request:Request,bindings:RendererEnv){
    const url=new URL(request.url);
    if(url.pathname==='/health')return bindings.AI_RENDERER.getByName('renderer-health').fetch(request);
    if(url.pathname!=='/render'||request.method!=='POST')return new Response('Not found',{status:404});
    if(bindings.RENDER_SERVICE_TOKEN&&request.headers.get('authorization')!==`Bearer ${bindings.RENDER_SERVICE_TOKEN}`)return new Response('Unauthorized',{status:401});
    let jobId='default';
    try{const copy=request.clone(),body=await copy.json() as {jobId?:string};if(body.jobId)jobId=body.jobId}catch{}
    return bindings.AI_RENDERER.getByName(pool(jobId)).fetch(request);
  },
} satisfies ExportedHandler<RendererEnv>;

