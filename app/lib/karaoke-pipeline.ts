import { type KaraokeLine } from './karaoke';
import {
  buildBackendKaraokeTimeline,
  compensateBackendVocalLatency,
} from './karaoke-backend-sync';
import { buildCapCutKaraokeTimeline } from './karaoke-capcut-sync';
import { isMobileKaraokeDevice } from './karaoke-device';
import {
  buildLocalKaraokeTimeline,
  transcribeLocalKaraokeTimeline,
  type KaraokeSyncStage,
} from './karaoke-local-sync';
import {
  extractAudioRhythmOnsets,
  refineKaraokeTimelineToRhythm,
  type RhythmOnset,
} from './karaoke-rhythm';
import {
  karaokeQualitySummary,
  validateKaraokeTimeline,
  type KaraokeValidationReport,
} from './karaoke-validation';

export type KaraokeEngineId =
  | 'backend-whisper'
  | 'backend-whisper-transcription'
  | 'capcut'
  | 'local-whisper'
  | 'local-whisper-transcription';

export type KaraokePipelineStage =
  | 'prepare'
  | 'recognize'
  | 'align'
  | 'validate'
  | 'fallback'
  | 'done';

export type KaraokePipelineProgress = {
  stage: KaraokePipelineStage;
  engine?: KaraokeEngineId;
  message: string;
};

export type KaraokePipelineResult = {
  timeline: KaraokeLine[];
  status: 'synced' | 'fallback';
  engine: KaraokeEngineId;
  quality: KaraokeValidationReport;
  attempts: Array<{
    engine: KaraokeEngineId;
    ok: boolean;
    confidence?: number;
    error?: string;
  }>;
};

type KaraokePipelineOptions = {
  audio: Blob;
  lyrics?: string;
  duration: number;
  language?: string;
  minimumConfidence?: number;
  onProgress?: (progress: KaraokePipelineProgress) => void;
  onPartialTimeline?: (timeline: KaraokeLine[]) => void;
};

type Candidate = {
  engine: KaraokeEngineId;
  timeline: KaraokeLine[];
  quality: KaraokeValidationReport;
};

function stageFromLocal(stage: KaraokeSyncStage): KaraokePipelineStage {
  if (stage === 'align') return 'align';
  if (stage === 'done') return 'validate';
  return 'recognize';
}

function betterCandidate(current: Candidate | null, next: Candidate) {
  if (!current) return next;
  if (next.quality.confidence !== current.quality.confidence) {
    return next.quality.confidence > current.quality.confidence ? next : current;
  }
  return next.timeline.length > current.timeline.length ? next : current;
}

