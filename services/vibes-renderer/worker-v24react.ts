import {Container} from '@cloudflare/containers';
import {env} from 'cloudflare:workers';

type RendererEnv={
  AI_RENDERER:DurableObjectNamespace<V24ReactRendererContainer>;
  VIBES_META_SESSION?:string;
};

export class V24ReactRendererContainer extends Container<RendererEnv>{
  defaultPort=8080;
  sleepAfter='15m';
  envVars={
    VIBES_META_SESSION:String(env.VIBES_META_SESSION||''),
    AUDIO_SOURCE_HOSTS:'sunoapp.aiautotool.com',
  };
  entrypoint=[
    'sh','-lc',
    "python -m pip install --no-cache-dir 'fastapi==0.115.12' 'uvicorn[standard]==0.34.2' 'requests==2.32.3' 'VibesAI-api==1.5.0' >/tmp/pip.log 2>&1 && python -c \"import urllib.request; urllib.request.urlretrieve('https://raw.githubusercontent.com/aiautotool/sunodown/4942ca8e655eaec877955c70c1a3f63d563959c8/services/vibes-renderer/app.py','/tmp/app.py')\" && uvicorn --app-dir /tmp app:app --host 0.0.0.0 --port 8080"
  ];
}

function pool(jobId:string){
  let hash=2166136261;
  for(const char of jobId){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return `v24react-renderer-${Math.abs(hash)%3}`;
}

export default {
  async fetch(request:Request,bindings:RendererEnv){
    const url=new URL(request.url);
    if(url.pathname==='/health'){
      return bindings.AI_RENDERER.getByName('v24react-renderer-health').fetch(request);
    }
    if(!['/render','/audio'].includes(url.pathname)||request.method!=='POST'){
      return new Response('Not found',{status:404});
    }
    let jobId='default';
    try{
      const body=await request.clone().json() as {jobId?:string};
      if(body.jobId)jobId=body.jobId;
    }catch{}

    return bindings.AI_RENDERER.getByName(pool(jobId)).fetch(request);
  },
} satisfies ExportedHandler<RendererEnv>;
