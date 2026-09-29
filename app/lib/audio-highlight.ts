import type { KaraokeLine } from '@/app/lib/karaoke';

export type HighlightAnalysis = {
  startSeconds: number;
  endSeconds: number;
  confidence: number;
  score: number;
  reason: 'audio-energy' | 'short-track' | 'fallback';
};

type HighlightOptions = {
  duration: number;
  minStart?: number;
  maxEnd?: number;
  windowSeconds?: number;
  karaokeTimeline?: KaraokeLine[];
};

type FrameFeature = {
  time: number;
  energy: number;
  peak: number;
  onset: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const stdev = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
};

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
};

const normalize = (value: number, low: number, high: number) =>
  high <= low + 1e-8 ? 0 : clamp((value - low) / (high - low), 0, 1);

function lyricActivity(
  start: number,
  end: number,
  karaokeTimeline: KaraokeLine[] = [],
) {
  if (!karaokeTimeline.length || end <= start) return 0;
  let active = 0;
  for (const line of karaokeTimeline) {
    const overlap = Math.max(0, Math.min(end, line.end) - Math.max(start, line.start));
    active += overlap;
  }
  return clamp(active / (end - start), 0, 1);
}

function alignToLyricStart(
  candidate: number,
  minStart: number,
  maxStart: number,
  karaokeTimeline: KaraokeLine[] = [],
) {
  if (!karaokeTimeline.length) return candidate;
  const nearby = karaokeTimeline
    .map((line) => line.start)
    .filter((start) => start >= minStart && start <= maxStart)
    .map((start) => ({ start, distance: Math.abs(start - candidate) }))
    .filter(({ distance }) => distance <= 2.5)
    .sort((a, b) => a.distance - b.distance)[0];
  return nearby ? nearby.start : candidate;
}

function extractFrameFeatures(buffer: AudioBuffer, frameSeconds = 0.25) {
  const frameSize = Math.max(256, Math.round(buffer.sampleRate * frameSeconds));
  const sampleStride = Math.max(1, Math.round(buffer.sampleRate / 3000));
  const frames: FrameFeature[] = [];
  let previousEnergy = 0;

  for (let offset = 0; offset < buffer.length; offset += frameSize) {
    const end = Math.min(buffer.length, offset + frameSize);
    let squareSum = 0;
    let peak = 0;
    let samples = 0;

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = offset; index < end; index += sampleStride) {
        const value = data[index] || 0;
        squareSum += value * value;
        peak = Math.max(peak, Math.abs(value));
        samples += 1;
      }
    }

    const energy = samples ? Math.sqrt(squareSum / samples) : 0;
    const onset = Math.max(0, energy - previousEnergy);
    frames.push({
      time: offset / buffer.sampleRate,
      energy,
      peak,
      onset,
    });
    previousEnergy = energy;
  }
  return frames;
}

export async function findMusicHighlight(
  audio: Blob,
  options: HighlightOptions,
): Promise<HighlightAnalysis> {
  const duration = Math.max(0, options.duration || 0);
  const minStart = clamp(options.minStart || 0, 0, duration);
  const maxEnd = clamp(options.maxEnd || duration, minStart, duration);
  const available = Math.max(0, maxEnd - minStart);
  const windowSeconds = Math.min(options.windowSeconds || 30, available || 30);

  if (available <= windowSeconds + 0.5) {
    return {
      startSeconds: minStart,
      endSeconds: maxEnd,
      confidence: 1,
      score: 1,
      reason: 'short-track',
    };
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Web Audio API is unavailable.');

  const context = new AudioContextCtor();
  try {
    const bytes = await audio.arrayBuffer();
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const decodedDuration = buffer.duration || duration;
    const safeMaxEnd = Math.min(maxEnd, decodedDuration);
    const safeAvailable = safeMaxEnd - minStart;
    if (safeAvailable <= windowSeconds + 0.5) {
      return {
        startSeconds: minStart,
        endSeconds: safeMaxEnd,
        confidence: 1,
        score: 1,
        reason: 'short-track',
      };
    }

    const frames = extractFrameFeatures(buffer);
    const scoped = frames.filter((frame) => frame.time >= minStart && frame.time <= safeMaxEnd);
    if (scoped.length < 8) throw new Error('Not enough audio frames for highlight analysis.');

    const energyLow = percentile(scoped.map((frame) => frame.energy), 0.12);
    const energyHigh = percentile(scoped.map((frame) => frame.energy), 0.92);
    const peakLow = percentile(scoped.map((frame) => frame.peak), 0.12);
    const peakHigh = percentile(scoped.map((frame) => frame.peak), 0.92);
    const onsetLow = percentile(scoped.map((frame) => frame.onset), 0.2);
    const onsetHigh = percentile(scoped.map((frame) => frame.onset), 0.95);

    const stepSeconds = 0.75;
    const lastStart = safeMaxEnd - windowSeconds;
    const introGuard = safeAvailable > 55 ? Math.min(7, safeAvailable * 0.06) : 0;
    const outroGuard = safeAvailable > 55 ? Math.min(4, safeAvailable * 0.035) : 0;
    const searchStart = Math.min(lastStart, minStart + introGuard);
    const searchEnd = Math.max(searchStart, lastStart - outroGuard);
    const candidates: Array<{ start: number; score: number }> = [];

    for (let start = searchStart; start <= searchEnd + 0.001; start += stepSeconds) {
      const end = start + windowSeconds;
      const windowFrames = scoped.filter((frame) => frame.time >= start && frame.time < end);
      if (!windowFrames.length) continue;

      const energies = windowFrames.map((frame) => frame.energy);
      const peaks = windowFrames.map((frame) => frame.peak);
      const onsets = windowFrames.map((frame) => frame.onset);
      const energyScore = normalize(mean(energies), energyLow, energyHigh);
      const peakScore = normalize(percentile(peaks, 0.84), peakLow, peakHigh);
      const onsetScore = normalize(mean(onsets), onsetLow, onsetHigh);
      const dynamicsScore = normalize(stdev(energies), 0, Math.max(0.015, energyHigh - energyLow));
      const lyricScore = lyricActivity(start, end, options.karaokeTimeline);
      const center = ((start + end) / 2) / Math.max(1, safeMaxEnd);
      const placementBonus = clamp(1 - Math.abs(center - 0.62) * 0.45, 0.84, 1);

      const score =
        (energyScore * 0.5 +
          onsetScore * 0.2 +
          peakScore * 0.12 +
          dynamicsScore * 0.08 +
          lyricScore * 0.1) *
        placementBonus;
      candidates.push({ start, score });
    }

    if (!candidates.length) throw new Error('No highlight candidates found.');
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const runnerUp = candidates[Math.min(4, candidates.length - 1)] || best;
    const alignedStart = clamp(
      alignToLyricStart(best.start, minStart, lastStart, options.karaokeTimeline),
      minStart,
      lastStart,
    );
    const separation = Math.max(0, best.score - runnerUp.score);
    const confidence = clamp(0.55 + best.score * 0.3 + separation * 0.7, 0.55, 0.98);

    return {
      startSeconds: alignedStart,
      endSeconds: Math.min(safeMaxEnd, alignedStart + windowSeconds),
      confidence,
      score: best.score,
      reason: 'audio-energy',
    };
  } finally {
    void context.close().catch(() => undefined);
  }
}
