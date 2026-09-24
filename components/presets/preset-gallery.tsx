'use client';

import { useMemo, useState } from 'react';
import { Copy, Download, Heart, Pencil, RefreshCw, RotateCcw, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import type { StudioPreset, StudioPresetCategory } from './studio-presets';
import type { PresetApplyMode } from './preset-apply-engine';

const CATEGORIES: Array<'All' | 'Favorites' | StudioPresetCategory | 'My Presets'> = ['All','Favorites','Social','Lyrics','Cinematic','Album','Visualizer','My Presets'];
type ManageAction = { type: 'rename' | 'delete' | 'update'; preset: StudioPreset } | null;

export function PresetGallery({ presets, selectedId, picture, favoriteIds, canUndo, modified, onApply, onToggleFavorite, onDuplicate, onRename, onDelete, onSaveCurrent, onUpdateCurrent, onResetSelected, onExportPreset, onImportPreset, onUndo }: {
  presets: StudioPreset[]; selectedId: string | null; picture?: string; favoriteIds: string[]; canUndo: boolean; modified: boolean;
  onApply: (preset: StudioPreset, mode: PresetApplyMode) => void; onToggleFavorite: (id: string) => void; onDuplicate: (preset: StudioPreset) => void;
  onRename: (preset: StudioPreset, name: string) => void; onDelete: (preset: StudioPreset) => void; onSaveCurrent: (name: string) => void;
  onUpdateCurrent: (preset: StudioPreset) => void; onResetSelected: (preset: StudioPreset) => void; onExportPreset: (preset: StudioPreset) => void;
  onImportPreset: (file: File) => void; onUndo: () => void;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [pendingPreset, setPendingPreset] = useState<StudioPreset | null>(null);
  const [manageAction, setManageAction] = useState<ManageAction>(null);
  const [manageName, setManageName] = useState('');
  const [notice, setNotice] = useState('');
  const selectedPreset = presets.find((preset) => preset.id === selectedId) || null;
  const myPresetCount = presets.filter((preset) => !preset.builtin).length;

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 1800); };
  const requestApply = (preset: StudioPreset) => { if (selectedId === preset.id && !modified) return; setPendingPreset(preset); };
  const saveNamedPreset = () => { const nextName = name.trim(); if (!nextName) return; onSaveCurrent(nextName); setName(''); setSaving(false); setCategory('My Presets'); flash(`Saved “${nextName}” to My Presets`); };
  const openManage = (type: 'rename' | 'delete' | 'update', preset: StudioPreset) => { setManageAction({ type, preset }); setManageName(preset.name); };
  const confirmManage = () => {
    if (!manageAction) return;
    const { type, preset } = manageAction;
    if (type === 'rename') { const next = manageName.trim(); if (!next) return; onRename(preset, next); flash(`Renamed to “${next}”`); }
    if (type === 'update') { onUpdateCurrent(preset); flash(`Updated “${preset.name}” from current video`); }
    if (type === 'delete') { onDelete(preset); flash(`Deleted “${preset.name}”`); }
    setManageAction(null);
  };
  const visible = useMemo(() => presets.filter((preset) => category === 'All' ? true : category === 'Favorites' ? favoriteIds.includes(preset.id) : category === 'My Presets' ? !preset.builtin : preset.category === category).sort((a,b) => category === 'All' ? Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)) : 0), [category,presets,favoriteIds]);

  return <section className="sd-preset-system">
    <div className="sd-preset-head">
      <div><span><Sparkles /> Smart Presets</span><b>One tap changes the whole video {modified && selectedId ? '· Modified' : ''}</b></div>
      <div className="sd-preset-head-actions">
        {modified && selectedPreset && <button onClick={() => { onResetSelected(selectedPreset); flash(`Reset to “${selectedPreset.name}”`); }}><RefreshCw /> Reset</button>}
        {modified && selectedPreset && !selectedPreset.builtin && <button className="primary" onClick={() => openManage('update', selectedPreset)}><Save /> Update</button>}
        {canUndo && <button onClick={() => { onUndo(); flash('Preset change undone'); }}><RotateCcw /> Undo</button>}
        {selectedPreset && <button onClick={() => onExportPreset(selectedPreset)}><Download /> Export</button>}
        <label className="sd-preset-import"><Upload /> Import<input type="file" accept=".json,application/json" onChange={(event) => { const file=event.target.files?.[0]; if(file){onImportPreset(file);setCategory('My Presets');flash('Preset imported to My Presets');} event.currentTarget.value=''; }} /></label>
        <button onClick={() => setSaving(true)}><Save /> Save new</button>
      </div>
    </div>

    {category === 'My Presets' && <div className="sd-my-presets-bar"><div><b>My Presets</b><span>{myPresetCount} saved styles · reusable across videos</span></div><button onClick={() => setSaving(true)}><Save /> Save current style</button></div>}

    {saving && <div className="sd-preset-save-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setSaving(false)}}><div className="sd-preset-save-dialog" role="dialog" aria-modal="true"><button className="sd-preset-dialog-close" onClick={()=>setSaving(false)}>×</button><div className="sd-preset-save-preview" style={picture?{backgroundImage:`url("${picture}")`}:undefined}><span><Sparkles /> Current video style</span></div><div className="sd-preset-save-copy"><small>MY PRESETS</small><b>Save current style</b><span>Save the current video look so you can apply it again with one tap.</span></div><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Preset name" onKeyDown={e=>{if(e.key==='Enter')saveNamedPreset();if(e.key==='Escape')setSaving(false)}}/><div className="sd-preset-save-actions"><button onClick={()=>setSaving(false)}>Cancel</button><button className="primary" disabled={!name.trim()} onClick={saveNamedPreset}><Save /> Save preset</button></div></div></div>}

    {pendingPreset && <div className="sd-preset-apply-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setPendingPreset(null)}}><div className="sd-preset-apply-choice" role="dialog" aria-modal="true"><button className="sd-preset-dialog-close" onClick={()=>setPendingPreset(null)}>×</button><div><b>Apply {pendingPreset.name}?</b><span>Choose whether this preset may replace your positioned text and custom background media.</span></div><div><button onClick={()=>{onApply(pendingPreset,'preserve-custom');flash(`Applied “${pendingPreset.name}” · kept custom layout/background`);setPendingPreset(null)}}>Keep layout, text & background</button><button className="replace" autoFocus onClick={()=>{onApply(pendingPreset,'replace-all');flash(`Applied “${pendingPreset.name}”`);setPendingPreset(null)}}>Replace everything</button><button className="cancel" onClick={()=>setPendingPreset(null)}>Cancel</button></div></div></div>}

    {manageAction && <div className="sd-preset-apply-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setManageAction(null)}}><div className="sd-preset-manage-dialog" role="dialog" aria-modal="true"><button className="sd-preset-dialog-close" onClick={()=>setManageAction(null)}>×</button><small>MY PRESETS</small>{manageAction.type==='rename' && <><b>Rename preset</b><span>Give this saved style a name you can recognize later.</span><input autoFocus value={manageName} onChange={e=>setManageName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')confirmManage();if(e.key==='Escape')setManageAction(null)}} /></>}{manageAction.type==='update' && <><b>Update “{manageAction.preset.name}”?</b><span>This replaces its saved style and thumbnail with the video settings you are using right now.</span></>}{manageAction.type==='delete' && <><b>Delete “{manageAction.preset.name}”?</b><span>This removes the preset from My Presets. Your current video will not be changed.</span></>}<div className="sd-preset-manage-actions"><button onClick={()=>setManageAction(null)}>Cancel</button><button className={manageAction.type==='delete'?'danger':'primary'} disabled={manageAction.type==='rename'&&!manageName.trim()} onClick={confirmManage}>{manageAction.type==='rename'?'Rename':manageAction.type==='update'?'Update preset':'Delete preset'}</button></div></div></div>}

    {notice && <div className="sd-preset-toast" role="status"><span>✓</span>{notice}</div>}
    <div className="sd-preset-tabs">{CATEGORIES.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}{item==='My Presets'&&myPresetCount>0?` (${myPresetCount})`:''}</button>)}</div>
    <div className="sd-preset-grid">{visible.map(preset=>{const selected=selectedId===preset.id;const favorite=favoriteIds.includes(preset.id);return <article key={preset.id} className={selected?'active':''} style={{['--preset-accent' as string]:preset.accent,['--preset-secondary' as string]:preset.secondary}}><button className="sd-preset-preview" onClick={()=>requestApply(preset)}><span className={`sd-preset-art${preset.thumbnail?' saved-thumb':''}`} style={preset.thumbnail||picture?{backgroundImage:`url("${preset.thumbnail||picture}")`}:undefined}><i/><em>{preset.category}</em>{preset.badge&&<strong>{preset.badge}</strong>}{selected&&<span className={`sd-preset-state ${modified?'modified':'applied'}`}>{modified?'Modified':'Applied'}</span>}{!preset.builtin&&<span className="sd-preset-owned">My preset</span>}</span><span className="sd-preset-copy"><b>{preset.name}</b><small>{preset.description}</small></span></button><footer className={preset.builtin?'':'custom'}><button className={favorite?'active':''} onClick={()=>{onToggleFavorite(preset.id);flash(favorite?`Removed “${preset.name}” from Favorites`:`Added “${preset.name}” to Favorites`)}} title="Favorite"><Heart/></button><button onClick={()=>{onDuplicate(preset);setCategory('My Presets');flash(`Duplicated “${preset.name}” to My Presets`)}} title="Duplicate"><Copy/></button>{!preset.builtin&&<button onClick={()=>openManage('rename',preset)} title="Rename"><Pencil/></button>}{!preset.builtin&&<button onClick={()=>openManage('delete',preset)} title="Delete"><Trash2/></button>}<button className="apply" onClick={()=>requestApply(preset)}>{selected?(modified?'Modified':'Applied'):'Apply'}</button>{!preset.builtin&&selected&&modified&&<button className="sd-card-update" onClick={()=>openManage('update',preset)}>Update</button>}</footer></article>})}{!visible.length&&<div className="sd-preset-empty">No presets here yet. Save the current video style to create your first preset.</div>}</div>
  </section>;
}
