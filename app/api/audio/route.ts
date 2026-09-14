import { NextRequest, NextResponse } from 'next/server';
import { verifyMediaToken } from '../../lib/media-token';

function getAllowedAudioUrl(value: string | null) {
  if (!value || value.length > 2000) return null;
  try {
    const url = new URL(value);
    const allowed = url.protocol === 'https:' && (
      url.hostname.endsWith('.cloudfront.net') ||
      url.hostname === 'suno.ai' ||
      url.hostname.endsWith('.suno.ai')
    );
    return allowed ? url : null;
  } catch {
    return null;
  }
}

function hasMp4Header(bytes: Uint8Array) {
  return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
}

async function resolvePlayableUrl(url: URL) {
  const match = url.hostname.endsWith('.cloudfront.net') && url.pathname.toLowerCase().endsWith('.m4a')
    ? url.pathname.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.m4a$/i)
    : null;
  if (!match) return url;

  const probe = await fetch(url.toString(), { headers: { range: 'bytes=0-31' } });
  if (probe.ok && hasMp4Header(new Uint8Array(await probe.arrayBuffer()))) return url;

  const videoUrl = new URL(`https://cdn1.suno.ai/${match[1]}.mp4`);
  const videoCheck = await fetch(videoUrl.toString(), { method: 'HEAD' });
  return videoCheck.ok ? videoUrl : url;
}

async function proxyAudio(request: NextRequest, headOnly = false) {
  const directSource = request.nextUrl.searchParams.get('source');
  const source = directSource ?? await verifyMediaToken(request.nextUrl.searchParams.get('token'), 'audio');
  const audioUrl = getAllowedAudioUrl(source);
  if (!audioUrl) return NextResponse.json({ error: 'Nguồn âm thanh hoặc token không hợp lệ.' }, { status: directSource ? 400 : 401 });

  try {
    const playableUrl = directSource ? await resolvePlayableUrl(audioUrl) : audioUrl;
    const range = request.headers.get('range');
    const upstream = await fetch(playableUrl.toString(), {
      method: headOnly ? 'HEAD' : 'GET',
      headers: range ? { range } : undefined,
    });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: 'Không thể phát file âm thanh.' }, { status: 502 });
    }

    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', 'private, no-store');
    headers.set('access-control-allow-origin', '*');

    return new Response(headOnly ? null : upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ error: 'Không thể kết nối tới nguồn âm thanh.' }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return proxyAudio(request);
}

export async function HEAD(request: NextRequest) {
  return proxyAudio(request, true);
}
