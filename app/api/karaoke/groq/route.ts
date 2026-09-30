import { NextRequest, NextResponse } from 'next/server';
import { getGroqCredentials } from '@/app/lib/cloudflare-runtime';
import {
  alignGroqWordsToLyrics,
  generateGroqSubtitle,
  GroqSubtitleError,
} from '@/app/lib/groq-subtitle-server';

export const runtime = 'edge';

export async function GET() {
  const credentials = await getGroqCredentials();
  return NextResponse.json({
    available: Boolean(credentials.key),
    source: credentials.source,
    engine: 'groq-whisper-large-v3-turbo',
    wordTimestamps: true,
    maxMobileUploadBytes: 24 * 1024 * 1024,
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as {
        mode?: string;
        lyrics?: string;
        words?: Array<{ text?: string; start?: number; end?: number }>;
        duration?: number;
      };
      if (body.mode !== 'align') {
        return NextResponse.json(
          { error: 'Unsupported JSON mode.' },
          { status: 400 },
        );
      }
      const words = Array.isArray(body.words)
        ? body.words.flatMap((word) => {
            const text = typeof word.text === 'string' ? word.text.trim() : '';
            const start = Number(word.start);
            const end = Number(word.end);
            return text && Number.isFinite(start) && Number.isFinite(end) && end > start
              ? [{ text, start, end }]
              : [];
          })
        : [];
      const duration = Number(body.duration) || words.at(-1)?.end || 0;
      const lines = body.lyrics?.trim()
        ? alignGroqWordsToLyrics(body.lyrics, words, duration)
        : [];
      return NextResponse.json({ lines, words });
    }

    let incoming: FormData;
    try {
      incoming = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error: 'Multipart form-data không hợp lệ.',
          code: 'INVALID_MULTIPART',
        },
        { status: 400 },
      );
    }

    const internalKey = incoming.get('__server_groq_key');
    const fallbackCredentials = await getGroqCredentials();
    const apiKey =
      (typeof internalKey === 'string' ? internalKey.trim() : '') ||
      fallbackCredentials.key;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Groq subtitle chưa được cấu hình trên server.',
          code: 'GROQ_NOT_CONFIGURED',
          diagnostics: { source: fallbackCredentials.source },
        },
        { status: 503 },
      );
    }

    const audio = incoming.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Thiếu audio.' }, { status: 400 });
    }

    const lyricsValue = incoming.get('lyrics');
    const languageValue = incoming.get('language');
    const durationValue = incoming.get('duration');

    const result = await generateGroqSubtitle({
      apiKey,
      audio,
      filename: audio.name || undefined,
      lyrics: typeof lyricsValue === 'string' ? lyricsValue : '',
      duration:
        typeof durationValue === 'string' ? Number(durationValue) : undefined,
      language:
        typeof languageValue === 'string' && languageValue.trim()
          ? languageValue.trim()
          : 'vi',
    });

    return NextResponse.json({
      lines: result.lines,
      words: result.words,
      text: result.text,
      meta: {
        engine: result.meta.engine,
        language: result.meta.language,
        duration: result.meta.duration,
        audio_bytes: result.meta.audioBytes,
        upload_filename: result.meta.uploadFilename,
        upload_mime: result.meta.uploadMime,
        word_count: result.meta.wordCount,
        line_count: result.meta.lineCount,
        anchored_line_count: result.meta.anchoredLineCount,
        interpolated_line_count: result.meta.interpolatedLineCount,
        lyrics_alignment: result.meta.lyricsAlignment,
      },
    });
  } catch (error) {
    if (error instanceof GroqSubtitleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error('[groq-karaoke]', error);
    return NextResponse.json(
      {
        error: 'Không xử lý được subtitle bằng Groq.',
        code: 'GROQ_REQUEST_FAILED',
      },
      { status: 502 },
    );
  }
}
