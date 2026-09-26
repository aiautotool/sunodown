import type { StudioPreset, StudioPresetConfig } from './studio-presets';
import { clonePresetConfig, normalizePresetConfig } from './studio-presets';
import { normalizeProductionPreset, productionFingerprint, type ProductionPresetConfig } from './production-preset';

export type PresetApplyMode = 'replace-all' | 'preserve-custom';

export type PresetApplyTransaction = {
  presetId: string;
  mode: PresetApplyMode;
  before: StudioPresetConfig;
  next: StudioPresetConfig;
  modified: boolean;
  production: ProductionPresetConfig;
  productionFingerprint: string;
};

export type PresetVisualStateSetters = {
  setTemplate: (value: StudioPresetConfig['template']) => void;
  setWave: (value: StudioPresetConfig['wave']) => void;
  setWaveAppearance?: (value: NonNullable<StudioPresetConfig['waveAppearance']>) => void;
  setMotion: (value: StudioPresetConfig['motion']) => void;
  setAspect: (value: StudioPresetConfig['aspect']) => void;
  setLyrics: (value: StudioPresetConfig['lyrics']) => void;
  setEffects: (value: StudioPresetConfig['effects']) => void;
  setLayout: (value: StudioPresetConfig['layout']) => void;
  setTextStyles: (value: StudioPresetConfig['textStyles']) => void;
  setSubtitleStyle: (value: StudioPresetConfig['subtitleStyle']) => void;
  setBackground: (value: StudioPresetConfig['background']) => void;
};

export type PresetVisualCommit = {
  revision: number;
  snapshot: StudioPresetConfig;
  fingerprint: string;
};

const isCustomMediaBackground = (config: StudioPresetConfig) =>
  (config.background.mode === 'image' && Boolean(config.background.imageUrl)) ||
  (config.background.mode === 'video' && Boolean(config.background.videoUrl));

const stableVisualValue = (config: StudioPresetConfig) => ({
  template: config.template,
  wave: config.wave,
  waveAppearance: config.waveAppearance,
  motion: config.motion,
  aspect: config.aspect,
  lyrics: config.lyrics,
  effects: [...config.effects],
  layout: config.layout,
  textStyles: config.textStyles,
  subtitleStyle: config.subtitleStyle,
  background: config.background,
});

/**
 * Fingerprint of the exact snapshot that is committed to preview/render.
 * Effect order is intentionally preserved because compositing order can alter output.
 */
export function presetVisualFingerprint(config: StudioPresetConfig) {
  const value = JSON.stringify(stableVisualValue(config));
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

/**
 * Produces one immutable transaction for applying a preset. preserve-custom
 * keeps all user-positioned overlays, typography, subtitle styling and custom
 * background media while still applying the preset's visual language.
 */
export function createPresetApplyTransaction(
  current: StudioPresetConfig,
  preset: StudioPreset,
  mode: PresetApplyMode = 'replace-all',
): PresetApplyTransaction {
  const before = normalizePresetConfig(current);
  const next = normalizePresetConfig(preset.config);
  const production = normalizeProductionPreset({ mastering:preset.mastering, export:preset.export }, next.aspect);

  if (mode === 'preserve-custom') {
    next.layout = structuredClone(before.layout);
    next.textStyles = structuredClone(before.textStyles);
    next.subtitleStyle = structuredClone(before.subtitleStyle);
    next.background = structuredClone(before.background);
  }

  return {
    presetId: preset.id,
    mode,
    before,
    next,
    modified: mode === 'preserve-custom',
    production,
    productionFingerprint: productionFingerprint(production),
  };
}

/**
 * Commits a complete immutable visual snapshot through one shared path. Every
 * field is cloned before it crosses into React state so preview, Undo and render
 * cannot accidentally share/mutate preset objects.
 */
export function commitPresetVisualState(
  config: StudioPresetConfig,
  setters: PresetVisualStateSetters,
  revision = 0,
): PresetVisualCommit {
  const next = normalizePresetConfig(config);
  setters.setTemplate(next.template);
  setters.setWave(next.wave);
  if(setters.setWaveAppearance)setters.setWaveAppearance(structuredClone(next.waveAppearance!));
  setters.setMotion(next.motion);
  setters.setAspect(next.aspect);
  setters.setLyrics(next.lyrics);
  setters.setEffects([...next.effects]);
  setters.setLayout(structuredClone(next.layout));
  setters.setTextStyles(structuredClone(next.textStyles));
  setters.setSubtitleStyle(structuredClone(next.subtitleStyle));
  setters.setBackground(structuredClone(next.background));
  return {
    revision: revision + 1,
    snapshot: clonePresetConfig(next),
    fingerprint: presetVisualFingerprint(next),
  };
}

/**
 * Creates the immutable snapshot used by both LivePreview and renderer. Keeping
 * this as a first-class operation prevents either consumer from rebuilding only
 * a subset of preset state.
 */
export function createPresetVisualCommit(
  config: StudioPresetConfig,
  revision = 0,
): PresetVisualCommit {
  const snapshot = normalizePresetConfig(config);
  return {
    revision: revision + 1,
    snapshot,
    fingerprint: presetVisualFingerprint(snapshot),
  };
}

/** Guard used by the apply UI to avoid silently destroying uploaded media. */
export function shouldConfirmPresetApply(
  current: StudioPresetConfig,
  selectedPresetId: string | null,
  modified: boolean,
) {
  return Boolean(selectedPresetId && (modified || isCustomMediaBackground(current)));
}

/** Small deterministic audit used by runtime QA and future tests. */
export function auditPresetApplyTransaction(transaction: PresetApplyTransaction) {
  const issues: string[] = [];
  const { before, next, mode } = transaction;
  if (mode === 'preserve-custom') {
    if (JSON.stringify(before.layout) !== JSON.stringify(next.layout)) issues.push('layout');
    if (JSON.stringify(before.textStyles) !== JSON.stringify(next.textStyles)) issues.push('textStyles');
    if (JSON.stringify(before.subtitleStyle) !== JSON.stringify(next.subtitleStyle)) issues.push('subtitleStyle');
    if (JSON.stringify(before.background) !== JSON.stringify(next.background)) issues.push('background');
  } else if (mode === 'replace-all') {
    if (JSON.stringify(next) !== JSON.stringify(clonePresetConfig(transaction.next))) {
      issues.push('transaction');
    }
  }
  if (!transaction.production.mastering.profile) issues.push('mastering');
  if (!transaction.production.export.aspect) issues.push('export');
  return { ok: issues.length === 0, issues };
}

/**
 * Verifies that the exact full-state commit reached both preview and renderer.
 * This is deliberately stricter than checking only selected preset id.
 */
export function auditPresetVisualCommit(
  commit: PresetVisualCommit,
  preview: StudioPresetConfig,
  render: StudioPresetConfig,
) {
  const expected = commit.fingerprint;
  const previewFingerprint = presetVisualFingerprint(preview);
  const renderFingerprint = presetVisualFingerprint(render);
  const issues: string[] = [];
  if (previewFingerprint !== expected) issues.push('preview');
  if (renderFingerprint !== expected) issues.push('render');
  if (previewFingerprint !== renderFingerprint) issues.push('preview-render');
  return {
    ok: issues.length === 0,
    revision: commit.revision,
    expected,
    preview: previewFingerprint,
    render: renderFingerprint,
    issues,
  };
}
