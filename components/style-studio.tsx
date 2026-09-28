'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Gauge, Sparkles } from 'lucide-react';
import {
  VISUAL_TEMPLATES,
  type MotionIntensity,
  type VisualTemplate,
} from '@/components/v4/types';

type Category = 'all' | 'lyrics' | 'visualizer' | 'cinematic' | 'retro';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'Dành cho bạn' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'visualizer', label: 'Visualizer' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'retro', label: 'Retro' },
];

const META: Record<VisualTemplate, {
  category: Exclude<Category, 'all'>;
  short: string;
  tags: string[];
}> = {
  'cover-motion': { category: 'cinematic', short: 'Ảnh bìa chuyển động mượt mà', tags: ['Cinematic', 'Mượt'] },
  vinyl: { category: 'retro', short: 'Vinyl trung tâm · waveform nhẹ', tags: ['Retro', 'Tinh tế'] },
  'glass-card': { category: 'visualizer', short: 'Thẻ kính · ánh sáng chuyển động', tags: ['Visualizer', 'Neon'] },
  'lyrics-focus': { category: 'lyrics', short: 'Lyrics làm trung tâm · dễ đọc', tags: ['Lyrics', 'Tập trung'] },
  editorial: { category: 'cinematic', short: 'Bố cục tạp chí âm nhạc hiện đại', tags: ['Editorial', 'Premium'] },
  spotlight: { category: 'cinematic', short: 'Sân khấu · halo · chiều sâu', tags: ['Stage', 'Dynamic'] },
  'gold-record': { category: 'retro', short: 'Đĩa vàng · ánh kim sang trọng', tags: ['Gold', 'Premium'] },
};

const MOTIONS: { id: MotionIntensity; label: string; hint: string }[] = [
  { id: 'low', label: 'Nhẹ', hint: 'Chuyển động tinh tế' },
  { id: 'medium', label: 'Vừa', hint: 'Cinematic cân bằng' },
  { id: 'high', label: 'Mạnh', hint: 'Năng động theo nhịp' },
];

export function StyleStudio({
  template,
  setTemplate,
  motion,
  setMotion,
  picture,
  onOpenPanel,
}: {
  template: VisualTemplate;
  setTemplate: (value: VisualTemplate) => void;
  motion: MotionIntensity;
  setMotion: (value: MotionIntensity) => void;
  picture?: string;
  onOpenPanel: (panel: string) => void;
}) {
  const [category, setCategory] = useState<Category>('all');
  const [advanced, setAdvanced] = useState(false);

  const templates = useMemo(
    () => VISUAL_TEMPLATES.filter((item) => category === 'all' || META[item.id].category === category),
    [category],
  );
  const selected = VISUAL_TEMPLATES.find((item) => item.id === template) || VISUAL_TEMPLATES[0];
  const meta = META[selected.id];

  return (
    <section className="sd-style-studio">
      <p className="sd-style-intro">
        Kiểu hình ảnh chỉ thay cấu trúc scene chính. Sóng nhạc, lời bài hát, nền và các chỉnh khác của bạn vẫn được giữ nguyên.
      </p>

      <div className="sd-style-heading">
        <div>
          <b>Chọn kiểu hình ảnh</b>
          <span>Scene đổi ngay trên preview</span>
        </div>
      </div>

      <div className="sd-style-categories" role="tablist" aria-label="Danh mục kiểu video">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={category === item.id ? 'active' : ''}
            onClick={() => setCategory(item.id)}
          >
            {item.id === 'all' && <Sparkles />}
            {item.label}
          </button>
        ))}
      </div>

      <div className="sd-style-grid">
        {templates.map((item) => {
          const active = template === item.id;
          const itemMeta = META[item.id];
          return (
            <button
              key={item.id}
              type="button"
              className={'sd-style-card style-' + item.id + (active ? ' active' : '')}
              onClick={() => setTemplate(item.id)}
            >
              <span className="sd-style-thumb">
                {picture ? <img src={picture} alt="" /> : <i />}
                <em />
                {active && <strong>✓</strong>}
              </span>
              <span className="sd-style-copy">
                <b>{item.label}</b>
                <small>{itemMeta.short}</small>
              </span>
              <ChevronRight />
            </button>
          );
        })}
      </div>

      <div className="sd-style-selected">
        <span className={'sd-style-mini style-' + selected.id}>
          {picture ? <img src={picture} alt="" /> : <i />}
          <em />
        </span>
        <div>
          <b>{selected.label}</b>
          <p>{meta.short}</p>
          <span className="sd-style-tags">
            {meta.tags.map((tag) => <i key={tag}>{tag}</i>)}
            <i>Phù hợp nhiều thể loại</i>
          </span>
        </div>
      </div>

      <button className="sd-style-customize" type="button" onClick={() => setAdvanced((value) => !value)}>
        <Gauge />
        <span>{advanced ? 'Ẩn tùy chỉnh style' : 'Tùy chỉnh style'}</span>
        <ChevronRight className={advanced ? 'open' : ''} />
      </button>

      {advanced && (
        <div className="sd-style-advanced">
          <button type="button" onClick={() => onOpenPanel('background')}>Nền</button>
          <button type="button" onClick={() => onOpenPanel('text')}>Văn bản</button>
          <button type="button" onClick={() => onOpenPanel('wave')}>Sóng nhạc</button>
          <button type="button" onClick={() => onOpenPanel('lyrics')}>Lời bài hát</button>
          <button type="button" onClick={() => onOpenPanel('effects')}>Hiệu ứng</button>
        </div>
      )}

      <div className="sd-style-motion">
        <div className="sd-style-motion-head">
          <b>Motion</b>
          <span>Chọn cường độ chuyển động</span>
        </div>
        <div className="sd-style-motion-grid">
          {MOTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={motion === item.id ? 'active' : ''}
              onClick={() => setMotion(item.id)}
            >
              <b>{item.label}</b>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
        <div className="sd-style-motion-meter" aria-hidden="true">
          <i style={{ width: motion === 'low' ? '28%' : motion === 'medium' ? '62%' : '100%' }} />
        </div>
      </div>
    </section>
  );
}
