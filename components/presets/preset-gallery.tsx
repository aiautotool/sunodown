'use client';

import { useMemo, useState } from 'react';
import { Copy, Download, Heart, Pencil, RefreshCw, RotateCcw, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import type { StudioPreset, StudioPresetCategory } from './studio-presets';
import type { PresetApplyMode } from './preset-apply-engine';

const aspectRatio = (aspect: StudioPreset['config']['aspect']) =>
  aspect === '9:16' ? '9 / 16' : aspect === '1:1' ? '1 / 1' : aspect === '4:5' ? '4 / 5' : aspect === '4:3' ? '4 / 3' : '16 / 9';

const backgroundLabel = (preset: StudioPreset) =>
  preset.config.background.mode === 'preset'
    ? preset.config.background.presetId || 'Preset'
    : preset.config.background.mode === 'suno'
      ? 'Suno cover'
      : preset.config.background.mode;

const waveLabel = (wave: string) => wave.replace(/-/g, ' ');

const CATEGORIES: Array<'All' | 'Favorites' | StudioPresetCategory | 'My Presets'> = [
  'All',
  'Favorites',
  'Social',
  'Lyrics',
  'Cinematic',
  'Album',
  'Visualizer',
  'My Presets',
];

export function PresetGallery({
  presets,
  selectedId,
  picture,
  favoriteIds,
  canUndo,
  modified,
  onApply,
  onToggleFavorite,
  onDuplicate,
  onRename,
  onDelete,
  onSaveCurrent,
  onUpdateCurrent,
  onResetSelected,
  onExportPreset,
  onImportPreset,
  onUndo,
}: {
  presets: StudioPreset[];
  selectedId: string | null;
  picture?: string;
  favoriteIds: string[];
  canUndo: boolean;
  modified: boolean;
  onApply: (preset: StudioPreset, mode: PresetApplyMode) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (preset: StudioPreset) => void;
  onRename: (preset: StudioPreset, name: string) => void;
  onDelete: (preset: StudioPreset) => void;
  onSaveCurrent: (name: string) => void;
  onUpdateCurrent: (preset: StudioPreset) => void;
  onResetSelected: (preset: StudioPreset) => void;
  onExportPreset: (preset: StudioPreset) => void;
  onImportPreset: (file: File) => void;
  onUndo: () => void;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [pendingPreset, setPendingPreset] = useState<StudioPreset | null>(null);
  const selectedPreset = presets.find((preset) => preset.id === selectedId) || null;

  const requestApply = (preset: StudioPreset) => {
    if (selectedId === preset.id && !modified) return;
    // Always make the destructive boundary explicit. This also protects a
    // manually uploaded image/video background when no preset is marked modified.
    setPendingPreset(preset);
  };
  const visible = useMemo(
    () =>
      presets
        .filter((preset) =>
          category === 'All'
            ? true
            : category === 'Favorites'
              ? favoriteIds.includes(preset.id)
              : category === 'My Presets'
                ? !preset.builtin
                : preset.category === category,
        )
        .sort((a, b) => {
          if (category !== 'All') return 0;
          return Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id));
        }),
    [category, presets, favoriteIds],
  );

  return (
    <section className="sd-preset-system">
      <div className="sd-preset-head">
        <div>
          <span><Sparkles /> Smart Presets</span>
          <b>One tap changes the whole video {modified && selectedId ? '· Modified' : ''}</b>
        </div>
        <div className="sd-preset-head-actions">
          {modified && selectedPreset && (
            <button
              onClick={() => onResetSelected(selectedPreset)}
              title="Reset to saved preset"
            >
              <RefreshCw /> Reset
            </button>
          )}
          {modified && selectedPreset && !selectedPreset.builtin && (
            <button
              className="primary"
              onClick={() => onUpdateCurrent(selectedPreset)}
              title="Update this custom preset"
            >
              <Save /> Update
            </button>
          )}
          {canUndo && (
            <button onClick={onUndo} title="Undo preset">
              <RotateCcw /> Undo
            </button>
          )}
          {selectedPreset && (
            <button onClick={() => onExportPreset(selectedPreset)} title="Export preset">
              <Download /> Export
            </button>
          )}
          <label className="sd-preset-import" title="Import preset">
            <Upload /> Import
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImportPreset(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <button onClick={() => setSaving((value) => !value)}>
            <Save /> Save new
          </button>
        </div>
      </div>

      {saving && (
        <div className="sd-preset-save">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Preset name"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) {
                onSaveCurrent(name.trim());
                setName('');
                setSaving(false);
              }
            }}
          />
          <button
            disabled={!name.trim()}
            onClick={() => {
              if (!name.trim()) return;
              onSaveCurrent(name.trim());
              setName('');
              setSaving(false);
            }}
          >
            Save preset
          </button>
        </div>
      )}

      {pendingPreset && (
        <div
          className="sd-preset-apply-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingPreset(null);
          }}
        >
          <div
            className="sd-preset-apply-choice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sd-preset-apply-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setPendingPreset(null);
            }}
          >
            <button
              className="sd-preset-dialog-close"
              aria-label="Close"
              onClick={() => setPendingPreset(null)}
            >
              ×
            </button>
            <div>
              <b id="sd-preset-apply-title">Apply {pendingPreset.name}?</b>
              <span>Choose whether this preset may replace your positioned text and custom background media.</span>
            </div>
            <div>
              <button
                onClick={() => {
                  onApply(pendingPreset, 'preserve-custom');
                  setPendingPreset(null);
                }}
              >
                Keep layout, text & background
              </button>
              <button
                className="replace"
                autoFocus
                onClick={() => {
                  onApply(pendingPreset, 'replace-all');
                  setPendingPreset(null);
                }}
              >
                Replace everything
              </button>
              <button className="cancel" onClick={() => setPendingPreset(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sd-preset-tabs">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            className={category === item ? 'active' : ''}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="sd-preset-grid">
        {visible.map((preset) => {
          const selected = selectedId === preset.id;
          const favorite = favoriteIds.includes(preset.id);
          return (
            <article
              key={preset.id}
              className={selected ? 'active' : ''}
              style={{
                ['--preset-accent' as string]: preset.accent,
                ['--preset-secondary' as string]: preset.secondary,
              }}
            >
              <button className="sd-preset-preview" onClick={() => requestApply(preset)}>
                <span
                  className={`sd-preset-art preset-${preset.config.background.mode}${preset.thumbnail ? ' saved-thumb' : ''}`}
                  style={{
                    ['--preset-aspect' as string]: aspectRatio(preset.config.aspect),
                    ['--preset-dim' as string]: String(preset.config.background.dim ?? 0),
                    ['--preset-overlay' as string]: String(preset.config.background.overlayOpacity ?? 0),
                    ...(preset.thumbnail || (preset.config.background.mode === 'suno' && picture)
                      ? { backgroundImage: `url("${preset.thumbnail || picture}")` }
                      : {}),
                  }}
                >
                  <span className="sd-preset-scene">
                    <i className={`wave wave-${preset.config.wave}`} />
                    <span className={`template template-${preset.config.template}`}>
                      <b />
                      {preset.config.lyrics !== 'off' && <small />}
                    </span>
                  </span>
                  <em>{preset.category}</em>
                  {preset.badge && <strong>{preset.badge}</strong>}
                  <span className="sd-preset-specs">
                    <span>{preset.config.aspect}</span>
                    <span>{waveLabel(preset.config.wave)}</span>
                    <span>{backgroundLabel(preset)}</span>
                  </span>
                  {selected && (
                    <span className={`sd-preset-state ${modified ? 'modified' : 'applied'}`}>
                      {modified ? 'Modified' : 'Applied'}
                    </span>
                  )}
                  {!preset.builtin && <span className="sd-preset-owned">My preset</span>}
                </span>
                <span className="sd-preset-copy">
                  <b>{preset.name}</b>
                  <small>{preset.description}</small>
                </span>
              </button>
              <footer className={preset.builtin ? '' : 'custom'}>
                <button
                  className={favorite ? 'active' : ''}
                  onClick={() => onToggleFavorite(preset.id)}
                  title="Favorite"
                >
                  <Heart />
                </button>
                <button onClick={() => onDuplicate(preset)} title="Duplicate">
                  <Copy />
                </button>
                {!preset.builtin && (
                  <button
                    onClick={() => {
                      const next = window.prompt('Rename preset', preset.name)?.trim();
                      if (next) onRename(preset, next);
                    }}
                    title="Rename"
                  >
                    <Pencil />
                  </button>
                )}
                {!preset.builtin && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete preset "${preset.name}"?`)) onDelete(preset);
                    }}
                    title="Delete"
                  >
                    <Trash2 />
                  </button>
                )}
                <button className="apply" onClick={() => requestApply(preset)}>
                  {selected ? (modified ? 'Modified' : 'Applied') : 'Apply'}
                </button>
              </footer>
            </article>
          );
        })}
        {!visible.length && (
          <div className="sd-preset-empty">No presets in this category yet.</div>
        )}
      </div>
    </section>
  );
}
