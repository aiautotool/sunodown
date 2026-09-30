import { NextRequest, NextResponse } from 'next/server';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';
import { proxyAudioSource } from '@/app/lib/audio-proxy';
import {
  getPublicSong,
  PUBLIC_SONG_UUID_RE,
} from '@/app/lib/public-song';
import {
  getGroqCredentials,
  getSubtitleStoreNamespace,
} from '@/app/lib/cloudflare-runtime';
import {
  alignGroqWordsToLyrics,
  extensionFromMime,
  generateGroqSubtitle,
  GroqSubtitleError,
} from '@/app/lib/groq-subtitle-server';
import { validateKaraokeTimeline } from '@/app/lib/karaoke-validation';
import {
  SUBTITLE_ARTIFACT_VERSION,
  SUBTITLE_PIPELINE_VERSION,
  claimSubtitleGeneration,
  getSubtitleArtifact,
  putSubtitleArtifact,
  releaseSubtitleGeneration,
  sha256Hex,
  type SubtitleArtifact,
} from '@/app/lib/subtitle-cloud';

export const runtime = 'edge';

function safeLanguage(value: unknown) {
  const language =
    typeof value === 'string' && value.trim()
      ? value.trim().toLowerCase()
      : 'vi';
  return /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(language)
    ? language
    : 'vi';
}

function artifactResponse(
  subtitle: SubtitleArtifact,
  options: { cached: boolean; realigned?: boolean } = { cached: false },
) {
  return NextResponse.json(
    {
      status: 'ready',
      cached: options.cached,
      realigned: Boolean(options.realigned),
      subtitle,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  let body: { songId?: string; language?: string; force?: boolean };
  try {
    body = (await request.json()) as {
      songId?: string;
      language?: string;
      force?: boolean;
    };
  } catch {
    return NextResponse.json(
      { error: 'invalid_json' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const songId = String(body.songId || '');
  const language = safeLanguage(body.language);
  const force = body.force === true;

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

  const song = await getPublicSong(songId);
  if (!song) {
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

  const cleanedLyrics = cleanLyricsForVideo(song.lyrics || '').trim();
  const lyricsHash = await sha256Hex(cleanedLyrics);

  let audioResponse: Response;
  try {
    audioResponse = await proxyAudioSource(
      new Request(request.url, {
        method: 'GET',
        headers: { accept: 'audio/*' },
      }),
      song.audioUrl,
      false,
    );
  } catch (error) {
    console.error('[subtitle-cloud:audio]', error);
    return NextResponse.json(
      { error: 'audio_fetch_failed' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }

  if (!audioResponse.ok) {
    return NextResponse.json(
      { error: 'audio_fetch_failed', status: audioResponse.status },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  if (!audioBuffer.byteLength) {
    return NextResponse.json(
      { error: 'audio_empty' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }

  const audioType =
    audioResponse.headers.get('content-type') || 'audio/mpeg';
  const audioHash = await sha256Hex(audioBuffer);
  const duration = Number(song.duration) || 0;
  const fingerprint = [
    audioHash,
    lyricsHash,
    language,
    SUBTITLE_PIPELINE_VERSION,
  ].join(':');

  const existing = await getSubtitleArtifact(songId, language);
  if (
    !force &&
    existing &&
    existing.audioHash === audioHash &&
    existing.lyricsHash === lyricsHash &&
    existing.pipelineVersion === SUBTITLE_PIPELINE_VERSION &&
    existing.lines.length
  ) {
    return artifactResponse(existing, { cached: true });
  }

  if (
    !force &&
    existing &&
    existing.audioHash === audioHash &&
    existing.pipelineVersion === SUBTITLE_PIPELINE_VERSION &&
    existing.rawWords?.length &&
    existing.lyricsHash !== lyricsHash &&
    cleanedLyrics
  ) {
    const lines = alignGroqWordsToLyrics(
      cleanedLyrics,
      existing.rawWords,
      duration || existing.duration,
    );
    if (lines.length) {
      const quality = validateKaraokeTimeline(
        lines,
        duration || existing.duration,
        {
          lyrics: cleanedLyrics,
          source: 'timed',
        },
      );
      const now = Date.now();
      const realigned: SubtitleArtifact = {
        ...existing,
        version: SUBTITLE_ARTIFACT_VERSION,
        pipelineVersion: SUBTITLE_PIPELINE_VERSION,
        language,
        lyricsHash,
        lines: quality.timeline,
        status: quality.confidence >= 60 ? 'synced' : 'fallback',
        confidence: quality.confidence,
        updatedAt: now,
      };
      await putSubtitleArtifact(realigned);
      return artifactResponse(realigned, {
        cached: true,
        realigned: true,
      });
    }
  }

  const claim = await claimSubtitleGeneration(songId, language, fingerprint);
  if (!claim.claimed) {
    return NextResponse.json(
      {
        status: 'generating',
        songId,
        language,
        startedAt: claim.startedAt || null,
      },
      {
        status: 202,
        headers: {
          'cache-control': 'no-store',
          'retry-after': '2',
        },
      },
    );
  }

  try {
    const credentials = await getGroqCredentials();
    if (!credentials.key) {
      return NextResponse.json(
        {
          error: 'groq_not_configured',
          source: credentials.source,
        },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }

    const extension = extensionFromMime(audioType) || 'mp3';
    const result = await generateGroqSubtitle({
      apiKey: credentials.key,
      audio: new Blob([audioBuffer], { type: audioType }),
      filename: `song-${songId}.${extension}`,
      lyrics: cleanedLyrics,
      duration,
      language,
    });

    const quality = validateKaraokeTimeline(
      result.lines,
      result.meta.duration,
      {
        lyrics: cleanedLyrics,
        source: 'timed',
      },
    );

    const now = Date.now();
    const subtitle: SubtitleArtifact = {
      version: SUBTITLE_ARTIFACT_VERSION,
      pipelineVersion: SUBTITLE_PIPELINE_VERSION,
      songId,
      language,
      engine: result.meta.engine,
      status: quality.confidence >= 60 ? 'synced' : 'fallback',
      confidence: quality.confidence,
      duration: result.meta.duration,
      audioHash,
      lyricsHash,
      lines: quality.timeline,
      rawWords: result.words,
      generatedAt: now,
      updatedAt: now,
    };

    await putSubtitleArtifact(subtitle);
    return artifactResponse(subtitle, { cached: false });
  } catch (error) {
    if (error instanceof GroqSubtitleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: { 'cache-control': 'no-store' },
        },
      );
    }
    console.error('[subtitle-cloud:generate]', error);
    return NextResponse.json(
      { error: 'subtitle_generation_failed' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  } finally {
    await releaseSubtitleGeneration(songId, language).catch(() => {});
  }
}
