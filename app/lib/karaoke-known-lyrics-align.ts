import {
  alignRoughWordsToLyrics,
  normalizeKaraokeTimeline,
  visibleLyricLines,
  type KaraokeLine,
  type KaraokeWord,
  type RoughWord,
} from './karaoke.ts';

export type KaraokeSegment = {
  text: string;
  start: number;
  end: number;
  words: RoughWord[];
};

export type KnownLyricsAlignment = {
  timeline: KaraokeLine[];
  matched: number;
  total: number;
  coverage: number;
  firstVocalAt: number | null;
};

type Candidate = {
  startIndex: number;
  endIndex: number;
  start: number;
  end: number;
  score: number;
  words: RoughWord[];
};

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');
}

function tokenList(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function levenshteinRatio(a: string, b: string) {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  const cur = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= right.length; j++) {
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= right.length; j++) prev[j] = cur[j];
  }
  return 1 - prev[right.length] / Math.max(left.length, right.length);
}

function tokenF1(a: string, b: string) {
  const left = tokenList(a);
  const right = tokenList(b);
  if (!left.length || !right.length) return { score: 0, matched: 0, expected: left.length };

  const counts = new Map<string, number>();
  for (const token of right) counts.set(token, (counts.get(token) || 0) + 1);
  let matched = 0;
  for (const token of left) {
    const count = counts.get(token) || 0;
    if (!count) continue;
    matched++;
    counts.set(token, count - 1);
  }
  const precision = matched / right.length;
  const recall = matched / left.length;
  return {
    score: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    matched,
    expected: left.length,
  };
}

function similarity(a: string, b: string) {
  const chars = levenshteinRatio(a, b);
  const tokens = tokenF1(a, b);
  return {
    score: chars * 0.62 + tokens.score * 0.38,
    matchedTokens: tokens.matched,
    expectedTokens: tokens.expected,
  };
}

function proportionalWords(text: string, start: number, end: number): KaraokeWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const span = Math.max(0.08, end - start);
  return words.map((word, index) => ({
    text: word,
    start: start + (span * index) / words.length,
    end: start + (span * (index + 1)) / words.length,
  }));
}

function candidateWords(segments: KaraokeSegment[], start: number, end: number) {
  return segments.slice(start, end + 1).flatMap((segment) => segment.words);
}

function buildCandidate(
  segments: KaraokeSegment[],
  startIndex: number,
  endIndex: number,
  lyric: string,
): Candidate {
  const slice = segments.slice(startIndex, endIndex + 1);
  const joined = slice.map((segment) => segment.text).join(' ');
  return {
    startIndex,
    endIndex,
    start: slice[0].start,
    end: slice.at(-1)!.end,
    score: similarity(lyric, joined).score,
    words: candidateWords(segments, startIndex, endIndex),
  };
}

function trustedCandidate(lyric: string, candidate: Candidate) {
  const stats = similarity(
    lyric,
    candidate.words.length
      ? candidate.words.map((word) => word.text).join(' ')
      : '',
  );
  const expected = tokenList(lyric).length;
  const minimumScore = expected <= 2 ? 0.72 : expected <= 4 ? 0.58 : 0.52;
  const enoughTokens =
    expected <= 2
      ? stats.matchedTokens >= 1
      : stats.matchedTokens >= Math.min(2, expected);

  // Segment text can be useful when word timing is sparse, but a common single
  // word is never enough to open the vocal gate for a full lyric line.
  return (
    candidate.score >= minimumScore &&
    (enoughTokens || (candidate.words.length === 0 && candidate.score >= 0.68))
  );
}

function localWords(
  lyric: string,
  candidate: Candidate,
  duration: number,
): KaraokeWord[] {
  const start = Math.max(0, candidate.start - 0.035);
  const end = Math.min(duration, Math.max(start + 0.1, candidate.end + 0.07));
  if (!candidate.words.length) return proportionalWords(lyric, start, end);

  const local = alignRoughWordsToLyrics(lyric, candidate.words, duration)[0];
  if (
    !local ||
    local.start < start - 0.45 ||
    local.end > end + 0.65 ||
    !local.words.length
  ) {
    return proportionalWords(lyric, start, end);
  }

  return local.words.map((word) => ({
    ...word,
    start: Math.max(start, Math.min(end, word.start)),
    end: Math.max(
      Math.max(start, Math.min(end, word.start)) + 0.01,
      Math.min(end, word.end),
    ),
  }));
}

/**
 * Known-lyrics karaoke alignment.
 *
 * Design is intentionally "honest-gap": ASR segments may be skipped freely
 * (the equivalent of a wildcard/star absorbing intro, solos and hallucinated
 * speech), but lyric lines are only emitted when a local forward match is
 * confident. Unmatched lyrics do NOT get estimated timestamps.
 *
 * The matching strategy is adapted from lyric-align's local monotonic anchor
 * approach and utasub's instrumental-gap philosophy, implemented here in TS so
 * it can run in the current SunoDown Edge backend.
 */
export function alignKnownLyricsToSegments(
  lyrics: string,
  segments: KaraokeSegment[],
  duration: number,
): KnownLyricsAlignment {
  const lines = visibleLyricLines(lyrics);
  const usable = segments
    .filter(
      (segment) =>
        segment.text.trim() &&
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start,
    )
    .sort((a, b) => a.start - b.start);

  if (!lines.length || !usable.length) {
    return {
      timeline: [],
      matched: 0,
      total: lines.length,
      coverage: 0,
      firstVocalAt: null,
    };
  }

  const timeline: KaraokeLine[] = [];
  let cursor = 0;
  let firstAnchorFound = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lyric = lines[lineIndex];
    let best: Candidate | null = null;

    // Before the first verified vocal, search broadly so any amount of intro
    // music / false ASR segments can be swallowed. After that, stay local to
    // preserve repeated choruses in chronological order.
    const searchEnd = firstAnchorFound
      ? Math.min(usable.length, cursor + 6)
      : usable.length;

    for (let segmentIndex = cursor; segmentIndex < searchEnd; segmentIndex++) {
      for (let span = 1; span <= 2 && segmentIndex + span <= usable.length; span++) {
        const candidate = buildCandidate(
          usable,
          segmentIndex,
          segmentIndex + span - 1,
          lyric,
        );

        // Prefer the earliest candidate once scores are close. This is crucial
        // for repeated chorus lines: locality/chronology beats a later perfect
        // duplicate.
        if (
          !best ||
          candidate.score > best.score + 0.035 ||
          (Math.abs(candidate.score - best.score) <= 0.035 &&
            candidate.start < best.start)
        ) {
          best = candidate;
        }

        if (
          candidate.score >= 0.86 &&
          trustedCandidate(lyric, candidate)
        ) {
          best = candidate;
          segmentIndex = searchEnd;
          break;
        }
      }
    }

    if (!best || !trustedCandidate(lyric, best)) {
      // Honest gap. Do not advance the ASR cursor and, critically, do not
      // invent a time before the first vocal.
      continue;
    }

    const start = Math.max(0, best.start - 0.035);
    const end = Math.min(
      duration,
      Math.max(start + 0.1, best.end + 0.07),
    );
    timeline.push({
      text: lyric,
      start,
      end,
      words: localWords(lyric, best, duration),
    });

    cursor = best.endIndex + 1;
    firstAnchorFound = true;
  }

  const normalized = normalizeKaraokeTimeline(timeline, duration);
  return {
    timeline: normalized,
    matched: normalized.length,
    total: lines.length,
    coverage: normalized.length / Math.max(1, lines.length),
    firstVocalAt: normalized[0]?.start ?? null,
  };
}
