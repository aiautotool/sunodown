import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from './server.mjs';
import { POST } from './dist/route.mjs';

test('standalone API validates CORS and proxies multipart without exposing credentials', async () => {
  let calls = 0;
  const server = createApiServer({available:()=>true,post:async request=>{
    calls++;
    const form = await request.formData();
    assert.equal(await form.get('audio').text(),'sample');
    assert.equal(form.get('lyrics'),'test lyrics');
    return Response.json({lines:[{text:'test',start:0,end:1}]});
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    const health=await fetch(url+'/health');
    assert.equal((await health.json()).available,true);
    const denied=await fetch(url+'/api/karaoke/groq',{method:'POST',headers:{Origin:'https://example.com'}});
    assert.equal(denied.status,403);assert.equal(calls,0);
    const headers={Origin:'https://picai.online'};
    const preflight=await fetch(url+'/api/karaoke/groq',{method:'OPTIONS',headers});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),headers.Origin);
    const form=new FormData();form.set('audio',new File(['sample'],'sample.mp3'));form.set('lyrics','test lyrics');
    const result=await fetch(url+'/api/karaoke/groq',{method:'POST',headers,body:form});
    assert.equal(result.status,200);assert.equal((await result.json()).lines.length,1);assert.equal(calls,1);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('production route uses server key and preserves Groq word timestamps', async()=>{
  const original=globalThis.fetch;const previous=process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY='test-server-key';
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal(options.headers.Authorization,'Bearer test-server-key');
    assert.equal(options.body.get('model'),'whisper-large-v3-turbo');
    return Response.json({words:[{word:'Xin',start:1,end:1.4},{word:'chào',start:1.5,end:2}],duration:3});
  };
  try{
    const form=new FormData();form.set('audio',new File(['sample'],'sample.mp3',{type:'audio/mpeg'}));form.set('duration','3');
    const response=await POST(new Request('http://localhost/api/karaoke/groq',{method:'POST',body:form}));
    assert.equal(response.status,200);const data=await response.json();assert.equal(data.words[0].start,1);assert.equal(data.lines[0].words[1].end,2);
    form.set('lyrics','Xin chào');
    const aligned=await POST(new Request('http://localhost/api/karaoke/groq',{method:'POST',body:form}));
    assert.equal(aligned.status,200);assert.equal((await aligned.json()).meta.lyrics_alignment,true);
  }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previous;}
});
