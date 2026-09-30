import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FileText, Image as ImageIcon, Music2, SlidersHorizontal, Sparkles } from 'lucide-react-native';
import type { KaraokeLine, Song, StudioAspect, StudioLyricsMode as LyricsMode, StudioMotion as Motion, StudioVisualConfig } from './types';
export type { StudioVisualConfig } from './types';

export const DEFAULT_VISUAL_CONFIG:StudioVisualConfig={
  presetId:'signature-mirror-glow',
  template:'cover-motion',
  wave:'mirror-glow',
  motion:'low',
  aspect:'9:16',
  lyrics:'focus',
  effects:['sparkles','bokeh','vignette'],
  titleFont:'Dancing Script',
  titleColor:'#ffd8f4',
  creatorColor:'#e9d5ff',
  subtitleFont:'serif',
  subtitleColor:'#ffffff',
  subtitleActiveColor:'#f0abfc',
  backgroundMode:'suno',
  backgroundPreset:'dark-film',
  waveGlow:96,
  waveHeight:108,
  waveSmoothing:88,
  waveColor:'#d946ef',
  waveColor2:'#60a5fa',
  waveThickness:46,
  waveOpacity:92,
  waveDensity:72,
  waveRotation:0,
  titleScale:100,
  creatorScale:100,
  subtitleScale:100,
  effectSpeed:1,
  effectAngle:0,
  effectDensity:1,
  effectSize:1,
  eqBass:0,
  eqVocal:0,
  eqTreble:0,
  trimStart:0,
  trimEnd:0,
  audioPreset:'Original',
  quality:'high',
};

