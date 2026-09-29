import type { WaveAppearance, WaveStyle } from './types';

export type SignatureWaveStyle =
  | 'mirror-glow'
  | 'rounded-spectrum'
  | 'circular-pulse'
  | 'ribbon-wave';

type Geometry = {
  ph: number;
  usable: number;
  start: number;
  cy: number;
  max: number;
};

const SIGNATURE = new Set<WaveStyle>([
  'mirror-glow',
  'rounded-spectrum',
  'circular-pulse',
  'ribbon-wave',
]);

export function isSignatureWaveStyle(style: WaveStyle): style is SignatureWaveStyle {
  return SIGNATURE.has(style);
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function sample(values: number[], ratio: number) {
  if (!values.length) return 0;
  const position = clamp01(ratio) * (values.length - 1);
  const lo = Math.floor(position);
  const hi = Math.min(values.length - 1, lo + 1);
  const mix = position - lo;
  return values[lo] * (1 - mix) + values[hi] * mix;
}

function makeGradient(
  ctx: CanvasRenderingContext2D,
  start: number,
  width: number,
  color: string,
  color2: string,
) {
  const gradient = ctx.createLinearGradient(start, 0, start + width, 0);
  gradient.addColorStop(0, color2);
  gradient.addColorStop(0.24, color);
  gradient.addColorStop(0.5, '#f6efff');
  gradient.addColorStop(0.73, color2);
  gradient.addColorStop(1, color);
  return gradient;
}

function smoothPath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    const midX = (point.x + next.x) / 2;
    const midY = (point.y + next.y) / 2;
    ctx.quadraticCurveTo(point.x, point.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function deterministicNoise(index: number, time: number, seed = 0) {
  const x =
    Math.sin(index * 12.9898 + seed * 31.416 + Math.floor(time * 5) * 0.071) *
    43758.5453;
  return x - Math.floor(x);
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  t: number,
  start: number,
  usable: number,
  cy: number,
  height: number,
  energy: number,
  color: string,
  count = 32,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < count; index += 1) {
    const ratio = deterministicNoise(index, 0, 3);
    const drift = Math.sin(t * (0.25 + (index % 5) * 0.035) + index * 1.91);
    const x = start + ratio * usable + drift * 8;
    const spread = (deterministicNoise(index, 0, 8) - 0.5) * height * 1.7;
    const y = cy + spread + Math.sin(t * 0.5 + index) * 4;
    const pulse = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.7 + index * 0.83));
    const radius = 0.8 + deterministicNoise(index, 0, 11) * 2.2 + energy * 1.2;
    ctx.globalAlpha = (0.1 + energy * 0.24) * pulse;
    ctx.fillStyle = index % 3 === 0 ? '#ffffff' : color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + energy * 16;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMirrorGlow(
  ctx: CanvasRenderingContext2D,
  values: number[],
  t: number,
  geometry: Geometry,
  look: WaveAppearance,
) {
  const { start, usable, cy, max } = geometry;
  const count = Math.max(48, Math.min(88, values.length));
  const pointsTop: Array<{ x: number; y: number }> = [];
  const pointsBottom: Array<{ x: number; y: number }> = [];
  let energy = 0;

  for (let index = 0; index < count; index += 1) {
    const ratio = index / Math.max(1, count - 1);
    const v = sample(values, ratio);
    const envelope = 0.45 + 0.55 * Math.sin(ratio * Math.PI);
    const living = Math.sin(t * 2.2 + ratio * Math.PI * 7.5) * 0.045;
    const amp = max * Math.max(0.08, v + living) * 1.06 * envelope;
    const x = start + ratio * usable;
    pointsTop.push({ x, y: cy - amp });
    pointsBottom.push({ x, y: cy + amp });
    energy += v;
  }
  energy /= count;

  const gradient = makeGradient(ctx, start, usable, look.color, look.color2);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Wide aura pass.
  ctx.strokeStyle = gradient;
  ctx.globalAlpha = 0.13 * (look.opacity / 100);
  ctx.lineWidth = 22 + look.glow * 0.12;
  ctx.shadowColor = look.color2;
  ctx.shadowBlur = 20 + look.glow * 0.55;
  smoothPath(ctx, pointsTop);
  ctx.stroke();
  smoothPath(ctx, pointsBottom);
  ctx.stroke();

  // Secondary luminous body.
  ctx.globalAlpha = 0.36 * (look.opacity / 100);
  ctx.lineWidth = 9;
  ctx.shadowBlur = 13 + look.glow * 0.32;
  smoothPath(ctx, pointsTop);
  ctx.stroke();
  smoothPath(ctx, pointsBottom);
  ctx.stroke();

  // Crisp glass core.
  ctx.globalAlpha = 0.95 * (look.opacity / 100);
  ctx.lineWidth = 2.25;
  ctx.shadowBlur = 9 + look.glow * 0.16;
  smoothPath(ctx, pointsTop);
  ctx.stroke();
  smoothPath(ctx, pointsBottom);
  ctx.stroke();

  // Bright center seam.
  const seam = ctx.createLinearGradient(start, 0, start + usable, 0);
  seam.addColorStop(0, look.color2);
  seam.addColorStop(0.5, '#ffffff');
  seam.addColorStop(1, look.color);
  ctx.strokeStyle = seam;
  ctx.globalAlpha = 0.72 * (look.opacity / 100);
  ctx.lineWidth = 1.2;
  ctx.shadowBlur = 10 + look.glow * 0.12;
  ctx.beginPath();
  ctx.moveTo(start, cy);
  ctx.lineTo(start + usable, cy);
  ctx.stroke();

  ctx.restore();
  drawParticles(
    ctx,
    t,
    start,
    usable,
    cy,
    max * 1.15,
    energy,
    look.color2,
    Math.round(24 + look.density * 0.18),
  );
}

function drawRoundedSpectrum(
  ctx: CanvasRenderingContext2D,
  values: number[],
  t: number,
  geometry: Geometry,
  look: WaveAppearance,
) {
  const { start, usable, cy, max } = geometry;
  const count = Math.max(24, Math.min(44, Math.round(22 + look.density * 0.22)));
  const gap = usable * 0.008;
  const barWidth = Math.max(5, (usable - gap * (count - 1)) / count);
  const baseline = cy + max * 0.25;
  const gradient = makeGradient(ctx, start, usable, look.color, look.color2);
  let energy = 0;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gradient;
  ctx.shadowColor = look.color2;
  ctx.shadowBlur = 8 + look.glow * 0.28;

  for (let index = 0; index < count; index += 1) {
    const ratio = index / Math.max(1, count - 1);
    const v = sample(values, ratio);
    const beatLift = 0.88 + Math.abs(Math.sin(t * 3.2 + index * 0.31)) * 0.12;
    const height = Math.max(9, max * (0.2 + v * 1.7) * beatLift);
    const x = start + index * (barWidth + gap);
    const radius = Math.min(barWidth / 2, 8);
    energy += v;

    ctx.globalAlpha = (0.72 + v * 0.26) * (look.opacity / 100);
    ctx.beginPath();
    ctx.roundRect(x, baseline - height, barWidth, height, radius);
    ctx.fill();

    // Softer mirrored reflection.
    ctx.globalAlpha = (0.08 + v * 0.11) * (look.opacity / 100);
    ctx.beginPath();
    ctx.roundRect(x, baseline + 4, barWidth, height * 0.32, radius);
    ctx.fill();

    // Tiny bright cap makes the bars feel glassy.
    ctx.globalAlpha = (0.34 + v * 0.32) * (look.opacity / 100);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, baseline - height, barWidth, Math.min(3.2, height), radius);
    ctx.fill();
    ctx.fillStyle = gradient;
  }

  energy /= count;
  ctx.globalAlpha = 0.34 * (look.opacity / 100);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 14 + look.glow * 0.2;
  ctx.beginPath();
  ctx.moveTo(start, baseline + 1);
  ctx.lineTo(start + usable, baseline + 1);
  ctx.stroke();
  ctx.restore();

  drawParticles(
    ctx,
    t,
    start,
    usable,
    baseline - max * 0.42,
    max * 0.72,
    energy,
    look.color,
    Math.round(12 + look.density * 0.1),
  );
}

