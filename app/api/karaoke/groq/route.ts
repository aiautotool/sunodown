import { NextRequest, NextResponse } from 'next/server';
import { getGroqCredentials } from '@/app/lib/cloudflare-runtime';
import {
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
    const credentials = await getGroqCredentials();
    if (!credentials.key) {
      return NextResponse.json(
        {
          error: 'Groq subtitle chưa được cấu hình trên server.',
          code: 'GROQ_NOT_CONFIGURED',
          diagnostics: { source: credentials.source },
        },
        { status: 503 },
      );
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

    const audio = incoming.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Thiếu audio.' }, { status: 400 });
    }

    const lyricsValue = incoming.get('lyrics');
    const languageValue = incoming.get('language');
    const durationValue = incoming.get('duration');

    const result = await generateGroqSubtitle({
      apiKey: credentials.key,
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
