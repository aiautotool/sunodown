import {
  normalizeKaraokeTimeline,
  visibleLyricLines,
  type KaraokeLine,
} from './karaoke.ts';

export type KaraokeTimelineSource = 'timed' | 'estimated';

export type KaraokeValidationIssue = {
  code:
    | 'empty_timeline'
    | 'low_lyric_coverage'
    | 'missing_word_timing'
    | 'cue_out_of_range'
    | 'cue_overlap'
    | 'cue_before_first_word'
    | 'suspicious_cue_duration';
  severity: 'warning' | 'critical';
  message: string;
};

export type KaraokeValidationReport = {
  timeline: KaraokeLine[];
  confidence: number;
  firstVocalAt: number | null;
  alignedLines: number;
  totalLyricLines: number;
  coverage: number;
  wordCoverage: number;
  source: KaraokeTimelineSource;
  issues: KaraokeValidationIssue[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function isFiniteTiming(start: number, end: number) {
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function sanitizeCue(line: KaraokeLine, duration: number): KaraokeLine {
  const timedWords = (line.words || [])
    .filter((word) => word.text.trim() && isFiniteTiming(word.start, word.end))
    .sort((a, b) => a.start - b.start)
    .map((word) => ({
      ...word,
      start: clamp(word.start, 0, duration),
      end: clamp(Math.max(word.start + 0.01, word.end), 0, duration),
    }));

  const firstWord = timedWords[0];
  const lastWord = timedWords.at(-1);
  const start = firstWord
    ? Math.max(line.start, firstWord.start)
    : clamp(line.start, 0, duration);
  const end = lastWord
    ? Math.max(start + 0.02, Math.min(duration, Math.max(line.end, lastWord.end)))
    : Math.max(start + 0.02, Math.min(duration, line.end));

  return {
    ...line,
    start,
    end,
    words: timedWords.length ? timedWords : line.words,
  };
}

/**
 * Validates and repairs a karaoke timeline before it reaches preview/render.
 *
 * The important invariant is conservative cue start: when word timestamps are
 * available, a line is never allowed to begin before its first recognized word.
 * This prevents the "subtitle appears, disappears, then the singer starts"
 * regression that is especially visible after instrumental intros.
 */
export function validateKaraokeTimeline(
  input: KaraokeLine[],
  duration: number,
  options: {
    lyrics?: string;
    source?: KaraokeTimelineSource;
  } = {},
): KaraokeValidationReport {
  const safeDuration =
    Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
  const source = options.source || 'timed';
  const issues: KaraokeValidationIssue[] = [];

  if (!input.length) {
    issues.push({
      code: 'empty_timeline',
      severity: 'critical',
      message: 'Không có cue subtitle có timestamp.',
    });
  }

  input.forEach((line, index) => {
    if (
      !isFiniteTiming(line.start, line.end) ||
      line.start < 0 ||
      (Number.isFinite(safeDuration) && line.end > safeDuration + 0.05)
    ) {
      issues.push({
        code: 'cue_out_of_range',
        severity: 'critical',
        message: `Cue ${index + 1} nằm ngoài thời lượng audio.`,
      });
    }
    if (line.end - line.start > 18) {
      issues.push({
        code: 'suspicious_cue_duration',
        severity: 'warning',
        message: `Cue ${index + 1} dài bất thường.`,
      });
    }
    const firstWord = (line.words || [])
      .filter((word) => isFiniteTiming(word.start, word.end))
      .sort((a, b) => a.start - b.start)[0];
    if (firstWord && line.start < firstWord.start - 0.06) {
      issues.push({
        code: 'cue_before_first_word',
        severity: 'warning',
        message: `Cue ${index + 1} bắt đầu trước từ đầu tiên.`,
      });
    }
    if (index > 0 && input[index - 1].end > line.start + 0.04) {
      issues.push({
        code: 'cue_overlap',
        severity: 'warning',
        message: `Cue ${index} và ${index + 1} bị chồng thời gian.`,
      });
    }
  });

  const normalized = normalizeKaraokeTimeline(input, safeDuration);
  const timeline = normalized.map((line) => sanitizeCue(line, safeDuration));

  const totalLyricLines = options.lyrics
    ? visibleLyricLines(options.lyrics).length
    : timeline.length;
  const alignedLines = timeline.length;
  const coverage =
    totalLyricLines > 0 ? Math.min(1, alignedLines / totalLyricLines) : 0;

  if (options.lyrics && coverage < 0.45) {
    issues.push({
      code: 'low_lyric_coverage',
      severity: 'critical',
      message: `Chỉ căn được ${alignedLines}/${totalLyricLines} câu.`,
    });
  } else if (options.lyrics && coverage < 0.78) {
    issues.push({
      code: 'low_lyric_coverage',
      severity: 'warning',
      message: `Căn được ${alignedLines}/${totalLyricLines} câu.`,
    });
  }

  const words = timeline.flatMap((line) => line.words || []);
  const timedWords = words.filter((word) => isFiniteTiming(word.start, word.end));
  const wordCoverage = words.length ? timedWords.length / words.length : 0;
  if (source === 'timed' && timeline.length && wordCoverage < 0.6) {
    issues.push({
      code: 'missing_word_timing',
      severity: 'warning',
      message: 'Thiếu timestamp theo từng từ.',
    });
  }

  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  let confidence =
    100 -
    (1 - coverage) * 45 -
    (1 - wordCoverage) * 18 -
    warningCount * 5 -
    criticalCount * 24;

  if (!timeline.length) confidence = 0;
  if (source === 'estimated') confidence = Math.min(confidence, 35);

  return {
    timeline,
    confidence: Math.round(clamp(confidence, 0, 100)),
    firstVocalAt: timeline[0]?.start ?? null,
    alignedLines,
    totalLyricLines,
    coverage,
    wordCoverage,
    source,
    issues,
  };
}

export function karaokeQualitySummary(report: KaraokeValidationReport) {
  const start =
    report.firstVocalAt == null ? '—' : `${report.firstVocalAt.toFixed(1)}s`;
  const prefix = report.source === 'estimated' ? 'Timing dự phòng' : 'Đồng bộ';
  return `${prefix} ${report.confidence}% · ${report.alignedLines}/${Math.max(
    report.totalLyricLines,
    report.alignedLines,
  )} câu · vocal từ ${start}`;
}
