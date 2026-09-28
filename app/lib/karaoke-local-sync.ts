import { alignRoughWordsToLyrics, type KaraokeLine, type RoughWord } from './karaoke';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';

export type KaraokeSyncStage =
  | 'decode'
  | 'model'
  | 'transcribe'
  | 'align'
  | 'done';

type DebugData = Record<string, string | number | boolean | null>;

type SyncOptions = {
  audio: Blob;
  lyrics: string;
  duration: number;
  language?: string;
  onStage?: (stage: KaraokeSyncStage, message: string) => void;
  onPartialTimeline?: (timeline: KaraokeLine[]) => void;
  onDebug?: (message: string, data?: DebugData) => void;
};

type TranscriptionOptions = Omit<SyncOptions, 'lyrics'>;

type WorkerChunk = {
  text: string;
  timestamp: [number | null, number | null];
};

type WorkerMessage =
  | { type: 'progress'; id?: number; stage?: string; progress?: unknown }
  | { type: 'status'; id?: number; message?: string }
  | { type: 'result'; id?: number; text?: string; chunks?: WorkerChunk[] }
  | { type: 'error'; id?: number; message?: string };

const MOBILE_LOCAL_CHUNK_SECONDS = 18;
const MOBILE_LOCAL_STEP_SECONDS = 15;
let workerRequestId = 0;

async function decodeAndResample(audio: Blob) {
  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) throw new Error('Thiết bị không hỗ trợ Web Audio.');

  const context = new AudioCtx();
  try {
    const decoded = await context.decodeAudioData((await audio.arrayBuffer()).slice(0));
    const sampleRate = 16_000;
    const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const OfflineCtx =
      window.OfflineAudioContext ||
      (window as typeof window & {
        webkitOfflineAudioContext?: typeof OfflineAudioContext;
      }).webkitOfflineAudioContext;
    if (!OfflineCtx) throw new Error('Thiết bị không hỗ trợ resample audio.');

    const offline = new OfflineCtx(1, length, sampleRate);
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

async function decodeForMobile(audio: Blob) {
  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) throw new Error('Thiết bị không hỗ trợ Web Audio.');

  const context = new AudioCtx();
  try {
    return await context.decodeAudioData((await audio.arrayBuffer()).slice(0));
  } finally {
    await context.close().catch(() => {});
  }
}

function resampleMobileSegment(
  decoded: AudioBuffer,
  start: number,
  duration: number,
  targetRate = 16_000,
) {
  const sourceRate = decoded.sampleRate;
  const sourceStart = Math.max(0, Math.floor(start * sourceRate));
  const sourceEnd = Math.min(
    decoded.length,
    Math.ceil((start + duration) * sourceRate),
  );
  const sourceLength = Math.max(0, sourceEnd - sourceStart);
  if (!sourceLength) return new Float32Array();

  const outputLength = Math.max(
    1,
    Math.ceil((sourceLength / sourceRate) * targetRate),
  );
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;
  const channels = Array.from(
    { length: decoded.numberOfChannels },
    (_, channel) => decoded.getChannelData(channel),
  );

  for (let index = 0; index < outputLength; index++) {
    const sourcePosition = Math.min(sourceLength - 1, index * ratio);
    const leftRelative = Math.floor(sourcePosition);
    const rightRelative = Math.min(sourceLength - 1, leftRelative + 1);
    const mix = sourcePosition - leftRelative;
    const left = sourceStart + leftRelative;
    const right = sourceStart + rightRelative;
    let sample = 0;
    for (const channel of channels) {
      sample += channel[left] + (channel[right] - channel[left]) * mix;
    }
    output[index] = sample / Math.max(1, channels.length);
  }

  return output;
}

function createWhisperWorker() {
  return new Worker(
    new URL('../workers/karaoke-whisper.worker.ts', import.meta.url).pathname,
    { type: 'module' },
  );
}

function chunksToWords(chunks: WorkerChunk[]) {
  return chunks
    .map((chunk) => {
      const start = chunk.timestamp?.[0];
      const end = chunk.timestamp?.[1];
      if (
        typeof start !== 'number' ||
        typeof end !== 'number' ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end < start ||
        !chunk.text?.trim()
      ) return null;
      return {
        text: chunk.text.trim(),
        start,
        end: Math.max(start + 0.01, end),
      } satisfies RoughWord;
    })
    .filter((word): word is RoughWord => Boolean(word));
}