function drawCircularPulse(
  ctx: CanvasRenderingContext2D,
  values: number[],
  t: number,
  geometry: Geometry,
  look: WaveAppearance,
) {
  const { cy, max } = geometry;
  const cx = geometry.start + geometry.usable * 0.5;
  const centerY = cy - max * 0.05;
  const radius = Math.max(54, Math.min(geometry.usable * 0.16, max * 1.1));
  const count = Math.max(72, Math.min(128, Math.round(68 + look.density * 0.55)));
  const gradient = makeGradient(
    ctx,
    cx - radius * 1.7,
    radius * 3.4,
    look.color,
    look.color2,
  );
  const energy = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

  ctx.save();
  ctx.translate(cx, centerY);
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';

  // Large halo.
  ctx.strokeStyle = gradient;
  ctx.globalAlpha = 0.12 * (look.opacity / 100);
  ctx.lineWidth = 18 + look.glow * 0.08;
  ctx.shadowColor = look.color2;
  ctx.shadowBlur = 22 + look.glow * 0.45;
  ctx.beginPath();
  ctx.arc(0, 0, radius * (1 + energy * 0.035), 0, Math.PI * 2);
  ctx.stroke();

  // Core rings.
  for (let ring = 0; ring < 2; ring += 1) {
    ctx.globalAlpha = (ring ? 0.34 : 0.72) * (look.opacity / 100);
    ctx.lineWidth = ring ? 2 : 4;
    ctx.shadowBlur = ring ? 8 : 16 + look.glow * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius - ring * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spectrum spikes around the ring.
  for (let index = 0; index < count; index += 1) {
    const ratio = index / count;
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    const v = sample(values, ratio);
    const pulse = 0.9 + 0.1 * Math.sin(t * 3.6 + index * 0.43);
    const inner = radius + 3;
    const length = 8 + max * (0.1 + v * 0.72) * pulse;
    const outer = inner + length;

    ctx.globalAlpha = (0.54 + v * 0.44) * (look.opacity / 100);
    ctx.lineWidth = index % 8 === 0 ? 3.1 : 1.6 + v * 1.8;
    ctx.shadowBlur = 8 + v * (10 + look.glow * 0.2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  // Dotted inner ring.
  ctx.fillStyle = '#ffffff';
  for (let index = 0; index < 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2 + t * 0.035;
    const v = sample(values, index / 48);
    const dotRadius = radius - 14;
    ctx.globalAlpha = (0.16 + v * 0.5) * (look.opacity / 100);
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * dotRadius,
      Math.sin(angle) * dotRadius,
      1.1 + v * 1.25,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Four cinematic accent rays.
  ctx.strokeStyle = '#ffffff';
  for (let accent = 0; accent < 4; accent += 1) {
    const angle = accent * (Math.PI / 2) + Math.PI / 4 + Math.sin(t * 0.3) * 0.03;
    const v = sample(values, accent / 4);
    const inner = radius + max * 0.48;
    const outer = inner + 14 + v * 25;
    ctx.globalAlpha = (0.18 + energy * 0.28) * (look.opacity / 100);
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 14 + look.glow * 0.18;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.restore();

  drawParticles(
    ctx,
    t,
    cx - radius * 1.8,
    radius * 3.6,
    centerY,
    radius * 1.8,
    energy,
    look.color2,
    Math.round(18 + look.density * 0.13),
  );
}

function drawRibbonWave(
  ctx: CanvasRenderingContext2D,
  values: number[],
  t: number,
  geometry: Geometry,
  look: WaveAppearance,
) {
  const { start, usable, cy, max } = geometry;
  const count = Math.max(56, Math.min(96, values.length));
  const gradient = makeGradient(ctx, start, usable, look.color, look.color2);
  const energy = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawRibbon = (ribbon: number) => {
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < count; index += 1) {
      const ratio = index / Math.max(1, count - 1);
      const v = sample(values, ratio);
      const envelope = 0.55 + 0.45 * Math.sin(ratio * Math.PI);
      const phase = t * (1.25 + ribbon * 0.12) + ratio * Math.PI * (4.5 + ribbon * 0.55);
      const carrier = Math.sin(phase + ribbon * 1.75);
      const secondary = Math.sin(phase * 0.48 + ribbon * 2.2);
      const amplitude = max * (0.2 + v * 0.66) * envelope;
      const x = start + ratio * usable;
      const y =
        cy +
        carrier * amplitude * (0.52 + ribbon * 0.08) +
        secondary * max * 0.11 +
        (ribbon - 1) * max * 0.06;
      points.push({ x, y });
    }

    ctx.strokeStyle = gradient;
    ctx.globalAlpha = (0.08 + ribbon * 0.025) * (look.opacity / 100);
    ctx.lineWidth = 27 - ribbon * 4 + look.glow * 0.05;
    ctx.shadowColor = ribbon === 1 ? look.color2 : look.color;
    ctx.shadowBlur = 20 + look.glow * 0.5;
    smoothPath(ctx, points);
    ctx.stroke();

    ctx.globalAlpha = (0.25 + ribbon * 0.05) * (look.opacity / 100);
    ctx.lineWidth = 11 - ribbon * 1.4;
    ctx.shadowBlur = 12 + look.glow * 0.28;
    smoothPath(ctx, points);
    ctx.stroke();

    ctx.globalAlpha = (0.64 + ribbon * 0.08) * (look.opacity / 100);
    ctx.lineWidth = 2.1 + (2 - ribbon) * 0.45;
    ctx.shadowBlur = 8 + look.glow * 0.16;
    smoothPath(ctx, points);
    ctx.stroke();
  };

  drawRibbon(0);
  drawRibbon(1);
  drawRibbon(2);
  ctx.restore();

  drawParticles(
    ctx,
    t,
    start,
    usable,
    cy,
    max * 1.45,
    energy,
    look.color2,
    Math.round(26 + look.density * 0.2),
  );
}

export function drawSignatureWaveform(
  ctx: CanvasRenderingContext2D,
  style: SignatureWaveStyle,
  values: number[],
  t: number,
  geometry: Geometry,
  appearance: WaveAppearance,
) {
  if (style === 'mirror-glow') {
    drawMirrorGlow(ctx, values, t, geometry, appearance);
    return;
  }
  if (style === 'rounded-spectrum') {
    drawRoundedSpectrum(ctx, values, t, geometry, appearance);
    return;
  }
  if (style === 'circular-pulse') {
    drawCircularPulse(ctx, values, t, geometry, appearance);
    return;
  }
  drawRibbonWave(ctx, values, t, geometry, appearance);
}
