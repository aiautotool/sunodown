import {
  alignRoughWordsToLyrics,
  normalizeKaraokeTimeline,
  type KaraokeLine,
  type RoughWord,
} from './karaoke.ts';

type BackendWord = {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
};

type BackendResponse = {
  lines?: Array<{
    text?: string;
    start?: number;
    end?: number;
    words?: BackendWord[];
  }>;
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

export type KaraokeChunkPlan = {
  start: number;
  duration: number;
};

type ChunkCandidate = RoughWord & {
  edge: number;
  chunkStart: number;
};

const SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 24;
const STAGGER_STEP_SECONDS = 20;
const BASE_STEP_SECONDS = 24;
const MAX_PARALLEL_CHUNKS = 3;

export const BACKEND_VOCAL_LEAD_SECONDS = 0.48;

export function compensateBackendVocalLatency(
  timeline: KaraokeLine[],
  duration: number,
): KaraokeLine[] {
  return timeline.map((line) => ({
    ...line,
    start: Math.max(0, line.start - BACKEND_VOCAL_LEAD_SECONDS),
    end: Math.min(duration, Math.max(0.02, line.end - BACKEND_VOCAL_LEAD_SECONDS)),
    words: line.words.map((word) => ({
      ...word,
      start: Math.max(0, word.start - BACKEND_VOCAL_LEAD_SECONDS),
      end: Math.min(duration, Math.max(0.01, word.end - BACKEND_VOCAL_LEAD_SECONDS)),
    })),
  }));
}

function normalizeWordKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');
}

export function buildKaraokeChunkPlan(
  duration: number,
  chunkSeconds = CHUNK_SECONDS,
): KaraokeChunkPlan[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const starts = new Map<number, KaraokeChunkPlan>();

  const addGrid = (step: number) => {
    for (let start = 0; start < duration - 0.01; start += step) {
      const rounded = Math.round(start * 1000) / 1000;
      const chunkDuration = Math.min(chunkSeconds, duration - rounded);
      if (chunkDuration <= 0.05) continue;
      starts.set(rounded, {
        start: rounded,
        duration: chunkDuration,
      });
      if (rounded + chunkDuration >= duration - 0.01) break;
    }
  };

  // Bench-tested on a real Suno song:
  // - 24s base grid maximized lyric coverage;
  // - 24s chunks staggered every 20s reduced edge-timestamp bias.
  // The client sends both grids and keeps the more reliable word timestamp.
  addGrid(BASE_STEP_SECONDS);
  addGrid(STAGGER_STEP_SECONDS);

  return [...starts.values()].sort((a, b) => a.start - b.start);
}

export function mergeKaraokeChunkWords(
  streams: ChunkCandidate[][],
): RoughWord[] {
  const candidates = streams
    .flat()
    .filter(
      (word) =>
        word.text.trim() &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end >= word.start,
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: ChunkCandidate[] = [];
  for (const word of candidates) {
    const key = normalizeWordKey(word.text);
    if (!key) continue;

    let duplicate = -1;
    for (let index = Math.max(0, merged.length - 16); index < merged.length; index++) {
      const previous = merged[index];
      if (
        normalizeWordKey(previous.text) === key &&
        Math.abs(previous.start - word.start) <= 0.75
      ) {
        duplicate = index;
        break;
      }
    }

    if (duplicate < 0) {
      merged.push({ ...word });
      continue;
    }

    const previous = merged[duplicate];
    if (word.edge > previous.edge + 0.15) {
      merged[duplicate] = { ...word };
      continue;
    }

    if (Math.abs(word.edge - previous.edge) <= 0.15) {
      previous.start = (previous.start + word.start) / 2;
      previous.end = (previous.end + word.end) / 2;
      previous.edge = Math.max(previous.edge, word.edge);
    }
  }

  return merged
    .sort((a, b) => a.start - b.start)
    .map(({ text, start, end }) => ({ text, start, end }));
}

async function decodeAndResample(audio: Blob) {
  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as typeof window & {
      webkitOfflineAudioContext?: typeof OfflineAudioContext;
    }).webkitOfflineAudioContext;

  if (!AudioCtx || !OfflineCtx) {
    throw new Error('Thiết bị không hỗ trợ xử lý audio cần thiết.');
  }

  const context = new AudioCtx();
  try {
    const decoded = await context.decodeAudioData(
      (await audio.arrayBuffer()).slice(0),
    );
    const length = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
    const offline = new OfflineCtx(1, length, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } finally {
    await context.close().catch(() => {});
  }
}

function encodeMonoPcm16Wav(samples: Float32Array, sampleRate = SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index++) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      offset,
      value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff),
      true,
    );
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

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