function transcribeWithWorker(
  worker: Worker,
  pcm16k: Float32Array,
  language: string,
  mode: 'desktop' | 'mobile',
  onStage?: SyncOptions['onStage'],
  onDebug?: SyncOptions['onDebug'],
) {
  const id = ++workerRequestId;

  return new Promise<RoughWord[]>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Whisper local quá thời gian cho phép.'));
    }, mode === 'mobile' ? 180_000 : 120_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'Không khởi động được Whisper local.'));
    };

    const onMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (
        typeof message.id === 'number' &&
        message.id !== id
      ) return;

      if (message.type === 'status') {
        onStage?.('transcribe', message.message || 'Đang nhận diện giọng hát…');
        onDebug?.('local-whisper-status', {
          mode,
          message: message.message || 'transcribing',
        });
        return;
      }

      if (message.type === 'progress') {
        onStage?.('model', mode === 'mobile'
          ? 'Đang tải Whisper Tiny trên thiết bị…'
          : 'Đang tải/khởi tạo mô hình nhận diện…');
        return;
      }

      if (message.type === 'error') {
        cleanup();
        reject(new Error(message.message || 'Whisper local bị lỗi.'));
        return;
      }

      if (message.type !== 'result') return;
      const words = chunksToWords(message.chunks || []);
      cleanup();
      resolve(words);
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    const transferable = pcm16k.buffer.slice(
      pcm16k.byteOffset,
      pcm16k.byteOffset + pcm16k.byteLength,
    );

    worker.postMessage(
      {
        type: 'transcribe',
        id,
        audio: transferable,
        language,
        mode,
      },
      [transferable],
    );
  });
}

function transcribe(
  pcm16k: Float32Array,
  language: string,
  onStage?: SyncOptions['onStage'],
) {
  const worker = createWhisperWorker();
  return transcribeWithWorker(
    worker,
    pcm16k,
    language,
    'desktop',
    onStage,
  ).finally(() => worker.terminate());
}

function normalizeWordKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');
}

function mergeMobileWords(existing: RoughWord[], incoming: RoughWord[]) {
  const merged = [...existing];

  for (const word of incoming) {
    const key = normalizeWordKey(word.text);
    if (!key) continue;

    const duplicate = merged.findIndex(
      (candidate) =>
        normalizeWordKey(candidate.text) === key &&
        Math.abs(candidate.start - word.start) <= 0.7,
    );

    if (duplicate >= 0) {
      const previous = merged[duplicate];
      merged[duplicate] = {
        text: previous.text,
        start: (previous.start + word.start) / 2,
        end: (previous.end + word.end) / 2,
      };
    } else {
      merged.push(word);
    }
  }

  return merged.sort((a, b) => a.start - b.start || a.end - b.end);
}

function roughWordsToLines(words: RoughWord[]): KaraokeLine[] {
  const lines: KaraokeLine[] = [];
  let current: RoughWord[] = [];

  const flush = () => {
    if (!current.length) return;
    lines.push({
      text: current.map((word) => word.text).join(' ').replace(/\s+([,.;!?])/g, '$1'),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current.map((word) => ({ ...word })),
    });
    current = [];
  };

  for (const word of words) {
    const previous = current[current.length - 1];
    const pause = previous ? word.start - previous.end : 0;
    const characterCount = current.reduce(
      (total, item) => total + item.text.length + 1,
      0,
    );
    if (
      current.length &&
      (pause > 0.85 ||
        current.length >= 10 ||
        characterCount + word.text.length > 58)
    ) {
      flush();
    }
    current.push(word);
    if (/[.!?…]$/.test(word.text) && current.length >= 3) flush();
  }
  flush();
  return lines;
}

