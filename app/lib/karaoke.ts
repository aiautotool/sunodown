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

export function visibleLyricLines(lyrics: string) {
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

function retimeWords(text: string, start: number, end: number): KaraokeWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const duration = Math.max(0.05, end - start);
  const total = words.reduce((sum, word) => sum + wordWeight(word), 0);
  let cursor = start;
  return words.map((word, index) => {
    const wordEnd = index === words.length - 1
      ? end
      : Math.min(end, cursor + duration * (wordWeight(word) / total));
    const result = { text: word, start: cursor, end: Math.max(cursor + 0.01, wordEnd) };
    cursor = result.end;
    return result;
  });
}

export function buildEstimatedKaraokeTimeline(lyrics: string, duration: number): KaraokeLine[] {
  const lines = visibleLyricLines(lyrics);
  if (!lines.length || !Number.isFinite(duration) || duration <= 0) return [];

  const intro = Math.min(10, Math.max(1.5, duration * 0.045));
  const outro = Math.min(5, Math.max(1, duration * 0.02));
  const usable = Math.max(1, duration - intro - outro);
  const weights = lines.map((text) => Math.max(1, text.split(/\s+/).reduce((sum, word) => sum + wordWeight(word), 0)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = intro;

  return lines.map((text, index) => {
    const share = usable * (weights[index] / total);
    const start = cursor;
    const end = index === lines.length - 1 ? Math.max(start + 0.2, duration - outro) : Math.min(duration - outro, start + share);
    cursor = end;
    return { text, start, end, words: retimeWords(text, start, end) };
  });
}

export function timelineFromLineStarts(lyrics: string, starts: number[], duration: number): KaraokeLine[] {
  const lines = visibleLyricLines(lyrics);
  if (!lines.length) return [];
  return lines.map((text, index) => {
    const start = Math.max(0, starts[index] ?? 0);
    const next = starts[index + 1];
    const end = Math.max(start + 0.08, Number.isFinite(next) ? next : duration);
    return { text, start, end, words: retimeWords(text, start, end) };
  });
}

export function normalizeKaraokeTimeline(lines: KaraokeLine[], duration = Number.POSITIVE_INFINITY): KaraokeLine[] {
  let previousLineEnd = 0;
  return lines.map((line) => {
    const requestedStart = Number.isFinite(line.start) ? line.start : previousLineEnd;
    const start = Math.max(0, previousLineEnd, requestedStart);
    const requestedEnd = Number.isFinite(line.end) ? line.end : start + 1;
    const end = Math.min(duration, Math.max(start + 0.02, requestedEnd));

    let previousWordEnd = start;
    const words = line.words?.length
      ? line.words.map((word) => {
          const requestedWordStart = Number.isFinite(word.start) ? word.start : previousWordEnd;
          const wordStart = Math.min(end, Math.max(start, previousWordEnd, requestedWordStart));
          const requestedWordEnd = Number.isFinite(word.end) ? word.end : wordStart + 0.1;
          const wordEnd = Math.min(end, Math.max(wordStart + 0.01, requestedWordEnd));
          previousWordEnd = wordEnd;
          return { text: word.text, start: wordStart, end: wordEnd };
        })
      : retimeWords(line.text, start, end);

    previousLineEnd = end;
    return { text: line.text, start, end, words };
  });
}

export function setLineTiming(lines: KaraokeLine[], index: number, start: number, end: number) {
  return normalizeKaraokeTimeline(lines.map((line, i) => i === index
    ? { ...line, start, end, words: retimeWords(line.text, start, end) }
    : line));
}

export function setWordTiming(lines: KaraokeLine[], lineIndex: number, wordIndex: number, start: number, end: number) {
  return lines.map((line, i) => {
    if (i !== lineIndex) return line;
    const words = line.words.map((word, j) => j === wordIndex ? { ...word, start, end } : word);
    return { ...line, start: Math.min(line.start, words[0]?.start ?? line.start), end: Math.max(line.end, words.at(-1)?.end ?? line.end), words };
  });
}

export function shiftTimeline(lines: KaraokeLine[], delta: number) {
  return lines.map((line) => ({
    ...line,
    start: Math.max(0, line.start + delta),
    end: Math.max(0.01, line.end + delta),
    words: line.words.map((word) => ({
      ...word,
      start: Math.max(0, word.start + delta),
      end: Math.max(0.01, word.end + delta),
    })),
  }));
}

export function activeKaraokeLine(lines: KaraokeLine[], time: number) {
  if (!lines.length) return { line: null as KaraokeLine | null, next: null as KaraokeLine | null, index: -1 };
  const index = lines.findIndex((line) => time >= line.start && time < line.end);
  if (index >= 0) return { line: lines[index], next: lines[index + 1] ?? null, index };
  const upcoming = lines.findIndex((line) => time < line.start);
  return { line: null, next: upcoming >= 0 ? lines[upcoming] : null, index: -1 };
}

function fmtSrt(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(milli).padStart(3,'0')}`;
}

function fmtAss(seconds: number) {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(c).padStart(2,'0')}`;
}

function fmtLrc(seconds: number) {
  const cs = Math.max(0, Math.round(seconds * 100));
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(c).padStart(2,'0')}`;
}

function assEscape(text: string) {
  return text.replace(/[{}]/g, '').replace(/\n/g, '\\N');
}

export function exportSrt(lines: KaraokeLine[]) {
  return lines.map((line, index) => `${index + 1}\n${fmtSrt(line.start)} --> ${fmtSrt(line.end)}\n${line.text}\n`).join('\n');
}

export function exportEnhancedLrc(lines: KaraokeLine[]) {
  return lines.map((line) => {
    const words = line.words.map((word) => `<${fmtLrc(word.start)}>${word.text}`).join(' ');
    return `[${fmtLrc(line.start)}]${words}`;
  }).join('\n');
}

export function exportAss(lines: KaraokeLine[]) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Karaoke,Arial,48,&H00FFFFFF,&H00F0ABFC,&H00101018,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,42,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`;
  const events = lines.map((line) => {
    const text = line.words.map((word) => {
      const centiseconds = Math.max(1, Math.round((word.end - word.start) * 100));
      return `{\\k${centiseconds}}${assEscape(word.text)}`;
    }).join(' ');
    return `Dialogue: 0,${fmtAss(line.start)},${fmtAss(line.end)},Karaoke,,0,0,0,,${text}`;
  });
  return [header, ...events].join('\n');
}

