import { alignRoughWordsToLyrics, type KaraokeLine, type RoughWord } from './karaoke';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';

export type KaraokeSyncStage =
  | 'decode'
  | 'model'
  | 'transcribe'
  | 'align'
  | 'done';

type SyncOptions = {
  audio: Blob;
  lyrics: string;
  duration: number;
  language?: string;
  onStage?: (stage: KaraokeSyncStage, message: string) => void;
};

type TranscriptionOptions = Omit<SyncOptions, 'lyrics'>;

type WorkerChunk = {
  text: string;
  timestamp: [number | null, number | null];
};

type WorkerMessage =
  | { type: 'progress'; stage?: string; progress?: unknown }
  | { type: 'status'; message?: string }
  | { type: 'result'; text?: string; chunks?: WorkerChunk[] }
  | { type: 'error'; message?: string };

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

function transcribe(
  pcm16k: Float32Array,
  language: string,
  onStage?: SyncOptions['onStage'],
) {
  return new Promise<RoughWord[]>((resolve, reject) => {
    // vinext currently emits browser worker assets as file:///_next/... URLs.
    // Passing only the generated pathname preserves Vite's worker compilation
    // while letting the browser resolve the asset against the active HTTP origin.
    const worker = new Worker(
      new URL('../workers/karaoke-whisper.worker.ts', import.meta.url).pathname,
      { type: 'module' },
    );

    const cleanup = () => worker.terminate();
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'Không khởi động được Whisper local.'));
    };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'status') {
        onStage?.('transcribe', message.message || 'Đang nhận diện giọng hát…');
        return;
      }
      if (message.type === 'progress') {
        onStage?.('model', 'Đang tải/khởi tạo mô hình nhận diện…');
        return;
      }
      if (message.type === 'error') {
        cleanup();
        reject(new Error(message.message || 'Whisper local bị lỗi.'));
        return;
      }
      if (message.type !== 'result') return;

      const words = (message.chunks || [])
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
      cleanup();
      resolve(words);
    };

    const transferable = pcm16k.buffer.slice(
      pcm16k.byteOffset,
      pcm16k.byteOffset + pcm16k.byteLength,
    );
    worker.postMessage(
      { type: 'transcribe', audio: transferable, language },
      [transferable],
    );
  });
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
    const characterCount = current.reduce((total, item) => total + item.text.length + 1, 0);
    if (current.length && (pause > 0.85 || current.length >= 10 || characterCount + word.text.length > 58)) {
      flush();
    }
    current.push(word);
    if (/[.!?…]$/.test(word.text) && current.length >= 3) flush();
  }
  flush();
  return lines;
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
  const timeline = alignRoughWordsToLyrics(cleaned, roughWords, duration);
  if (!timeline.length) throw new Error('Không căn được lời bài hát với audio.');

  onStage?.('done', 'Subtitle đã được căn theo giọng hát.');
  return timeline;
}
