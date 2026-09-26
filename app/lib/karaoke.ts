import { lyricLinesForKaraoke } from '../../components/v4/lyrics-clean.ts';
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

export function visibleLyricLines(lyrics: string) {
  return lyricLinesForKaraoke(lyrics);
}
function wordWeight(word: string) {
  const normalized = word.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');
  return Math.max(1, Array.from(normalized).length);
}
function retimeWords(text: string, start: number, end: number): KaraokeWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const duration = Math.max(0.05, end - start),
    total = words.reduce((s, w) => s + wordWeight(w), 0);
  let cursor = start;
  return words.map((word, index) => {
    const wordEnd =
      index === words.length - 1
        ? end
        : Math.min(end, cursor + duration * (wordWeight(word) / total));
    const result = {
      text: word,
      start: cursor,
      end: Math.max(cursor + 0.01, wordEnd),
    };
    cursor = result.end;
    return result;
  });
}
export function buildEstimatedKaraokeTimeline(
  lyrics: string,
  duration: number,
): KaraokeLine[] {
  const lines = visibleLyricLines(lyrics);
  if (!lines.length || !Number.isFinite(duration) || duration <= 0) return [];
  const intro = Math.min(12, Math.max(1.8, duration * 0.05));
  const outro = Math.min(6, Math.max(1, duration * 0.02));
  const usable = Math.max(1, duration - intro - outro);
  const weights = lines.map((text) =>
    Math.max(
      1,
      text.split(/\s+/).reduce((s, w) => s + wordWeight(w), 0),
    ),
  );
  const rawTotal = weights.reduce((s, v) => s + v, 0);
  const minGap = 0.12;
  const lyricBudget = Math.max(
    1,
    usable - minGap * Math.max(0, lines.length - 1),
  );
  let cursor = intro;
  return lines.map((text, index) => {
    const natural = lyricBudget * (weights[index] / rawTotal);
    const share = Math.min(Math.max(natural, 0.9), 8);
    const start = cursor;
    const hardEnd = duration - outro;
    const end =
      index === lines.length - 1
        ? Math.max(start + 0.2, hardEnd)
        : Math.min(hardEnd, start + share);
    cursor = Math.min(hardEnd, end + minGap);
    return { text, start, end, words: retimeWords(text, start, end) };
  });
}
export function timelineFromLineStarts(
  lyrics: string,
  starts: number[],
  duration: number,
): KaraokeLine[] {
  const lines = visibleLyricLines(lyrics);
  if (!lines.length) return [];
  return lines.map((text, index) => {
    const start = Math.max(0, starts[index] ?? 0),
      next = starts[index + 1],
      end = Math.max(start + 0.08, Number.isFinite(next) ? next : duration);
    return { text, start, end, words: retimeWords(text, start, end) };
  });
}
export function normalizeKaraokeTimeline(
  lines: KaraokeLine[],
  duration = Number.POSITIVE_INFINITY,
): KaraokeLine[] {
  const limit = Number.isFinite(duration)
    ? Math.max(0, duration)
    : Number.POSITIVE_INFINITY;
  const normalized = lines
    .map((line) => {
      const start = Math.min(
          limit,
          Math.max(0, Number.isFinite(line.start) ? line.start : 0),
        ),
        end = Math.min(
          limit,
          Math.max(
            start + 0.02,
            Number.isFinite(line.end) ? line.end : start + 1,
          ),
        );
      return {
        ...line,
        start,
        end,
        words: line.words?.length
          ? line.words.map((word) => ({ ...word }))
          : retimeWords(line.text, start, end),
      };
    })
    .sort((a, b) => a.start - b.start);
  // Clip only the earlier line at an overlap. Moving later vocal anchors caused
  // small recognition errors to accumulate into visible drift across the song.
  for (let i = 0; i < normalized.length - 1; i++) {
    const line = normalized[i],
      next = normalized[i + 1];
    if (line.end > next.start)
      line.end = Math.max(line.start + 0.02, next.start - 0.02);
  }
  return normalized.map((line) => {
    let cursor = line.start;
    const words = line.words.map((word, index) => {
      const start = Math.min(line.end, Math.max(cursor, word.start)),
        end = Math.min(line.end, Math.max(start + 0.01, word.end));
      cursor = end;
      return {
        ...word,
        start,
        end:
          index === line.words.length - 1
            ? Math.min(line.end, Math.max(end, word.end))
            : end,
      };
    });
    return { ...line, words };
  });
}
export function setLineTiming(
  lines: KaraokeLine[],
  index: number,
  start: number,
  end: number,
) {
  return normalizeKaraokeTimeline(
    lines.map((line, i) =>
      i === index
        ? { ...line, start, end, words: retimeWords(line.text, start, end) }
        : line,
    ),
  );
}
export function setWordTiming(
  lines: KaraokeLine[],
  lineIndex: number,
  wordIndex: number,
  start: number,
  end: number,
) {
  return lines.map((line, i) => {
    if (i !== lineIndex) return line;
    const words = line.words.map((word, j) =>
      j === wordIndex ? { ...word, start, end } : word,
    );
    return {
      ...line,
      start: Math.min(line.start, words[0]?.start ?? line.start),
      end: Math.max(line.end, words.at(-1)?.end ?? line.end),
      words,
    };
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
  if (!lines.length)
    return {
      line: null as KaraokeLine | null,
      next: null as KaraokeLine | null,
      index: -1,
    };
  const index = lines.findIndex(
    (line) => time >= line.start && time < line.end,
  );
  if (index >= 0)
    return { line: lines[index], next: lines[index + 1] ?? null, index };
  const upcoming = lines.findIndex((line) => time < line.start);
  return {
    line: null,
    next: upcoming >= 0 ? lines[upcoming] : null,
    index: -1,
  };
}
function fmtSrt(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000)),
    h = Math.floor(ms / 3600000),
    m = Math.floor((ms % 3600000) / 60000),
    s = Math.floor((ms % 60000) / 1000),
    milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}
