import { NextRequest, NextResponse } from 'next/server';
import { verifyMediaToken } from '../../lib/media-token';
import { proxyAudioSource } from '../../lib/audio-proxy';

async function proxyAudio(request: NextRequest, headOnly = false) {
  const directSource = request.nextUrl.searchParams.get('source');
  const source =
    directSource ??
    (await verifyMediaToken(
      request.nextUrl.searchParams.get('token'),
      'audio',
    ));

  if (!source) {
    return NextResponse.json(
      { error: 'Nguồn âm thanh hoặc token không hợp lệ.' },
      { status: directSource ? 400 : 401 },
    );
  }

  return proxyAudioSource(request, source, headOnly);
}

export async function GET(request: NextRequest) {
  return proxyAudio(request);
}

export async function HEAD(request: NextRequest) {
  return proxyAudio(request, true);
}