type Preset={
  id:string;name:string;description:string;category:string;badge:string;accent:string;secondary:string;
  template:string;wave:string;motion:Motion;aspect:StudioAspect;lyrics:LyricsMode;effects:string[];
};
export const V24_PRESETS:Preset[]=[
  {id:'social-hook',name:'Viral Hook',description:'Video dọc bắt mắt ngay 3 giây đầu.',category:'Social',badge:'Popular',accent:'#8b5cf6',secondary:'#ec4899',template:'glass-card',wave:'rounded-spectrum',motion:'high',aspect:'9:16',lyrics:'focus',effects:['sparkles','vignette']},
  {id:'sad-lyrics',name:'Sad Lyrics Cinema',description:'Ballad cảm xúc, lyric làm trung tâm.',category:'Lyrics',badge:'Ballad',accent:'#6366f1',secondary:'#94a3b8',template:'lyrics-focus',wave:'mirror-glow',motion:'low',aspect:'9:16',lyrics:'focus',effects:['film','vignette']},
  {id:'cinematic-story',name:'Cinema Story',description:'Khung hình điện ảnh, title thanh lịch.',category:'Cinematic',badge:'Premium',accent:'#f59e0b',secondary:'#7c2d12',template:'editorial',wave:'circular-pulse',motion:'low',aspect:'16:9',lyrics:'scroll',effects:['lightleak','film','vignette']},
  {id:'album-motion',name:'Midnight Vinyl',description:'Đĩa than quay, waveform vòng tròn.',category:'Album',badge:'Album',accent:'#22c55e',secondary:'#06b6d4',template:'vinyl',wave:'circle-bars',motion:'medium',aspect:'1:1',lyrics:'off',effects:['bokeh','vignette']},
  {id:'neon-pulse',name:'Neon Pulse',description:'EDM/synthwave với neon glow mạnh.',category:'Visualizer',badge:'EDM',accent:'#06b6d4',secondary:'#d946ef',template:'glass-card',wave:'rounded-spectrum',motion:'high',aspect:'9:16',lyrics:'off',effects:['sparkles','stars','lightleak']},
  {id:'minimal-clean',name:'Minimal Clean',description:'Tối giản, sạch và ít hiệu ứng.',category:'Album',badge:'Clean',accent:'#64748b',secondary:'#e2e8f0',template:'cover-motion',wave:'ribbon-wave',motion:'low',aspect:'4:5',lyrics:'off',effects:['vignette']},
  {id:'karaoke-pop',name:'Karaoke Pop',description:'Highlight từng câu để hát theo.',category:'Lyrics',badge:'Karaoke',accent:'#f43f5e',secondary:'#fb7185',template:'lyrics-focus',wave:'mirror',motion:'medium',aspect:'16:9',lyrics:'focus',effects:['bokeh']},
  {id:'gold-premiere',name:'Golden Premiere',description:'Ra mắt ca khúc phong cách luxury.',category:'Cinematic',badge:'Launch',accent:'#fbbf24',secondary:'#92400e',template:'gold-record',wave:'dots',motion:'low',aspect:'16:9',lyrics:'off',effects:['dust','film','vignette']},
  {id:'reels-velocity',name:'Reels Velocity',description:'Nhịp nhanh cho Reels/Shorts.',category:'Social',badge:'New',accent:'#22d3ee',secondary:'#a855f7',template:'spotlight',wave:'wave-bars',motion:'high',aspect:'9:16',lyrics:'focus',effects:['sparkles','lightleak','vignette']},
  {id:'story-confession',name:'Confession Story',description:'Tập trung lời kể và lyric.',category:'Lyrics',badge:'Story',accent:'#c084fc',secondary:'#64748b',template:'lyrics-focus',wave:'ribbon-wave',motion:'low',aspect:'9:16',lyrics:'scroll',effects:['film','dust','vignette']},
  {id:'midnight-drive',name:'Midnight Drive',description:'Không khí thành phố về đêm.',category:'Visualizer',badge:'Night',accent:'#38bdf8',secondary:'#818cf8',template:'glass-card',wave:'circular-pulse',motion:'medium',aspect:'16:9',lyrics:'off',effects:['stars','bokeh','vignette']},
  {id:'acoustic-room',name:'Acoustic Journal',description:'Ấm, tối giản cho acoustic/live.',category:'Album',badge:'Acoustic',accent:'#f59e0b',secondary:'#d6d3d1',template:'cover-motion',wave:'ribbon-wave',motion:'low',aspect:'4:5',lyrics:'scroll',effects:['dust','vignette']},
  {id:'festival-energy',name:'Festival Pulse',description:'Visualizer năng lượng cao cho EDM.',category:'Visualizer',badge:'Live',accent:'#f472b6',secondary:'#22d3ee',template:'spotlight',wave:'rounded-spectrum',motion:'high',aspect:'16:9',lyrics:'off',effects:['sparkles','stars','lightleak']},
  {id:'romantic-letter',name:'Romantic Letter',description:'Thư tình điện ảnh, glow hồng dịu.',category:'Cinematic',badge:'Love',accent:'#fb7185',secondary:'#fda4af',template:'editorial',wave:'mirror-glow',motion:'low',aspect:'16:9',lyrics:'focus',effects:['bokeh','film','vignette']},
  {id:'golden-floating-title',name:'Golden Floating Title',description:'Title vàng ánh kim làm tâm điểm.',category:'Cinematic',badge:'Title',accent:'#f3c768',secondary:'#8f5d20',template:'cover-motion',wave:'thin-bars',motion:'low',aspect:'9:16',lyrics:'focus',effects:['bokeh','film','vignette']},
  {id:'silver-moon-script',name:'Silver Moon Script',description:'Title bạc lạnh kiểu ánh trăng.',category:'Cinematic',badge:'Silver',accent:'#cbd5e1',secondary:'#64748b',template:'cover-motion',wave:'line',motion:'low',aspect:'9:16',lyrics:'focus',effects:['stars','film','vignette']},
  {id:'neon-heartbeat-title',name:'Neon Heartbeat Title',description:'Title neon hồng tím pulse.',category:'Visualizer',badge:'Neon',accent:'#f472d0',secondary:'#7c3aed',template:'glass-card',wave:'rounded-spectrum',motion:'medium',aspect:'9:16',lyrics:'off',effects:['sparkles','lightleak','vignette']},
  {id:'vintage-love-letter',name:'Vintage Love Letter',description:'Chữ ký màu kem pha đỏ rượu.',category:'Cinematic',badge:'Letter',accent:'#d6b38b',secondary:'#7f1d1d',template:'editorial',wave:'thin-bars',motion:'low',aspect:'4:5',lyrics:'scroll',effects:['dust','film','vignette']},
  {id:'midnight-blue-glow',name:'Midnight Blue Glow',description:'Title xanh đêm phát sáng.',category:'Cinematic',badge:'Night',accent:'#7dd3fc',secondary:'#4338ca',template:'cover-motion',wave:'mountain',motion:'low',aspect:'16:9',lyrics:'focus',effects:['stars','bokeh','vignette']},
  {id:'podcast-wave',name:'Podcast Clean',description:'Bố cục sạch cho spoken-word.',category:'Social',badge:'Voice',accent:'#10b981',secondary:'#94a3b8',template:'glass-card',wave:'center-line',motion:'low',aspect:'1:1',lyrics:'scroll',effects:['vignette']},
  {id:'retro-vinyl',name:'Warm Retro Vinyl',description:'Vinyl retro với film grain.',category:'Album',badge:'Retro',accent:'#fbbf24',secondary:'#a16207',template:'vinyl',wave:'orbit-dots',motion:'medium',aspect:'1:1',lyrics:'off',effects:['film','dust','vignette']},
  {id:'signature-mirror-glow',name:'Mirror Glow',description:'Waveform phản chiếu phát sáng.',category:'Visualizer',badge:'Signature · Ballad',accent:'#f24fda',secondary:'#6cbcff',template:'cover-motion',wave:'mirror-glow',motion:'low',aspect:'9:16',lyrics:'off',effects:['sparkles','bokeh','vignette']},
  {id:'signature-rounded-spectrum',name:'Rounded Spectrum',description:'Spectrum cyan-magenta cyberpunk.',category:'Visualizer',badge:'Signature · EDM',accent:'#45d8ff',secondary:'#ff4fd8',template:'glass-card',wave:'rounded-spectrum',motion:'high',aspect:'9:16',lyrics:'off',effects:['sparkles','lightleak','vignette']},
  {id:'signature-circular-pulse',name:'Circular Pulse',description:'Vòng phổ 360° theo beat.',category:'Cinematic',badge:'Signature · Cinema',accent:'#ffd98a',secondary:'#ff9d55',template:'spotlight',wave:'circular-pulse',motion:'medium',aspect:'9:16',lyrics:'off',effects:['dust','lightleak','vignette']},
  {id:'signature-ribbon-wave',name:'Ribbon Wave',description:'Dải lụa ánh sáng dream pop.',category:'Visualizer',badge:'Signature · Dream',accent:'#a985ff',secondary:'#ff75d8',template:'cover-motion',wave:'ribbon-wave',motion:'low',aspect:'9:16',lyrics:'off',effects:['sparkles','stars','vignette']},
];

