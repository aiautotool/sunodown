'use client';

import { useMemo, useState } from 'react';
import { Copy, Heart, RotateCcw, Save, Sparkles } from 'lucide-react';
import type { StudioPreset, StudioPresetCategory } from './studio-presets';

const CATEGORIES: Array<'All' | StudioPresetCategory | 'My Presets'> = [
  'All',
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
  onApply,
  onToggleFavorite,
  onDuplicate,
  onSaveCurrent,
  onUndo,
}: {
  presets: StudioPreset[];
  selectedId: string | null;
  picture?: string;
  favoriteIds: string[];
  canUndo: boolean;
  onApply: (preset: StudioPreset) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (preset: StudioPreset) => void;
  onSaveCurrent: (name: string) => void;
  onUndo: () => void;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const visible = useMemo(
    () =>
      presets.filter((preset) =>
        category === 'All'
          ? true
          : category === 'My Presets'
            ? !preset.builtin
            : preset.category === category,
      ),
    [category, presets],
  );

  return (
    <section className="sd-preset-system">
      <div className="sd-preset-head">
        <div>
          <span><Sparkles /> Smart Presets</span>
          <b>One tap changes the whole video</b>
        </div>
        <div className="sd-preset-head-actions">
          {canUndo && (
            <button onClick={onUndo} title="Undo preset">
              <RotateCcw /> Undo
            </button>
          )}
          <button onClick={() => setSaving((value) => !value)}>
            <Save /> Save current
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
              <button className="sd-preset-preview" onClick={() => onApply(preset)}>
                <span
                  className="sd-preset-art"
                  style={picture ? { backgroundImage: `url("${picture}")` } : undefined}
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
              <footer>
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
                <button className="apply" onClick={() => onApply(preset)}>
                  {selected ? 'Applied' : 'Apply'}
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
