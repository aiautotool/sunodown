import { NextRequest, NextResponse } from 'next/server';
import {
  alignRoughWordsToLyrics,
  normalizeKaraokeTimeline,
  type KaraokeLine,
  type RoughWord,
} from '@/app/lib/karaoke';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';

export const runtime = 'edge';
// GROQ_API_KEY is provisioned at deploy time as a Cloudflare Worker secret.

type GroqEnv = {
  GROQ_API_KEY?: string;
};

type GroqWord = {
  word?: string;
  text?: string;
  start?: number;
  end?: number;
};

type GroqSegment = {
  text?: string;
  start?: number;
  end?: number;
  words?: GroqWord[];
};

type GroqVerboseResponse = {
  text?: string;
  language?: string;
  duration?: number;
  words?: GroqWord[];
  segments?: GroqSegment[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

const GROQ_EXTENSIONS = new Set([
  'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'opus', 'wav', 'webm',
]);

function extensionFromMime(type: string) {
  const mime = type.toLowerCase().split(';')[0].trim();
  if (mime === 'audio/flac' || mime === 'audio/x-flac') return 'flac';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3';
  if (mime === 'audio/mp4' || mime === 'video/mp4') return 'mp4';
  if (mime === 'audio/x-m4a' || mime === 'audio/m4a') return 'm4a';
  if (mime === 'audio/ogg' || mime === 'application/ogg') return 'ogg';
  if (mime === 'audio/opus') return 'opus';
  if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') return 'wav';
  if (mime === 'audio/webm' || mime === 'video/webm') return 'webm';
  return '';
}

function groqUploadName(file: File) {
  const nameExt = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  const extension =
    (GROQ_EXTENSIONS.has(nameExt) ? nameExt : '') ||
    extensionFromMime(file.type) ||
    'mp3';
  return `mobile-audio.${extension}`;
}

async function getEnv(): Promise<GroqEnv> {
  try {
    const mod = await import('cloudflare:workers');
    return ((mod as any).env || {}) as GroqEnv;
  } catch {
    return {
      GROQ_API_KEY:
        typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined,
    };
  }
}

function normalizeWord(value: GroqWord): RoughWord | null {
  const text = String(value.word ?? value.text ?? '').trim();
  const start = Number(value.start);
  const end = Number(value.end);
  if (
    !text ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return null;
  }
  return {
    text,
    start: Math.max(0, start),
    end: Math.max(start + 0.01, end),
  };
}

function distributeSegmentWords(segment: GroqSegment): RoughWord[] {
  const text = String(segment.text ?? '').trim();
  const start = Number(segment.start);
  const end = Number(segment.end);
  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const span = end - start;
  return tokens.map((token, index) => {
    const tokenStart = start + (span * index) / tokens.length;
    const tokenEnd = start + (span * (index + 1)) / tokens.length;
    return {
      text: token,
      start: tokenStart,
      end: Math.max(tokenStart + 0.01, tokenEnd),
    };
  });
}

function extractWords(result: GroqVerboseResponse): RoughWord[] {
  const direct = (result.words || [])
    .map(normalizeWord)
    .filter((word): word is RoughWord => Boolean(word));
  if (direct.length) return direct;

  const nested = (result.segments || []).flatMap((segment) =>
    (segment.words || [])
      .map(normalizeWord)
      .filter((word): word is RoughWord => Boolean(word)),
  );
  if (nested.length) return nested;

  return (result.segments || []).flatMap(distributeSegmentWords);
}

export async function GET() {
  const env = await getEnv();
  return NextResponse.json({
    available: Boolean(env.GROQ_API_KEY?.trim()),
    engine: 'groq-whisper-large-v3-turbo',
    wordTimestamps: true,
    maxMobileUploadBytes: 24 * 1024 * 1024,
  });
}

function alignGroqWordsToLyrics(
  lyrics: string,
  words: RoughWord[],
  duration: number,
) {
  const anchored = alignRoughWordsToLyrics(lyrics, words, duration, {
    strictAnchors: true,
  });
  if (!anchored.length) return anchored;

  const full = alignRoughWordsToLyrics(lyrics, words, duration, {
    strictAnchors: false,
  });
  if (!full.length) return anchored;

  const anchoredIndexes = anchored
    .map((line) => line.lyricIndex)
    .filter((value): value is number => Number.isFinite(value));
  if (!anchoredIndexes.length) return anchored;

  const firstAnchor = Math.min(...anchoredIndexes);
  const lastAnchor = Math.max(...anchoredIndexes);
  const lowerBound = firstAnchor <= 1 ? 0 : firstAnchor;
  const upperBound =
    lastAnchor >= full.length - 2 ? full.length - 1 : lastAnchor;

  const bounded = full.filter((line) => {
    const index = line.lyricIndex;
    return (
      Number.isFinite(index) &&
      (index as number) >= lowerBound &&
      (index as number) <= upperBound
    );
  });

  // Only use interpolation when it materially improves lyric coverage.
  // Leading/trailing unanchored lines remain excluded unless an anchor is
  // already close to that edge, preventing subtitles during instrumental intro/outro.
  return bounded.length >= anchored.length + 2 ? bounded : anchored;
}

function wordsToLines(words: RoughWord[], duration: number): KaraokeLine[] {
  const lines: KaraokeLine[] = [];
  let current: RoughWord[] = [];

  const flush = () => {
    if (!current.length) return;
    lines.push({
      text: current
        .map((word) => word.text)
        .join(' ')
        .replace(/\s+([,.;!?])/g, '$1'),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current.map((word) => ({ ...word })),
    });
    current = [];
  };

  for (const word of words) {
    const previous = current.at(-1);
    const pause = previous ? word.start - previous.end : 0;
    const characters = current.reduce(
      (sum, item) => sum + item.text.length + 1,
      0,
    );
    if (
      current.length &&
      (pause > 0.9 ||
        current.length >= 10 ||
        characters + word.text.length > 58)
    ) {
      flush();
    }
    current.push(word);
    if (/[.!?…]$/.test(word.text) && current.length >= 3) flush();
  }
  flush();
  return normalizeKaraokeTimeline(lines, duration);
}

export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    const apiKey = env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Groq subtitle chưa được cấu hình trên server.',
          code: 'GROQ_NOT_CONFIGURED',
        },
        { status: 503 },
      );
    }

    const incoming = await request.formData();
    const audio = incoming.get('audio');
    const lyricsValue = incoming.get('lyrics');
    const languageValue = incoming.get('language');
    const durationValue = incoming.get('duration');

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Thiếu audio.' }, { status: 400 });
    }

    // Groq free tier accepts up to 25 MB. Keep a small safety margin so mobile
    // uploads do not hit the upstream hard limit; larger files fall back to the
    // existing chunked subtitle pipeline on the client.
    if (audio.size > 24 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: 'Audio vượt giới hạn Groq mobile 24 MB.',
          code: 'GROQ_FILE_TOO_LARGE',
        },
        { status: 413 },
      );
    }

    const lyrics =
      typeof lyricsValue === 'string'
        ? cleanLyricsForVideo(lyricsValue).trim()
        : '';
    const language =
      typeof languageValue === 'string' && languageValue.trim()
        ? languageValue.trim()
        : 'vi';
    const requestedDuration = Number(durationValue);

    const form = new FormData();
    const uploadName = groqUploadName(audio);
    form.set(
      'file',
      new File([audio], uploadName, {
        type: audio.type || 'audio/mpeg',
      }),
    );
    form.set('model', 'whisper-large-v3-turbo');
    form.set('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.set('language', language);
    form.set('temperature', '0');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    let upstream: Response;
    try {
      upstream = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: form,
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const result = (await upstream.json().catch(() => ({}))) as GroqVerboseResponse;
    if (!upstream.ok) {
      const upstreamMessage =
        result.error?.message || `Groq transcription lỗi HTTP ${upstream.status}.`;
      console.warn('[groq-karaoke]', upstream.status, upstreamMessage);
      return NextResponse.json(
        {
          error: upstreamMessage,
          code: 'GROQ_UPSTREAM_ERROR',
          status: upstream.status,
        },
        { status: upstream.status === 429 ? 429 : 502 },
      );
    }

    const words = extractWords(result);
    if (!words.length) {
      return NextResponse.json(
        {
          error: 'Groq không trả về word timestamp.',
          code: 'GROQ_NO_WORD_TIMESTAMPS',
        },
        { status: 422 },
      );
    }

    const detectedDuration =
      Number(result.duration) || words.at(-1)?.end || 0;
    const duration =
      Number.isFinite(requestedDuration) && requestedDuration > 0
        ? requestedDuration
        : Math.max(0.1, detectedDuration);

    const lines = lyrics
      ? alignGroqWordsToLyrics(lyrics, words, duration)
      : wordsToLines(words, duration);

    if (!lines.length) {
      return NextResponse.json(
        {
          error: lyrics
            ? 'Groq nhận diện được lời nhưng chưa căn được lyric.'
            : 'Groq không tạo được cue subtitle.',
          code: 'GROQ_ALIGNMENT_EMPTY',
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      lines,
      words,
      text: result.text || '',
      meta: {
        engine: 'groq-whisper-large-v3-turbo',
        language: result.language || language,
        duration,
        audio_bytes: audio.size,
        upload_filename: uploadName,
        upload_mime: audio.type || 'audio/mpeg',
        word_count: words.length,
        line_count: lines.length,
        anchored_line_count: lines.filter((line) => line.timingSource === 'anchored').length,
        interpolated_line_count: lines.filter((line) => line.timingSource === 'interpolated').length,
        lyrics_alignment: Boolean(lyrics),
      },
    });
  } catch (error) {
    const aborted =
      error instanceof DOMException && error.name === 'AbortError';
    console.error('[groq-karaoke]', error);
    return NextResponse.json(
      {
        error: aborted
          ? 'Groq transcription quá thời gian chờ.'
          : 'Không xử lý được subtitle bằng Groq.',
        code: aborted ? 'GROQ_TIMEOUT' : 'GROQ_REQUEST_FAILED',
      },
      { status: aborted ? 504 : 502 },
    );
  }
}
