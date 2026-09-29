import { NextRequest, NextResponse } from 'next/server';
import { getPublicSong, PUBLIC_SONG_UUID_RE } from '@/app/lib/public-song';
import { proxyAudioSource } from '@/app/lib/audio-proxy';

async function streamSong(request: NextRequest, headOnly = false) {
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

  // Keep the browser on one stable URL and return the ranged media response
  // directly. Creator v22 used this native-media pattern successfully on
  // mobile; avoiding a 307 here is especially important after iOS locks the
  // screen and performs follow-up Range requests in the background.
  return proxyAudioSource(request, song.audioUrl, headOnly);
}

export async function GET(request: NextRequest) {
  return streamSong(request);
}

export async function HEAD(request: NextRequest) {
  return streamSong(request, true);
}
