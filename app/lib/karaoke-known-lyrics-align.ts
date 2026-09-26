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

function trustedCandidate(
  lyric: string,
  candidate: Candidate,
  firstAnchor: boolean,
) {
  const stats = similarity(
    lyric,
    candidate.words.length
      ? candidate.words.map((word) => word.text).join(' ')
      : '',
  );
  const expected = tokenList(lyric).length;
  const minimumScore = firstAnchor
    ? expected <= 2
      ? 0.68
      : expected <= 4
        ? 0.6
        : 0.56
    : expected <= 2
      ? 0.7
      : expected <= 4
        ? 0.58
        : 0.52;
  const recall =
    expected > 0 ? stats.matchedTokens / expected : 0;
  const minimumRecall =
    expected <= 2 ? 0.5 : expected <= 6 ? 0.67 : 0.5;
  const enoughTokens =
    stats.matchedTokens >= (expected <= 2 ? 1 : 2) &&
    recall >= minimumRecall;
  const strongSegmentText = candidate.score >= 0.84;

  // The very first vocal anchor is the most important one: a false match here
  // shifts the entire song into the instrumental intro. Require either a very
  // strong segment-text match or convincing word recall.
  return (
    candidate.score >= minimumScore &&
    (strongSegmentText || enoughTokens)
  );
}

function bestCandidateInRange(
  segments: KaraokeSegment[],
  lyric: string,
  from: number,
  to: number,
) {
  let best: Candidate | null = null;
  for (let segmentIndex = from; segmentIndex < to; segmentIndex++) {
    for (
      let span = 1;
      span <= 2 && segmentIndex + span <= segments.length;
      span++
    ) {
      const endIndex = segmentIndex + span - 1;
      if (
        span > 1 &&
        segments[endIndex].start - segments[endIndex - 1].end > 1.5
      ) {
        break;
      }
      const candidate = buildCandidate(
        segments,
        segmentIndex,
        endIndex,
        lyric,
      );
      if (
        !best ||
        candidate.score > best.score + 0.035 ||
        (Math.abs(candidate.score - best.score) <= 0.035 &&
          candidate.start < best.start)
      ) {
        best = candidate;
      }
      if (candidate.score >= 0.88) return candidate;
    }
  }
  return best;
}

