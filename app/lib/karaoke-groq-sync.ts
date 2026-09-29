import {
  normalizeKaraokeTimeline,
  type KaraokeLine,
} from './karaoke';

type GroqWord = {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
};

type GroqLine = {
  text?: string;
  start?: number;
  end?: number;
  words?: GroqWord[];
};

type GroqResponse = {
  lines?: GroqLine[];
  words?: GroqWord[];
  meta?: Record<string, unknown>;
  error?: string;
  detail?: string;
  code?: string;
};

export type GroqKaraokeOptions = {
  audio: Blob;
  lyrics?: string;
  duration: number;
  language?: string;
  onStage?: (message: string) => void;
  onDebug?: (
    message: string,
    data?: Record<string, string | number | boolean | null>,
  ) => void;
};

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
  return 'mp3';
}

export async function buildGroqKaraokeTimeline({
  audio,
  lyrics,
  duration,
  language = 'vi',
  onStage,
  onDebug,
}: GroqKaraokeOptions): Promise<KaraokeLine[]> {
  if (typeof window === 'undefined') {
    throw new Error('Groq subtitle sync cần chạy từ trình duyệt.');
  }

  if (!audio.size) throw new Error('Audio không có dữ liệu.');
  if (audio.size > 24 * 1024 * 1024) {
    throw new Error('Audio vượt giới hạn Groq mobile 24 MB.');
  }

  onStage?.('Mobile · đang gửi audio lên Groq Whisper…');
  onDebug?.('groq-start', {
    audioBytes: audio.size,
    duration: Math.round(duration * 100) / 100,
    hasLyrics: Boolean(lyrics?.trim()),
    language,
  });

  const form = new FormData();
  const uploadName = `mobile-audio.${extensionFromMime(audio.type || 'audio/mpeg')}`;
  form.set(
    'audio',
    new File([audio], uploadName, {
      type: audio.type || 'audio/mpeg',
    }),
  );
  onDebug?.('groq-upload', {
    uploadName,
    mime: audio.type || 'audio/mpeg',
    audioBytes: audio.size,
  });
  form.set('duration', String(duration));
  form.set('language', language);
  if (lyrics?.trim()) form.set('lyrics', lyrics);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch('/api/karaoke/groq', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as GroqResponse;
    if (!response.ok) {
      const error = new Error(
        data.error || data.detail || 'Groq Whisper không xử lý được audio.',
      );
      (error as Error & { code?: string }).code = data.code;
      throw error;
    }

    const lines = normalizeKaraokeTimeline(
      (data.lines || [])
        .map((line) => {
          const text = String(line.text ?? '').trim();
          const start = Number(line.start);
          const end = Number(line.end);
          if (!text || !Number.isFinite(start) || !Number.isFinite(end)) {
            return null;
          }
          const words = (line.words || [])
            .map((word) => {
              const wordText = String(word.text ?? word.word ?? '').trim();
              const wordStart = Number(word.start);
              const wordEnd = Number(word.end);
              if (
                !wordText ||
                !Number.isFinite(wordStart) ||
                !Number.isFinite(wordEnd)
              ) {
                return null;
              }
              return {
                text: wordText,
                start: wordStart,
                end: Math.max(wordStart + 0.01, wordEnd),
              };
            })
            .filter(
              (
                word,
              ): word is { text: string; start: number; end: number } =>
                Boolean(word),
            );
          return {
            text,
            start,
            end,
            words,
          } satisfies KaraokeLine;
        })
        .filter((line): line is KaraokeLine => Boolean(line)),
      duration,
    );

    if (!lines.length) {
      throw new Error('Groq Whisper không trả về cue subtitle hợp lệ.');
    }

    onDebug?.('groq-result', {
      lines: lines.length,
      words: Array.isArray(data.words) ? data.words.length : 0,
    });
    onStage?.('Groq subtitle đã sẵn sàng.');
    return lines;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Groq Whisper quá thời gian chờ.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
