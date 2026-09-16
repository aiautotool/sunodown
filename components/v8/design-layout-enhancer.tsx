'use client';
import {useEffect} from 'react';

export function V8DesignLayoutEnhancer(){
  useEffect(()=>{
    const apply=()=>{
      const main=document.querySelector('.v7-workspace main');
      const article=main?.querySelector('article');
      if(!main||!article)return;
      main.classList.add('v8-app-flow');
      article.classList.add('v8-song-studio');
      const input=main.querySelector('input[placeholder*="Suno"]');
      input?.parentElement?.classList.add('v8-link-card');
      article.firstElementChild?.classList.add('v8-song-detail');
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
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
#render-zone{position:relative;z-index:1}
#preview-result{position:relative;z-index:1;overflow:hidden}

@media(min-width:900px){
  .v8-song-studio{display:grid!important;grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr);gap:20px;align-items:start}
  .v8-song-detail{grid-column:1/-1}
  #studio-editor{grid-column:1;grid-row:2 / span 3}
  #render-zone{grid-column:2;grid-row:2;position:sticky;top:18px;margin-top:24px!important}
  #preview-result{grid-column:2;grid-row:3;margin-top:0!important}
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
  #render-zone{position:static!important;margin-top:14px!important;padding:12px!important}
  #preview-result{margin-top:12px!important}
  .v8-app-flow video{border-radius:14px!important}
}
`}</style>;
}
