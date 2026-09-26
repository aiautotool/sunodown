import {
  normalizeKaraokeTimeline,
  type KaraokeLine,
  type KaraokeWord,
} from './karaoke.ts';

export type RhythmOnset = {
  time: number;
  strength: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function bestOnsetNear(
  onsets: RhythmOnset[],
  time: number,
  minShift = -0.035,
  maxShift = 0.12,
) {
  let best: RhythmOnset | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const onset of onsets) {
    const delta = onset.time - time;
    if (delta < minShift || delta > maxShift) continue;

    // Prefer strong nearby attacks. Earlier snapping is deliberately penalized
    // because showing karaoke before the vocal is more distracting than being a
    // few milliseconds late, and a full mix can contain unrelated drum hits.
    const earlyPenalty = delta < 0 ? 0.35 : 0;
    const score = onset.strength - Math.abs(delta) * 6 - earlyPenalty;
    if (score > bestScore) {
      best = onset;
      bestScore = score;
    }
  }

  return bestScore >= 0.15 ? best : null;
}

function refineLineWords(words: KaraokeWord[], onsets: RhythmOnset[]) {
  const refined = words
    .map((word) => ({ ...word }))
    .sort((a, b) => a.start - b.start);

  for (let index = 0; index < refined.length; index++) {
    const word = refined[index];
    const onset = bestOnsetNear(onsets, word.start);
    if (!onset) continue;

    const previous = refined[index - 1];
    const minimumStart = previous ? previous.end + 0.005 : 0;
    const snapped = Math.max(minimumStart, onset.time);

    // Never move a word dramatically. Onset snapping is a micro-refinement,
    // not a second alignment engine.
    if (Math.abs(snapped - word.start) <= 0.12) {
      const duration = Math.max(0.035, word.end - word.start);
      word.start = snapped;
      word.end = Math.max(word.start + 0.035, word.start + duration);
    }
  }

  // Preserve held notes but stop a word before the next word begins. For short
  // gaps we let the highlight breathe until the next onset; for real breaths or
  // instrumental gaps we keep the ASR end and leave visible silence.
  for (let index = 0; index < refined.length - 1; index++) {
    const word = refined[index];
    const next = refined[index + 1];
    const gap = next.start - word.end;

    if (word.end >= next.start) {
      word.end = Math.max(word.start + 0.025, next.start - 0.012);
    } else if (gap >= 0 && gap <= 0.28) {
      word.end = Math.max(word.end, next.start - 0.018);
    }
  }

  return refined;
}

/**
 * Pure timing refinement used after ASR/forced alignment.
 *
 * It snaps word starts only to strong nearby onset candidates and then rebuilds
 * line boundaries from the refined words. This means preview/render start a
 * lyric at the first sung word, not at an arbitrary padded line timestamp.
 */
export function refineKaraokeTimelineToRhythm(
  lines: KaraokeLine[],
  onsets: RhythmOnset[],
  duration: number,
): KaraokeLine[] {
  if (!lines.length || !onsets.length) {
    return normalizeKaraokeTimeline(lines, duration).map((line) => {
      if (!line.words.length) return line;
      return {
        ...line,
        start: line.words[0].start,
        end: Math.max(line.words.at(-1)!.end, line.words[0].start + 0.02),
      };
    });
  }

  const refined = normalizeKaraokeTimeline(lines, duration).map((line) => {
    if (!line.words.length) return line;
    const words = refineLineWords(line.words, onsets);
    return {
      ...line,
      words,
      start: words[0].start,
      end: Math.min(
        duration,
        Math.max(words.at(-1)!.end + 0.035, words[0].start + 0.02),
      ),
    };
  });

  // A line can tail a little after its last syllable, but never into the next
  // vocal line. This keeps instrumental gaps genuinely empty.
  for (let index = 0; index < refined.length - 1; index++) {
    const line = refined[index];
    const next = refined[index + 1];
    if (line.end >= next.start) {
      line.end = Math.max(line.start + 0.02, next.start - 0.02);
      const last = line.words.at(-1);
      if (last && last.end > line.end) last.end = line.end;
    }
  }

  return normalizeKaraokeTimeline(refined, duration);
}

/**
 * Extract conservative onset candidates from the decoded full mix.
 *
 * Full-song onset detection is intentionally used only as a micro-refinement:
 * drums/instruments also create attacks, so callers constrain snapping to a
 * tiny window around an already trusted ASR word timestamp.
 */
export async function extractAudioRhythmOnsets(
  audio: Blob,
): Promise<RhythmOnset[]> {
  if (typeof window === 'undefined') return [];

  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return [];

  const context = new AudioCtx();
  try {
    const decoded = await context.decodeAudioData(
      (await audio.arrayBuffer()).slice(0),
    );
    const sampleRate = decoded.sampleRate;
    const frame = Math.max(64, Math.round(sampleRate * 0.024));
    const hop = Math.max(32, Math.round(sampleRate * 0.012));
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, channel) => decoded.getChannelData(channel),
    );

    const energies: number[] = [];
    const times: number[] = [];
    for (let start = 0; start + frame < decoded.length; start += hop) {
      let sum = 0;
      let samples = 0;
      const stride = Math.max(1, Math.floor(frame / 256));
      for (let sample = start; sample < start + frame; sample += stride) {
        let mono = 0;
        for (const channel of channels) mono += channel[sample] || 0;
        mono /= Math.max(1, channels.length);
        sum += mono * mono;
        samples++;
      }
      energies.push(Math.sqrt(sum / Math.max(1, samples)));
      times.push((start + frame * 0.5) / sampleRate);
    }

    if (energies.length < 5) return [];

    const rises = energies.map((energy, index) =>
      index === 0 ? 0 : Math.max(0, energy - energies[index - 1]),
    );
    const base = median(rises);
    const deviations = rises.map((value) => Math.abs(value - base));
    const mad = Math.max(1e-6, median(deviations));
    const energyFloor = median(energies) * 0.35;
    const threshold = base + mad * 1.8;

    const raw: RhythmOnset[] = [];
    for (let index = 2; index < rises.length - 2; index++) {
      const value = rises[index];
      if (
        value < threshold ||
        energies[index] < energyFloor ||
        value < rises[index - 1] ||
        value < rises[index + 1]
      ) {
        continue;
      }
      raw.push({
        time: times[index],
        strength: clamp((value - threshold) / (mad * 4), 0, 1),
      });
    }

    // Collapse dense peaks from the same acoustic attack.
    const merged: RhythmOnset[] = [];
    for (const onset of raw) {
      const previous = merged.at(-1);
      if (previous && onset.time - previous.time < 0.055) {
        if (onset.strength > previous.strength) merged[merged.length - 1] = onset;
      } else {
        merged.push(onset);
      }
    }
    return merged;
  } finally {
    await context.close().catch(() => {});
  }
}