export function parseKaraokeJson(value: string): KaraokeLine[] {
  const parsed = JSON.parse(value);
  const lines = Array.isArray(parsed) ? parsed : parsed?.lines;
  if (!Array.isArray(lines)) throw new Error('JSON karaoke phải là mảng lines.');
  return normalizeKaraokeTimeline(lines.map((line: any) => ({
    text: String(line.text ?? ''),
    start: Number(line.start),
    end: Number(line.end),
    words: Array.isArray(line.words) ? line.words.map((word: any) => ({
      text: String(word.text ?? ''),
      start: Number(word.start),
      end: Number(word.end),
    })) : [],
  })).filter((line: KaraokeLine) => line.text.trim()));
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
}

function drawWordLine(ctx: CanvasRenderingContext2D, line: KaraokeLine, time: number, centerX: number, baselineY: number, maxWidth: number) {
  const gap = 14;
  ctx.font = '700 42px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'alphabetic';
  const widths = line.words.map((word) => ctx.measureText(word.text).width);
  const fullWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  const fontSize = Math.max(24, Math.floor(42 * Math.min(1, maxWidth / Math.max(1, fullWidth))));
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const measured = line.words.map((word) => ctx.measureText(word.text).width);
  let x = centerX - (measured.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, measured.length - 1)) / 2;

  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    const width = measured[i];
    const progress = word.end <= word.start ? (time >= word.end ? 1 : 0) : Math.max(0, Math.min(1, (time - word.start) / (word.end - word.start)));
    ctx.lineWidth = Math.max(4, fontSize * 0.12); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.9)';
    ctx.strokeText(word.text, x, baselineY);
    ctx.fillStyle = 'rgba(255,255,255,.84)'; ctx.fillText(word.text, x, baselineY);
    if (progress > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x - 2, baselineY - fontSize * 1.15, (width + 4) * progress, fontSize * 1.5); ctx.clip();
      ctx.fillStyle = '#f0abfc'; ctx.fillText(word.text, x, baselineY); ctx.restore();
    }
    x += width + gap;
  }
}

export function drawKaraokeOverlay(ctx: CanvasRenderingContext2D, lines: KaraokeLine[], time: number, width: number, height: number) {
  const { line, next } = activeKaraokeLine(lines, time);
  if (!line && !next) return;
  const panelWidth = Math.min(width - 96, 1120), panelHeight = 154;
  const panelX = (width - panelWidth) / 2, panelY = height - panelHeight - 42;
  ctx.save(); roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 28); ctx.fillStyle = 'rgba(8,8,18,.68)'; ctx.fill();
  if (line) drawWordLine(ctx, line, time, width / 2, panelY + 66, panelWidth - 64);
  if (next) {
    ctx.font = '600 26px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,255,255,.42)';
    const nextText = next.text.length > 86 ? `${next.text.slice(0,83)}…` : next.text;
    ctx.fillText(nextText, width / 2, panelY + 119, panelWidth - 64); ctx.textAlign = 'start';
  }
  ctx.restore();
}
