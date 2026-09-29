import {
  alignRoughWordsToLyrics,
  normalizeKaraokeTimeline,
  type KaraokeLine,
  type RoughWord,
} from './karaoke';
import { cleanLyricsForVideo } from '../../components/v4/lyrics-clean.ts';

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

export type GroqSubtitleResult = {
  lines: KaraokeLine[];
  words: RoughWord[];
  text: string;
  meta: {
    engine: 'groq-whisper-large-v3-turbo';
    language: string;
    duration: number;
    audioBytes: number;
    uploadFilename: string;
    uploadMime: string;
    wordCount: number;
    lineCount: number;
    anchoredLineCount: number;
    interpolatedLineCount: number;
    lyricsAlignment: boolean;
  };
};

export class GroqSubtitleError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'GroqSubtitleError';
    this.status = status;
    this.code = code;
  }
}

const GROQ_EXTENSIONS = new Set([
  'flac',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'm4a',
  'ogg',
  'opus',
  'wav',
  'webm',
]);

export function extensionFromMime(type: string) {
  const mime = type.toLowerCase().split(';')[0].trim();
  if (mime === 'audio/flac' || mime === 'audio/x-flac') return 'flac';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3';
  if (mime === 'audio/mp4' || mime === 'video/mp4') return 'mp4';
  if (mime === 'audio/x-m4a' || mime === 'audio/m4a') return 'm4a';
  if (mime === 'audio/ogg' || mime === 'application/ogg') return 'ogg';
  if (mime === 'audio/opus') return 'opus';
  if (
    mime === 'audio/wav' ||
    mime === 'audio/x-wav' ||
    mime === 'audio/wave'
  ) {
    return 'wav';
  }
  if (mime === 'audio/webm' || mime === 'video/webm') return 'webm';
  return '';
}

export function groqUploadName(file: Blob & { name?: string }) {
  const nameExt =
    typeof file.name === 'string'
      ? file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
      : '';
  const extension =
    (GROQ_EXTENSIONS.has(nameExt) ? nameExt : '') ||
    extensionFromMime(file.type) ||
    'mp3';
  return `audio.${extension}`;
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

export function alignGroqWordsToLyrics(
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

export async function generateGroqSubtitle(input: {
  apiKey: string;
  audio: Blob;
  filename?: string;
  lyrics?: string | null;
  duration?: number | null;
  language?: string | null;
}): Promise<GroqSubtitleResult> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new GroqSubtitleError(
      'Groq subtitle chưa được cấu hình trên server.',
      503,
      'GROQ_NOT_CONFIGURED',
    );
  }
  if (!input.audio.size) {
    throw new GroqSubtitleError('Thiếu audio.', 400, 'GROQ_AUDIO_MISSING');
  }
  if (input.audio.size > 24 * 1024 * 1024) {
    throw new GroqSubtitleError(
      'Audio vượt giới hạn Groq 24 MB.',
      413,
      'GROQ_FILE_TOO_LARGE',
    );
  }

  const lyrics = input.lyrics
    ? cleanLyricsForVideo(input.lyrics).trim()
    : '';
  const language = input.language?.trim() || 'vi';
  const requestedDuration = Number(input.duration);
  const fileLike = Object.assign(input.audio, {
    name: input.filename || '',
  });
  const uploadName = input.filename || groqUploadName(fileLike);

  const form = new FormData();
  form.set(
    'file',
    new File([input.audio], uploadName, {
      type: input.audio.type || 'audio/mpeg',
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
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GroqSubtitleError(
        'Groq transcription quá thời gian chờ.',
        504,
        'GROQ_TIMEOUT',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const result = (await upstream.json().catch(() => ({}))) as GroqVerboseResponse;
  if (!upstream.ok) {
    const message =
      result.error?.message || `Groq transcription lỗi HTTP ${upstream.status}.`;
    throw new GroqSubtitleError(
      message,
      upstream.status === 429 ? 429 : 502,
      'GROQ_UPSTREAM_ERROR',
    );
  }

  const words = extractWords(result);
  if (!words.length) {
    throw new GroqSubtitleError(
      'Groq không trả về word timestamp.',
      422,
      'GROQ_NO_WORD_TIMESTAMPS',
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
    throw new GroqSubtitleError(
      lyrics
        ? 'Groq nhận diện được lời nhưng chưa căn được lyric.'
        : 'Groq không tạo được cue subtitle.',
      422,
      'GROQ_ALIGNMENT_EMPTY',
    );
  }

  return {
    lines,
    words,
    text: result.text || '',
    meta: {
      engine: 'groq-whisper-large-v3-turbo',
      language: result.language || language,
      duration,
      audioBytes: input.audio.size,
      uploadFilename: uploadName,
      uploadMime: input.audio.type || 'audio/mpeg',
      wordCount: words.length,
      lineCount: lines.length,
      anchoredLineCount: lines.filter(
        (line) => line.timingSource === 'anchored',
      ).length,
      interpolatedLineCount: lines.filter(
        (line) => line.timingSource === 'interpolated',
      ).length,
      lyricsAlignment: Boolean(lyrics),
    },
  };
}
