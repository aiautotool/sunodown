import { type KaraokeLine } from './karaoke';
import { isMobileKaraokeDevice } from './karaoke-device';
import { buildGroqKaraokeTimeline } from './karaoke-groq-sync';
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
  | 'groq-whisper-transcription';

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
      // Avoid decoding the whole song again on iOS/Safari.
      const timeline = mobile
        ? rawTimeline
        : await refineToSungRhythm(rawTimeline, engine);
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
        coverage: Math.round(quality.coverage * 1000) / 1000,
        wordCoverage: Math.round(quality.wordCoverage * 1000) / 1000,
        criticalIssues: quality.issues.filter((issue) => issue.severity === 'critical').length,
        warningIssues: quality.issues.filter((issue) => issue.severity === 'warning').length,
        issueCodes: quality.issues.map((issue) => issue.code).join(',') || 'none',
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
    message: 'Đang chuẩn bị subtitle bằng Groq Whisper Large V3 Turbo…',
  });

  const engine: KaraokeEngineId = hasLyrics
    ? 'groq-whisper'
    : 'groq-whisper-transcription';
  const accepted = finishIfAccepted(
    await evaluate(
      engine,
      () => buildGroqKaraokeTimeline({
        audio,
        lyrics: hasLyrics ? lyrics : undefined,
        duration,
        language,
        onStage: (message) => onProgress?.({
          stage: 'recognize',
          engine,
          message,
        }),
        onDebug,
      }),
      hasLyrics
        ? 'Đang căn subtitle bằng Groq Whisper Large V3 Turbo…'
        : 'Đang tạo subtitle bằng Groq Whisper Large V3 Turbo…',
    ),
  );
  if (accepted) return accepted;

  const groqFallback =
    bestTimed?.engine.startsWith('groq-whisper') &&
    bestTimed.timeline.length >= 6 &&
    bestTimed.quality.wordCoverage >= 0.9;
  const fallbackThreshold = groqFallback ? 25 : 50;

  if (bestTimed && bestTimed.quality.confidence >= fallbackThreshold) {
    onProgress?.({
      stage: 'fallback',
      engine: bestTimed.engine,
      message: groqFallback
        ? `${karaokeQualitySummary(bestTimed.quality)} · giữ timing Groq thay vì bỏ trắng subtitle`
        : `${karaokeQualitySummary(bestTimed.quality)} · cần kiểm tra lại`,
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
  throw new Error(
    attempts.find((attempt) => !attempt.ok)?.error ||
    'Groq không tạo được subtitle có timestamp đủ tin cậy.',
  );
}
