export function backgroundSearchQuery(text:string){
 const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const themes:[RegExp,string][]=[
  [/\b(rain|mua|sad|buon|lonely|co don|heartbreak|broken)\b/,'cinematic music cover rainy window moody silhouette'],
  [/\b(ocean|sea|bien|song bien)\b/,'cinematic ocean dusk album cover background'],
  [/\b(love|yeu|romantic|ballad|tinh|wedding)\b/,'romantic cinematic couple silhouette sunset cover'],
  [/\b(edm|electronic|dance|synth|cyberpunk|techno)\b/,'neon cyberpunk music cover city lights abstract'],
  [/\b(rap|hip hop|trap|urban)\b/,'moody urban night editorial music cover'],
  [/\b(chill|lofi|lo-fi|jazz|piano|acoustic)\b/,'dreamy atmospheric music cover misty landscape'],
  [/\b(rock|metal|epic|cinematic|orchestra)\b/,'dramatic cinematic landscape music cover'],
  [/\b(happy|vui|summer|tropical|bright)\b/,'golden hour colorful music cover landscape'],
 ];
 return themes.find(([pattern])=>pattern.test(normalized))?.[1]||'premium cinematic music cover background HD';
}

export function pexelsOrientation(aspect:string){
 return aspect==='1:1'?'square':aspect==='16:9'||aspect==='4:3'?'landscape':'portrait';
}

export function rankBackgroundPhotos<T extends {width:number;height:number;alt?:string}>(photos:T[],aspect:string){
 const [w,h]=aspect.split(':').map(Number),ratio=w/h;
 return [...photos].sort((a,b)=>score(b)-score(a));
 function score(p:T){
  const imageRatio=p.width/p.height;
  const pixels=p.width*p.height;
  const alt=(p.alt||'').toLowerCase();
  const aspectScore=-Math.abs(Math.log(imageRatio/ratio))*5.2;
  const resolutionScore=Math.min(pixels/2500000,2.8);
  const hdBonus=pixels>=4000000?.9:pixels>=2500000?.45:0;
  const badContentPenalty=/text|logo|poster|sign|screenshot|selfie|phone screen|watermark|document/i.test(alt)?2.8:0;
  const coverFriendlyBonus=/silhouette|landscape|sky|cloud|night|light|shadow|abstract|portrait|ocean|mountain|forest|city/i.test(alt)?.35:0;
  return aspectScore+resolutionScore+hdBonus+coverFriendlyBonus-badContentPenalty;
 }
}
