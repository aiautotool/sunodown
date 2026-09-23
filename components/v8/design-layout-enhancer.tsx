'use client';
import {useEffect} from 'react';

export function V8DesignLayoutEnhancer(){
  useEffect(()=>{
    const listeners = new AbortController();
    const tracks = new WeakSet<HTMLElement>();
    const apply=()=>{
      const main=document.querySelector('.v7-workspace main');
      const article=main?.querySelector('article');
      if(!main||!article)return;
      main.classList.add('v8-app-flow');
      article.classList.add('v8-song-studio');
      const input=main.querySelector('input[placeholder*="Suno"]');
      input?.parentElement?.classList.add('v8-link-card');
      article.firstElementChild?.classList.add('v8-song-detail');
      main.querySelectorAll<HTMLElement>('.v5-preset-track, .v8-effects-track').forEach(track => {
        if (tracks.has(track)) return;
        tracks.add(track);
        let startX = 0, startScroll = 0, dragging = false, moved = false;
        const options = {signal: listeners.signal};
        track.addEventListener('pointerdown', event => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          startX = event.clientX;
          startScroll = track.scrollLeft;
          dragging = true;
          moved = false;
        }, options);
        track.addEventListener('pointermove', event => {
          if (!dragging) return;
          const delta = event.clientX - startX;
          if (!moved && Math.abs(delta) < 5) return;
          moved = true;
          track.setPointerCapture(event.pointerId);
          track.classList.add('is-dragging');
          track.scrollLeft = startScroll - delta;
          event.preventDefault();
        }, options);
        const stop = () => {
          dragging = false;
          track.classList.remove('is-dragging');
        };
        track.addEventListener('pointerup', stop, options);
        track.addEventListener('pointercancel', stop, options);
        track.addEventListener('lostpointercapture', stop, options);
        track.addEventListener('pointerleave', () => { if (!moved) stop(); }, options);
        track.addEventListener('click', event => {
          if (!moved) return;
          event.preventDefault();
          event.stopPropagation();
          moved = false;
        }, {...options, capture: true});
        track.addEventListener('dragstart', event => event.preventDefault(), options);
      });
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();listeners.abort();};
  },[]);

  return <style>{`
.v8-app-flow{max-width:none!important}
.v8-link-card{padding:16px;border:1px solid rgba(139,92,246,.18);border-radius:18px;background:linear-gradient(145deg,rgba(124,58,237,.09),rgba(8,20,33,.96));box-shadow:0 14px 50px rgba(0,0,0,.16)}
.v8-song-studio{overflow:visible!important}
.v8-song-detail{padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.07)}
.v8-song-detail img{box-shadow:0 12px 35px rgba(0,0,0,.28)}
.v8-app-flow button{transition:transform .16s ease,background .16s ease,border-color .16s ease}
.v8-app-flow button:active{transform:scale(.98)}
#studio-editor{min-width:0}
#studio-editor>section{min-width:0}
#studio-editor>section>.grid{grid-template-columns:minmax(0,1fr)}
#studio-editor>section>.grid>div{min-width:0}
#v5-video-preset-gallery{min-width:0;max-width:100%}
.v5-preset-track,.v8-effects-track{display:flex;flex-wrap:nowrap;gap:10px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scroll-padding-inline:4px;padding:4px 4px 16px;scrollbar-width:thin;scrollbar-color:rgba(167,139,250,.45) transparent}
.v5-preset-track>[data-preset]{flex:0 0 164px;min-width:0;scroll-snap-align:start}
.v5-preset-track>[data-preset]:focus-visible,.v8-effects-track>button:focus-visible{outline:2px solid #67e8f9;outline-offset:2px}
.v5-preset-track,.v5-preset-track>[data-preset],.v8-effects-track,.v8-effects-track>button{cursor:grab;user-select:none}
.v5-preset-track.is-dragging,.v8-effects-track.is-dragging{scroll-snap-type:none}
.v5-preset-track.is-dragging,.v5-preset-track.is-dragging>[data-preset],.v8-effects-track.is-dragging,.v8-effects-track.is-dragging>button{cursor:grabbing}
#effects-slot,#video-effects{min-width:0;max-width:100%}
.v8-effects-track>button{flex:0 0 96px;min-width:0;scroll-snap-align:start}
#render-zone{position:relative;z-index:1;overflow:hidden}
#render-zone>div:first-of-type{margin-bottom:10px!important}
#render-zone canvas,#render-zone video{display:block;max-width:100%}
#render-zone input[type="range"]{min-width:0}
#studio-editor>section,#video-effects{box-shadow:none!important}
#studio-editor>section{overflow:hidden}
#studio-editor>section+section,#studio-editor>section+#effects-slot{margin-top:0!important}

@media(min-width:900px){
  .v8-song-studio{display:grid!important;grid-template-columns:minmax(0,1.36fr) minmax(360px,.64fr);column-gap:22px;row-gap:16px;align-items:start}
  .v8-song-detail{grid-column:1/-1}
  .v8-song-studio>div:nth-of-type(2){grid-column:1/-1}
  #studio-editor{grid-column:1;grid-row:auto;gap:12px!important;min-width:0}
  #render-zone{grid-column:2;grid-row:3 / span 20;position:sticky;top:16px;margin-top:0!important;align-self:start;min-width:0;max-height:calc(100vh - 32px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
  .v8-link-card{max-width:820px}
}

@media(max-width:767px){
  .v8-link-card{margin-top:12px!important;padding:12px}
  .v8-link-card input{height:52px!important}
  .v8-song-studio{border-radius:18px!important}
  .v8-song-detail{display:grid!important;grid-template-columns:82px minmax(0,1fr);gap:12px!important}
  .v8-song-detail img{width:82px!important;height:82px!important;border-radius:14px!important}
  .v8-song-detail audio{grid-column:1/-1;width:100%;height:38px}
  #studio-editor{gap:12px!important}
  #studio-editor>section,#video-effects{padding:12px!important;border-radius:14px!important}
  #studio-editor button{min-height:34px}
  #render-zone{position:static!important;margin-top:14px!important;padding:12px!important;max-height:none!important;overflow:visible!important}
  .v8-app-flow video{border-radius:14px!important}
  .v8-effects-track>button{flex-basis:88px}
  .v5-preset-track>[data-preset]{flex-basis:154px}
}
`}</style>;
}
