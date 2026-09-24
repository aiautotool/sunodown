'use client';

import { useMemo, useState } from 'react';
import { Copy, Download, Heart, Pencil, RefreshCw, RotateCcw, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import type { StudioPreset, StudioPresetCategory } from './studio-presets';

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
  onApply: (preset: StudioPreset, mode: 'replace-all' | 'preserve-custom') => void;
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
    if (modified && selectedId) {
      setPendingPreset(preset);
      return;
    }
    onApply(preset, 'replace-all');
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
        <div className="sd-preset-apply-choice">
          <div>
            <b>Apply {pendingPreset.name}?</b>
            <span>You have manual changes on the current preset.</span>
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
                  className={`sd-preset-art${preset.thumbnail ? ' saved-thumb' : ''}`}
                  style={
                    preset.thumbnail || picture
                      ? {
                          backgroundImage: `url("${preset.thumbnail || picture}")`,
                        }
                      : undefined
                  }
                >
                  <i />
                  <em>{preset.category}</em>
                  {preset.badge && <strong>{preset.badge}</strong>}
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
