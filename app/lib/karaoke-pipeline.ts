import {
  buildEstimatedKaraokeTimeline,
  type KaraokeLine,
} from './karaoke';
import { buildCapCutKaraokeTimeline } from './karaoke-capcut-sync';
import {
  buildLocalKaraokeTimeline,
  transcribeLocalKaraokeTimeline,
  type KaraokeSyncStage,
} from './karaoke-local-sync';
import {
  karaokeQualitySummary,
  validateKaraokeTimeline,
  type KaraokeValidationReport,
} from './karaoke-validation';
import {
  extractAudioRhythmOnsets,
  refineKaraokeTimelineToRhythm,
  type RhythmOnset,
} from './karaoke-rhythm';

export type KaraokeEngineId =
  | 'capcut'
  | 'local-whisper'
  | 'local-whisper-transcription'
  | 'estimated';

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
}: KaraokePipelineOptions): Promise<KaraokePipelineResult> {
  const attempts: KaraokePipelineResult['attempts'] = [];
  const hasLyrics = Boolean(lyrics?.trim());
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

  onProgress?.({
    stage: 'prepare',
    message: 'Đang chuẩn bị audio và karaoke pipeline…',
  });

  if (hasLyrics) {
    try {
      onProgress?.({
        stage: 'recognize',
        engine: 'capcut',
        message: 'Đang tìm timestamp theo giọng hát…',
      });
      const rawTimeline = await buildCapCutKaraokeTimeline({
        audio,
        lyrics: lyrics!,
        duration,
        language: language === 'vi' ? 'vi-VN' : language,
      });
      const timeline = await refineToSungRhythm(rawTimeline, 'capcut');
      onProgress?.({
        stage: 'validate',
        engine: 'capcut',
        message: 'Đang kiểm tra độ tin cậy timestamp…',
      });
      const quality = validateKaraokeTimeline(timeline, duration, {
        lyrics,
        source: 'timed',
      });
      attempts.push({
        engine: 'capcut',
        ok: true,
        confidence: quality.confidence,
      });
      bestTimed = betterCandidate(bestTimed, {
        engine: 'capcut',
        timeline: quality.timeline,
        quality,
      });
      if (quality.confidence >= minimumConfidence) {
        onProgress?.({
          stage: 'done',
          engine: 'capcut',
          message: karaokeQualitySummary(quality),
        });
        return {
          timeline: quality.timeline,
          status: 'synced',
          engine: 'capcut',
          quality,
          attempts,
        };
      }
    } catch (error) {
      attempts.push({
        engine: 'capcut',
        ok: false,
        error: error instanceof Error ? error.message : 'CapCut engine failed',
      });
    }

    try {
      onProgress?.({
        stage: 'fallback',
        engine: 'local-whisper',
        message: 'Đang chuyển sang Whisper trên thiết bị…',
      });
      const rawTimeline = await buildLocalKaraokeTimeline({
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
      });
      const timeline = await refineToSungRhythm(rawTimeline, 'local-whisper');
      onProgress?.({
        stage: 'validate',
        engine: 'local-whisper',
        message: 'Đang kiểm tra timing Whisper…',
      });
      const quality = validateKaraokeTimeline(timeline, duration, {
        lyrics,
        source: 'timed',
      });
      attempts.push({
        engine: 'local-whisper',
        ok: true,
        confidence: quality.confidence,
      });
      bestTimed = betterCandidate(bestTimed, {
        engine: 'local-whisper',
        timeline: quality.timeline,
        quality,
      });
      if (quality.confidence >= minimumConfidence) {
        onProgress?.({
          stage: 'done',
          engine: 'local-whisper',
          message: karaokeQualitySummary(quality),
        });
        return {
          timeline: quality.timeline,
          status: 'synced',
          engine: 'local-whisper',
          quality,
          attempts,
        };
      }
    } catch (error) {
      attempts.push({
        engine: 'local-whisper',
        ok: false,
        error:
          error instanceof Error ? error.message : 'Local Whisper engine failed',
      });
    }
  } else {
    try {
      onProgress?.({
        stage: 'recognize',
        engine: 'local-whisper-transcription',
        message: 'Đang tự động nhận diện lời từ audio…',
      });
      const rawTimeline = await transcribeLocalKaraokeTimeline({
        audio,
        duration,
        language,
        onStage: (stage, message) =>
          onProgress?.({
            stage: stageFromLocal(stage),
            engine: 'local-whisper-transcription',
            message,
          }),
      });
      const timeline = await refineToSungRhythm(
        rawTimeline,
        'local-whisper-transcription',
      );
      const quality = validateKaraokeTimeline(timeline, duration, {
        source: 'timed',
      });
      attempts.push({
        engine: 'local-whisper-transcription',
        ok: true,
        confidence: quality.confidence,
      });
      onProgress?.({
        stage: 'done',
        engine: 'local-whisper-transcription',
        message: karaokeQualitySummary(quality),
      });
      return {
        timeline: quality.timeline,
        status: quality.confidence >= minimumConfidence ? 'synced' : 'fallback',
        engine: 'local-whisper-transcription',
        quality,
        attempts,
      };
    } catch (error) {
      attempts.push({
        engine: 'local-whisper-transcription',
        ok: false,
        error:
          error instanceof Error ? error.message : 'Local transcription failed',
      });
      throw new Error(
        attempts.at(-1)?.error || 'Không thể tự động tạo subtitle từ audio.',
      );
    }
  }

  // Prefer a real timed result even when its confidence is below the acceptance
  // threshold. Estimated timing is only a last resort and is explicitly marked
  // as fallback, never as a successful sync.
  if (bestTimed && bestTimed.quality.confidence >= 35) {
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

  if (hasLyrics) {
    onProgress?.({
      stage: 'fallback',
      engine: 'estimated',
      message: 'Không đủ confidence; đang tạo timing dự phòng để chỉnh tay…',
    });
    const timeline = buildEstimatedKaraokeTimeline(lyrics!, duration);
    const quality = validateKaraokeTimeline(timeline, duration, {
      lyrics,
      source: 'estimated',
    });
    attempts.push({
      engine: 'estimated',
      ok: Boolean(timeline.length),
      confidence: quality.confidence,
    });
    if (timeline.length) {
      return {
        timeline: quality.timeline,
        status: 'fallback',
        engine: 'estimated',
        quality,
        attempts,
      };
    }
  }

  throw new Error('Không tìm thấy subtitle có timestamp đáng tin cậy.');
}
