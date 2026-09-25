'use client';

import { useMemo, useState } from 'react';
import { Copy, Download, Heart, Pencil, RefreshCw, RotateCcw, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import type { StudioPreset, StudioPresetCategory } from './studio-presets';
import type { PresetApplyMode } from './preset-apply-engine';

const CATEGORIES: Array<'Tất cả' | 'Yêu thích' | StudioPresetCategory | 'Mẫu của tôi'> = ['Tất cả','Yêu thích','Social','Lyrics','Cinematic','Album','Visualizer','Mẫu của tôi'];
type ManageAction = { type: 'rename' | 'delete' | 'update'; preset: StudioPreset } | null;

export function PresetGallery({ presets, selectedId, picture, favoriteIds, canHoàn tác, modified, onApply, onToggleFavorite, onDuplicate, onRename, onDelete, onSaveCurrent, onUpdateCurrent, onKhôi phục mẫuSelected, onXuấtPreset, onNhậpPreset, onHoàn tác }: {
  presets: StudioPreset[]; selectedId: string | null; picture?: string; favoriteIds: string[]; canHoàn tác: boolean; modified: boolean;
  onApply: (preset: StudioPreset, mode: PresetApplyMode) => void; onToggleFavorite: (id: string) => void; onDuplicate: (preset: StudioPreset) => void;
  onRename: (preset: StudioPreset, name: string) => void; onDelete: (preset: StudioPreset) => void; onSaveCurrent: (name: string) => void;
  onUpdateCurrent: (preset: StudioPreset) => void; onKhôi phục mẫuSelected: (preset: StudioPreset) => void; onXuấtPreset: (preset: StudioPreset) => void;
  onNhậpPreset: (file: File) => void; onHoàn tác: () => void;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tất cả');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [pendingPreset, setPendingPreset] = useState<StudioPreset | null>(null);
  const [manageAction, setManageAction] = useState<ManageAction>(null);
  const [manageName, setManageName] = useState('');
  const [notice, setNotice] = useState('');
  const selectedPreset = presets.find((preset) => preset.id === selectedId) || null;
  const myPresetCount = presets.filter((preset) => !preset.builtin).length;

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 1800); };
  const requestÁp dụng = (preset: StudioPreset) => { if (selectedId === preset.id && !modified) return; setPendingPreset(preset); };
  const saveNamedPreset = () => { const nextName = name.trim(); if (!nextName) return; onSaveCurrent(nextName); setName(''); setSaving(false); setCategory('Mẫu của tôi'); flash(`Saved “${nextName}” to Mẫu của tôi`); };
  const openManage = (type: 'rename' | 'delete' | 'update', preset: StudioPreset) => { setManageAction({ type, preset }); setManageName(preset.name); };
  const confirmManage = () => {
    if (!manageAction) return;
    const { type, preset } = manageAction;
    if (type === 'rename') { const next = manageName.trim(); if (!next) return; onRename(preset, next); flash(`Renamed to “${next}”`); }
    if (type === 'update') { onUpdateCurrent(preset); flash(`Updated “${preset.name}” from current video`); }
    if (type === 'delete') { onDelete(preset); flash(`Deleted “${preset.name}”`); }
    setManageAction(null);
  };
  const visible = useMemo(() => presets.filter((preset) => category === 'Tất cả' ? true : category === 'Yêu thích' ? favoriteIds.includes(preset.id) : category === 'Mẫu của tôi' ? !preset.builtin : preset.category === category).sort((a,b) => category === 'Tất cả' ? Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)) : 0), [category,presets,favoriteIds]);

  return <section className="sd-preset-system">
    <div className="sd-preset-head">
      <div><span><Sparkles /> Mẫu hoàn chỉnh</span><b>Một chạm thay đổi đồng bộ toàn bộ video {modified && selectedId ? '· Đã chỉnh tay' : ''}</b></div>
      <div className="sd-preset-head-actions">
        {modified && selectedPreset && <button onClick={() => { onKhôi phục mẫuSelected(selectedPreset); flash(`Khôi phục mẫu to “${selectedPreset.name}”`); }}><RefreshCw /> Khôi phục mẫu</button>}
        {modified && selectedPreset && !selectedPreset.builtin && <button className="primary" onClick={() => openManage('update', selectedPreset)}><Save /> Update</button>}
        {canHoàn tác && <button onClick={() => { onHoàn tác(); flash('Preset change undone'); }}><RotateCcw /> Hoàn tác</button>}
        {selectedPreset && <button onClick={() => onXuấtPreset(selectedPreset)}><Download /> Xuất</button>}
        <label className="sd-preset-import"><Upload /> Nhập<input type="file" accept=".json,application/json" onChange={(event) => { const file=event.target.files?.[0]; if(file){onNhậpPreset(file);setCategory('Mẫu của tôi');flash('Preset imported to Mẫu của tôi');} event.currentTarget.value=''; }} /></label>
        <button onClick={() => setSaving(true)}><Save /> Lưu mẫu mới</button>
      </div>
    </div>

    {category === 'Mẫu của tôi' && <div className="sd-my-presets-bar"><div><b>Mẫu của tôi</b><span>{myPresetCount} saved styles · reusable across videos</span></div><button onClick={() => setSaving(true)}><Save /> Lưu cấu hình hiện tại</button></div>}

    {saving && <div className="sd-preset-save-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setSaving(false)}}><div className="sd-preset-save-dialog" role="dialog" aria-modal="true"><button className="sd-preset-dialog-close" onClick={()=>setSaving(false)}>×</button><div className="sd-preset-save-preview" style={picture?{backgroundImage:`url("${picture}")`}:undefined}><span><Sparkles /> Current video style</span></div><div className="sd-preset-save-copy"><small>MY PRESETS</small><b>Lưu cấu hình hiện tại</b><span>Lưu toàn bộ cấu hình hiện tại để áp dụng lại chỉ với một chạm.</span></div><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Tên mẫu" onKeyDown={e=>{if(e.key==='Enter')saveNamedPreset();if(e.key==='Escape')setSaving(false)}}/><div className="sd-preset-save-actions"><button onClick={()=>setSaving(false)}>Hủy</button><button className="primary" disabled={!name.trim()} onClick={saveNamedPreset}><Save /> Lưu mẫu</button></div></div></div>}

    {pendingPreset && <div className="sd-preset-apply-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setPendingPreset(null)}}><div className="sd-preset-apply-choice" role="dialog" aria-modal="true"><button className="sd-preset-dialog-close" onClick={()=>setPendingPreset(null)}>×</button><div><b>Áp dụng {pendingPreset.name}?</b><span>Mẫu hoàn chỉnh có thể thay toàn bộ cấu hình. Bạn có thể giữ lại những mục đã chỉnh tay hoặc áp dụng toàn bộ mẫu.</span></div><div><button onClick={()=>{onApply(pendingPreset,'preserve-custom');flash(`Applied “${pendingPreset.name}” · kept custom layout/background`);setPendingPreset(null)}}>Giữ các chỉnh tay</button><button className="replace" autoFocus onClick={()=>{onApply(pendingPreset,'replace-all');flash(`Applied “${pendingPreset.name}”`);setPendingPreset(null)}}>Áp dụng toàn bộ</button><button className="cancel" onClick={()=>setPendingPreset(null)}>Hủy</button></div></div></div>}

    {manageAction && <div className="sd-preset-apply-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setManageAction(null)}}><div className="sd-preset-manage-dialog" role="dialog" aria-modal="true"><button className="sd-preset-dialog-close" onClick={()=>setManageAction(null)}>×</button><small>MY PRESETS</small>{manageAction.type==='rename' && <><b>Rename preset</b><span>Give this saved style a name you can recognize later.</span><input autoFocus value={manageName} onChange={e=>setManageName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')confirmManage();if(e.key==='Escape')setManageAction(null)}} /></>}{manageAction.type==='update' && <><b>Update “{manageAction.preset.name}”?</b><span>This replaces its saved style and thumbnail with the video settings you are using right now.</span></>}{manageAction.type==='delete' && <><b>Delete “{manageAction.preset.name}”?</b><span>This removes the preset from Mẫu của tôi. Your current video will not be changed.</span></>}<div className="sd-preset-manage-actions"><button onClick={()=>setManageAction(null)}>Hủy</button><button className={manageAction.type==='delete'?'danger':'primary'} disabled={manageAction.type==='rename'&&!manageName.trim()} onClick={confirmManage}>{manageAction.type==='rename'?'Rename':manageAction.type==='update'?'Update preset':'Delete preset'}</button></div></div></div>}

    {notice && <div className="sd-preset-toast" role="status"><span>✓</span>{notice}</div>}
    <div className="sd-preset-tabs">{CATEGORIES.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}{item==='Mẫu của tôi'&&myPresetCount>0?` (${myPresetCount})`:''}</button>)}</div>
    <div className="sd-preset-grid">{visible.map(preset=>{const selected=selectedId===preset.id;const favorite=favoriteIds.includes(preset.id);return <article key={preset.id} className={selected?'active':''} style={{['--preset-accent' as string]:preset.accent,['--preset-secondary' as string]:preset.secondary}}><button className="sd-preset-preview" onClick={()=>requestApply(preset)}><span className={`sd-preset-art${preset.thumbnail||picture?' saved-thumb':''}`} style={preset.thumbnail||picture?{backgroundImage:`url("${preset.thumbnail||picture}")`}:undefined}><em>{preset.category}</em>{preset.badge&&<strong>{preset.badge}</strong>}{selected&&<span className={`sd-preset-state ${modified?'modified':'applied'}`}>{modified?'Đã chỉnh':'Đã áp dụng'}</span>}{!preset.builtin&&<span className="sd-preset-owned">My preset</span>}</span><span className="sd-preset-copy"><b>{preset.name}</b><small>{preset.description}</small></span></button><footer className={preset.builtin?'':'custom'}><button className={favorite?'active':''} onClick={()=>{onToggleFavorite(preset.id);flash(favorite?`Removed “${preset.name}” from Favorites`:`Added “${preset.name}” to Favorites`)}} title="Favorite"><Heart/></button><button onClick={()=>{onDuplicate(preset);setCategory('Mẫu của tôi');flash(`Duplicated “${preset.name}” to Mẫu của tôi`)}} title="Duplicate"><Copy/></button>{!preset.builtin&&<button onClick={()=>openManage('rename',preset)} title="Rename"><Pencil/></button>}{!preset.builtin&&<button onClick={()=>openManage('delete',preset)} title="Delete"><Trash2/></button>}<button className="apply" onClick={()=>requestApply(preset)}>{selected?(modified?'Đã chỉnh':'Đã áp dụng'):'Áp dụng'}</button>{!preset.builtin&&selected&&modified&&<button className="sd-card-update" onClick={()=>openManage('update',preset)}>Update</button>}</footer></article>})}{!visible.length&&<div className="sd-preset-empty">Chưa có mẫu nào. Hãy lưu cấu hình hiện tại để tạo mẫu đầu tiên.</div>}</div>
  </section>;
}
