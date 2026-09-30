export const runtime='edge';

type Env={RENDERER?:Fetcher};
async function env():Promise<Env>{const mod=await import('cloudflare:workers');return (mod as unknown as {env:Env}).env}

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request:Request){
  const url=new URL(request.url);
  const songId=url.searchParams.get('songId')||'';
  const format=(url.searchParams.get('format')||'m4a').toLowerCase();
  const title=(url.searchParams.get('title')||'suno-audio').slice(0,120);

  if(!UUID_RE.test(songId))return Response.json({error:'invalid_song_id'},{status:400});
  if(!['m4a','mp3','wav'].includes(format))return Response.json({error:'unsupported_format'},{status:400});

  const e=await env();
  if(!e.RENDERER)return Response.json({error:'Audio renderer chưa được cấu hình.'},{status:503});

  const audioUrl=`${url.origin}/api/music/audio?id=${encodeURIComponent(songId)}`;
  const response=await e.RENDERER.fetch('https://renderer/audio',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({audioUrl,format,title}),
  });

  if(!response.ok){
    const detail=(await response.text()).slice(0,500);
    return Response.json({error:detail||'Không thể xuất audio.'},{status:response.status});
  }

  const headers=new Headers();
  headers.set('content-type',response.headers.get('content-type')||({m4a:'audio/mp4',mp3:'audio/mpeg',wav:'audio/wav'} as Record<string,string>)[format]);
  headers.set('content-disposition',`attachment; filename="suno-audio.${format}"`);
  headers.set('cache-control','private, no-store');
  return new Response(response.body,{headers});
}
