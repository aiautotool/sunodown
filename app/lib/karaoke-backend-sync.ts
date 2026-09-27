import {
  alignRoughWordsToLyrics,
  normalizeKaraokeTimeline,
  type KaraokeLine,
  type RoughWord,
} from './karaoke';

type BackendWord = {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
  confidence?: number;
};

type BackendLine = {
  text?: string;
  start?: number;
  end?: number;
  words?: BackendWord[];
};

type BackendResponse = {
  lines?: BackendLine[];
  words?: BackendWord[];
  meta?: Record<string, unknown>;
  error?: string;
  detail?: string;
};

type BackendSyncOptions = {
  audio: Blob;
  lyrics?: string;
  duration: number;
  language?: string;
  onStage?: (message: string) => void;
};

function cleanWord(word: BackendWord): RoughWord | null {
  const text = String(word.text ?? word.word ?? '').trim();
  const start = Number(word.start);
  const end = Number(word.end);
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

function responseLines(data: BackendResponse, duration: number) {
  if (!Array.isArray(data.lines)) return [];
  return normalizeKaraokeTimeline(
    data.lines
      .map((line) => {
        const text = String(line.text ?? '').trim();
        const words = (line.words || [])
          .map(cleanWord)
          .filter((word): word is RoughWord => Boolean(word));
        const start = Number(line.start);
        const end = Number(line.end);
        if (!text || !Number.isFinite(start) || !Number.isFinite(end)) {
          return null;
        }
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
}

export async function buildBackendKaraokeTimeline({
  audio,
  lyrics,
  duration,
  language = 'vi',
  onStage,
}: BackendSyncOptions): Promise<KaraokeLine[]> {
  const form = new FormData();
  form.set(
    'audio',
    new File([audio], 'song.mp3', {
      type: audio.type || 'audio/mpeg',
    }),
  );
  if (lyrics?.trim()) form.set('lyrics', lyrics);
  form.set('duration', String(duration));
  form.set('language', language);

  onStage?.(
    lyrics?.trim()
      ? 'Đang gửi audio lên Whisper backend để căn lời…'
      : 'Đang gửi audio lên Whisper backend để nhận diện subtitle…',
  );

  const response = await fetch('/api/karaoke/align', {
    method: 'POST',
    body: form,
  });
  const data = (await response.json().catch(() => ({}))) as BackendResponse;

  if (!response.ok) {
    throw new Error(
      data.error || data.detail || 'Whisper backend không khả dụng.',
    );
  }

  const lines = responseLines(data, duration);
  if (lines.length) {
    onStage?.(`Whisper backend trả về ${lines.length} cue có timestamp.`);
    return lines;
  }

  const roughWords = (data.words || [])
    .map(cleanWord)
    .filter((word): word is RoughWord => Boolean(word));

  if (lyrics?.trim() && roughWords.length) {
    const aligned = alignRoughWordsToLyrics(lyrics, roughWords, duration, { strictAnchors: true });
    if (aligned.length) {
      onStage?.(
        `Whisper backend trả về ${roughWords.length} word timestamp · đang căn vào lyrics.`,
      );
      return aligned;
    }
  }

  throw new Error('Whisper backend không trả về timeline hợp lệ.');
}