function fmtAss(seconds: number) {
  const cs = Math.max(0, Math.round(seconds * 100)),
    h = Math.floor(cs / 360000),
    m = Math.floor((cs % 360000) / 6000),
    s = Math.floor((cs % 6000) / 100),
    c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
function fmtLrc(seconds: number) {
  const cs = Math.max(0, Math.round(seconds * 100)),
    m = Math.floor(cs / 6000),
    s = Math.floor((cs % 6000) / 100),
    c = cs % 100;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
function assEscape(text: string) {
  return text.replace(/[{}]/g, '').replace(/\n/g, '\\N');
}
function fmtVtt(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000)),
    h = Math.floor(ms / 3600000),
    m = Math.floor((ms % 3600000) / 60000),
    s = Math.floor((ms % 60000) / 1000),
    milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}
export function exportVtt(lines: KaraokeLine[]) {
  const cues = lines
    .filter(
      (line) =>
        Number.isFinite(line.start) &&
        Number.isFinite(line.end) &&
        line.end > line.start &&
        line.text.trim(),
    )
    .map(
      (line, index) =>
        `${index + 1}\n${fmtVtt(line.start)} --> ${fmtVtt(line.end)}\n${line.text.trim()}`,
    )
    .join('\n\n');
  return `WEBVTT\n\n${cues}${cues ? '\n' : ''}`;
}
export function exportSrt(lines: KaraokeLine[]) {
  return lines
    .map(
      (line, index) =>
        `${index + 1}\n${fmtSrt(line.start)} --> ${fmtSrt(line.end)}\n${line.text}\n`,
    )
    .join('\n');
}
export function exportEnhancedLrc(lines: KaraokeLine[]) {
  return lines
    .map(
      (line) =>
        `[${fmtLrc(line.start)}]${line.words.map((word) => `<${fmtLrc(word.start)}>${word.text}`).join(' ')}`,
    )
    .join('\n');
}
export function exportAss(lines: KaraokeLine[]) {
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Karaoke,Arial,48,&H00FFFFFF,&H00F0ABFC,&H00101018,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,42,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`;
  const events = lines.map(
    (line) =>
      `Dialogue: 0,${fmtAss(line.start)},${fmtAss(line.end)},Karaoke,,0,0,0,,${line.words.map((word) => `{\\k${Math.max(1, Math.round((word.end - word.start) * 100))}}${assEscape(word.text)}`).join(' ')}`,
  );
  return [header, ...events].join('\n');
}
export function parseKaraokeJson(value: string): KaraokeLine[] {
  const parsed: unknown = JSON.parse(value),
    lines = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && 'lines' in parsed
        ? (parsed as { lines: unknown }).lines
        : null;
  if (!Array.isArray(lines))
    throw new Error('JSON karaoke phải là mảng lines.');
  return normalizeKaraokeTimeline(
    lines
      .filter(
        (line): line is Record<string, unknown> =>
          typeof line === 'object' && line !== null,
      )
      .map((line) => ({
        text: typeof line.text === 'string' ? line.text : '',
        start: Number(line.start),
        end: Number(line.end),
        words: Array.isArray(line.words)
          ? line.words
              .filter(
                (word): word is Record<string, unknown> =>
                  typeof word === 'object' && word !== null,
              )
              .map((word) => ({
                text: typeof word.text === 'string' ? word.text : '',
                start: Number(word.start),
                end: Number(word.end),
              }))
          : [],
      }))
      .filter((line: KaraokeLine) => line.text.trim()),
  );
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
export type KaraokeDrawStyle = {
  color?: string;
  activeColor?: string;
  background?: string;
  backgroundOpacity?: number;
  fontSize?: number;
  font?: 'system' | 'serif' | 'rounded' | 'mono' | 'impact';
  bold?: boolean;
  shadow?: boolean;
  outline?: boolean;
  radius?: number;
};
const KARAOKE_FONTS: Record<NonNullable<KaraokeDrawStyle['font']>, string> = {
  system:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: '"Trebuchet MS", Arial, sans-serif',
  mono: '"Courier New", monospace',
  impact: 'Impact, "Arial Black", sans-serif',
};
function drawWordLine(
  ctx: CanvasRenderingContext2D,
  line: KaraokeLine,
  time: number,
  centerX: number,
  baselineY: number,
  maxWidth: number,
  style: KaraokeDrawStyle = {},
) {
  const gap = 14,
    scale = Math.max(0.6, Math.min(1.8, (style.fontSize || 100) / 100)),
    weight = style.bold === false ? 500 : 700,
    font = KARAOKE_FONTS[style.font || 'system'];
  ctx.font = `${weight} ${42 * scale}px ${font}`;
  ctx.textBaseline = 'alphabetic';
  const widths = line.words.map((word) => ctx.measureText(word.text).width),
    fullWidth =
      widths.reduce((s, w) => s + w, 0) + gap * Math.max(0, widths.length - 1),
    fontSize = Math.max(
      20,
      Math.floor(42 * scale * Math.min(1, maxWidth / Math.max(1, fullWidth))),
    );
  ctx.font = `${weight} ${fontSize}px ${font}`;
  const measured = line.words.map((word) => ctx.measureText(word.text).width);
  let x =
    centerX -
    (measured.reduce((s, w) => s + w, 0) +
      gap * Math.max(0, measured.length - 1)) /
      2;
  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i],
      width = measured[i],
      progress =
        word.end <= word.start
          ? time >= word.end
            ? 1
            : 0
          : Math.max(
              0,
              Math.min(1, (time - word.start) / (word.end - word.start)),
            );
    ctx.lineWidth = Math.max(3, fontSize * 0.1);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.9)';
    ctx.shadowColor =
      style.shadow === false ? 'transparent' : 'rgba(0,0,0,.85)';
    ctx.shadowBlur = style.shadow === false ? 0 : 12;
    if (style.outline !== false) ctx.strokeText(word.text, x, baselineY);
    ctx.fillStyle = style.color || '#fff';
    ctx.fillText(word.text, x, baselineY);
    if (progress > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        x - 2,
        baselineY - fontSize * 1.15,
        (width + 4) * progress,
        fontSize * 1.5,
      );
      ctx.clip();
      ctx.fillStyle = style.activeColor || '#f0abfc';
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
  style: KaraokeDrawStyle = {},
) {
  const { line, next } = activeKaraokeLine(lines, time);
  // Never pre-roll the upcoming lyric. During intro/instrumental gaps there is
  // no active cue, so the preview must stay completely subtitle-free. The
  // upcoming line is only shown as secondary context while a current line is
  // actually active.
  if (!line) return;
  const panelWidth = Math.min(width - 96, 1120),
    panelHeight = 154,
    panelX = (width - panelWidth) / 2,
    panelY = height - panelHeight - 42;
  ctx.save();
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, style.radius ?? 28);
  const bg = style.background || '#080812',
    a = Math.max(0, Math.min(1, (style.backgroundOpacity ?? 68) / 100));
  ctx.fillStyle = bg;
  ctx.globalAlpha = a;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (line)
    drawWordLine(
      ctx,
      line,
      time,
      width / 2,
      panelY + 66,
      panelWidth - 64,
      style,
    );
  if (next) {
    const font = KARAOKE_FONTS[style.font || 'system'];
    ctx.font = `600 26px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    const nextText =
      next.text.length > 86 ? `${next.text.slice(0, 83)}…` : next.text;
    ctx.fillText(nextText, width / 2, panelY + 119, panelWidth - 64);
    ctx.textAlign = 'start';
  }
  ctx.restore();
}