const CHUNK_RETRY_DELAYS_MS = [0, 700, 1800];
const RETRYABLE_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function transcribeChunk(
  pcm16k: Float32Array,
  plan: KaraokeChunkPlan,
  index: number,
  language: string,
): Promise<ChunkCandidate[]> {
  const startSample = Math.max(0, Math.floor(plan.start * SAMPLE_RATE));
  const endSample = Math.min(
    pcm16k.length,
    Math.ceil((plan.start + plan.duration) * SAMPLE_RATE),
  );
  const slice = pcm16k.subarray(startSample, endSample);
  if (!slice.length) return [];

  const wav = encodeMonoPcm16Wav(slice);
  const actualDuration = slice.length / SAMPLE_RATE;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < CHUNK_RETRY_DELAYS_MS.length; attempt++) {
    if (CHUNK_RETRY_DELAYS_MS[attempt] > 0) {
      await sleep(CHUNK_RETRY_DELAYS_MS[attempt]);
    }

    const form = new FormData();
    form.set(
      'audio',
      new File([wav], `karaoke-${index}.wav`, { type: 'audio/wav' }),
    );
    form.set('duration', String(actualDuration));
    form.set('language', language);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 75_000);
      let response: Response;
      try {
        response = await fetch('/api/karaoke/align', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }

      const data = (await response.json().catch(() => ({}))) as BackendResponse;

      // A silent/instrumental chunk is a valid result, not a job failure.
      // The staggered neighboring chunk can still carry the surrounding vocal.
      if (response.status === 422) return [];

      if (!response.ok) {
        const error = new Error(
          data.error || data.detail || 'Không xử lý được đoạn audio.',
        );
        lastError = error;
        if (RETRYABLE_HTTP.has(response.status) && attempt < CHUNK_RETRY_DELAYS_MS.length - 1) {
          continue;
        }
        throw error;
      }

      return (data.words || [])
        .map(cleanWord)
        .filter((word): word is RoughWord => Boolean(word))
        .map((word) => ({
          ...word,
          start: word.start + plan.start,
          end: word.end + plan.start,
          edge: Math.max(
            0,
            Math.min(word.start, Math.max(0, actualDuration - word.end)),
          ),
          chunkStart: plan.start,
        }));
    } catch (error) {
      lastError = error;
      if (attempt < CHUNK_RETRY_DELAYS_MS.length - 1) continue;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Không xử lý được đoạn audio.');
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        output[index] = await task(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return output;
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
      end: current.at(-1)!.end,
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

export async function buildBackendKaraokeTimeline({
  audio,
  lyrics,
  duration,
  language = 'vi',
  onStage,
}: BackendSyncOptions): Promise<KaraokeLine[]> {
  if (typeof window === 'undefined') {
    throw new Error('Backend subtitle sync cần chạy từ trình duyệt.');
  }

  onStage?.('Đang chuẩn bị dữ liệu phụ đề…');
  const pcm16k = await decodeAndResample(audio);
  const actualDuration = pcm16k.length / SAMPLE_RATE;
  const safeDuration =
    Number.isFinite(duration) && duration > 0 ? duration : actualDuration;
  const plan = buildKaraokeChunkPlan(actualDuration);
  if (!plan.length) throw new Error('Audio không có dữ liệu để đồng bộ.');

  onStage?.('Đang đồng bộ phụ đề…');
  let failedChunks = 0;
  const streams = await mapWithConcurrency(
    plan,
    MAX_PARALLEL_CHUNKS,
    async (chunk, index) => {
      try {
        return await transcribeChunk(pcm16k, chunk, index, language);
      } catch (error) {
        failedChunks++;
        console.warn('[karaoke-chunk-retry-exhausted]', {
          index,
          start: chunk.start,
          reason: error instanceof Error ? error.message : 'unknown',
        });
        return [] as ChunkCandidate[];
      }
    },
  );

  const roughWords = mergeKaraokeChunkWords(streams);
  const failureRatio = failedChunks / Math.max(1, plan.length);
  if (!roughWords.length || failureRatio > 0.4) {
    throw new Error('Dịch vụ subtitle tạm thời chưa ổn định.');
  }

  if (lyrics?.trim()) {
    const aligned = alignRoughWordsToLyrics(
      lyrics,
      roughWords,
      safeDuration,
      { strictAnchors: true },
    );
    if (!aligned.length) {
      throw new Error('Không tìm được mốc lời đủ tin cậy.');
    }
    onStage?.('Subtitle đã sẵn sàng.');
    return aligned;
  }

  const timeline = wordsToLines(roughWords, safeDuration);
  if (!timeline.length) throw new Error('Không tạo được subtitle có timestamp.');
  onStage?.('Subtitle đã sẵn sàng.');
  return timeline;
}
