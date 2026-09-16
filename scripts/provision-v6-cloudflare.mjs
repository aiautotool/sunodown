import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
function wr(args,{allowFail=false}={}){try{return execFileSync('npx',['wrangler',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){if(allowFail)return `${e.stdout||''}${e.stderr||''}`;throw e}}
function json(args){const out=wr([...args,'--json']);const starts=[out.indexOf('['),out.indexOf('{')].filter(x=>x>=0);if(!starts.length)throw new Error(`No JSON returned by wrangler ${args.join(' ')}`);return JSON.parse(out.slice(Math.min(...starts)))}
function existsFromText(args,name){const out=wr(args,{allowFail:true});return out.toLowerCase().includes(name.toLowerCase())}
const d1Name='suno-render-db',r2Name='suno-render-results',queueName='suno-render-jobs',generated='wrangler.v6.generated.json';
let db=json(['d1','list']).find(x=>x.name===d1Name);
if(!db){console.log('Creating D1…');const out=wr(['d1','create',d1Name]);const m=out.match(/database_id\s*=\s*"([^"]+)"/)||out.match(/database_id[^a-f0-9-]*([a-f0-9-]{20,})/i);if(!m)throw new Error(`Could not parse D1 id:\n${out}`);db={uuid:m[1],name:d1Name}}
if(!existsFromText(['r2','bucket','list'],r2Name)){console.log('Creating R2…');wr(['r2','bucket','create',r2Name])}
let queueExists=false;try{const queues=json(['queues','list']);queueExists=queues.some(x=>x.queue_name===queueName||x.name===queueName)}catch{queueExists=existsFromText(['queues','list'],queueName)}
if(!queueExists){console.log('Creating Queue…');wr(['queues','create',queueName])}
const cfg=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
cfg.d1_databases=[{binding:'RENDER_DB',database_name:d1Name,database_id:db.uuid||db.id,migrations_dir:'migrations'}];
cfg.r2_buckets=[{binding:'RENDER_RESULTS',bucket_name:r2Name}];
cfg.queues={producers:[{binding:'RENDER_QUEUE',queue:queueName}],consumers:[{queue:queueName,max_batch_size:1,max_batch_timeout:2,max_retries:3,max_concurrency:2}]};
writeFileSync(generated,JSON.stringify(cfg,null,2));
console.log('Applying D1 migration…');wr(['d1','migrations','apply','RENDER_DB','--remote','--config',generated]);
console.log('Cloudflare v6 resources ready.');