const tabs=[
  ['audio','Âm thanh',Music2],['presets','Mẫu hoàn chỉnh',Sparkles],['style','Kiểu hình ảnh',Sparkles],
  ['text','Văn bản',FileText],['wave','Sóng nhạc',SlidersHorizontal],['lyrics','Lời bài hát',FileText],
  ['format','Định dạng',SlidersHorizontal],['background','Nền',ImageIcon],['effects','Hiệu ứng',Sparkles],['trim','Cắt',SlidersHorizontal],
] as const;
export type StudioPanel=(typeof tabs)[number][0];

export function recommendPresets(song:Song){
  const hay=(song.style+' '+song.tags+' '+song.lyrics).toLowerCase();
  const score=(p:Preset)=>{
    let s=p.aspect==='9:16'?2:0;
    if(song.lyrics&&p.lyrics!=='off')s+=3;
    if(/ballad|sad|emotional|piano|acoustic|love|romantic/.test(hay)&&['sad-lyrics','romantic-letter','acoustic-room','story-confession','golden-floating-title','silver-moon-script','vintage-love-letter','midnight-blue-glow'].includes(p.id))s+=7;
    if(/edm|electronic|dance|house|synth|techno|festival/.test(hay)&&['neon-pulse','festival-energy','reels-velocity','neon-heartbeat-title'].includes(p.id))s+=8;
    if(/chill|lofi|lo-fi|jazz|soul|retro|night|dream/.test(hay)&&['minimal-clean','midnight-drive','retro-vinyl','silver-moon-script','midnight-blue-glow'].includes(p.id))s+=6;
    return s;
  };
  return [...V24_PRESETS].sort((a,b)=>score(b)-score(a)).slice(0,3);
}

