import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicSong,
  PUBLIC_SONG_UUID_RE,
} from '@/app/lib/public-song';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';

  if (!PUBLIC_SONG_UUID_RE.test(id)) {
    return NextResponse.json(
      { error: 'invalid_song_id' },
      { status: 400, headers: { 'cache-control': 'public, max-age=300' } },
    );
  }

  const song = await getPublicSong(id);
  if (!song || !song.isPublic) {
    return NextResponse.json(
      { error: 'song_not_found' },
      { status: 404, headers: { 'cache-control': 'public, max-age=60' } },
    );
  }

  return NextResponse.json(
    {
      song: {
        id: song.id,
        title: song.title,
        creator: song.creator,
        handle: song.handle,
        picture: song.picture,
        duration: song.duration,
        tags: song.tags || song.style,
        lyrics: song.lyrics,
      },
    },
    {
      headers: {
        'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      },
    },
  );
}
