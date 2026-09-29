import { NextRequest, NextResponse } from 'next/server';
import { getPublicSong, PUBLIC_SONG_UUID_RE } from '@/app/lib/public-song';
import { createMediaToken } from '@/app/lib/media-token';
import { readUserSession } from '@/app/lib/user-auth';

export async function GET(request: NextRequest) {
  const user = await readUserSession(request);
  if (!user) {
    return NextResponse.json(
      { error: 'authentication_required' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  const id = request.nextUrl.searchParams.get('id') || '';
  if (!PUBLIC_SONG_UUID_RE.test(id)) {
    return NextResponse.json(
      { error: 'invalid_song_id' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const song = await getPublicSong(id);
  if (!song || !song.isPublic) {
    return NextResponse.json(
      { error: 'song_not_found' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }
  if (!song.audioUrl) {
    return NextResponse.json(
      { error: 'audio_unavailable' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }

  const token = await createMediaToken(song.audioUrl, 'audio', 60 * 60 * 2);
  const target = new URL('/api/audio', request.url);
  target.searchParams.set('token', token);

  const response = NextResponse.redirect(target, 307);
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export async function HEAD(request: NextRequest) {
  return GET(request);
}
