import { NextRequest, NextResponse } from 'next/server';
import {
  alignRoughWordsToLyrics,
  normalizeKaraokeTimeline,
  type KaraokeLine,
  type RoughWord,
} from '@/app/lib/karaoke';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';

export const runtime = 'edge';

type WorkersAiEnv = {
  AI?: {
    run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
  };
  KARAOKE_ALIGN_URL?: string;
  KARAOKE_ALIGN_TOKEN?: string;
};

type AiWord = {
  word?: string;
  text?: string;
  start?: number;
  end?: number;
};

type AiSegment = {
  text?: string;
  start?: number;
  end?: number;
  words?: AiWord[];
};

type AiWhisperResult = {
  text?: string;
  words?: AiWord[];
  segments?: AiSegment[];
  vtt?: string;
  transcription_info?: {
    text?: string;
    word_count?: number;
  };
};

async function getEnv(): Promise<WorkersAiEnv> {
  const mod = await import('cloudflare:workers');
  return (mod as any).env as WorkersAiEnv;
}

function normalizeAiWord(value: AiWord): RoughWord | null {
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

function distributeSegmentWords(segment: AiSegment): RoughWord[] {
  const text = String(segment.text ?? '').trim();
  const start = Number(segment.start);
  const end = Number(segment.end);
  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const weights = tokens.map((token) =>
    Math.max(1, token.replace(/[^\p{L}\p{N}]/gu, '').length),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const span = end - start;
  let cursor = start;

  return tokens.map((token, index) => {
    const tokenStart = cursor;
    const tokenEnd =
      index === tokens.length - 1
        ? end
        : Math.min(end, tokenStart + span * (weights[index] / total));
    cursor = tokenEnd;
    return {
      text: token,
      start: tokenStart,
      end: Math.max(tokenStart + 0.01, tokenEnd),
    };
  });
}

function extractWords(result: AiWhisperResult): RoughWord[] {
  const direct = (result.words || [])
    .map(normalizeAiWord)
    .filter((word): word is RoughWord => Boolean(word));
  if (direct.length) return direct;

  const nested = (result.segments || []).flatMap((segment) =>
    (segment.words || [])
      .map(normalizeAiWord)
      .filter((word): word is RoughWord => Boolean(word)),
  );
  if (nested.length) return nested;

  return (result.segments || []).flatMap(distributeSegmentWords);
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
      (pause > 0.85 ||
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

async function proxyExternal(
  env: WorkersAiEnv,
  audio: File,
  lyrics: string,
  language: string,
) {
  if (!env.KARAOKE_ALIGN_URL) return null;

  const form = new FormData();
  form.set('audio', audio, audio.name || 'song.audio');
  if (lyrics) form.set('lyrics', lyrics);
  form.set('language', language);

  const headers: Record<string, string> = {};
  if (env.KARAOKE_ALIGN_TOKEN) {
    headers.authorization = `Bearer ${env.KARAOKE_ALIGN_TOKEN}`;
  }

  const target = lyrics ? '/align' : '/transcribe';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(
      new URL(target, env.KARAOKE_ALIGN_URL).toString(),
      {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    return new NextResponse(await response.text(), {
      status: 200,
      headers: {
        'content-type':
          response.headers.get('content-type') || 'application/json',
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();
    const audio = incoming.get('audio');
    const lyricsValue = incoming.get('lyrics');
    const languageValue = incoming.get('language');
    const durationValue = incoming.get('duration');

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Thiếu audio.' }, { status: 400 });
    }

    // Base64 expansion plus inference response must stay comfortably below the
    // Worker memory envelope. Suno MP3s are normally far smaller than this.
    if (audio.size > 28 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio quá lớn cho Cloudflare Whisper backend (tối đa 28MB).' },
        { status: 413 },
      );
    }

    const lyrics =
      typeof lyricsValue === 'string'
        ? cleanLyricsForVideo(lyricsValue).trim()
        : '';
    const language =
      typeof languageValue === 'string' && languageValue
        ? languageValue
        : 'vi';
    const requestedDuration = Number(durationValue);

    const env = await getEnv();

    // The production path is Workers AI on short chunks. The dedicated
    // external service remains only as a last-resort compatibility fallback.
    if (!env.AI) {
      const external = await proxyExternal(env, audio, lyrics, language);
      if (external) return external;
      return NextResponse.json(
        { error: 'Dịch vụ subtitle chưa sẵn sàng.' },
        { status: 503 },
      );
    }

    if (
      Number.isFinite(requestedDuration) &&
      requestedDuration > 26.5
    ) {
      return NextResponse.json(
        { error: 'Đoạn audio vượt giới hạn xử lý.' },
        { status: 413 },
      );
    }

    const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64');

    // Bench result for sung Vietnamese:
    // - classic Whisper hallucinated unrelated "subscribe" speech;
    // - Turbo with speech VAD discarded almost the entire song;
    // - Turbo on short, pre-cut chunks with VAD disabled tracked vocals well.
    // The client therefore sends <=24s chunks and owns cross-chunk consensus.
    const result = (await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: base64,
      task: 'transcribe',
      language,
      vad_filter: false,
      beam_size: 5,
      condition_on_previous_text: false,
      no_speech_threshold: 0.55,
      compression_ratio_threshold: 2.2,
      log_prob_threshold: -1,
    })) as AiWhisperResult;

    const roughWords = extractWords(result);
    if (!roughWords.length) {
      return NextResponse.json(
        { error: 'Không nhận diện được timestamp trong đoạn audio.' },
        { status: 422 },
      );
    }

    const detectedDuration = roughWords.at(-1)?.end || 0;
    const duration =
      Number.isFinite(requestedDuration) && requestedDuration > 0
        ? requestedDuration
        : Math.max(0.1, detectedDuration);

    if (lyrics) {
      const lines = alignRoughWordsToLyrics(lyrics, roughWords, duration, { strictAnchors: true });
      if (!lines.length) {
        return NextResponse.json(
          { error: 'Không căn được lời vào đoạn audio.' },
          { status: 422 },
        );
      }
      return NextResponse.json({
        lines,
        words: roughWords,
        meta: {
          engine: 'cloudflare-workers-ai-whisper-turbo-chunk',
          language,
          lyrics_words: lyrics.split(/\s+/).filter(Boolean).length,
          asr_words: roughWords.length,
        },
      });
    }

    return NextResponse.json({
      lines: wordsToLines(roughWords, duration),
      words: roughWords,
      meta: {
        engine: 'cloudflare-workers-ai-whisper-turbo-chunk',
        language,
        asr_words: roughWords.length,
      },
    });
  } catch (error) {
    console.error('[karaoke-workers-ai]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Không xử lý được audio: ${error.message}`
            : 'Không xử lý được audio.',
      },
      { status: 502 },
    );
  }
}
