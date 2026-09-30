import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Song, StudioAspect } from './types';

type Photo={
  id:number;width:number;height:number;alt?:string;url:string;
  photographer?:{name:string};
  src?:{medium?:string;large?:string;large2x?:string;portrait?:string};
  download:string;
};

const SUBJECTS=[
  'lonely silhouette at sunset','couple silhouette under street lights','moody portrait with backlight','cinematic profile portrait',
  'person walking on empty road','night city skyline','rainy neon street','futuristic neon tunnel','ocean horizon at dusk',
  'dramatic mountain landscape','misty forest path','moonlit clouds','desert dunes at sunset','starry night sky',
  'abstract smoke and light','abstract liquid gradient','glowing particles on dark background','prism light reflections',
  'flower field at sunset','vintage car on night road','empty train station at night','cozy room with rainy window',
  'concert stage lights','minimal architecture and shadows','surreal dream landscape',
];
const DIRECTIONS=[
  'cinematic music cover','premium album cover background','HD editorial photography','fine art photography','moody film still',
  'dreamy atmospheric art','dark aesthetic cover','soft volumetric lighting','dramatic rim lighting','minimal negative space',
  'surreal visual art','ethereal fantasy mood','neon cyberpunk aesthetic','retro film grain','luxury editorial style',
  'high contrast photography','blue hour cinematic','golden hour cinematic','monochrome fine art','color grade poster background',
];
const KEYWORDS=SUBJECTS.flatMap(subject=>DIRECTIONS.map(direction=>direction+' '+subject));