export async function runKaraokePipeline({
  audio,
  lyrics,
  duration,
  language = 'vi',
  minimumConfidence = 60,
  onProgress,
  onPartialTimeline,
}: KaraokePipelineOptions): Promise<KaraokePipelineResult> {
  const attempts: KaraokePipelineResult['attempts'] = [];
  const hasLyrics = Boolean(lyrics?.trim());
  const mobile = isMobileKaraokeDevice();
  let bestTimed: Candidate | null = null;
  let rhythmOnsetsPromise: Promise<RhythmOnset[]> | null = null;

  const refineToSungRhythm = async (
    timeline: KaraokeLine[],
    engine: KaraokeEngineId,
  ) => {
    onProgress?.({
      stage: 'align',
      engine,
      message: 'Đang tinh chỉnh word timing theo onset và nhịp hát…',
    });
    rhythmOnsetsPromise ||= extractAudioRhythmOnsets(audio).catch(() => []);
    const onsets = await rhythmOnsetsPromise;
    return refineKaraokeTimelineToRhythm(timeline, onsets, duration);
  };

  const evaluate = async (
    engine: KaraokeEngineId,
    run: () => Promise<KaraokeLine[]>,
    label: string,
  ): Promise<Candidate | null> => {
    try {
      onProgress?.({
        stage: 'recognize',
        engine,
        message: label,
      });
      const rawTimeline = await run();
      const refinedTimeline = await refineToSungRhythm(rawTimeline, engine);
      const timeline = engine.startsWith('backend-whisper')
        ? compensateBackendVocalLatency(refinedTimeline, duration)
        : refinedTimeline;
      onProgress?.({
        stage: 'validate',
        engine,
        message: 'Đang kiểm tra độ tin cậy timestamp…',
      });
      const quality = validateKaraokeTimeline(timeline, duration, {
        lyrics,
        source: 'timed',
      });
      attempts.push({
        engine,
        ok: true,
        confidence: quality.confidence,
      });
      return { engine, timeline: quality.timeline, quality };
    } catch (error) {
      attempts.push({
        engine,
        ok: false,
        error: error instanceof Error ? error.message : `${engine} failed`,
      });
      return null;
    }
  };

  const finishIfAccepted = (candidate: Candidate | null) => {
    if (!candidate) return null;
    bestTimed = betterCandidate(bestTimed, candidate);
    if (candidate.quality.confidence < minimumConfidence) return null;

    onProgress?.({
      stage: 'done',
      engine: candidate.engine,
      message: karaokeQualitySummary(candidate.quality),
    });
    return {
      timeline: candidate.timeline,
      status: 'synced' as const,
      engine: candidate.engine,
      quality: candidate.quality,
      attempts,
    };
  };

  onProgress?.({
    stage: 'prepare',
    message: mobile
      ? 'Thiết bị mobile · ưu tiên Whisper backend…'
      : 'Thiết bị desktop · ưu tiên Whisper trong trình duyệt…',
  });

  if (hasLyrics) {
    const backendEngine = {
      engine: 'backend-whisper' as const,
      label: 'Đang đồng bộ subtitle…',
      run: () =>
        buildBackendKaraokeTimeline({
          audio,
          lyrics,
          duration,
          language,
          onStage: (message) =>
            onProgress?.({
              stage: 'recognize',
              engine: 'backend-whisper',
              message,
            }),
          onPartialTimeline: (timeline) =>
            onPartialTimeline?.(
              compensateBackendVocalLatency(timeline, duration),
            ),
        }),
    };
    const knownLyricsEngines: Array<{
      engine: KaraokeEngineId;
      label: string;
      run: () => Promise<KaraokeLine[]>;
    }> = mobile
      ? [
          backendEngine,
          {
            engine: 'capcut',
            label: 'Whisper backend chưa đủ tốt · đang thử CapCut timestamp…',
            run: () =>
              buildCapCutKaraokeTimeline({
                audio,
                lyrics: lyrics!,
                duration,
                language: language === 'vi' ? 'vi-VN' : language,
              }),
          },
        ]
      : [
          backendEngine,
          {
            engine: 'local-whisper',
            label: 'Desktop · đang nhận diện bằng Whisper trên trình duyệt…',
            run: () =>
              buildLocalKaraokeTimeline({
                audio,
                lyrics: lyrics!,
                duration,
                language,
                onStage: (stage, message) =>
                  onProgress?.({
                    stage: stageFromLocal(stage),
                    engine: 'local-whisper',
                    message,
                  }),
              }),
          },
          {
            engine: 'capcut',
            label: 'Local Whisper chưa đủ tốt · đang thử CapCut timestamp…',
            run: () =>
              buildCapCutKaraokeTimeline({
                audio,
                lyrics: lyrics!,
                duration,
                language: language === 'vi' ? 'vi-VN' : language,
              }),
          },
        ];

    for (const item of knownLyricsEngines) {
      const accepted = finishIfAccepted(
        await evaluate(item.engine, item.run, item.label),
      );
      if (accepted) return accepted;
    }
  } else {
    const transcriptionEngines: Array<{
      engine: KaraokeEngineId;
      label: string;
      run: () => Promise<KaraokeLine[]>;
    }> = mobile
      ? [
          {
            engine: 'backend-whisper-transcription',
            label: 'Mobile · đang tạo subtitle bằng Whisper backend…',
            run: () =>
              buildBackendKaraokeTimeline({
                audio,
                duration,
                language,
                onStage: (message) =>
                  onProgress?.({
                    stage: 'recognize',
                    engine: 'backend-whisper-transcription',
                    message,
                  }),
                onPartialTimeline: (timeline) =>
                  onPartialTimeline?.(
                    compensateBackendVocalLatency(timeline, duration),
                  ),
              }),
          },
        ]
      : [
          {
            engine: 'local-whisper-transcription',
            label: 'Desktop · đang tạo subtitle bằng Whisper trong trình duyệt…',
            run: () =>
              transcribeLocalKaraokeTimeline({
                audio,
                duration,
                language,
                onStage: (stage, message) =>
                  onProgress?.({
                    stage: stageFromLocal(stage),
                    engine: 'local-whisper-transcription',
                    message,
                  }),
              }),
          },
          {
            engine: 'backend-whisper-transcription',
            label: 'Local Whisper lỗi · đang chuyển sang Whisper backend…',
            run: () =>
              buildBackendKaraokeTimeline({
                audio,
                duration,
                language,
                onStage: (message) =>
                  onProgress?.({
                    stage: 'fallback',
                    engine: 'backend-whisper-transcription',
                    message,
                  }),
                onPartialTimeline: (timeline) =>
                  onPartialTimeline?.(
                    compensateBackendVocalLatency(timeline, duration),
                  ),
              }),
          },
        ];

    for (const item of transcriptionEngines) {
      const accepted = finishIfAccepted(
        await evaluate(item.engine, item.run, item.label),
      );
      if (accepted) return accepted;
    }
  }

  if (bestTimed && bestTimed.quality.confidence >= 50) {
    onProgress?.({
      stage: 'fallback',
      engine: bestTimed.engine,
      message: `${karaokeQualitySummary(bestTimed.quality)} · cần kiểm tra lại`,
    });
    return {
      timeline: bestTimed.timeline,
      status: 'fallback',
      engine: bestTimed.engine,
      quality: bestTimed.quality,
      attempts,
    };
  }


  throw new Error('Không tìm thấy subtitle có timestamp đủ tin cậy.');
}