function firstAnchorConfirmed(
  lines: string[],
  lineIndex: number,
  segments: KaraokeSegment[],
  candidate: Candidate,
) {
  if (!trustedCandidate(lines[lineIndex], candidate, true)) return false;
  const nextLyric = lines[lineIndex + 1];
  if (!nextLyric) return candidate.score >= 0.78;

  const confirmFrom = candidate.endIndex + 1;
  const confirmTo = Math.min(segments.length, confirmFrom + 6);
  const confirmation = bestCandidateInRange(
    segments,
    nextLyric,
    confirmFrom,
    confirmTo,
  );
  if (!confirmation) return false;

  const gap = confirmation.start - candidate.end;
  return (
    gap >= -0.15 &&
    gap <= 12 &&
    trustedCandidate(nextLyric, confirmation, false)
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

    if (!firstAnchorFound) {
      // Opening vocal uses two-line confirmation. This allows a realistic
      // threshold for sung Vietnamese while still rejecting hallucinated intro
      // text: one accidental phrase is not enough to start karaoke.
      for (let segmentIndex = cursor; segmentIndex < searchEnd; segmentIndex++) {
        const localBest = bestCandidateInRange(
          usable,
          lyric,
          segmentIndex,
          Math.min(searchEnd, segmentIndex + 2),
        );
        if (!localBest) continue;
        if (firstAnchorConfirmed(lines, lineIndex, usable, localBest)) {
          best = localBest;
          break;
        }
      }
    } else {
      best = bestCandidateInRange(
        usable,
        lyric,
        cursor,
        searchEnd,
      );
    }

    if (
      !best ||
      (!firstAnchorFound
        ? !firstAnchorConfirmed(lines, lineIndex, usable, best)
        : !trustedCandidate(lyric, best, false))
    ) {
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


export function alignKnownLyricsGlobally(
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

  const n = lines.length;
  const m = usable.length;
  const skipLyricPenalty = -0.22;
  const skipSegmentPenalty = -0.045;
  let prev = Array.from({ length: m + 1 }, (_, j) => j * skipSegmentPenalty);
  const back = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  const sims = Array.from({ length: n }, () => new Float32Array(m));

  for (let j = 1; j <= m; j++) back[0][j] = 2;
  for (let i = 1; i <= n; i++) {
    const cur = Array.from<number>({ length: m + 1 }).fill(0);
    cur[0] = i * skipLyricPenalty;
    back[i][0] = 1;
    for (let j = 1; j <= m; j++) {
      const sim = similarity(lines[i - 1], usable[j - 1].text).score;
      sims[i - 1][j - 1] = sim;
      const matchReward = sim * 2.25 - 0.62;
      const match = prev[j - 1] + matchReward;
      const skipLyric = prev[j] + skipLyricPenalty;
      const skipSegment = cur[j - 1] + skipSegmentPenalty;
      if (match >= skipLyric && match >= skipSegment) {
        cur[j] = match;
        back[i][j] = 0;
      } else if (skipLyric >= skipSegment) {
        cur[j] = skipLyric;
        back[i][j] = 1;
      } else {
        cur[j] = skipSegment;
        back[i][j] = 2;
      }
    }
    prev = cur;
  }

  const pairs: Array<{ lineIndex: number; segmentIndex: number; score: number }> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const step = back[i]?.[j] ?? 0;
    if (i > 0 && j > 0 && step === 0) {
      const score = sims[i - 1][j - 1];
      if (score >= 0.24) {
        pairs.push({ lineIndex: i - 1, segmentIndex: j - 1, score });
      }
      i--;
      j--;
    } else if (i > 0 && (j === 0 || step === 1)) {
      i--;
    } else {
      j--;
    }
  }
  pairs.reverse();

  if (!pairs.length) {
    return {
      timeline: [],
      matched: 0,
      total: lines.length,
      coverage: 0,
      firstVocalAt: null,
    };
  }

  // Remove weak pre-roll matches. The opening cue must either be convincing on
  // its own or be confirmed by the next chronologically adjacent lyric cue.
  let first = 0;
  while (first < pairs.length) {
    const current = pairs[first];
    const next = pairs[first + 1];
    const currentSegment = usable[current.segmentIndex];
    const confirmed =
      current.score >= 0.5 ||
      (!!next &&
        next.lineIndex === current.lineIndex + 1 &&
        next.segmentIndex > current.segmentIndex &&
        usable[next.segmentIndex].start - currentSegment.end <= 12 &&
        current.score >= 0.3 &&
        next.score >= 0.34);
    if (confirmed) break;
    first++;
  }

  const trustedPairs = pairs.slice(first);
  if (!trustedPairs.length) {
    return {
      timeline: [],
      matched: 0,
      total: lines.length,
      coverage: 0,
      firstVocalAt: null,
    };
  }

  const timeline: KaraokeLine[] = trustedPairs.map((pair) => {
    const segment = usable[pair.segmentIndex];
    const text = lines[pair.lineIndex];
    const start = Math.max(0, segment.start - 0.03);
    const end = Math.min(
      duration,
      Math.max(start + 0.1, segment.end + 0.06),
    );
    const candidate: Candidate = {
      startIndex: pair.segmentIndex,
      endIndex: pair.segmentIndex,
      start: segment.start,
      end: segment.end,
      score: pair.score,
      words: segment.words,
    };
    return {
      text,
      start,
      end,
      words: localWords(text, candidate, duration),
    };
  });

  const normalized = normalizeKaraokeTimeline(timeline, duration);
  return {
    timeline: normalized,
    matched: normalized.length,
    total: lines.length,
    coverage: normalized.length / Math.max(1, lines.length),
    firstVocalAt: normalized[0]?.start ?? null,
  };
}