function searchQuery(text:string){
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
function orientation(aspect:StudioAspect){return aspect==='1:1'?'square':aspect==='16:9'||aspect==='4:3'?'landscape':'portrait'}
function rank(photos:Photo[],aspect:StudioAspect){
  const parts=aspect.split(':').map(Number); const w=parts[0]||9,h=parts[1]||16,ratio=w/h;
  return [...photos].sort((a,b)=>score(b)-score(a));
  function score(p:Photo){
    const imageRatio=p.width/p.height,pixels=p.width*p.height,alt=(p.alt||'').toLowerCase();
    return -Math.abs(Math.log(imageRatio/ratio))*5.2+Math.min(pixels/2500000,2.8)+(pixels>=4000000?.9:pixels>=2500000?.45:0)+(/silhouette|landscape|sky|cloud|night|light|shadow|abstract|portrait|ocean|mountain|forest|city/i.test(alt)?.35:0)-(/text|logo|poster|sign|screenshot|selfie|phone screen|watermark|document/i.test(alt)?2.8:0);
  }
}
function randomKeyword(exclude?:string){
  if(!KEYWORDS.length)return 'cinematic music cover moody silhouette HD';
  let next=KEYWORDS[Math.floor(Math.random()*KEYWORDS.length)]!;
  for(let i=0;i<10&&next===exclude;i++)next=KEYWORDS[Math.floor(Math.random()*KEYWORDS.length)]!;
  return next;
}

export function SuggestedBackground({
  song,aspect,selectedUri,disabled,onApply,onBrowse,
}:{
  song:Song;aspect:StudioAspect;selectedUri?:string;disabled:boolean;onApply:(uri:string)=>void;onBrowse:()=>void;
}){
  const songText=useMemo(()=>[song.title,song.style,song.tags].filter(Boolean).join(' '),[song.title,song.style,song.tags]);
  const [attempt,setAttempt]=useState(0);
  const [random,setRandom]=useState<string|null>(null);
  const [query,setQuery]=useState('');
  const [photos,setPhotos]=useState<Photo[]>([]);
  const [busy,setBusy]=useState(false);
  const [applying,setApplying]=useState<number|null>(null);
  const [status,setStatus]=useState('');

  useEffect(()=>{setRandom(null);setAttempt(0)},[song.id,song.audio]);
  useEffect(()=>{
    let disposed=false;
    const controller=new AbortController();
    void (async()=>{
      setBusy(true);setStatus('');
      const q=random||searchQuery(songText);setQuery(q);
      try{
        const params=new URLSearchParams({q,orientation:orientation(aspect),per_page:'18'});
        const response=await fetch('https://pexels.aiautotool.com/v1/photos?'+params.toString(),{signal:controller.signal});
        if(!response.ok)throw new Error('Chưa tìm được ảnh gợi ý.');
        const data=await response.json();
        if(disposed)return;
        const ranked=rank((data.results||[]).filter((photo:Photo)=>photo.width>0&&photo.height>0&&photo.download),aspect).slice(0,8);
        setPhotos(ranked);
        if(!ranked.length)setStatus('Chưa có ảnh phù hợp. Hãy thử gợi ý khác.');
      }catch(e){
        if(!disposed&&!(e instanceof Error&&e.name==='AbortError'))setStatus(e instanceof Error?e.message:'Không kết nối được Pexels.');
      }finally{if(!disposed)setBusy(false)}
    })();
    return()=>{disposed=true;controller.abort()};
  },[songText,aspect,attempt,random]);

  const apply=async(photo:Photo)=>{
    if(disabled||applying!==null)return;
    setApplying(photo.id);setStatus('');
    try{
      const uri=photo.src?.large2x||photo.src?.large||photo.src?.portrait||photo.download;
      if(!uri)throw new Error('Ảnh nền không hợp lệ.');
      onApply(uri);
    }catch(e){setStatus(e instanceof Error?e.message:'Chưa áp dụng được ảnh.')}
    finally{setApplying(null)}
  };

  return <View style={styles.root}>
    <View style={styles.head}>
      <View style={{flex:1}}><Text style={styles.title}>Ảnh nền gợi ý · Pexels</Text><Text numberOfLines={1} style={styles.query}>{random?'Random · ':'Theo bài hát · '}{query} · {KEYWORDS.length} cover HD · art</Text></View>
      <Pressable disabled={disabled||busy} style={styles.other} onPress={()=>{const next=randomKeyword(query);setRandom(next);setAttempt(v=>v+1)}}><Text style={styles.otherText}>{busy?'Đang tìm…':'Gợi ý khác'}</Text></Pressable>
    </View>
    {!!status&&<Text style={styles.status}>{status}</Text>}
    {busy&&!photos.length?<View style={styles.loading}><ActivityIndicator color="#7dd3fc"/><Text style={styles.loadingText}>Đang tìm ảnh phù hợp…</Text></View>:<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
      {photos.map(photo=>{
        const preview=photo.src?.medium||photo.src?.portrait||photo.src?.large||photo.download;
        const full=photo.src?.large2x||photo.src?.large||photo.src?.portrait||photo.download;
        const selected=selectedUri===full;
        return <Pressable key={photo.id} disabled={disabled||applying!==null} onPress={()=>void apply(photo)} style={[styles.card,selected&&styles.cardActive]}>
          <Image source={{uri:preview}} style={styles.image} resizeMode="cover"/>
          <View style={styles.cardCopy}><Text style={styles.use}>{selected?'Đang dùng':applying===photo.id?'Đang áp dụng…':'Dùng ảnh này'}</Text><Text numberOfLines={1} style={styles.credit}>{photo.photographer?.name||'Pexels'}</Text></View>
        </Pressable>;
      })}
    </ScrollView>}
    <View style={styles.actions}><Pressable disabled={disabled} onPress={onBrowse} style={styles.browse}><Text style={styles.browseText}>Mở kho ảnh/video</Text></Pressable></View>
  </View>
}

const styles=StyleSheet.create({
  root:{marginTop:12,borderWidth:1,borderColor:'rgba(125,211,252,.18)',borderRadius:12,backgroundColor:'rgba(56,189,248,.045)',padding:11},
  head:{flexDirection:'row',alignItems:'flex-start',gap:10},title:{color:'#edf7ff',fontSize:11,fontWeight:'800'},query:{maxWidth:300,color:'#6f7e92',fontSize:8,marginTop:4},
  other:{minHeight:34,borderRadius:8,backgroundColor:'rgba(125,211,252,.12)',paddingHorizontal:11,alignItems:'center',justifyContent:'center'},otherText:{color:'#bde9ff',fontSize:9,fontWeight:'700'},
  status:{color:'#ffb4bd',fontSize:9,marginTop:6},loading:{height:90,alignItems:'center',justifyContent:'center',gap:7},loadingText:{color:'#7890a4',fontSize:9},
  list:{gap:8,paddingTop:10,paddingBottom:2},card:{width:122,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.08)',borderRadius:11,backgroundColor:'rgba(0,0,0,.22)'},cardActive:{borderColor:'rgba(125,211,252,.62)'},image:{width:'100%',height:128,backgroundColor:'#111823'},cardCopy:{paddingHorizontal:8,paddingVertical:7},use:{color:'#eef4fb',fontSize:9,fontWeight:'800'},credit:{color:'#667589',fontSize:8,marginTop:3},
  actions:{flexDirection:'row',marginTop:8},browse:{minHeight:34,borderRadius:8,backgroundColor:'rgba(255,255,255,.06)',paddingHorizontal:11,alignItems:'center',justifyContent:'center'},browseText:{color:'#b8c2d0',fontSize:9,fontWeight:'700'},
});
