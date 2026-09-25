'use client';

import { useMemo, useState } from 'react';
import {
  Copy, Download, Heart, Pencil, RefreshCw, RotateCcw, Save,
  Sparkles, Trash2, Upload,
} from 'lucide-react';
import type { StudioPreset, StudioPresetCategory } from './studio-presets';
import type { PresetApplyMode } from './preset-apply-engine';

const CATEGORIES: Array<'Tất cả' | 'Yêu thích' | StudioPresetCategory | 'Mẫu của tôi'> = [
  'Tất cả', 'Yêu thích', 'Social', 'Lyrics', 'Cinematic', 'Album', 'Visualizer', 'Mẫu của tôi',
];

type ManageAction =
  | { type: 'rename' | 'delete' | 'update'; preset: StudioPreset }
  | null;

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
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tất cả');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [pendingPreset, setPendingPreset] = useState<StudioPreset | null>(null);
  const [manageAction, setManageAction] = useState<ManageAction>(null);
  const [manageName, setManageName] = useState('');
  const [notice, setNotice] = useState('');

  const selectedPreset = presets.find((preset) => preset.id === selectedId) || null;
  const myPresetCount = presets.filter((preset) => !preset.builtin).length;

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  };

  const requestApply = (preset: StudioPreset) => {
    if (selectedId === preset.id && !modified) return;
    setPendingPreset(preset);
  };

  const saveNamedPreset = () => {
    const nextName = name.trim();
    if (!nextName) return;
    onSaveCurrent(nextName);
    setName('');
    setSaving(false);
    setCategory('Mẫu của tôi');
    flash(`Đã lưu “${nextName}”`);
  };

  const openManage = (type: 'rename' | 'delete' | 'update', preset: StudioPreset) => {
    setManageAction({ type, preset });
    setManageName(preset.name);
  };

  const confirmManage = () => {
    if (!manageAction) return;
    const { type, preset } = manageAction;
    if (type === 'rename') {
      const next = manageName.trim();
      if (!next) return;
      onRename(preset, next);
      flash(`Đã đổi tên thành “${next}”`);
    }
    if (type === 'update') {
      onUpdateCurrent(preset);
      flash(`Đã cập nhật “${preset.name}” từ video hiện tại`);
    }
    if (type === 'delete') {
      onDelete(preset);
      flash(`Đã xóa “${preset.name}”`);
    }
    setManageAction(null);
  };

  const visible = useMemo(
    () =>
      presets
        .filter((preset) =>
          category === 'Tất cả'
            ? true
            : category === 'Yêu thích'
              ? favoriteIds.includes(preset.id)
              : category === 'Mẫu của tôi'
                ? !preset.builtin
                : preset.category === category,
        )
        .sort((a, b) =>
          category === 'Tất cả'
            ? Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id))
            : 0,
        ),
    [category, presets, favoriteIds],
  );

  return (
    <section className="sd-preset-system">
      <div className="sd-preset-head">
        <div>
          <span><Sparkles /> Mẫu hoàn chỉnh</span>
          <b>
            Một chạm thay đổi đồng bộ toàn bộ video
            {modified && selectedId ? ' · Đã chỉnh tay' : ''}
          </b>
        </div>
        <div className="sd-preset-head-actions">
          {modified && selectedPreset && (
            <button
              onClick={() => {
                onResetSelected(selectedPreset);
                flash(`Đã khôi phục “${selectedPreset.name}”`);
              }}
            >
              <RefreshCw /> Khôi phục mẫu
            </button>
          )}
          {modified && selectedPreset && !selectedPreset.builtin && (
            <button className="primary" onClick={() => openManage('update', selectedPreset)}>
              <Save /> Cập nhật
            </button>
          )}
          {canUndo && (
            <button onClick={() => { onUndo(); flash('Đã hoàn tác thay đổi mẫu'); }}>
              <RotateCcw /> Hoàn tác
            </button>
          )}
          {selectedPreset && (
            <button onClick={() => onExportPreset(selectedPreset)}>
              <Download /> Xuất
            </button>
          )}
          <label className="sd-preset-import">
            <Upload /> Nhập
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onImportPreset(file);
                  setCategory('Mẫu của tôi');
                  flash('Đã nhập mẫu vào Mẫu của tôi');
                }
                event.currentTarget.value = '';
              }}
            />
          </label>
          <button onClick={() => setSaving(true)}><Save /> Lưu mẫu mới</button>
        </div>
      </div>

      <p className="sd-preset-explainer">
        Mẫu hoàn chỉnh gồm Kiểu hình ảnh + Sóng nhạc + Motion + Lời bài hát + Chữ + Nền + Hiệu ứng + Tỉ lệ khung hình.
      </p>

      {category === 'Mẫu của tôi' && (
        <div className="sd-my-presets-bar">
          <div>
            <b>Mẫu của tôi</b>
            <span>{myPresetCount} mẫu đã lưu · dùng lại cho các video khác</span>
          </div>
          <button onClick={() => setSaving(true)}><Save /> Lưu cấu hình hiện tại</button>
        </div>
      )}

      {saving && (
        <div className="sd-preset-save-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSaving(false); }}>
          <div className="sd-preset-save-dialog" role="dialog" aria-modal="true">
            <button className="sd-preset-dialog-close" onClick={() => setSaving(false)}>×</button>
            <div
              className="sd-preset-save-preview"
              style={picture ? { backgroundImage: `url("${picture}")` } : undefined}
            >
              <span><Sparkles /> Cấu hình video hiện tại</span>
            </div>
            <div className="sd-preset-save-copy">
              <small>MẪU CỦA TÔI</small>
              <b>Lưu cấu hình hiện tại</b>
              <span>Lưu toàn bộ cấu hình để lần sau áp dụng lại chỉ với một chạm.</span>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên mẫu"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNamedPreset();
                if (e.key === 'Escape') setSaving(false);
              }}
            />
            <div className="sd-preset-save-actions">
              <button onClick={() => setSaving(false)}>Hủy</button>
              <button className="primary" disabled={!name.trim()} onClick={saveNamedPreset}>
                <Save /> Lưu mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingPreset && (
        <div className="sd-preset-apply-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPendingPreset(null); }}>
          <div className="sd-preset-apply-choice" role="dialog" aria-modal="true">
            <button className="sd-preset-dialog-close" onClick={() => setPendingPreset(null)}>×</button>
            <div>
              <b>Áp dụng “{pendingPreset.name}”?</b>
              <span>
                “Áp dụng toàn bộ” dùng đúng cấu hình của mẫu. “Giữ các chỉnh tay” giữ lại những mục bạn đã sửa sau khi chọn mẫu trước.
              </span>
            </div>
            <div>
              <button
                onClick={() => {
                  onApply(pendingPreset, 'preserve-custom');
                  flash(`Đã áp dụng “${pendingPreset.name}” và giữ chỉnh tay`);
                  setPendingPreset(null);
                }}
              >
                Giữ các chỉnh tay
              </button>
              <button
                className="replace"
                autoFocus
                onClick={() => {
                  onApply(pendingPreset, 'replace-all');
                  flash(`Đã áp dụng toàn bộ “${pendingPreset.name}”`);
                  setPendingPreset(null);
                }}
              >
                Áp dụng toàn bộ
              </button>
              <button className="cancel" onClick={() => setPendingPreset(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {manageAction && (
        <div className="sd-preset-apply-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setManageAction(null); }}>
          <div className="sd-preset-manage-dialog" role="dialog" aria-modal="true">
            <button className="sd-preset-dialog-close" onClick={() => setManageAction(null)}>×</button>
            <small>MẪU CỦA TÔI</small>
            {manageAction.type === 'rename' && (
              <>
                <b>Đổi tên mẫu</b>
                <span>Đặt tên dễ nhận biết cho mẫu đã lưu.</span>
                <input
                  autoFocus
                  value={manageName}
                  onChange={(e) => setManageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmManage();
                    if (e.key === 'Escape') setManageAction(null);
                  }}
                />
              </>
            )}
            {manageAction.type === 'update' && (
              <>
                <b>Cập nhật “{manageAction.preset.name}”?</b>
                <span>Thay cấu hình và thumbnail đã lưu bằng trạng thái video hiện tại.</span>
              </>
            )}
            {manageAction.type === 'delete' && (
              <>
                <b>Xóa “{manageAction.preset.name}”?</b>
                <span>Mẫu sẽ bị xóa khỏi Mẫu của tôi. Video hiện tại không thay đổi.</span>
              </>
            )}
            <div className="sd-preset-manage-actions">
              <button onClick={() => setManageAction(null)}>Hủy</button>
              <button
                className={manageAction.type === 'delete' ? 'danger' : 'primary'}
                disabled={manageAction.type === 'rename' && !manageName.trim()}
                onClick={confirmManage}
              >
                {manageAction.type === 'rename'
                  ? 'Đổi tên'
                  : manageAction.type === 'update'
                    ? 'Cập nhật mẫu'
                    : 'Xóa mẫu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="sd-preset-toast" role="status"><span>✓</span>{notice}</div>}

      <div className="sd-preset-tabs">
        {CATEGORIES.map((item) => (
          <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
            {item}{item === 'Mẫu của tôi' && myPresetCount > 0 ? ` (${myPresetCount})` : ''}
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
                  className={`sd-preset-art${preset.thumbnail || picture ? ' saved-thumb' : ''}`}
                  style={preset.thumbnail || picture ? { backgroundImage: `url("${preset.thumbnail || picture}")` } : undefined}
                >
                  <em>{preset.category}</em>
                  {preset.badge && <strong>{preset.badge}</strong>}
                  {selected && (
                    <span className={`sd-preset-state ${modified ? 'modified' : 'applied'}`}>
                      {modified ? 'Đã chỉnh' : 'Đã áp dụng'}
                    </span>
                  )}
                  {!preset.builtin && <span className="sd-preset-owned">Mẫu của tôi</span>}
                </span>
                <span className="sd-preset-copy">
                  <b>{preset.name}</b>
                  <small>{preset.description}</small>
                </span>
              </button>
              <footer className={preset.builtin ? '' : 'custom'}>
                <button
                  className={favorite ? 'active' : ''}
                  onClick={() => {
                    onToggleFavorite(preset.id);
                    flash(favorite ? `Đã bỏ “${preset.name}” khỏi Yêu thích` : `Đã thêm “${preset.name}” vào Yêu thích`);
                  }}
                  title="Yêu thích"
                >
                  <Heart />
                </button>
                <button
                  onClick={() => {
                    onDuplicate(preset);
                    setCategory('Mẫu của tôi');
                    flash(`Đã nhân bản “${preset.name}”`);
                  }}
                  title="Nhân bản"
                >
                  <Copy />
                </button>
                {!preset.builtin && <button onClick={() => openManage('rename', preset)} title="Đổi tên"><Pencil /></button>}
                {!preset.builtin && <button onClick={() => openManage('delete', preset)} title="Xóa"><Trash2 /></button>}
                <button className="apply" onClick={() => requestApply(preset)}>
                  {selected ? (modified ? 'Đã chỉnh' : 'Đã áp dụng') : 'Áp dụng'}
                </button>
                {!preset.builtin && selected && modified && (
                  <button className="sd-card-update" onClick={() => openManage('update', preset)}>
                    Cập nhật
                  </button>
                )}
              </footer>
            </article>
          );
        })}
        {!visible.length && (
          <div className="sd-preset-empty">
            Chưa có mẫu nào. Hãy lưu cấu hình hiện tại để tạo mẫu đầu tiên.
          </div>
        )}
      </div>
    </section>
  );
}
