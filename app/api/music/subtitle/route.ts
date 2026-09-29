import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_SONG_UUID_RE } from '@/app/lib/public-song';
import { getSubtitleStoreNamespace } from '@/app/lib/cloudflare-runtime';
import { getSubtitleArtifact } from '@/app/lib/subtitle-cloud';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const songId = request.nextUrl.searchParams.get('songId') || '';
  const language = request.nextUrl.searchParams.get('language') || 'vi';

  if (!PUBLIC_SONG_UUID_RE.test(songId)) {
    return NextResponse.json(
      { error: 'invalid_song_id' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  if (!getSubtitleStoreNamespace()) {
    return NextResponse.json(
      { error: 'subtitle_store_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const subtitle = await getSubtitleArtifact(songId, language);
    if (!subtitle) {
      return NextResponse.json(
        { status: 'missing', songId, language },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { status: 'ready', cached: true, subtitle },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('[subtitle-cloud:get]', error);
    return NextResponse.json(
      { error: 'subtitle_store_failed' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
