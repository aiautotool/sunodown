import type { StudioPreset, StudioPresetConfig } from './studio-presets';

export type VisualParityReport = {
  ok: boolean;
  fingerprint: string;
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
  return JSON.stringify(value);
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

export function normalizeVisualSnapshot(config: StudioPresetConfig): StudioPresetConfig {
  return {
    template: config.template,
    wave: config.wave,
    motion: config.motion,
    aspect: config.aspect,
    lyrics: config.lyrics,
    effects: [...config.effects].sort(),
    layout: structuredClone(config.layout),
    textStyles: structuredClone(config.textStyles),
    subtitleStyle: structuredClone(config.subtitleStyle),
    background: structuredClone(config.background),
  };
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

export function comparePreviewAndRender(
  preview: StudioPresetConfig,
  render: StudioPresetConfig,
): VisualParityReport {
  const a = normalizeVisualSnapshot(preview);
  const b = normalizeVisualSnapshot(render);
  const issues: string[] = [];

  comparePath(issues, 'template', a.template, b.template);
  comparePath(issues, 'wave', a.wave, b.wave);
  comparePath(issues, 'motion', a.motion, b.motion);
  comparePath(issues, 'aspect', a.aspect, b.aspect);
  comparePath(issues, 'lyrics', a.lyrics, b.lyrics);
  comparePath(issues, 'effects', a.effects, b.effects);
  comparePath(issues, 'layout', a.layout, b.layout);
  comparePath(issues, 'textStyles', a.textStyles, b.textStyles);
  comparePath(issues, 'subtitleStyle', a.subtitleStyle, b.subtitleStyle);
  comparePath(issues, 'background', a.background, b.background);

  return {
    ok: issues.length === 0,
    fingerprint: visualFingerprint(a),
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
