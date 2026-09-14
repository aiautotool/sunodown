import { NextRequest, NextResponse } from 'next/server';
import { verifyMediaToken } from '../../lib/media-token';

export async function GET(request: NextRequest) {
  const source = await verifyMediaToken(request.nextUrl.searchParams.get('token'), 'image');
  try {
    if (!source || source.length > 2000) throw new Error();
    const url = new URL(source);
    if (url.protocol !== 'https:' || !(url.hostname === 'suno.ai' || url.hostname.endsWith('.suno.ai'))) throw new Error();
    let upstream = await fetch(url.toString());
    if (!upstream.ok && url.hostname === 'cdn2.suno.ai') {
      url.hostname = 'cdn1.suno.ai';
      upstream = await fetch(url.toString());
    }
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'Ảnh không khả dụng.' }, { status: 502 });
    return new Response(upstream.body, { headers: { 'content-type': upstream.headers.get('content-type') || 'image/jpeg', 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' } });
  } catch {
    return NextResponse.json({ error: 'Token ảnh không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
  }
}
