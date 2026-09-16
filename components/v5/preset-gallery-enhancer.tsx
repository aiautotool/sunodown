'use client';

import { useEffect } from 'react';
import { VIDEO_PRESETS } from '@/components/v4/types';

function clickButton(root: Element, text: string) {
  const button = Array.from(root.querySelectorAll('button')).find((el) => el.textContent?.trim() === text);
  if (button instanceof HTMLButtonElement) button.click();
}

function applyPreset(root: Element, preset: (typeof VIDEO_PRESETS)[number]) {
  const templateLabels: Record<string,string> = {'cover-motion':'Cover Motion',vinyl:'Vinyl','glass-card':'Glass Card','lyrics-focus':'Lyrics Focus'};
  const motionLabels: Record<string,string> = {low:'Nhẹ',medium:'Vừa',high:'Mạnh'};
  const lyricsLabels: Record<string,string> = {off:'Tắt',scroll:'Scroll',focus:'Focus'};
  clickButton(root,templateLabels[preset.template]); clickButton(root,preset.aspect);
  clickButton(root,preset.wave[0].toUpperCase()+preset.wave.slice(1)); clickButton(root,motionLabels[preset.motion]); clickButton(root,lyricsLabels[preset.lyrics]);
}

const thumbThemes: Record<string,{bg:string;accent:string;kind:string}> = {
  'cinematic-cover':{bg:'linear-gradient(135deg,#111827,#312e81 55%,#0e7490)',accent:'#67e8f9',kind:'cover'},
  'vinyl-night':{bg:'linear-gradient(145deg,#020617,#3b0764)',accent:'#d8b4fe',kind:'vinyl'},
  'glass-neon':{bg:'linear-gradient(135deg,#082f49,#581c87,#111827)',accent:'#22d3ee',kind:'glass'},
  'lyrics-tiktok':{bg:'linear-gradient(160deg,#09090b,#831843)',accent:'#f9a8d4',kind:'lyrics'},
  'minimal-album':{bg:'linear-gradient(145deg,#18181b,#292524)',accent:'#fde68a',kind:'minimal'},
  'spectrum-club':{bg:'linear-gradient(135deg,#020617,#172554,#4c1d95)',accent:'#22d3ee',kind:'spectrum'},
  'dreamy-reels':{bg:'linear-gradient(160deg,#312e81,#701a75,#0f172a)',accent:'#e879f9',kind:'glass'},
  'karaoke-focus':{bg:'linear-gradient(135deg,#111827,#4c0519)',accent:'#fb7185',kind:'lyrics'},
  'retro-record':{bg:'linear-gradient(145deg,#422006,#1c1917)',accent:'#fbbf24',kind:'vinyl'},
  'social-pulse':{bg:'linear-gradient(160deg,#0f172a,#312e81,#164e63)',accent:'#a5f3fc',kind:'pulse'},
  'chill-glass':{bg:'linear-gradient(145deg,#083344,#312e81)',accent:'#5eead4',kind:'glass'},
  'youtube-music':{bg:'linear-gradient(135deg,#18181b,#7f1d1d)',accent:'#fca5a5',kind:'youtube'},
};

function bars(color:string){return `<div style="height:24px;display:flex;align-items:center;justify-content:center;gap:2px;color:${color}">${[7,13,20,10,24,16,8,21,12,18,9,15,22,11].map(h=>`<i style="display:block;width:2px;height:${h}px;border-radius:3px;background:currentColor"></i>`).join('')}</div>`}
function cover(){return '<i style="display:block;width:42px;height:42px;border-radius:9px;background:linear-gradient(135deg,#22d3ee,#8b5cf6 52%,#fb7185);box-shadow:0 0 22px rgba(139,92,246,.35)"></i>'}

