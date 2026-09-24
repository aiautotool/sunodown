import type { StudioPreset, StudioPresetConfig } from './studio-presets';
import { clonePresetConfig } from './studio-presets';

export type PresetApplyMode = 'replace-all' | 'preserve-custom';

export type PresetApplyTransaction = {
  presetId: string;
  mode: PresetApplyMode;
  before: StudioPresetConfig;
  next: StudioPresetConfig;
  modified: boolean;
};

export type PresetVisualStateSetters = {
  setTemplate: (value: StudioPresetConfig['template']) => void;
  setWave: (value: StudioPresetConfig['wave']) => void;
  setMotion: (value: StudioPresetConfig['motion']) => void;
  setAspect: (value: StudioPresetConfig['aspect']) => void;
  setLyrics: (value: StudioPresetConfig['lyrics']) => void;
  setEffects: (value: StudioPresetConfig['effects']) => void;
  setLayout: (value: StudioPresetConfig['layout']) => void;
  setTextStyles: (value: StudioPresetConfig['textStyles']) => void;
  setSubtitleStyle: (value: StudioPresetConfig['subtitleStyle']) => void;
  setBackground: (value: StudioPresetConfig['background']) => void;
};

const isCustomMediaBackground = (config: StudioPresetConfig) =>
  (config.background.mode === 'image' && Boolean(config.background.imageUrl)) ||
  (config.background.mode === 'video' && Boolean(config.background.videoUrl));

/**
 * Produces one immutable transaction for applying a preset. Creator Studio can
 * commit `next` to React state in one batch and keep `before` for Undo.
 *
 * preserve-custom deliberately keeps all user-positioned overlays, typography,
 * subtitle styling and background media. The preset still changes the visual
 * template, waveform, motion, aspect, lyrics mode and effects.
 */
export function createPresetApplyTransaction(
  current: StudioPresetConfig,
  preset: StudioPreset,
  mode: PresetApplyMode = 'replace-all',
): PresetApplyTransaction {
  const before = clonePresetConfig(current);
  const next = clonePresetConfig(preset.config);

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
  };
}

/**
 * Commits a complete immutable visual snapshot through one shared path. React
 * batches these setters in an event, so LivePreview never has a second apply
 * implementation that can drift from Undo/reset/import.
 */
export function commitPresetVisualState(
  config: StudioPresetConfig,
  setters: PresetVisualStateSetters,
) {
  const next = clonePresetConfig(config);
  setters.setTemplate(next.template);
  setters.setWave(next.wave);
  setters.setMotion(next.motion);
  setters.setAspect(next.aspect);
  setters.setLyrics(next.lyrics);
  setters.setEffects([...next.effects]);
  setters.setLayout(structuredClone(next.layout));
  setters.setTextStyles(structuredClone(next.textStyles));
  setters.setSubtitleStyle(structuredClone(next.subtitleStyle));
  setters.setBackground(structuredClone(next.background));
  return next;
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
  }
  return { ok: issues.length === 0, issues };
}
