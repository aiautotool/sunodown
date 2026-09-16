'use client';

import { useEffect } from 'react';
import { VIDEO_PRESETS } from '@/components/v4/types';

function clickButton(root: Element, text: string) {
  const button = Array.from(root.querySelectorAll('button')).find((el) => el.textContent?.trim() === text);
  if (button instanceof HTMLButtonElement) button.click();
}

function applyPreset(root: Element, preset: (typeof VIDEO_PRESETS)[number]) {
  const templateLabels: Record<string,string> = {
    'cover-motion':'Cover Motion', vinyl:'Vinyl', 'glass-card':'Glass Card', 'lyrics-focus':'Lyrics Focus',
  };
  const motionLabels: Record<string,string> = { low:'Nhẹ', medium:'Vừa', high:'Mạnh' };
  const lyricsLabels: Record<string,string> = { off:'Tắt', scroll:'Scroll', focus:'Focus' };
  clickButton(root, templateLabels[preset.template]);
  clickButton(root, preset.aspect);
  clickButton(root, preset.wave[0].toUpperCase()+preset.wave.slice(1));
  clickButton(root, motionLabels[preset.motion]);
  clickButton(root, lyricsLabels[preset.lyrics]);
}

function mountGallery() {
  const labels = Array.from(document.querySelectorAll('p')).filter((el) => el.textContent?.trim() === 'Template');
  const label = labels[0];
  if (!label || document.getElementById('v5-video-preset-gallery')) return;
  const visualizer = label.closest('div.rounded-2xl');
  if (!visualizer) return;

  const wrap = document.createElement('div');
  wrap.id = 'v5-video-preset-gallery';
  wrap.className = 'mt-5';
  wrap.innerHTML = `
    <div class="flex items-end justify-between gap-3">
      <div><p class="text-[11px] font-bold uppercase text-white/40">Video mẫu</p><p class="mt-1 text-xs text-white/45">Chọn preset để áp dụng nhanh layout, waveform, motion và tỉ lệ.</p></div>
      <span class="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-1 text-[10px] font-bold text-fuchsia-200">12 PRESET</span>
    </div>
    <div class="mt-3 flex gap-2 overflow-x-auto pb-2" data-preset-filters>
      ${['Tất cả','Album','Social','Lyrics','Visualizer'].map((x,i)=>`<button data-filter="${x}" class="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${i===0?'border-fuchsia-300/40 bg-fuchsia-300/15 text-fuchsia-100':'border-white/10 bg-black/20 text-white/50'}">${x}</button>`).join('')}
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-preset-grid>
      ${VIDEO_PRESETS.map((p,i)=>`<button data-preset="${p.id}" data-category="${p.category}" class="group relative min-h-[126px] overflow-hidden rounded-2xl border ${i===0?'border-fuchsia-300/45':'border-white/10'} bg-[radial-gradient(circle_at_80%_10%,rgba(217,70,239,.18),transparent_36%),linear-gradient(145deg,rgba(255,255,255,.07),rgba(0,0,0,.2))] p-3 text-left transition hover:border-fuchsia-300/35">
        <span class="absolute right-2 top-2 rounded-md bg-black/35 px-1.5 py-1 text-[9px] font-bold text-white/55">${p.badge||p.category}</span>
        <span class="mt-7 block text-sm font-bold text-white">${p.label}</span>
        <span class="mt-1 block text-[10px] leading-4 text-white/45">${p.hint}</span>
        <span class="mt-2 block text-[9px] font-semibold uppercase tracking-wide text-cyan-200/60">${p.aspect} · ${p.wave} · ${p.motion}</span>
      </button>`).join('')}
    </div>`;

  label.parentElement?.insertBefore(wrap,label);

  const cards = Array.from(wrap.querySelectorAll<HTMLButtonElement>('[data-preset]'));
  cards.forEach((card) => card.addEventListener('click', () => {
    const preset = VIDEO_PRESETS.find((p) => p.id === card.dataset.preset);
    if (!preset) return;
    applyPreset(visualizer,preset);
    cards.forEach((x) => { x.classList.remove('border-fuchsia-300/45','bg-fuchsia-300/10'); x.classList.add('border-white/10'); });
    card.classList.remove('border-white/10'); card.classList.add('border-fuchsia-300/45','bg-fuchsia-300/10');
  }));

  const filters = Array.from(wrap.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  filters.forEach((button) => button.addEventListener('click', () => {
    const filter = button.dataset.filter || 'Tất cả';
    filters.forEach((x) => { x.className='shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-bold text-white/50'; });
    button.className='shrink-0 rounded-full border border-fuchsia-300/40 bg-fuchsia-300/15 px-3 py-1.5 text-[11px] font-bold text-fuchsia-100';
    cards.forEach((card) => { card.style.display = filter==='Tất cả'||card.dataset.category===filter ? '' : 'none'; });
  }));
}

export function V5PresetGalleryEnhancer(){
  useEffect(()=>{
    mountGallery();
    const observer=new MutationObserver(mountGallery);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