function previewMarkup(p:(typeof VIDEO_PRESETS)[number]){
  const t=thumbThemes[p.id]||{bg:'linear-gradient(135deg,#111827,#312e81)',accent:'#a5f3fc',kind:'cover'};
  const vertical=p.aspect==='9:16'||p.aspect==='4:5', square=p.aspect==='1:1';
  const frame=vertical?'width:70px;height:116px;margin:auto':square?'width:94px;height:94px;margin:auto':'width:100%;height:84px';
  let body='';
  if(t.kind==='vinyl') body=`<div style="height:100%;display:flex;align-items:center;justify-content:center;gap:9px"><div style="position:relative;width:48px;height:48px;border-radius:50%;background:repeating-radial-gradient(circle,#27272a 0 2px,#09090b 3px 6px);border:1px solid rgba(255,255,255,.2)"><i style="position:absolute;inset:14px;border-radius:50%;background:${t.accent}"></i><i style="position:absolute;left:23px;top:23px;width:3px;height:3px;border-radius:50%;background:#000"></i></div><div style="flex:1"><i style="display:block;width:75%;height:5px;border-radius:5px;background:rgba(255,255,255,.75)"></i><i style="display:block;margin-top:5px;width:48%;height:3px;border-radius:5px;background:rgba(255,255,255,.25)"></i>${bars(t.accent)}</div></div>`;
  else if(t.kind==='lyrics') body=`<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"><b style="font-size:8px;line-height:12px;color:white">KHI GIAI ĐIỆU<br>CHẠM VÀO KÝ ỨC</b><span style="font-size:6px;color:rgba(255,255,255,.4);margin-top:3px">lyrics đang phát</span><div style="width:80%;margin-top:4px">${bars(t.accent)}</div></div>`;
  else if(t.kind==='glass') body=`<div style="height:100%;display:flex;align-items:center;justify-content:center"><div style="width:90%;display:flex;align-items:center;gap:8px;padding:8px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.25)">${cover()}<div style="flex:1"><i style="display:block;width:80%;height:5px;border-radius:5px;background:rgba(255,255,255,.8)"></i><i style="display:block;margin-top:4px;width:50%;height:3px;border-radius:5px;background:rgba(255,255,255,.3)"></i>${bars(t.accent)}</div></div></div>`;
  else if(t.kind==='spectrum') body=`<div style="height:100%;display:flex;flex-direction:column;justify-content:center"><div style="font-size:7px;font-weight:700;color:white;text-align:center;letter-spacing:1px">SPECTRUM</div>${bars(t.accent)}<div style="height:1px;background:linear-gradient(90deg,transparent,${t.accent},transparent)"></div></div>`;
  else if(t.kind==='pulse') body=`<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center">${cover()}<div style="position:relative;width:70%;height:24px;margin-top:5px"><i style="position:absolute;left:50%;top:50%;width:12px;height:12px;transform:translate(-50%,-50%);border-radius:50%;background:${t.accent};box-shadow:0 0 18px ${t.accent}"></i><i style="position:absolute;left:0;right:0;top:50%;height:1px;background:${t.accent};opacity:.5"></i></div></div>`;
  else if(t.kind==='youtube') body=`<div style="height:100%;display:flex;align-items:center;gap:9px"><div style="position:relative;width:48px;height:48px;border-radius:50%;background:#09090b;border:1px solid rgba(255,255,255,.18)"><i style="position:absolute;inset:14px;border-radius:50%;background:#ef4444"></i></div><div style="flex:1"><b style="font-size:7px;color:white">YOUTUBE MUSIC</b>${bars(t.accent)}</div></div>`;
  else if(t.kind==='minimal') body=`<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center">${cover()}<i style="display:block;margin-top:6px;width:45%;height:4px;border-radius:4px;background:rgba(255,255,255,.75)"></i><div style="width:60%;height:1px;margin-top:8px;background:${t.accent}"></div></div>`;
  else body=vertical?`<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center">${cover()}<i style="display:block;margin-top:6px;width:42px;height:4px;border-radius:4px;background:rgba(255,255,255,.8)"></i><div style="width:50px">${bars(t.accent)}</div></div>`:`<div style="height:100%;display:flex;align-items:center;gap:9px">${cover()}<div style="flex:1"><i style="display:block;width:72%;height:5px;border-radius:5px;background:rgba(255,255,255,.8)"></i><i style="display:block;margin-top:4px;width:45%;height:3px;border-radius:5px;background:rgba(255,255,255,.28)"></i>${bars(t.accent)}</div></div>`;
  return `<div data-thumb="${p.id}" style="height:136px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;padding:8px;border-radius:12px;overflow:hidden;background:${t.bg};border:1px solid rgba(255,255,255,.12)"><div style="${frame};padding:8px;overflow:hidden;border-radius:9px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12)">${body}</div></div>`;
}

