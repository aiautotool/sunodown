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

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function aesGcmDecrypt(value: string, aad: string, keyBytes: ArrayBuffer) {
  const raw = fromBase64(value);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12), additionalData: new TextEncoder().encode(aad), tagLength: 128 }, key, raw.subarray(12)));
}

async function decryptSunoAudio(url: URL, clipId: string) {
  const [rightsResponse, encryptedResponse] = await Promise.all([
    fetch('https://studio-api-prod.suno.com/api/mango/rights', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content_params: { content_id: clipId, content_type: 'clip' } }),
    }),
    fetch(url.toString(), { cache: 'no-store' }),
  ]);
  if (!rightsResponse.ok || !encryptedResponse.ok) throw new Error('Suno media request failed');
  const rights = await rightsResponse.json() as { key?: string; iv?: string; glt?: string };
  if (!rights.key || !rights.iv || !rights.glt) throw new Error('Invalid Suno media rights');
  const gltKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rights.glt));
  const [counterKey, counterIv] = await Promise.all([aesGcmDecrypt(rights.key, clipId, gltKey), aesGcmDecrypt(rights.iv, clipId, gltKey)]);
  const key = await crypto.subtle.importKey('raw', counterKey, { name: 'AES-CTR' }, false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CTR', counter: counterIv.subarray(0, 16), length: 128 }, key, await encryptedResponse.arrayBuffer()));
}

function parseRange(value: string | null, length: number) {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  return Number.isInteger(start) && start >= 0 && start <= end && start < length ? { start, end } : null;
}

async function proxyAudio(request: NextRequest, headOnly = false) {
  const directSource = request.nextUrl.searchParams.get('source');
  const source = directSource ?? await verifyMediaToken(request.nextUrl.searchParams.get('token'), 'audio');
  const audioUrl = getAllowedAudioUrl(source);
  if (!audioUrl) return NextResponse.json({ error: 'Nguồn âm thanh hoặc token không hợp lệ.' }, { status: directSource ? 400 : 401 });

  try {
    const encryptedMatch = audioUrl.hostname.endsWith('.cloudfront.net') && audioUrl.pathname.toLowerCase().endsWith('.m4a')
      ? audioUrl.pathname.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.m4a$/i)
      : null;
    if (encryptedMatch && !headOnly) {
      const clear = await decryptSunoAudio(audioUrl, encryptedMatch[1]);
      if (!hasMp4Header(clear)) throw new Error('Invalid decrypted audio');
      const range = parseRange(request.headers.get('range'), clear.byteLength);
      const body = range ? clear.slice(range.start, range.end + 1) : clear;
      const headers = new Headers({ 'content-type': 'audio/mp4', 'content-length': String(body.byteLength), 'accept-ranges': 'bytes', 'cache-control': 'private, no-store', 'access-control-allow-origin': '*' });
      if (range) headers.set('content-range', `bytes ${range.start}-${range.end}/${clear.byteLength}`);
      return new Response(body, { status: range ? 206 : 200, headers });
    }
    const range = request.headers.get('range');
    const upstream = await fetch(audioUrl.toString(), {
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