export function applyPresetConfig(current:StudioVisualConfig,preset:Preset,duration:number):StudioVisualConfig{
  return {...current,presetId:preset.id,template:preset.template,wave:preset.wave,motion:preset.motion,aspect:preset.aspect,lyrics:preset.lyrics,effects:[...preset.effects],trimEnd:current.trimEnd||duration};
}

export function V24StudioControls({
  song,config,onChange,timeline,subtitleLoading,subtitleError,onReget,onPickBackground,
  panel:controlledPanel,onPanelChange,
}:{
  song:Song;config:StudioVisualConfig;onChange:(next:StudioVisualConfig)=>void;timeline:KaraokeLine[];
  subtitleLoading:boolean;subtitleError:string;onReget:()=>void;onPickBackground:()=>void;
  panel?:StudioPanel;onPanelChange?:(panel:StudioPanel)=>void;
}){
  const [internalPanel,setInternalPanel]=useState<StudioPanel>('audio');
  const panel=controlledPanel??internalPanel;
  const setPanel=(value:StudioPanel)=>{setInternalPanel(value);onPanelChange?.(value)};
  const [category,setCategory]=useState('Nổi bật');
  const categories=['Nổi bật','Social','Lyrics','Cinematic','Album','Visualizer'];
  const presets=useMemo(()=>category==='Nổi bật'?V24_PRESETS:V24_PRESETS.filter(p=>p.category===category),[category]);
  const set=<K extends keyof StudioVisualConfig>(key:K,value:StudioVisualConfig[K])=>onChange({...config,[key]:value});

  return <View style={styles.root}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {tabs.map(([id,label,Icon])=><Pressable key={id} onPress={()=>setPanel(id)} style={[styles.tab,panel===id&&styles.tabActive]}><Icon size={16} color={panel===id?'#fff':'#8e99aa'}/><Text style={[styles.tabText,panel===id&&styles.tabTextActive]}>{label}</Text></Pressable>)}
    </ScrollView>

    <View style={styles.panel}>
      {panel==='audio'&&<AudioPanel config={config} onChange={onChange}/>} 
      {panel==='presets'&&<View>
        <View style={styles.presetHead}><View><Text style={styles.kicker}>PRESET SYSTEM</Text><Text style={styles.panelTitle}>Mẫu video</Text></View><Pressable style={styles.smallButton}><Text style={styles.smallButtonText}>Lưu mẫu</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map(x=><Pressable key={x} onPress={()=>setCategory(x)} style={[styles.category,category===x&&styles.categoryActive]}><Text style={[styles.categoryText,category===x&&styles.categoryTextActive]}>{x}</Text></Pressable>)}</ScrollView>
        <View style={styles.presetGrid}>{presets.map(p=><PresetCard key={p.id} preset={p} picture={song.picture} active={config.presetId===p.id} onPress={()=>onChange(applyPresetConfig(config,p,song.duration||0))}/>)}</View>
      </View>}
      {panel==='style'&&<View style={styles.stack}>
        <FieldTitle title="Template"/><ChipGrid values={['cover-motion','vinyl','glass-card','lyrics-focus','editorial','spotlight','gold-record']} value={config.template} onChange={v=>set('template',v)}/>
        <FieldTitle title="Motion"/><ChipGrid values={['low','medium','high']} value={config.motion} onChange={v=>set('motion',v as Motion)}/>
      </View>}
      {panel==='text'&&<View style={styles.stack}>
        <FieldTitle title="Font tiêu đề"/><ChipGrid values={['Dancing Script','Tangerine','Bebas Neue','Orbitron','Special Elite','Georgia']} value={config.titleFont} onChange={v=>set('titleFont',v)}/>
        <FieldTitle title="Màu tiêu đề"/><ColorGrid value={config.titleColor} onChange={v=>set('titleColor',v)}/>
        <Stepper label="Kích thước tiêu đề" value={config.titleScale??100} min={40} max={220} suffix="%" step={5} onChange={v=>set('titleScale',v)}/>
        <FieldTitle title="Màu tác giả"/><ColorGrid value={config.creatorColor} onChange={v=>set('creatorColor',v)}/>
        <Stepper label="Kích thước tác giả" value={config.creatorScale??100} min={40} max={180} suffix="%" step={5} onChange={v=>set('creatorScale',v)}/>
      </View>}
      {panel==='wave'&&<View style={styles.stack}>
        <FieldTitle title="Kiểu sóng"/><ChipGrid values={['mirror-glow','rounded-spectrum','circular-pulse','ribbon-wave','line','thin-bars','circle-bars','orbit-dots','mountain','center-line']} value={config.wave} onChange={v=>set('wave',v)}/>
        <FieldTitle title="Màu chính"/><ColorGrid value={config.waveColor??'#d946ef'} onChange={v=>set('waveColor',v)}/>
        <FieldTitle title="Màu phụ"/><ColorGrid value={config.waveColor2??'#60a5fa'} onChange={v=>set('waveColor2',v)}/>
        <Stepper label="Glow" value={config.waveGlow} min={0} max={100} onChange={v=>set('waveGlow',v)}/>
        <Stepper label="Height" value={config.waveHeight} min={20} max={160} onChange={v=>set('waveHeight',v)}/>
        <Stepper label="Thickness" value={config.waveThickness??46} min={10} max={100} onChange={v=>set('waveThickness',v)}/>
        <Stepper label="Smoothing" value={config.waveSmoothing} min={0} max={100} onChange={v=>set('waveSmoothing',v)}/>
        <Stepper label="Opacity" value={config.waveOpacity??92} min={10} max={100} suffix="%" onChange={v=>set('waveOpacity',v)}/>
        <Stepper label="Density" value={config.waveDensity??72} min={20} max={100} suffix="%" onChange={v=>set('waveDensity',v)}/>
        <Stepper label="Rotation" value={config.waveRotation??0} min={-180} max={180} suffix="°" step={5} onChange={v=>set('waveRotation',v)}/>
      </View>}
      {panel==='lyrics'&&<View style={styles.stack}>
        <FieldTitle title="Chế độ lời"/><ChipGrid values={['off','scroll','focus']} value={config.lyrics} onChange={v=>set('lyrics',v as LyricsMode)}/>
        <FieldTitle title="Font subtitle"/><ChipGrid values={['system','rounded','serif','impact']} value={config.subtitleFont} onChange={v=>set('subtitleFont',v)}/>
        <Stepper label="Kích thước subtitle" value={config.subtitleScale??100} min={40} max={220} suffix="%" step={5} onChange={v=>set('subtitleScale',v)}/>
        <View style={styles.regetRow}><Pressable onPress={onReget} style={styles.primaryBtn}><Text style={styles.primaryText}>{subtitleLoading?'Đang lấy lại…':'Lấy subtitle mới'}</Text></Pressable><Text style={styles.help}>{timeline.length} cue</Text></View>
        {!!subtitleError&&<Text style={styles.error}>{subtitleError}</Text>}
        {timeline.slice(0,5).map((line,i)=><View key={i} style={styles.cue}><Text style={styles.cueTime}>{Math.floor(line.start/60)}:{String(Math.floor(line.start%60)).padStart(2,'0')}</Text><Text numberOfLines={1} style={styles.cueText}>{line.text}</Text></View>)}
      </View>}
      {panel==='format'&&<View style={styles.stack}>
        <FieldTitle title="Tỷ lệ"/><ChipGrid values={['9:16','16:9','1:1','4:5','4:3']} value={config.aspect} onChange={v=>set('aspect',v as StudioAspect)}/>
        <FieldTitle title="Chất lượng"/><ChipGrid values={['balanced','high']} value={config.quality} onChange={v=>set('quality',v as 'balanced'|'high')}/>
      </View>}
      {panel==='background'&&<View style={styles.stack}>
        <FieldTitle title="Nguồn nền"/><ChipGrid values={['suno','preset','image','video']} value={config.backgroundMode} onChange={v=>set('backgroundMode',v as StudioVisualConfig['backgroundMode'])}/>
        <FieldTitle title="Preset nền"/><ChipGrid values={['dark-film','neon-blur','concert-light','soft-light','romantic-glow','dreamy-blue','bokeh-night']} value={config.backgroundPreset} onChange={v=>set('backgroundPreset',v)}/>
        <Pressable onPress={onPickBackground} style={styles.upload}><ImageIcon size={19} color="#b9a7ff"/><View><Text style={styles.uploadTitle}>Ảnh / video của bạn</Text><Text style={styles.uploadSub}>Chọn background từ thiết bị</Text></View></Pressable>
      </View>}
      {panel==='effects'&&<View style={styles.stack}>
        <FieldTitle title="Video effects"/><ToggleGrid values={['sparkles','vignette','film','dust','bokeh','stars','lightleak','glitch']} selected={config.effects} onChange={effects=>set('effects',effects)}/>
        <Stepper label="Speed" value={Math.round((config.effectSpeed??1)*10)} min={2} max={30} suffix=" /10" onChange={v=>set('effectSpeed',v/10)}/>
        <Stepper label="Angle" value={config.effectAngle??0} min={-60} max={60} suffix="°" step={5} onChange={v=>set('effectAngle',v)}/>
        <Stepper label="Density" value={Math.round((config.effectDensity??1)*10)} min={2} max={30} suffix=" /10" onChange={v=>set('effectDensity',v/10)}/>
        <Stepper label="Size" value={Math.round((config.effectSize??1)*10)} min={5} max={30} suffix=" /10" onChange={v=>set('effectSize',v/10)}/>
      </View>}
      {panel==='trim'&&<View style={styles.stack}>
        <Stepper label="Bắt đầu" value={Math.round(config.trimStart)} min={0} max={Math.max(0,Math.round(song.duration||0)-1)} suffix="s" step={5} onChange={v=>set('trimStart',Math.min(v,config.trimEnd||song.duration||v+1))}/>
        <Stepper label="Kết thúc" value={Math.round(config.trimEnd||song.duration||0)} min={Math.round(config.trimStart+1)} max={Math.max(1,Math.round(song.duration||1))} suffix="s" step={5} onChange={v=>set('trimEnd',v)}/>
        <Text style={styles.help}>Đoạn xuất: {Math.max(0,Math.round((config.trimEnd||song.duration||0)-config.trimStart))} giây</Text>
      </View>}
    </View>
  </View>
}

