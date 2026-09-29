import { type KaraokeLine } from './karaoke';
import {
  buildBackendKaraokeTimeline,
  buildFullBackendKaraokeTimeline,
  compensateBackendVocalLatency,
} from './karaoke-backend-sync';
import { buildCapCutKaraokeTimeline } from './karaoke-capcut-sync';
import { isMobileKaraokeDevice } from './karaoke-device';
import { buildGroqKaraokeTimeline } from './karaoke-groq-sync';
import {
  buildLocalKaraokeTimeline,
  buildMobileLocalKaraokeTimeline,
  transcribeLocalKaraokeTimeline,
  transcribeMobileLocalKaraokeTimeline,
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
  | 'groq-whisper'
  | 'groq-whisper-transcription'
  | 'backend-whisper'
  | 'backend-whisper-full'
  | 'backend-whisper-transcription'
  | 'backend-whisper-full-transcription'
  | 'capcut'
  | 'local-whisper'
  | 'local-whisper-mobile'
  | 'local-whisper-transcription'
  | 'local-whisper-mobile-transcription';

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
  onDebug?: (message: string, data?: Record<string, string | number | boolean | null>) => void;
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
  onDebug,
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
      onDebug?.('engine-start', { engine, label });
      onProgress?.({
        stage: 'recognize',
        engine,
        message: label,
      });
      const rawTimeline = await run();
      // Mobile local Whisper already works on short chunks. Avoid decoding the
      // whole song a second time for onset refinement on iOS/Safari.
      const refinedTimeline =
        mobile &&
        (engine.startsWith('local-whisper-mobile') ||
          engine.startsWith('groq-whisper') ||
          engine.startsWith('backend-whisper-full'))
          ? rawTimeline
          : await refineToSungRhythm(rawTimeline, engine);
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
      onDebug?.('engine-result', {
        engine,
        ok: true,
        confidence: quality.confidence,
        lines: quality.timeline.length,
      });
      return { engine, timeline: quality.timeline, quality };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${engine} failed`;
      attempts.push({
        engine,
        ok: false,
        error: message,
      });
      onDebug?.('engine-result', {
        engine,
        ok: false,
        error: message,
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
    onDebug?.('pipeline-accepted', {
      engine: candidate.engine,
      confidence: candidate.quality.confidence,
      lines: candidate.timeline.length,
    });
    return {
      timeline: candidate.timeline,
      status: 'synced' as const,
      engine: candidate.engine,
      quality: candidate.quality,
      attempts,
    };
  };

  onDebug?.('pipeline-start', {
    mobile,
    hasLyrics,
    duration: Math.round(duration * 100) / 100,
    minimumConfidence,
  });
  onProgress?.({
    stage: 'prepare',
    message: mobile
      ? 'Thiết bị mobile · ưu tiên Groq Whisper Large V3 Turbo…'
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
          onDebug,
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
          {
            engine: 'groq-whisper',
            label: 'Mobile · đang căn subtitle bằng Groq Whisper Large V3 Turbo…',
            run: () =>
              buildGroqKaraokeTimeline({
                audio,
                lyrics: lyrics!,
                duration,
                language,
                onStage: (message) =>
                  onProgress?.({
                    stage: 'recognize',
                    engine: 'groq-whisper',
                    message,
                  }),
                onDebug,
              }),
          },
          {
            engine: 'backend-whisper-full',
            label: 'Groq chưa đủ tốt · gửi nguyên audio lên backend, không decode trên iPhone…',
            run: () =>
              buildFullBackendKaraokeTimeline({
                audio,
                lyrics: lyrics!,
                duration,
                language,
                onStage: (message) =>
                  onProgress?.({
                    stage: 'fallback',
                    engine: 'backend-whisper-full',
                    message,
                  }),
                onDebug,
              }),
          },
          {
            engine: 'local-whisper-mobile',
            label: 'Backend full chưa đủ tốt · mới thử Whisper Tiny trực tiếp trên mobile…',
            run: () =>
              buildMobileLocalKaraokeTimeline({
                audio,
                lyrics: lyrics!,
                duration,
                language,
                onStage: (stage, message) =>
                  onProgress?.({
                    stage: stageFromLocal(stage),
                    engine: 'local-whisper-mobile',
                    message,
                  }),
                onPartialTimeline,
                onDebug,
              }),
          },
          {
            ...backendEngine,
            label: 'Whisper local mobile chưa đủ tốt · fallback sang backend chunking…',
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
            engine: 'groq-whisper-transcription',
            label: 'Mobile · đang tạo subtitle bằng Groq Whisper Large V3 Turbo…',
            run: () =>
              buildGroqKaraokeTimeline({
                audio,
                duration,
                language,
                onStage: (message) =>
                  onProgress?.({
                    stage: 'recognize',
                    engine: 'groq-whisper-transcription',
                    message,
                  }),
                onDebug,
              }),
          },
          {
            engine: 'backend-whisper-full-transcription',
            label: 'Groq lỗi · gửi nguyên audio lên backend, không decode trên iPhone…',
            run: () =>
              buildFullBackendKaraokeTimeline({
                audio,
                duration,
                language,
                onStage: (message) =>
                  onProgress?.({
                    stage: 'fallback',
                    engine: 'backend-whisper-full-transcription',
                    message,
                  }),
                onDebug,
              }),
          },
          {
            engine: 'local-whisper-mobile-transcription',
            label: 'Backend full lỗi hoặc chưa đủ tốt · đang thử Whisper Tiny trên mobile…',
            run: () =>
              transcribeMobileLocalKaraokeTimeline({
                audio,
                duration,
                language,
                onStage: (stage, message) =>
                  onProgress?.({
                    stage: stageFromLocal(stage),
                    engine: 'local-whisper-mobile-transcription',
                    message,
                  }),
                onPartialTimeline,
                onDebug,
              }),
          },
          {
            engine: 'backend-whisper-transcription',
            label: 'Whisper local mobile lỗi · fallback sang backend chunking…',
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
                onDebug,
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
                onDebug,
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
    onDebug?.('pipeline-fallback', {
      engine: bestTimed.engine,
      confidence: bestTimed.quality.confidence,
      lines: bestTimed.timeline.length,
    });
    return {
      timeline: bestTimed.timeline,
      status: 'fallback',
      engine: bestTimed.engine,
      quality: bestTimed.quality,
      attempts,
    };
  }


  onDebug?.('pipeline-failed', {
    attempts: attempts.length,
    successfulAttempts: attempts.filter((item) => item.ok).length,
  });
  throw new Error('Không tìm thấy subtitle có timestamp đủ tin cậy.');
}
