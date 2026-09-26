import type { StudioPreset, StudioPresetConfig } from './studio-presets';
import { normalizePresetConfig } from './studio-presets';

export type VisualParityReport = {
  ok: boolean;
  fingerprint: string;
  renderFingerprint: string;
  issues: string[];
};

const REQUIRED_LAYOUT_KEYS = ['wave', 'subtitle', 'title', 'creator'] as const;
const REQUIRED_TEXT_KEYS = ['title', 'creator'] as const;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function fingerprint(value: unknown) {
  const input = stable(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Clone the exact visual state consumed by preview/render. Effect order is
 * deliberately preserved because compositing order changes the final frame.
 */
export function normalizeVisualSnapshot(config: StudioPresetConfig): StudioPresetConfig {
  return normalizePresetConfig(config);
}

export function visualFingerprint(config: StudioPresetConfig) {
  return fingerprint(normalizeVisualSnapshot(config));
}

function comparePath(
  issues: string[],
  path: string,
  preview: unknown,
  render: unknown,
) {
  if (stable(preview) !== stable(render)) issues.push(path);
}

/**
 * End-to-end visual contract between LivePreview and renderer. Keep paths
 * granular so a production mismatch points to the exact state that drifted.
 */
export function comparePreviewAndRender(
  preview: StudioPresetConfig,
  render: StudioPresetConfig,
): VisualParityReport {
  const a = normalizeVisualSnapshot(preview);
  const b = normalizeVisualSnapshot(render);
  const issues: string[] = [];

  comparePath(issues, 'template', a.template, b.template);
  comparePath(issues, 'wave', a.wave, b.wave);
  comparePath(issues, 'waveAppearance', a.waveAppearance, b.waveAppearance);
  comparePath(issues, 'motion', a.motion, b.motion);
  comparePath(issues, 'aspect', a.aspect, b.aspect);
  comparePath(issues, 'lyrics', a.lyrics, b.lyrics);
  comparePath(issues, 'effects', a.effects, b.effects);

  for (const key of REQUIRED_LAYOUT_KEYS) {
    comparePath(issues, `layout.${key}`, a.layout[key], b.layout[key]);
  }
  for (const key of REQUIRED_TEXT_KEYS) {
    comparePath(issues, `textStyles.${key}`, a.textStyles[key], b.textStyles[key]);
  }
  comparePath(issues, 'subtitleStyle', a.subtitleStyle, b.subtitleStyle);

  comparePath(issues, 'background.mode', a.background.mode, b.background.mode);
  comparePath(issues, 'background.presetId', a.background.presetId, b.background.presetId);
  comparePath(issues, 'background.imageUrl', a.background.imageUrl, b.background.imageUrl);
  comparePath(issues, 'background.videoUrl', a.background.videoUrl, b.background.videoUrl);
  comparePath(issues, 'background.fit', a.background.fit, b.background.fit);
  comparePath(issues, 'background.blur', a.background.blur, b.background.blur);
  comparePath(issues, 'background.dim', a.background.dim, b.background.dim);
  comparePath(issues, 'background.overlayOpacity', a.background.overlayOpacity, b.background.overlayOpacity);
  comparePath(issues, 'background.loopVideo', a.background.loopVideo, b.background.loopVideo);

  const previewFingerprint = visualFingerprint(a);
  const renderFingerprint = visualFingerprint(b);
  if (previewFingerprint !== renderFingerprint && issues.length === 0) {
    issues.push('fingerprint');
  }

  return {
    ok: issues.length === 0,
    fingerprint: previewFingerprint,
    renderFingerprint,
    issues,
  };
}

export function auditPresetConfig(config: Partial<StudioPresetConfig> | null | undefined) {
  const issues: string[] = [];
  if (!config) return ['config'];

  for (const key of ['template', 'wave', 'motion', 'aspect', 'lyrics'] as const) {
    if (!config[key]) issues.push(key);
  }
  if (!Array.isArray(config.effects)) issues.push('effects');

  for (const key of REQUIRED_LAYOUT_KEYS) {
    const item = config.layout?.[key];
    if (!item) {
      issues.push(`layout.${key}`);
      continue;
    }
    if (!Number.isFinite(item.x)) issues.push(`layout.${key}.x`);
    if (!Number.isFinite(item.y)) issues.push(`layout.${key}.y`);
    if (!Number.isFinite(item.scale)) issues.push(`layout.${key}.scale`);
  }

  for (const key of REQUIRED_TEXT_KEYS) {
    const item = config.textStyles?.[key];
    if (!item?.font) issues.push(`textStyles.${key}.font`);
    if (!item?.color) issues.push(`textStyles.${key}.color`);
  }

  if (!config.subtitleStyle) issues.push('subtitleStyle');

  const background = config.background;
  if (!background) {
    issues.push('background');
  } else {
    if (!background.mode) issues.push('background.mode');
    if (!background.fit) issues.push('background.fit');
    if (!Number.isFinite(background.blur)) issues.push('background.blur');
    if (!Number.isFinite(background.dim)) issues.push('background.dim');
    if (!Number.isFinite(background.overlayOpacity))
      issues.push('background.overlayOpacity');
    if (typeof background.loopVideo !== 'boolean')
      issues.push('background.loopVideo');
  }

  return issues;
}

export function auditPresetLibrary(presets: StudioPreset[]) {
  return presets.flatMap((preset) =>
    auditPresetConfig(preset.config).map((field) => `${preset.id}:${field}`),
  );
}