function mountGallery(){
  const label=Array.from(document.querySelectorAll('p')).find(el=>el.textContent?.trim()==='Template');
  if(!label||document.getElementById('v5-video-preset-gallery'))return;
  const visualizer=label.closest('div.rounded-2xl'); if(!visualizer)return;
  const wrap=document.createElement('div'); wrap.id='v5-video-preset-gallery'; wrap.className='mt-5';
  wrap.innerHTML=`<div class="flex items-end justify-between gap-3"><div><p class="text-[11px] font-bold uppercase text-white/40">Video mẫu</p><p class="mt-1 text-xs text-white/45">Tất cả preset đều có thumbnail riêng. Chạm mẫu để áp dụng ngay.</p></div><span class="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-1 text-[10px] font-bold text-fuchsia-200">12 PRESET</span></div><div class="mt-3 flex gap-2 overflow-x-auto pb-2" data-preset-filters>${['Tất cả','Album','Social','Lyrics','Visualizer'].map((x,i)=>`<button data-filter="${x}" class="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${i===0?'border-fuchsia-300/40 bg-fuchsia-300/15 text-fuchsia-100':'border-white/10 bg-black/20 text-white/50'}">${x}</button>`).join('')}</div><div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">${VIDEO_PRESETS.map((p,i)=>`<button data-preset="${p.id}" data-category="${p.category}" class="relative overflow-hidden rounded-2xl border ${i===0?'border-fuchsia-300/45':'border-white/10'} bg-white/[.035] p-2.5 text-left transition hover:border-fuchsia-300/35">${previewMarkup(p)}<span class="absolute right-4 top-4 rounded-md border border-white/10 bg-black/60 px-1.5 py-1 text-[9px] font-bold text-white/75">${p.badge||p.category}</span><span class="block truncate text-sm font-bold text-white">${p.label}</span><span class="mt-1 block min-h-8 text-[10px] leading-4 text-white/45">${p.hint}</span><span class="mt-1 block text-[9px] font-semibold uppercase text-cyan-200/60">${p.aspect} · ${p.wave} · ${p.motion}</span></button>`).join('')}</div>`;
  label.parentElement?.insertBefore(wrap,label);
  const cards=Array.from(wrap.querySelectorAll<HTMLButtonElement>('[data-preset]'));
  cards.forEach(card=>card.addEventListener('click',()=>{const p=VIDEO_PRESETS.find(x=>x.id===card.dataset.preset);if(!p)return;applyPreset(visualizer,p);cards.forEach(x=>{x.classList.remove('border-fuchsia-300/45');x.classList.add('border-white/10')});card.classList.remove('border-white/10');card.classList.add('border-fuchsia-300/45')}));
  const filters=Array.from(wrap.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  filters.forEach(button=>button.addEventListener('click',()=>{const f=button.dataset.filter||'Tất cả';filters.forEach(x=>x.className='shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-bold text-white/50');button.className='shrink-0 rounded-full border border-fuchsia-300/40 bg-fuchsia-300/15 px-3 py-1.5 text-[11px] font-bold text-fuchsia-100';cards.forEach(card=>card.style.display=f==='Tất cả'||card.dataset.category===f?'':'none')}));
}

export function V5PresetGalleryEnhancer(){useEffect(()=>{mountGallery();const o=new MutationObserver(mountGallery);o.observe(document.body,{childList:true,subtree:true});return()=>o.disconnect()},[]);return null}