export type RoughWord = { text: string; start: number; end: number };
function normalizeToken(value: string) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/[^\p{L}\p{N}]/gu, '');
}
function tokenSimilarity(a: string, b: string) {
  const x = normalizeToken(a),
    y = normalizeToken(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const rows = x.length + 1,
    cols = y.length + 1,
    dp = Array.from({ length: rows }, () =>
      Array.from<number>({ length: cols }).fill(0),
    );
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++)
    for (let j = 1; j < cols; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
  return 1 - dp[x.length][y.length] / Math.max(x.length, y.length);
}
export function alignRoughWordsToLyrics(
  lyrics: string,
  roughWords: RoughWord[],
  duration: number,
): KaraokeLine[] {
  const lines = visibleLyricLines(lyrics),
    lyricTokens: Array<{ text: string; line: number }> = [],
    lineTokenIndexes: number[][] = [];
  lines.forEach((line, lineIndex) => {
    const indexes: number[] = [];
    line
      .split(/\s+/)
      .filter(Boolean)
      .forEach((text) => {
        indexes.push(lyricTokens.length);
        lyricTokens.push({ text, line: lineIndex });
      });
    lineTokenIndexes.push(indexes);
  });
  const asr = roughWords
    .filter(
      (word) =>
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end >= word.start,
    )
    .map((word) => ({ ...word, text: word.text.trim() }))
    .filter((word) => word.text);
  if (!lyricTokens.length) return [];
  if (!asr.length) return buildEstimatedKaraokeTimeline(lyrics, duration);
  const frequencies = new Map<string, number>();
  for (const token of lyricTokens) {
    const key = normalizeToken(token.text);
    frequencies.set(key, (frequencies.get(key) || 0) + 1);
  }
  const n = lyricTokens.length,
    m = asr.length,
    gap = -0.72;
  let prev = Array.from({ length: m + 1 }, (_, j) => j * gap);
  const back = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let j = 1; j <= m; j++) back[0][j] = 2;
  for (let i = 1; i <= n; i++) {
    const cur = Array.from<number>({ length: m + 1 }).fill(0);
    cur[0] = i * gap;
    back[i][0] = 1;
    for (let j = 1; j <= m; j++) {
      const sim = tokenSimilarity(lyricTokens[i - 1].text, asr[j - 1].text),
        key = normalizeToken(lyricTokens[i - 1].text),
        rarity = 1 / Math.sqrt(frequencies.get(key) || 1),
        previousContext =
          i > 1 && j > 1
            ? tokenSimilarity(lyricTokens[i - 2].text, asr[j - 2].text)
            : 0,
        nextContext =
          i < n && j < m
            ? tokenSimilarity(lyricTokens[i].text, asr[j].text)
            : 0,
        // Common one-word anchors (anh/em/mình/yêu) are weak. Consecutive
        // context and rare words must win before an anchor can move a line.
        match =
          prev[j - 1] +
          (2 * sim - 0.9) * (0.72 + 0.28 * rarity) +
          0.24 * Math.max(previousContext, nextContext),
        skipLyric = prev[j] + gap,
        skipAsr = cur[j - 1] + gap;
      if (match >= skipLyric && match >= skipAsr) {
        cur[j] = match;
        back[i][j] = 0;
      } else if (skipLyric >= skipAsr) {
        cur[j] = skipLyric;
        back[i][j] = 1;
      } else {
        cur[j] = skipAsr;
        back[i][j] = 2;
      }
    }
    prev = cur;
  }
  const matches: Array<number | null> = Array.from({ length: n }, () => null);
  let i = n,
    j = m;
  while (i > 0 || j > 0) {
    const step = back[i]?.[j] ?? 0;
    if (i > 0 && j > 0 && step === 0) {
      if (tokenSimilarity(lyricTokens[i - 1].text, asr[j - 1].text) >= 0.58)
        matches[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || step === 1)) i--;
    else j--;
  }
  const lineAnchors = lines.map((text, lineIndex) => {
    const indexes = lineTokenIndexes[lineIndex];
    const matched = indexes
      .map((index) => matches[index])
      .filter((value): value is number => value != null);
    if (!matched.length) return null;
    return { start: asr[matched[0]].start, end: asr[matched.at(-1)!].end };
  });
  if (!lineAnchors.some(Boolean))
    return buildEstimatedKaraokeTimeline(lyrics, duration);

  const built = lines.map((text, lineIndex) => {
    const indexes = lineTokenIndexes[lineIndex],
      anchor = lineAnchors[lineIndex];
    let start: number, end: number;
    if (anchor) {
      start = Math.max(0, anchor.start - 0.06);
      // Preserve the ASR end of a sustained word, but do not consume an
      // instrumental pause by extending to the next recognized token.
      end = Math.min(duration, Math.max(start + 0.12, anchor.end + 0.12));
    } else {
      const previous = lineAnchors.slice(0, lineIndex).findLast(Boolean);
      const next = lineAnchors.slice(lineIndex + 1).find(Boolean);
      const wordCount = Math.max(1, indexes.length),
        estimated = Math.min(4.5, Math.max(0.65, wordCount * 0.28));
      const low = previous ? previous.end + 0.12 : 0,
        high = next ? next.start - 0.12 : duration;
      start = Math.max(0, Math.min(low, high - estimated));
      end = Math.min(
        duration,
        Math.max(start + 0.12, Math.min(high, start + estimated)),
      );
    }
    const words = retimeWords(text, start, end);
    const anchoredIndexes: number[] = [];
    for (let wordIndex = 0; wordIndex < indexes.length; wordIndex++) {
      const asrIndex = matches[indexes[wordIndex]];
      if (asrIndex == null) continue;
      const recognized = asr[asrIndex];
      words[wordIndex] = {
        text: words[wordIndex].text,
        start: Math.max(start, recognized.start - 0.025),
        end: Math.min(end, Math.max(recognized.start + 0.03, recognized.end)),
      };
      anchoredIndexes.push(wordIndex);
    }
    // Interpolate missing words only inside this line. Never spread them over
    // a multi-second musical break between unrelated anchors.
    const boundaries = [-1, ...anchoredIndexes, words.length];
    for (let b = 0; b < boundaries.length - 1; b++) {
      const left = boundaries[b],
        right = boundaries[b + 1],
        count = right - left - 1;
      if (count <= 0) continue;
      const low = left >= 0 ? words[left].end : start,
        high = right < words.length ? words[right].start : end;
      const available = Math.max(0.04 * count, high - low),
        step = available / count;
      for (let k = 0; k < count; k++) {
        const index = left + 1 + k,
          wordStart = low + step * k,
          wordEnd = Math.min(
            high,
            Math.max(wordStart + 0.02, low + step * (k + 1)),
          );
        words[index] = { ...words[index], start: wordStart, end: wordEnd };
      }
    }
    return { text, start, end, words };
  });
  return normalizeKaraokeTimeline(built, duration);
}
