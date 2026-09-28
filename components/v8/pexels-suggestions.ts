export function backgroundSearchQuery(text:string){
 const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const themes:[RegExp,string][]=[
  [/\b(rain|mua|sad|buon|lonely|co don)\b/,'rainy window night'],
  [/\b(ocean|sea|bien|song bien)\b/,'ocean sunset'],
  [/\b(love|yeu|romantic|ballad|tinh)\b/,'sunset flowers landscape'],
  [/\b(edm|electronic|dance|synth|cyberpunk)\b/,'neon city night'],
  [/\b(rap|hip hop|trap|urban)\b/,'city night skyline'],
  [/\b(chill|lofi|lo-fi|jazz|piano)\b/,'misty forest lake'],
  [/\b(rock|metal|epic|cinematic)\b/,'dramatic mountains'],
  [/\b(happy|vui|summer|tropical)\b/,'sunny tropical beach'],
 ];
 return themes.find(([pattern])=>pattern.test(normalized))?.[1]||'scenic sunset landscape';
}
export function pexelsOrientation(aspect:string){return aspect==='1:1'?'square':aspect==='16:9'?'landscape':'portrait';}
export function rankBackgroundPhotos<T extends {width:number;height:number;alt?:string}>(photos:T[],aspect:string){
 const [w,h]=aspect.split(':').map(Number),ratio=w/h;
 return [...photos].sort((a,b)=>score(b)-score(a));
 function score(p:T){
  return -Math.abs(Math.log((p.width/p.height)/ratio))*4+Math.min(p.width*p.height/2000000,2)-(/portrait|selfie|text|logo/i.test(p.alt||'')?2:0);
 }
}