function AudioPanel({config,onChange}:{config:StudioVisualConfig;onChange:(next:StudioVisualConfig)=>void}){
  const presets=['Original','Clean','Vocal','Punchy','Bass+','Wide','Immersive'];
  const setPreset=(preset:string)=>{
    const presetEq:Record<string,[number,number,number]>={
      Original:[0,0,0],Clean:[-1,1,2],Vocal:[-2,3,1],Punchy:[2,1,2],'Bass+':[4,-1,0],Wide:[1,1,2],Immersive:[2,1,3],
    };
    const [eqBass,eqVocal,eqTreble]=presetEq[preset]||[0,0,0];
    onChange({...config,audioPreset:preset,eqBass,eqVocal,eqTreble});
  };
  const set=(key:'eqBass'|'eqVocal'|'eqTreble',value:number)=>onChange({...config,[key]:value,audioPreset:'Custom'});
  return <View style={styles.stack}>
    <Text style={styles.sectionKicker}>AUDIO WORKSPACE</Text>
    <Text style={styles.help}>Preset + Quick EQ được lưu cùng project và áp dụng khi export.</Text>
    <View style={styles.audioList}>{presets.map((p,i)=><Pressable key={p} onPress={()=>setPreset(p)} style={styles.audioRow}><View style={[styles.radio,config.audioPreset===p&&styles.radioActive]}/><Text style={styles.audioName}>{p}</Text><Text style={styles.audioDb}>{i===0?'0 dB':'+1.2 dB'}</Text></Pressable>)}</View>
    <FieldTitle title="Quick EQ"/>
    <View style={styles.eqRow}>
      <Stepper label="Bass" value={config.eqBass??0} min={-6} max={6} suffix=" dB" onChange={v=>set('eqBass',v)}/>
      <Stepper label="Vocal" value={config.eqVocal??0} min={-6} max={6} suffix=" dB" onChange={v=>set('eqVocal',v)}/>
      <Stepper label="Treble" value={config.eqTreble??0} min={-6} max={6} suffix=" dB" onChange={v=>set('eqTreble',v)}/>
    </View>
  </View>
}