export async function buildMobileLocalKaraokeTimeline({
  audio,
  lyrics,
  duration,
  language = 'vi',
  onStage,
  onPartialTimeline,
  onDebug,
}: SyncOptions): Promise<KaraokeLine[]> {
  const cleaned = cleanLyricsForVideo(lyrics);
  if (!cleaned.trim()) return [];

  onStage?.('decode', 'Mobile · đang giải mã audio để chạy Whisper Tiny…');
  onDebug?.('mobile-local-start', {
    audioBytes: audio.size,
    duration: Math.round(duration * 100) / 100,
    chunkSeconds: MOBILE_LOCAL_CHUNK_SECONDS,
    stepSeconds: MOBILE_LOCAL_STEP_SECONDS,
  });

  const decoded = await decodeForMobile(audio);
  const actualDuration = decoded.duration;
  const plan: Array<{ start: number; duration: number }> = [];

  for (
    let start = 0;
    start < actualDuration - 0.05;
    start += MOBILE_LOCAL_STEP_SECONDS
  ) {
    const chunkDuration = Math.min(
      MOBILE_LOCAL_CHUNK_SECONDS,
      actualDuration - start,
    );
    if (chunkDuration <= 0.2) break;
    plan.push({ start, duration: chunkDuration });
    if (start + chunkDuration >= actualDuration - 0.05) break;
  }

  if (!plan.length) throw new Error('Audio không có dữ liệu để nhận diện.');

  const worker = createWhisperWorker();
  let mergedWords: RoughWord[] = [];
  let failedChunks = 0;

  try {
    for (let index = 0; index < plan.length; index++) {
      const chunk = plan[index];
      onStage?.(
        'transcribe',
        `Whisper Tiny mobile · đoạn ${index + 1}/${plan.length}…`,
      );
      onDebug?.('mobile-local-chunk-start', {
        chunk: index + 1,
        totalChunks: plan.length,
        start: Math.round(chunk.start * 100) / 100,
        duration: Math.round(chunk.duration * 100) / 100,
      });

      try {
        const pcm = resampleMobileSegment(
          decoded,
          chunk.start,
          chunk.duration,
        );
        const relativeWords = await transcribeWithWorker(
          worker,
          pcm,
          language,
          'mobile',
          onStage,
          onDebug,
        );
        const absoluteWords = relativeWords.map((word) => ({
          ...word,
          start: word.start + chunk.start,
          end: word.end + chunk.start,
        }));

        mergedWords = mergeMobileWords(mergedWords, absoluteWords);

        const partial = alignRoughWordsToLyrics(
          cleaned,
          mergedWords,
          duration,
          { strictAnchors: true },
        );

        onDebug?.('mobile-local-chunk-ok', {
          chunk: index + 1,
          totalChunks: plan.length,
          words: relativeWords.length,
          mergedWords: mergedWords.length,
          partialLines: partial.length,
        });

        if (partial.length) onPartialTimeline?.(partial);
      } catch (error) {
        failedChunks++;
        onDebug?.('mobile-local-chunk-fail', {
          chunk: index + 1,
          totalChunks: plan.length,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
  } finally {
    worker.terminate();
  }

  if (!mergedWords.length) {
    throw new Error('Whisper Tiny mobile không nhận diện được từ có timestamp.');
  }

  onStage?.('align', 'Đang căn timestamp Whisper Tiny vào lyrics gốc…');
  const timeline = alignRoughWordsToLyrics(
    cleaned,
    mergedWords,
    duration,
    { strictAnchors: true },
  );

  onDebug?.('mobile-local-result', {
    totalChunks: plan.length,
    failedChunks,
    mergedWords: mergedWords.length,
    lines: timeline.length,
  });

  if (!timeline.length) {
    throw new Error('Whisper Tiny mobile có nhận diện nhưng chưa căn được lyrics.');
  }

  onStage?.('done', 'Subtitle đã được tạo bằng Whisper trên mobile.');
  return timeline;
}

export async function transcribeMobileLocalKaraokeTimeline({
  audio,
  duration,
  language = 'vi',
  onStage,
  onPartialTimeline,
  onDebug,
}: TranscriptionOptions): Promise<KaraokeLine[]> {
  onStage?.('decode', 'Mobile · đang giải mã audio cho Whisper Tiny…');
  const decoded = await decodeForMobile(audio);
  const actualDuration = decoded.duration;
  const plan: Array<{ start: number; duration: number }> = [];

  for (
    let start = 0;
    start < actualDuration - 0.05;
    start += MOBILE_LOCAL_STEP_SECONDS
  ) {
    const chunkDuration = Math.min(
      MOBILE_LOCAL_CHUNK_SECONDS,
      actualDuration - start,
    );
    if (chunkDuration <= 0.2) break;
    plan.push({ start, duration: chunkDuration });
    if (start + chunkDuration >= actualDuration - 0.05) break;
  }

  const worker = createWhisperWorker();
  let mergedWords: RoughWord[] = [];

  try {
    for (let index = 0; index < plan.length; index++) {
      const chunk = plan[index];
      onStage?.(
        'transcribe',
        `Whisper Tiny mobile · đoạn ${index + 1}/${plan.length}…`,
      );
      try {
        const pcm = resampleMobileSegment(
          decoded,
          chunk.start,
          chunk.duration,
        );
        const relativeWords = await transcribeWithWorker(
          worker,
          pcm,
          language,
          'mobile',
          onStage,
          onDebug,
        );
        mergedWords = mergeMobileWords(
          mergedWords,
          relativeWords.map((word) => ({
            ...word,
            start: word.start + chunk.start,
            end: word.end + chunk.start,
          })),
        );
        const partial = roughWordsToLines(mergedWords).map((line) => ({
          ...line,
          start: Math.max(0, Math.min(duration, line.start)),
          end: Math.max(line.start + 0.01, Math.min(duration, line.end)),
        }));
        if (partial.length) onPartialTimeline?.(partial);
      } catch (error) {
        onDebug?.('mobile-local-transcribe-chunk-fail', {
          chunk: index + 1,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
  } finally {
    worker.terminate();
  }

  if (!mergedWords.length) {
    throw new Error('Whisper Tiny mobile không nhận diện được lời trong audio.');
  }

  const timeline = roughWordsToLines(mergedWords).map((line) => ({
    ...line,
    start: Math.max(0, Math.min(duration, line.start)),
    end: Math.max(line.start + 0.01, Math.min(duration, line.end)),
  }));

  onStage?.('done', 'Đã tạo subtitle bằng Whisper Tiny trên mobile.');
  return timeline;
}

export async function transcribeLocalKaraokeTimeline({
  audio,
  duration,
  language = 'vi',
  onStage,
}: TranscriptionOptions): Promise<KaraokeLine[]> {
  onStage?.('decode', 'Đang chuẩn hóa audio 16 kHz…');
  const pcm16k = await decodeAndResample(audio);
  onStage?.('transcribe', 'Đang tự động tạo subtitle trên thiết bị…');
  const roughWords = await transcribe(pcm16k, language, onStage);
  if (!roughWords.length) throw new Error('Không nhận diện được lời trong audio.');

  const timeline = roughWordsToLines(roughWords).map((line) => ({
    ...line,
    start: Math.max(0, Math.min(duration, line.start)),
    end: Math.max(line.start + 0.01, Math.min(duration, line.end)),
  }));
  onStage?.('done', 'Đã tự động tạo subtitle từ audio.');
  return timeline;
}

export async function buildLocalKaraokeTimeline({
  audio,
  lyrics,
  duration,
  language = 'vi',
  onStage,
}: SyncOptions): Promise<KaraokeLine[]> {
  const cleaned = cleanLyricsForVideo(lyrics);
  if (!cleaned.trim()) return [];

  onStage?.('decode', 'Đang chuẩn hóa audio 16 kHz…');
  const pcm16k = await decodeAndResample(audio);

  onStage?.('transcribe', 'Đang nhận diện giọng hát trên thiết bị…');
  const roughWords = await transcribe(pcm16k, language, onStage);
  if (!roughWords.length) throw new Error('Không nhận diện được từ có timestamp.');

  onStage?.('align', 'Đang căn timestamp vào lyrics gốc…');
  const timeline = alignRoughWordsToLyrics(
    cleaned,
    roughWords,
    duration,
    { strictAnchors: true },
  );
  if (!timeline.length) throw new Error('Không căn được lời bài hát với audio.');

  onStage?.('done', 'Subtitle đã được căn theo giọng hát.');
  return timeline;
}
