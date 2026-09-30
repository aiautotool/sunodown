import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';

function wr(args,{allowFail=false}={}){
  try{
    return execFileSync('npx',['wrangler',...args],{
      encoding:'utf8',
      stdio:['ignore','pipe','pipe'],
      env:{...process.env},
    });
  }catch(error){
    if(allowFail)return `${error.stdout||''}${error.stderr||''}`;
    throw error;
  }
}

function json(args){
  const out=wr([...args,'--json']);
  const starts=[out.indexOf('['),out.indexOf('{')].filter(x=>x>=0);
  if(!starts.length)throw new Error(`No JSON from wrangler ${args.join(' ')}`);
  return JSON.parse(out.slice(Math.min(...starts)));
}

function textHas(args,name){
  return wr(args,{allowFail:true}).toLowerCase().includes(name.toLowerCase());
}

const d1Name='sunoapp-v24react-db';
const r2Name='sunoapp-v24react-render-results';
const queueName='sunoapp-v24react-render-jobs';
const generated='wrangler.v24react.generated.json';

let db=json(['d1','list']).find(item=>item.name===d1Name);
if(!db){
  console.log('Creating isolated D1',d1Name);
  wr(['d1','create',d1Name]);
  db=json(['d1','list']).find(item=>item.name===d1Name);
}
if(!db)throw new Error('Unable to provision isolated D1');

if(!textHas(['r2','bucket','list'],r2Name)){
  console.log('Creating isolated R2',r2Name);
  wr(['r2','bucket','create',r2Name]);
}

let queueExists=false;
try{
  const queues=json(['queues','list']);
  queueExists=queues.some(item=>item.queue_name===queueName||item.name===queueName);
}catch{
  queueExists=textHas(['queues','list'],queueName);
}
if(!queueExists){
  console.log('Creating isolated Queue',queueName);
  wr(['queues','create',queueName]);
}

const cfg=JSON.parse(readFileSync('wrangler.v24react.json','utf8'));
cfg.d1_databases=[{
  binding:'RENDER_DB',
  database_name:d1Name,
  database_id:db.uuid||db.id,
  migrations_dir:'migrations',
}];
cfg.r2_buckets=[{
  binding:'RENDER_RESULTS',
  bucket_name:r2Name,
}];
cfg.queues={
  producers:[{binding:'RENDER_QUEUE',queue:queueName}],
  consumers:[{
    queue:queueName,
    max_batch_size:1,
    max_batch_timeout:2,
    max_retries:3,
    max_concurrency:2,
  }],
};
writeFileSync(generated,JSON.stringify(cfg,null,2));

console.log('Applying isolated D1 migrations');
wr(['d1','migrations','apply','RENDER_DB','--remote','--config',generated]);
console.log('v24react isolated Cloudflare resources ready');