function PresetCard({preset,picture,active,onPress}:{preset:Preset;picture?:string;active:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} style={[styles.presetCard,active&&{borderColor:preset.accent}]}>
    <View style={[styles.presetArt,{backgroundColor:preset.accent+'22'}]}>{picture&&<Image source={{uri:picture}} style={StyleSheet.absoluteFill} resizeMode="cover"/>}<View style={styles.presetShade}/><Text style={styles.presetBadge}>{preset.badge}</Text><View style={[styles.disc,{borderColor:preset.secondary}]}><View style={[styles.discCore,{backgroundColor:preset.accent}]}/></View></View>
    <View style={styles.presetCopy}><Text numberOfLines={1} style={styles.presetName}>{preset.name}</Text><Text numberOfLines={2} style={styles.presetDesc}>{preset.description}</Text></View>
  </Pressable>
}

function FieldTitle({title}:{title:string}){return <Text style={styles.fieldTitle}>{title}</Text>}
function ChipGrid({values,value,onChange}:{values:string[];value:string;onChange:(v:string)=>void}){return <View style={styles.chips}>{values.map(v=><Pressable key={v} onPress={()=>onChange(v)} style={[styles.chip,value===v&&styles.chipActive]}><Text style={[styles.chipText,value===v&&styles.chipTextActive]}>{v}</Text></Pressable>)}</View>}
function ColorGrid({value,onChange}:{value:string;onChange:(v:string)=>void}){const colors=['#ffffff','#ffd8f4','#f8d88b','#7dd3fc','#f472d0','#c4b5fd','#22d3ee','#fb7185'];return <View style={styles.colorGrid}>{colors.map(c=><Pressable key={c} onPress={()=>onChange(c)} style={[styles.color,{backgroundColor:c},value===c&&styles.colorActive]}/>)}</View>}
function ToggleGrid({values,selected,onChange}:{values:string[];selected:string[];onChange:(v:string[])=>void}){return <View style={styles.chips}>{values.map(v=>{const active=selected.includes(v);return <Pressable key={v} onPress={()=>onChange(active?selected.filter(x=>x!==v):[...selected,v])} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{v}</Text></Pressable>})}</View>}
function Stepper({label,value,min,max,onChange,suffix='',step=1}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void;suffix?:string;step?:number}){return <View style={styles.stepper}><Text style={styles.stepLabel}>{label}</Text><Pressable onPress={()=>onChange(Math.max(min,value-step))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></Pressable><Text style={styles.stepValue}>{value}{suffix}</Text><Pressable onPress={()=>onChange(Math.min(max,value+step))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></Pressable></View>}

const styles=StyleSheet.create({
  root:{width:'100%'},tabs:{gap:6,paddingTop:4,paddingBottom:10},tab:{width:78,height:52,borderWidth:1,borderColor:'#29313d',borderRadius:10,backgroundColor:'#111720',alignItems:'center',justifyContent:'center',gap:3},tabActive:{borderColor:'#7059e4',backgroundColor:'#211c3b'},tabText:{color:'#8e99aa',fontSize:8,fontWeight:'800'},tabTextActive:{color:'#fff'},
  panel:{borderTopWidth:1,borderColor:'#29313d',paddingTop:10},stack:{gap:10},sectionKicker:{color:'#8e7cf0',fontSize:8,fontWeight:'900',letterSpacing:1.2},help:{color:'#8793a5',fontSize:9,lineHeight:14},fieldTitle:{color:'#cdd4df',fontSize:10,fontWeight:'800',marginTop:2},
  presetHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},kicker:{color:'#a78bfa',fontSize:9,fontWeight:'800',letterSpacing:1.3},panelTitle:{color:'#f4f6fb',fontSize:13,fontWeight:'800',marginTop:4},smallButton:{height:31,borderWidth:1,borderColor:'#303a48',borderRadius:8,backgroundColor:'#151c26',paddingHorizontal:9,justifyContent:'center'},smallButtonText:{color:'#aeb8c7',fontSize:10},
  categories:{gap:6,paddingVertical:10},category:{height:29,borderWidth:1,borderColor:'#2d3542',borderRadius:999,backgroundColor:'#111722',paddingHorizontal:10,justifyContent:'center'},categoryActive:{borderColor:'#7c5ce8',backgroundColor:'rgba(124,92,232,.16)'},categoryText:{color:'#8f99aa',fontSize:9,fontWeight:'700'},categoryTextActive:{color:'#eee9ff'},
  presetGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},presetCard:{width:'48.5%',overflow:'hidden',borderWidth:1,borderColor:'#29313d',borderRadius:12,backgroundColor:'#0b1017'},presetArt:{height:82,position:'relative',alignItems:'center',justifyContent:'center',overflow:'hidden'},presetShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(7,10,16,.42)'},presetBadge:{position:'absolute',left:7,top:7,zIndex:2,color:'#dce3ef',fontSize:7,fontWeight:'800'},disc:{width:48,height:48,borderWidth:1,borderRadius:24,alignItems:'center',justifyContent:'center'},discCore:{width:12,height:12,borderRadius:6},presetCopy:{minHeight:62,padding:9},presetName:{color:'#f5f7fb',fontSize:10,fontWeight:'800'},presetDesc:{color:'#778396',fontSize:8,lineHeight:12,marginTop:4},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{minHeight:34,borderWidth:1,borderColor:'#303947',borderRadius:8,backgroundColor:'#151c27',paddingHorizontal:9,alignItems:'center',justifyContent:'center'},chipActive:{borderColor:'#8a67ff',backgroundColor:'rgba(125,91,255,.18)'},chipText:{color:'#aeb8c7',fontSize:9,fontWeight:'700'},chipTextActive:{color:'#fff'},
  colorGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},color:{width:28,height:28,borderRadius:7,borderWidth:2,borderColor:'#252d39'},colorActive:{borderColor:'#8b5cf6',transform:[{scale:1.08}]},
  regetRow:{flexDirection:'row',alignItems:'center',gap:10},primaryBtn:{minHeight:38,borderRadius:8,backgroundColor:'#7658e9',paddingHorizontal:12,alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontSize:10,fontWeight:'800'},error:{color:'#ff9da5',fontSize:9},cue:{minHeight:34,flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:1,borderColor:'#1f2631'},cueTime:{width:36,color:'#9478ff',fontSize:8},cueText:{flex:1,color:'#b9c1cd',fontSize:9},
  upload:{minHeight:58,borderWidth:1,borderStyle:'dashed',borderColor:'#49576c',borderRadius:10,backgroundColor:'#111823',padding:10,flexDirection:'row',alignItems:'center',gap:10},uploadTitle:{color:'#e5eaf2',fontSize:10,fontWeight:'700'},uploadSub:{color:'#788496',fontSize:8,marginTop:4},
  audioList:{borderTopWidth:1,borderColor:'#252b34'},audioRow:{height:43,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#1e2630'},radio:{width:14,height:14,borderRadius:7,borderWidth:1,borderColor:'#6d7787'},radioActive:{borderWidth:4,borderColor:'#8b6cff'},audioName:{flex:1,color:'#dce0e7',fontSize:10,marginLeft:10},audioDb:{color:'#727e8f',fontSize:8},eqRow:{gap:6},
  stepper:{minHeight:38,borderRadius:8,backgroundColor:'#0c1119',paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:7},stepLabel:{flex:1,color:'#aab4c2',fontSize:9},stepButton:{width:28,height:26,borderWidth:1,borderColor:'#303947',borderRadius:6,backgroundColor:'#151c27',alignItems:'center',justifyContent:'center'},stepButtonText:{color:'#d7deea',fontSize:16},stepValue:{minWidth:44,color:'#dbe3ee',fontSize:9,textAlign:'center'},
});
