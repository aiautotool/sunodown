export type KaraokeWord = {
  text: string;
  start: number;
  end: number;
};

export type KaraokeLine = {
  text: string;
  start: number;
  end: number;
  words: KaraokeWord[];
};

const SECTION_LABEL = /^\s*\[[^\]]+\]\s*$/;
const PUNCT_ONLY = /^[\s\p{P}\p{S}]+$/u;

function visibleLines(lyrics: string) {
  return lyrics
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !SECTION_LABEL.test(line) && !PUNCT_ONLY.test(line));
}

function wordWeight(word: string) {
  const normalized = word.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');
  return Math.max(1, Array.from(normalized).length);
}

/**
 * Browser-safe fallback timeline.
 *
 * This deliberately never changes the original Suno lyrics. It estimates a
 * monotonic word timeline from the song duration so the video renderer can
 * already support karaoke. A future forced-alignment backend can return the
 * same KaraokeLine[] shape and replace this function without touching render.
 */
export function buildEstimatedKaraokeTimeline(
  lyrics: string,
  duration: number,
): KaraokeLine[] {
  const lines = visibleLines(lyrics);
  if (!lines.length || !Number.isFinite(duration) || duration <= 0) return [];

  const intro = Math.min(10, Math.max(1.5, duration * 0.045));
  const outro = Math.min(5, Math.max(1, duration * 0.02));
  const usableDuration = Math.max(1, duration - intro - outro);

  const parsed = lines.map((text) => {
    const words = text.split(/\s+/).filter(Boolean);
    const weight = Math.max(1, words.reduce((sum, word) => sum + wordWeight(word), 0));
    return { text, words, weight };
  });

  const totalWeight = parsed.reduce((sum, line) => sum + line.weight, 0);
  let cursor = intro;

  return parsed.map((line, lineIndex) => {
    const minimum = 1.15;
    const proportional = usableDuration * (line.weight / totalWeight);
    const lineDuration = Math.max(minimum, proportional);
    const lineStart = cursor;
    const isLast = lineIndex === parsed.length - 1;
    const lineEnd = isLast ? Math.max(lineStart + 0.2, duration - outro) : Math.min(duration - outro, lineStart + lineDuration);
    const actualDuration = Math.max(0.2, lineEnd - lineStart);
    const wordTotalWeight = line.words.reduce((sum, word) => sum + wordWeight(word), 0);

    let wordCursor = lineStart;
    const words = line.words.map((word, wordIndex) => {
      const isLastWord = wordIndex === line.words.length - 1;
      const end = isLastWord
        ? lineEnd
        : Math.min(lineEnd, wordCursor + actualDuration * (wordWeight(word) / wordTotalWeight));
      const timedWord = { text: word, start: wordCursor, end: Math.max(wordCursor + 0.01, end) };
      wordCursor = timedWord.end;
      return timedWord;
    });

    cursor = lineEnd;
    return { text: line.text, start: lineStart, end: lineEnd, words };
  });
}

export function activeKaraokeLine(lines: KaraokeLine[], time: number) {
  if (!lines.length) return { line: null as KaraokeLine | null, next: null as KaraokeLine | null };
  let index = lines.findIndex((line) => time >= line.start && time < line.end);
  if (index < 0) {
    index = lines.findIndex((line) => time < line.start);
    if (index < 0) return { line: null, next: null };
    return { line: null, next: lines[index] ?? null };
  }
  return { line: lines[index], next: lines[index + 1] ?? null };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawWordLine(
  ctx: CanvasRenderingContext2D,
  line: KaraokeLine,
  time: number,
  centerX: number,
  baselineY: number,
  maxWidth: number,
) {
  const gap = 14;
  ctx.font = '700 42px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'alphabetic';

  const widths = line.words.map((word) => ctx.measureText(word.text).width);
  const fullWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  const scale = Math.min(1, maxWidth / Math.max(1, fullWidth));
  const fontSize = Math.floor(42 * scale);
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  const scaledWidths = line.words.map((word) => ctx.measureText(word.text).width);
  const renderedWidth = scaledWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, scaledWidths.length - 1);
  let x = centerX - renderedWidth / 2;

  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    const width = scaledWidths[i];
    const progress = word.end <= word.start ? (time >= word.end ? 1 : 0) : Math.max(0, Math.min(1, (time - word.start) / (word.end - word.start)));

    ctx.lineWidth = Math.max(4, fontSize * 0.12);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.88)';
    ctx.strokeText(word.text, x, baselineY);

    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.fillText(word.text, x, baselineY);

    if (progress > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 2, baselineY - fontSize * 1.15, (width + 4) * progress, fontSize * 1.5);
      ctx.clip();
      ctx.fillStyle = '#f0abfc';
      ctx.fillText(word.text, x, baselineY);
      ctx.restore();
    }

    x += width + gap;
  }
}

export function drawKaraokeOverlay(
  ctx: CanvasRenderingContext2D,
  lines: KaraokeLine[],
  time: number,
  width: number,
  height: number,
) {
  const { line, next } = activeKaraokeLine(lines, time);
  if (!line && !next) return;

  const panelWidth = Math.min(width - 96, 1120);
  const panelHeight = 154;
  const panelX = (width - panelWidth) / 2;
  const panelY = height - panelHeight - 42;

  ctx.save();
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 28);
  ctx.fillStyle = 'rgba(8,8,18,.68)';
  ctx.fill();

  if (line) {
    drawWordLine(ctx, line, time, width / 2, panelY + 66, panelWidth - 64);
  }

  if (next) {
    ctx.font = '600 26px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    const nextText = next.text.length > 86 ? `${next.text.slice(0, 83)}…` : next.text;
    ctx.fillText(nextText, width / 2, panelY + 119, panelWidth - 64);
    ctx.textAlign = 'start';
  }

  ctx.restore();
}
