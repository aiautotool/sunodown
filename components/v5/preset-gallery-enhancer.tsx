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

function waveMarkup(wave: string) {
  if (wave === 'line') return '<svg viewBox="0 0 120 28" class="h-7 w-full" aria-hidden="true"><path d="M0 16 C10 4 16 25 27 12 S43 22 54 10 S70 25 82 12 S101 20 120 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  if (wave === 'dots') return `<div class="flex h-7 items-center justify-center gap-1">${[1,2,3,4,5,6,7,8,9,10,11].map((_,i)=>`<i class="block rounded-full bg-current" style="width:${i%3===0?4:3}px;height:${i%4===0?4:3}px;opacity:${.35+(i%4)*.16}"></i>`).join('')}</div>`;
  if (wave === 'pulse') return '<div class="relative h-7"><i class="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current shadow-[0_0_18px_currentColor]"></i><i class="absolute inset-x-3 top-1/2 h-px bg-current/40"></i></div>';
  const bars = [8,15,22,12,26,18,9,23,14,20,11,17,25,13,8];
  return `<div class="flex h-7 items-center justify-center gap-[2px]">${bars.map((h)=>`<i class="block w-[2px] rounded-full bg-current" style="height:${wave==='mirror'?Math.max(5,h*.72):h}px"></i>`).join('')}</div>`;
}

function previewMarkup(preset: (typeof VIDEO_PRESETS)[number]) {
  const vertical = preset.aspect === '9:16' || preset.aspect === '4:5';
  const square = preset.aspect === '1:1';
  const frame = vertical ? 'mx-auto h-[116px] w-[68px]' : square ? 'mx-auto h-[92px] w-[92px]' : 'h-[82px] w-full';
  const accent = preset.category === 'Lyrics' ? 'text-fuchsia-300' : preset.category === 'Visualizer' ? 'text-cyan-300' : preset.category === 'Social' ? 'text-violet-300' : 'text-amber-200';
  const cover = '<i class="block h-10 w-10 shrink-0 rounded-lg bg-[linear-gradient(135deg,rgba(34,211,238,.85),rgba(168,85,247,.9)_50%,rgba(244,63,94,.8))] shadow-[0_0_22px_rgba(168,85,247,.28)]"></i>';
  let body = '';

  if (preset.template === 'vinyl') {
    body = `<div class="flex h-full items-center justify-center gap-2"><div class="relative h-12 w-12 rounded-full border border-white/20 bg-[repeating-radial-gradient(circle,rgba(255,255,255,.16)_0_1px,rgba(0,0,0,.75)_2px_5px)]"><i class="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-400 to-cyan-300"></i><i class="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"></i></div><div class="min-w-0 flex-1"><i class="block h-1.5 w-3/4 rounded bg-white/75"></i><i class="mt-1 block h-1 w-1/2 rounded bg-white/25"></i><div class="mt-2 ${accent}">${waveMarkup(preset.wave)}</div></div></div>`;
  } else if (preset.template === 'lyrics-focus') {
    body = `<div class="flex h-full flex-col justify-center text-center"><i class="mx-auto block h-1 w-8 rounded bg-white/20"></i><b class="mt-2 block text-[8px] leading-3 text-white/90">Khi giai điệu<br/>chạm vào ký ức</b><span class="mt-1 text-[6px] text-white/35">lời bài hát đang phát</span><div class="mt-1 ${accent}">${waveMarkup(preset.wave)}</div></div>`;
  } else if (preset.template === 'glass-card') {
    body = `<div class="relative flex h-full items-center justify-center"><i class="absolute left-2 top-2 h-12 w-12 rounded-full bg-fuchsia-500/25 blur-xl"></i><div class="relative flex w-[88%] items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur">${cover}<div class="min-w-0 flex-1"><i class="block h-1.5 w-4/5 rounded bg-white/75"></i><i class="mt-1 block h-1 w-1/2 rounded bg-white/25"></i><div class="mt-1 ${accent}">${waveMarkup(preset.wave)}</div></div></div></div>`;
  } else {
    body = vertical
      ? `<div class="flex h-full flex-col items-center justify-center">${cover}<i class="mt-2 block h-1.5 w-10 rounded bg-white/75"></i><i class="mt-1 block h-1 w-7 rounded bg-white/25"></i><div class="mt-1 w-12 ${accent}">${waveMarkup(preset.wave)}</div></div>`
      : `<div class="flex h-full items-center gap-2">${cover}<div class="min-w-0 flex-1"><i class="block h-1.5 w-3/4 rounded bg-white/75"></i><i class="mt-1 block h-1 w-1/2 rounded bg-white/25"></i><div class="mt-2 ${accent}">${waveMarkup(preset.wave)}</div></div></div>`;
  }

  return `<div class="mb-3 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_75%_10%,rgba(168,85,247,.22),transparent_35%),linear-gradient(145deg,#17152b,#080810)] p-2"><div class="${frame} overflow-hidden rounded-lg border border-white/10 bg-black/25 p-2 shadow-inner">${body}</div></div>`;
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
      <div><p class="text-[11px] font-bold uppercase text-white/40">Video mẫu</p><p class="mt-1 text-xs text-white/45">Xem thumbnail rồi chọn preset để áp dụng layout, waveform, motion và tỉ lệ.</p></div>
      <span class="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-1 text-[10px] font-bold text-fuchsia-200">12 PRESET</span>
    </div>
    <div class="mt-3 flex gap-2 overflow-x-auto pb-2" data-preset-filters>
      ${['Tất cả','Album','Social','Lyrics','Visualizer'].map((x,i)=>`<button data-filter="${x}" class="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${i===0?'border-fuchsia-300/40 bg-fuchsia-300/15 text-fuchsia-100':'border-white/10 bg-black/20 text-white/50'}">${x}</button>`).join('')}
    </div>
    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-preset-grid>
      ${VIDEO_PRESETS.map((p,i)=>`<button data-preset="${p.id}" data-category="${p.category}" class="group relative overflow-hidden rounded-2xl border ${i===0?'border-fuchsia-300/45 bg-fuchsia-300/[.04]':'border-white/10'} bg-[linear-gradient(145deg,rgba(255,255,255,.055),rgba(0,0,0,.2))] p-2.5 text-left transition hover:-translate-y-0.5 hover:border-fuchsia-300/35">
        ${previewMarkup(p)}
        <span class="absolute right-4 top-4 rounded-md border border-white/10 bg-black/55 px-1.5 py-1 text-[9px] font-bold text-white/70 backdrop-blur">${p.badge||p.category}</span>
        <span class="block truncate px-0.5 text-sm font-bold text-white">${p.label}</span>
        <span class="mt-1 block min-h-8 px-0.5 text-[10px] leading-4 text-white/45">${p.hint}</span>
        <span class="mt-1.5 block px-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200/60">${p.aspect} · ${p.wave} · ${p.motion}</span>
      </button>`).join('')}
    </div>`;

  label.parentElement?.insertBefore(wrap,label);

  const cards = Array.from(wrap.querySelectorAll<HTMLButtonElement>('[data-preset]'));
  cards.forEach((card) => card.addEventListener('click', () => {
    const preset = VIDEO_PRESETS.find((p) => p.id === card.dataset.preset);
    if (!preset) return;
    applyPreset(visualizer,preset);
    cards.forEach((x) => { x.classList.remove('border-fuchsia-300/45','bg-fuchsia-300/[.04]'); x.classList.add('border-white/10'); });
    card.classList.remove('border-white/10'); card.classList.add('border-fuchsia-300/45','bg-fuchsia-300/[.04]');
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
