import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FileText, Image as ImageIcon, Music2, SlidersHorizontal, Sparkles } from 'lucide-react-native';
import type { KaraokeLine, SavedVisualPreset, Song, StudioAspect, StudioEqBand, StudioLyricsMode as LyricsMode, StudioMasterProfile, StudioMotion as Motion, StudioSpatialMode, StudioVisualConfig } from './types';
export type { StudioVisualConfig } from './types';

const DEFAULT_MASTER_EQ:StudioEqBand[]=[
  {enabled:true,frequency:60,gain:0,q:.7,type:'lowshelf'},
  {enabled:true,frequency:120,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:250,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:500,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:1000,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:2500,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:6000,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:12000,gain:0,q:.7,type:'highshelf'},
];

const MASTER_PROFILES:Record<StudioMasterProfile,{label:string;description:string;target:number;ceiling:number;threshold:number;ratio:number;attack:number;release:number;drive:number}>={
  original:{label:'Original',description:'Giữ dynamic gốc, không loudness normalize.',target:-14,ceiling:-1,threshold:-18,ratio:1,attack:10,release:120,drive:0},
  clean:{label:'Clean',description:'Sạch, cân bằng và giữ vocal tự nhiên.',target:-14,ceiling:-1,threshold:-15,ratio:2,attack:9,release:120,drive:.02},
  'tiktok-loud':{label:'TikTok',description:'Loudness rõ cho social video, vẫn có headroom.',target:-9,ceiling:-1,threshold:-17,ratio:3.2,attack:8,release:100,drive:.08},
  punchy:{label:'Punchy',description:'Transient rõ hơn, hợp pop/EDM và hook nhanh.',target:-11,ceiling:-.8,threshold:-16,ratio:2.6,attack:18,release:110,drive:.06},
  'max-loud':{label:'Max Loud',description:'Mức loud cao nhất; phù hợp preview/short-form.',target:-7.5,ceiling:-.8,threshold:-20,ratio:4.2,attack:6,release:90,drive:.14},
};

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
  titleX:50,
  titleY:67,
  creatorX:50,
  creatorY:75,
  subtitleX:50,
  subtitleY:70,
  waveX:50,
  waveY:82,
  effectSpeed:1,
  effectAngle:0,
  effectDensity:1,
  effectSize:1,
  eqBass:0,
  eqVocal:0,
  eqTreble:0,
  masteringProfile:'original',
  masterTargetLufs:-14,
  masterCeilingDb:-1,
  masterThresholdDb:-18,
  masterRatio:1,
  masterAttackMs:10,
  masterReleaseMs:120,
  masterDrive:0,
  masterEqBands:DEFAULT_MASTER_EQ.map(b=>({...b})),
  spatialEnabled:false,
  spatialMode:'immersive',
  spatialAmount:65,
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
  song,config,onChange,timeline,onTimelineChange,onImportSubtitles,onExportSubtitles,subtitleLoading,subtitleError,onReget,onPickBackground,
  customPresets=[],onSavePreset,onDeletePreset,
  panel:controlledPanel,onPanelChange,
}:{
  song:Song;config:StudioVisualConfig;onChange:(next:StudioVisualConfig)=>void;timeline:KaraokeLine[];onTimelineChange?:(lines:KaraokeLine[])=>void;
  onImportSubtitles?:()=>void;onExportSubtitles?:()=>void;
  subtitleLoading:boolean;subtitleError:string;onReget:()=>void;onPickBackground:()=>void;
  customPresets?:SavedVisualPreset[];onSavePreset?:()=>void;onDeletePreset?:(id:string)=>void;
  panel?:StudioPanel;onPanelChange?:(panel:StudioPanel)=>void;
}){
  const [internalPanel,setInternalPanel]=useState<StudioPanel>('audio');
  const panel=controlledPanel??internalPanel;
  const setPanel=(value:StudioPanel)=>{setInternalPanel(value);onPanelChange?.(value)};
  const [category,setCategory]=useState('Nổi bật');
  const categories=['Nổi bật','Social','Lyrics','Cinematic','Album','Visualizer'];
  const presets=useMemo(()=>category==='Nổi bật'?V24_PRESETS:V24_PRESETS.filter(p=>p.category===category),[category]);
  const set=<K extends keyof StudioVisualConfig>(key:K,value:StudioVisualConfig[K])=>onChange({...config,[key]:value});
  const updateCue=(index:number,patch:Partial<KaraokeLine>)=>{
    if(!onTimelineChange)return;
    onTimelineChange(timeline.map((line,i)=>i===index?{...line,...patch,words:patch.text!==undefined?undefined:line.words}:line));
  };
  const shiftCue=(index:number,delta:number)=>{
    const line=timeline[index];if(!line||!onTimelineChange)return;
    const length=Math.max(.12,line.end-line.start);
    const start=Math.max(0,line.start+delta);
    onTimelineChange(timeline.map((item,i)=>i===index?{...item,start,end:start+length,words:item.words?.map(word=>({...word,start:word.start+delta,end:word.end+delta}))}:item));
  };
  const deleteCue=(index:number)=>onTimelineChange?.(timeline.filter((_,i)=>i!==index));
  const addCue=()=>{
    if(!onTimelineChange)return;
    const start=Math.min(song.duration||Infinity,(timeline.at(-1)?.end||0)+.1);
    const end=Math.min(song.duration||start+3,start+3);
    onTimelineChange([...timeline,{text:'Subtitle mới',start,end}]);
  };

  return <View style={styles.root}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {tabs.map(([id,label,Icon])=><Pressable key={id} onPress={()=>setPanel(id)} style={[styles.tab,panel===id&&styles.tabActive]}><Icon size={16} color={panel===id?'#fff':'#8e99aa'}/><Text style={[styles.tabText,panel===id&&styles.tabTextActive]}>{label}</Text></Pressable>)}
    </ScrollView>

    <View style={styles.panel}>
      {panel==='audio'&&<AudioPanel config={config} onChange={onChange}/>} 
      {panel==='presets'&&<View>
        <View style={styles.presetHead}><View><Text style={styles.kicker}>PRESET SYSTEM</Text><Text style={styles.panelTitle}>Mẫu video</Text></View><Pressable onPress={onSavePreset} style={styles.smallButton}><Text style={styles.smallButtonText}>Lưu mẫu</Text></Pressable></View>
        {!!customPresets.length&&<View style={styles.savedPresetBox}>
          <Text style={styles.savedPresetTitle}>MẪU CỦA TÔI · {customPresets.length}</Text>
          <View style={styles.savedPresetList}>
            {customPresets.map(saved=><View key={saved.id} style={styles.savedPresetRow}>
              <Pressable style={styles.savedPresetApply} onPress={()=>onChange({...saved.config,presetId:saved.id})}><Text numberOfLines={1} style={styles.savedPresetName}>{saved.name}</Text><Text style={styles.savedPresetMeta}>{saved.config.aspect} · {saved.config.template}</Text></Pressable>
              <Pressable onPress={()=>onDeletePreset?.(saved.id)} style={styles.savedPresetDelete}><Text style={styles.savedPresetDeleteText}>×</Text></Pressable>
            </View>)}
          </View>
        </View>}
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
        <View style={styles.subtitleFileRow}>
          <Pressable onPress={onImportSubtitles} style={styles.fileBtn}><Text style={styles.fileBtnText}>Import SRT / VTT</Text></Pressable>
          <Pressable onPress={onExportSubtitles} style={styles.fileBtn}><Text style={styles.fileBtnText}>Export SRT</Text></Pressable>
        </View>
        {!!subtitleError&&<Text style={styles.error}>{subtitleError}</Text>}
        <View style={styles.cueActions}><Pressable onPress={addCue} style={styles.cueAdd}><Text style={styles.cueAddText}>+ Thêm cue</Text></Pressable><Text style={styles.help}>{timeline.length} cue tổng cộng</Text></View>
        {timeline.slice(0,20).map((line,i)=><View key={i+'-'+line.start} style={styles.cueEditor}>
          <View style={styles.cueTop}><Text style={styles.cueTime}>{Math.floor(line.start/60)}:{String(Math.floor(line.start%60)).padStart(2,'0')}.{Math.floor((line.start%1)*10)}</Text><Text style={styles.cueDuration}>{Math.max(.1,line.end-line.start).toFixed(1)}s</Text></View>
          <TextInput value={line.text} onChangeText={text=>updateCue(i,{text})} multiline style={styles.cueInput} placeholder="Subtitle" placeholderTextColor="#5d6878"/>
          <View style={styles.cueButtons}>
            <Pressable onPress={()=>shiftCue(i,-.1)} style={styles.cueButton}><Text style={styles.cueButtonText}>−0.1s</Text></Pressable>
            <Pressable onPress={()=>shiftCue(i,.1)} style={styles.cueButton}><Text style={styles.cueButtonText}>+0.1s</Text></Pressable>
            <Pressable onPress={()=>updateCue(i,{end:Math.max(line.start+.12,line.end-.1)})} style={styles.cueButton}><Text style={styles.cueButtonText}>End −</Text></Pressable>
            <Pressable onPress={()=>updateCue(i,{end:Math.min(song.duration||line.end+.1,line.end+.1)})} style={styles.cueButton}><Text style={styles.cueButtonText}>End +</Text></Pressable>
            <Pressable onPress={()=>deleteCue(i)} style={[styles.cueButton,styles.cueDelete]}><Text style={styles.cueDeleteText}>Xóa</Text></Pressable>
          </View>
        </View>)}
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
  const [section,setSection]=useState<'master'|'eq'|'5d'>('master');
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [eqOpen,setEqOpen]=useState(false);
  const presets=['Original','Clean','Vocal','Punchy','Bass+','Wide','Immersive'];
  const setPreset=(preset:string)=>{
    const presetEq:Record<string,[number,number,number]>={
      Original:[0,0,0],Clean:[-1,1,2],Vocal:[-2,3,1],Punchy:[2,1,2],'Bass+':[4,-1,0],Wide:[1,1,2],Immersive:[2,1,3],
    };
    const [eqBass,eqVocal,eqTreble]=presetEq[preset]||[0,0,0];
    onChange({...config,audioPreset:preset,eqBass,eqVocal,eqTreble});
  };
  const setEq=(key:'eqBass'|'eqVocal'|'eqTreble',value:number)=>onChange({...config,[key]:value,audioPreset:'Custom'});
  const bands=(config.masterEqBands?.length?config.masterEqBands:DEFAULT_MASTER_EQ).map(b=>({...b}));
  const applyProfile=(profile:StudioMasterProfile)=>{
    const value=MASTER_PROFILES[profile];
    onChange({...config,masteringProfile:profile,masterTargetLufs:value.target,masterCeilingDb:value.ceiling,masterThresholdDb:value.threshold,masterRatio:value.ratio,masterAttackMs:value.attack,masterReleaseMs:value.release,masterDrive:value.drive});
  };
  const changeBand=(index:number,patch:Partial<StudioEqBand>)=>{
    const next=bands.map((band,i)=>i===index?{...band,...patch}:band);
    onChange({...config,masterEqBands:next});
  };
  const resetMaster=()=>{
    const profile=config.masteringProfile||'original';
    const value=MASTER_PROFILES[profile];
    onChange({...config,masterTargetLufs:value.target,masterCeilingDb:value.ceiling,masterThresholdDb:value.threshold,masterRatio:value.ratio,masterAttackMs:value.attack,masterReleaseMs:value.release,masterDrive:value.drive});
  };
  const resetEq=()=>onChange({...config,masterEqBands:DEFAULT_MASTER_EQ.map(b=>({...b}))});
  const spatialMode=config.spatialMode||'immersive';
  const profile=config.masteringProfile||'original';

  return <View style={styles.stack}>
    <Text style={styles.sectionKicker}>AUDIO WORKSPACE</Text>
    <Text style={styles.help}>Quick Sound + Mastering + Channel EQ + 5D dùng chung config project trên Web, Android và iOS.</Text>

    <View style={styles.audioSubnav}>
      <Pressable onPress={()=>setSection('master')} style={[styles.audioSubnavBtn,section==='master'&&styles.audioSubnavActive]}><Text style={[styles.audioSubnavText,section==='master'&&styles.audioSubnavTextActive]}>Mastering</Text></Pressable>
      <Pressable onPress={()=>{setSection('eq');setEqOpen(true)}} style={[styles.audioSubnavBtn,section==='eq'&&styles.audioSubnavActive]}><Text style={[styles.audioSubnavText,section==='eq'&&styles.audioSubnavTextActive]}>EQ</Text></Pressable>
      <Pressable onPress={()=>setSection('5d')} style={[styles.audioSubnavBtn,section==='5d'&&styles.audioSubnavActive]}><Text style={[styles.audioSubnavText,section==='5d'&&styles.audioSubnavTextActive]}>5D</Text></Pressable>
    </View>

    {section==='master'&&<>
      <FieldTitle title="Sound preset"/>
      <View style={styles.audioList}>{presets.map((p,i)=><Pressable key={p} onPress={()=>setPreset(p)} style={styles.audioRow}><View style={[styles.radio,config.audioPreset===p&&styles.radioActive]}/><Text style={styles.audioName}>{p}</Text><Text style={styles.audioDb}>{i===0?'0 dB':'+1.2 dB'}</Text></Pressable>)}</View>
      <FieldTitle title="Quick EQ"/>
      <View style={styles.eqRow}>
        <Stepper label="Bass" value={config.eqBass??0} min={-6} max={6} suffix=" dB" onChange={v=>setEq('eqBass',v)}/>
        <Stepper label="Vocal" value={config.eqVocal??0} min={-6} max={6} suffix=" dB" onChange={v=>setEq('eqVocal',v)}/>
        <Stepper label="Treble" value={config.eqTreble??0} min={-6} max={6} suffix=" dB" onChange={v=>setEq('eqTreble',v)}/>
      </View>

      <FieldTitle title="Master profile"/>
      <View style={styles.masterProfiles}>{(Object.keys(MASTER_PROFILES) as StudioMasterProfile[]).map(id=><Pressable key={id} onPress={()=>applyProfile(id)} style={[styles.masterProfile,profile===id&&styles.masterProfileActive]}><Text style={[styles.masterProfileText,profile===id&&styles.masterProfileTextActive]}>{MASTER_PROFILES[id].label}</Text></Pressable>)}</View>
      <Text style={styles.masterDesc}>{MASTER_PROFILES[profile].description}</Text>
      <View style={styles.masterSummary}>
        <View><Text style={styles.masterSummaryValue}>{config.masterTargetLufs??MASTER_PROFILES[profile].target}</Text><Text style={styles.masterSummaryLabel}>LUFS</Text></View>
        <View><Text style={styles.masterSummaryValue}>{config.masterCeilingDb??MASTER_PROFILES[profile].ceiling}</Text><Text style={styles.masterSummaryLabel}>PEAK dB</Text></View>
        <View><Text style={styles.masterSummaryValue}>{(config.masterRatio??MASTER_PROFILES[profile].ratio).toFixed(1)}:1</Text><Text style={styles.masterSummaryLabel}>RATIO</Text></View>
      </View>
      <Pressable style={styles.advancedButton} onPress={()=>setAdvancedOpen(true)}><SlidersHorizontal size={17} color="#b7a7ff"/><View style={{flex:1}}><Text style={styles.advancedTitle}>Tinh chỉnh Audio nâng cao</Text><Text style={styles.advancedSub}>Loudness · limiter · compressor · attack/release · drive</Text></View><Text style={styles.advancedArrow}>›</Text></Pressable>
    </>}

    {section==='eq'&&<View style={styles.audioSectionCard}>
      <Text style={styles.audioSectionTitle}>8-Band Parametric EQ</Text>
      <Text style={styles.help}>Precision EQ · ±12 dB · Frequency / Gain / Q. Mở full màn hình để chỉnh dễ hơn.</Text>
      <Pressable style={styles.primaryBtn} onPress={()=>setEqOpen(true)}><Text style={styles.primaryText}>Mở Channel EQ</Text></Pressable>
    </View>}

    {section==='5d'&&<View style={styles.audioSectionCard}>
      <View style={styles.toggleRow}><View style={{flex:1}}><Text style={styles.audioSectionTitle}>Âm thanh 5D</Text><Text style={styles.help}>{config.spatialEnabled?'Đang bật · áp dụng khi render/export':'Stereo gốc · không spatial'}</Text></View><Pressable onPress={()=>onChange({...config,spatialEnabled:!config.spatialEnabled})} style={[styles.switchTrack,config.spatialEnabled&&styles.switchTrackOn]}><View style={[styles.switchKnob,config.spatialEnabled&&styles.switchKnobOn]}/></Pressable></View>
      {config.spatialEnabled&&<>
        <FieldTitle title="Chế độ"/><ChipGrid values={['wide','immersive','orbit']} value={spatialMode} onChange={v=>onChange({...config,spatialMode:v as StudioSpatialMode})}/>
        <Text style={styles.help}>{spatialMode==='orbit'?'Qua tai: chuyển động trái ↔ phải rõ hơn, nên dùng tai nghe.':spatialMode==='wide'?'Rộng: mở stereo tự nhiên, ít thay đổi vị trí nhạc cụ.':'Bao quanh: sân khấu sâu và rộng hơn cho ballad/ambient.'}</Text>
        <Stepper label={spatialMode==='orbit'?'Mức chuyển động':'Độ rộng'} value={config.spatialAmount??65} min={20} max={100} suffix="%" step={5} onChange={v=>onChange({...config,spatialAmount:v})}/>
      </>}
    </View>}

    <Modal visible={advancedOpen} animationType="slide" onRequestClose={()=>setAdvancedOpen(false)}>
      <View style={styles.audioModal}>
        <View style={styles.audioModalHead}><View style={{flex:1}}><Text style={styles.audioModalKicker}>ADVANCED MASTERING</Text><Text style={styles.audioModalTitle}>Tinh chỉnh Audio nâng cao</Text></View><Pressable style={styles.audioModalClose} onPress={()=>setAdvancedOpen(false)}><Text style={styles.audioModalCloseText}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.audioModalBody}>
          <Text style={styles.masterDesc}>Mặc định vẫn theo profile. Thay đổi bên dưới sẽ lưu cùng project và được gửi vào render engine.</Text>
          <View style={styles.advancedGrid}>
            <Stepper label="Target loudness" value={config.masterTargetLufs??-14} min={-18} max={-6} suffix=" LUFS" step={.5} onChange={v=>onChange({...config,masterTargetLufs:v})}/>
            <Stepper label="Peak ceiling" value={config.masterCeilingDb??-1} min={-3} max={-.5} suffix=" dB" step={.1} onChange={v=>onChange({...config,masterCeilingDb:Number(v.toFixed(1))})}/>
            <Stepper label="Threshold" value={config.masterThresholdDb??-18} min={-30} max={-6} suffix=" dB" onChange={v=>onChange({...config,masterThresholdDb:v})}/>
            <Stepper label="Ratio" value={config.masterRatio??2} min={1} max={6} suffix=":1" step={.1} onChange={v=>onChange({...config,masterRatio:Number(v.toFixed(1))})}/>
            <Stepper label="Attack" value={config.masterAttackMs??10} min={1} max={80} suffix=" ms" onChange={v=>onChange({...config,masterAttackMs:v})}/>
            <Stepper label="Release" value={config.masterReleaseMs??120} min={40} max={500} suffix=" ms" step={5} onChange={v=>onChange({...config,masterReleaseMs:v})}/>
            <Stepper label="Drive" value={Math.round((config.masterDrive??0)*100)} min={0} max={40} suffix="%" onChange={v=>onChange({...config,masterDrive:v/100})}/>
          </View>
        </ScrollView>
        <View style={styles.audioModalFooter}><Pressable style={styles.modalSecondary} onPress={resetMaster}><Text style={styles.modalSecondaryText}>Reset preset</Text></Pressable><Pressable style={styles.modalPrimary} onPress={()=>setAdvancedOpen(false)}><Text style={styles.modalPrimaryText}>Xong</Text></Pressable></View>
      </View>
    </Modal>

    <Modal visible={eqOpen} animationType="slide" onRequestClose={()=>setEqOpen(false)}>
      <View style={styles.audioModal}>
        <View style={styles.audioModalHead}><View style={{flex:1}}><Text style={styles.audioModalKicker}>CHANNEL EQ</Text><Text style={styles.audioModalTitle}>8-Band Parametric EQ</Text></View><Pressable style={styles.audioModalClose} onPress={()=>setEqOpen(false)}><Text style={styles.audioModalCloseText}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.audioModalBody}>
          <View style={styles.eqCurve}>
            <View style={styles.eqZero}/>
            {bands.map((band,index)=>{
              const left=Math.max(2,Math.min(96,((Math.log10(Math.max(20,band.frequency)/20)/Math.log10(1000))*92)+4));
              const top=Math.max(6,Math.min(92,50-(band.enabled?band.gain:0)*3.1));
              return <View key={index} style={[styles.eqNode,{left:(left+'%') as any,top:(top+'%') as any},!band.enabled&&styles.eqNodeOff]}><Text style={styles.eqNodeText}>{index+1}</Text></View>;
            })}
          </View>
          <View style={styles.eqBands}>{bands.map((band,index)=><View key={index} style={[styles.eqBand,!band.enabled&&styles.eqBandOff]}>
            <View style={styles.eqBandHead}><Pressable style={[styles.eqBandToggle,band.enabled&&styles.eqBandToggleOn]} onPress={()=>changeBand(index,{enabled:!band.enabled})}><Text style={styles.eqBandToggleText}>{band.enabled?'ON':'OFF'}</Text></Pressable><Text style={styles.eqBandTitle}>Band {index+1}</Text><Text style={styles.eqBandFreq}>{band.frequency>=1000?(band.frequency/1000).toFixed(band.frequency%1000?1:0)+'k':Math.round(band.frequency)} Hz</Text></View>
            <Stepper label="Gain" value={band.gain} min={-12} max={12} suffix=" dB" step={.5} onChange={v=>changeBand(index,{gain:v})}/>
            <Stepper label="Frequency" value={band.frequency} min={20} max={20000} suffix=" Hz" step={band.frequency<500?10:band.frequency<3000?50:250} onChange={v=>changeBand(index,{frequency:v})}/>
            <Stepper label="Q" value={band.q} min={.3} max={8} step={.1} onChange={v=>changeBand(index,{q:Number(v.toFixed(1))})}/>
          </View>)}</View>
        </ScrollView>
        <View style={styles.audioModalFooter}><Pressable style={styles.modalSecondary} onPress={resetEq}><Text style={styles.modalSecondaryText}>Reset EQ</Text></Pressable><Pressable style={styles.modalPrimary} onPress={()=>setEqOpen(false)}><Text style={styles.modalPrimaryText}>Xong</Text></Pressable></View>
      </View>
    </Modal>
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
  savedPresetBox:{marginTop:10,borderWidth:1,borderColor:'#29313d',borderRadius:10,backgroundColor:'#0d131c',padding:9},savedPresetTitle:{color:'#8d72ff',fontSize:8,fontWeight:'900',letterSpacing:1.1,marginBottom:7},savedPresetList:{gap:6},savedPresetRow:{minHeight:42,flexDirection:'row',alignItems:'stretch',borderWidth:1,borderColor:'#26303d',borderRadius:8,backgroundColor:'#101720',overflow:'hidden'},savedPresetApply:{flex:1,paddingHorizontal:9,justifyContent:'center'},savedPresetName:{color:'#e8edf4',fontSize:9,fontWeight:'800'},savedPresetMeta:{color:'#788496',fontSize:7,marginTop:2},savedPresetDelete:{width:34,alignItems:'center',justifyContent:'center',borderLeftWidth:1,borderColor:'#26303d'},savedPresetDeleteText:{color:'#ff9da5',fontSize:18,lineHeight:18},
  categories:{gap:6,paddingVertical:10},category:{height:29,borderWidth:1,borderColor:'#2d3542',borderRadius:999,backgroundColor:'#111722',paddingHorizontal:10,justifyContent:'center'},categoryActive:{borderColor:'#7c5ce8',backgroundColor:'rgba(124,92,232,.16)'},categoryText:{color:'#8f99aa',fontSize:9,fontWeight:'700'},categoryTextActive:{color:'#eee9ff'},
  presetGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},presetCard:{width:'48.5%',overflow:'hidden',borderWidth:1,borderColor:'#29313d',borderRadius:12,backgroundColor:'#0b1017'},presetArt:{height:82,position:'relative',alignItems:'center',justifyContent:'center',overflow:'hidden'},presetShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(7,10,16,.42)'},presetBadge:{position:'absolute',left:7,top:7,zIndex:2,color:'#dce3ef',fontSize:7,fontWeight:'800'},disc:{width:48,height:48,borderWidth:1,borderRadius:24,alignItems:'center',justifyContent:'center'},discCore:{width:12,height:12,borderRadius:6},presetCopy:{minHeight:62,padding:9},presetName:{color:'#f5f7fb',fontSize:10,fontWeight:'800'},presetDesc:{color:'#778396',fontSize:8,lineHeight:12,marginTop:4},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{minHeight:34,borderWidth:1,borderColor:'#303947',borderRadius:8,backgroundColor:'#151c27',paddingHorizontal:9,alignItems:'center',justifyContent:'center'},chipActive:{borderColor:'#8a67ff',backgroundColor:'rgba(125,91,255,.18)'},chipText:{color:'#aeb8c7',fontSize:9,fontWeight:'700'},chipTextActive:{color:'#fff'},
  colorGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},color:{width:28,height:28,borderRadius:7,borderWidth:2,borderColor:'#252d39'},colorActive:{borderColor:'#8b5cf6',transform:[{scale:1.08}]},
  regetRow:{flexDirection:'row',alignItems:'center',gap:10},primaryBtn:{minHeight:38,borderRadius:8,backgroundColor:'#7658e9',paddingHorizontal:12,alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontSize:10,fontWeight:'800'},error:{color:'#ff9da5',fontSize:9},
  subtitleFileRow:{flexDirection:'row',gap:7},fileBtn:{flex:1,minHeight:34,borderWidth:1,borderColor:'#344152',borderRadius:8,backgroundColor:'#111925',alignItems:'center',justifyContent:'center'},fileBtnText:{color:'#b8c5d7',fontSize:8,fontWeight:'800'},
  cueActions:{flexDirection:'row',alignItems:'center',gap:9},cueAdd:{minHeight:32,borderWidth:1,borderColor:'#5945a7',borderRadius:8,backgroundColor:'rgba(118,88,237,.12)',paddingHorizontal:10,alignItems:'center',justifyContent:'center'},cueAddText:{color:'#cfc5ff',fontSize:9,fontWeight:'800'},
  cueEditor:{borderWidth:1,borderColor:'#252e3a',borderRadius:9,backgroundColor:'#0d131c',padding:8,gap:6},cueTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},cueTime:{color:'#9478ff',fontSize:8,fontWeight:'800'},cueDuration:{color:'#69768a',fontSize:8},cueInput:{minHeight:38,borderWidth:1,borderColor:'#293441',borderRadius:7,backgroundColor:'#101720',paddingHorizontal:8,paddingVertical:6,color:'#e6ebf3',fontSize:9,textAlignVertical:'top'},cueButtons:{flexDirection:'row',flexWrap:'wrap',gap:5},cueButton:{minHeight:28,borderWidth:1,borderColor:'#303947',borderRadius:7,backgroundColor:'#151c27',paddingHorizontal:7,alignItems:'center',justifyContent:'center'},cueButtonText:{color:'#aeb8c7',fontSize:8,fontWeight:'700'},cueDelete:{borderColor:'#553038',backgroundColor:'#201318'},cueDeleteText:{color:'#ffadb4',fontSize:8,fontWeight:'800'},
  upload:{minHeight:58,borderWidth:1,borderStyle:'dashed',borderColor:'#49576c',borderRadius:10,backgroundColor:'#111823',padding:10,flexDirection:'row',alignItems:'center',gap:10},uploadTitle:{color:'#e5eaf2',fontSize:10,fontWeight:'700'},uploadSub:{color:'#788496',fontSize:8,marginTop:4},
  audioList:{borderTopWidth:1,borderColor:'#252b34'},audioRow:{height:43,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#1e2630'},radio:{width:14,height:14,borderRadius:7,borderWidth:1,borderColor:'#6d7787'},radioActive:{borderWidth:4,borderColor:'#8b6cff'},audioName:{flex:1,color:'#dce0e7',fontSize:10,marginLeft:10},audioDb:{color:'#727e8f',fontSize:8},eqRow:{gap:6},
  stepper:{minHeight:38,borderRadius:8,backgroundColor:'#0c1119',paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:7},stepLabel:{flex:1,color:'#aab4c2',fontSize:9},stepButton:{width:28,height:26,borderWidth:1,borderColor:'#303947',borderRadius:6,backgroundColor:'#151c27',alignItems:'center',justifyContent:'center'},stepButtonText:{color:'#d7deea',fontSize:16},stepValue:{minWidth:44,color:'#dbe3ee',fontSize:9,textAlign:'center'},
  audioSubnav:{height:38,borderWidth:1,borderColor:'#26303b',borderRadius:9,backgroundColor:'#0b1119',padding:3,flexDirection:'row',gap:3},audioSubnavBtn:{flex:1,borderRadius:6,alignItems:'center',justifyContent:'center'},audioSubnavActive:{backgroundColor:'#211c3b'},audioSubnavText:{color:'#7f8a9b',fontSize:9,fontWeight:'800'},audioSubnavTextActive:{color:'#efeaff'},
  masterProfiles:{flexDirection:'row',flexWrap:'wrap',gap:6},masterProfile:{minHeight:34,borderWidth:1,borderColor:'#303947',borderRadius:8,backgroundColor:'#151c27',paddingHorizontal:10,alignItems:'center',justifyContent:'center'},masterProfileActive:{borderColor:'#8a67ff',backgroundColor:'rgba(125,91,255,.18)'},masterProfileText:{color:'#9da8b7',fontSize:9,fontWeight:'800'},masterProfileTextActive:{color:'#fff'},masterDesc:{color:'#8793a5',fontSize:10,lineHeight:16},
  masterSummary:{minHeight:70,borderWidth:1,borderColor:'#252e3a',borderRadius:11,backgroundColor:'#0d131c',padding:10,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},masterSummaryValue:{color:'#f3f6fb',fontSize:17,fontWeight:'800',textAlign:'center'},masterSummaryLabel:{color:'#687589',fontSize:7,fontWeight:'900',letterSpacing:.8,textAlign:'center',marginTop:3},
  advancedButton:{minHeight:62,borderWidth:1,borderColor:'#3b315f',borderRadius:11,backgroundColor:'#141125',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10},advancedTitle:{color:'#eee9ff',fontSize:10,fontWeight:'800'},advancedSub:{color:'#8176a8',fontSize:8,lineHeight:12,marginTop:3},advancedArrow:{color:'#a999f1',fontSize:23},
  audioSectionCard:{borderWidth:1,borderColor:'#29313d',borderRadius:11,backgroundColor:'#0d141d',padding:12,gap:10},audioSectionTitle:{color:'#f0f3f8',fontSize:12,fontWeight:'800'},toggleRow:{flexDirection:'row',alignItems:'center',gap:12},switchTrack:{width:44,height:24,borderRadius:12,backgroundColor:'#29313d',padding:3},switchTrackOn:{backgroundColor:'#7458e8'},switchKnob:{width:18,height:18,borderRadius:9,backgroundColor:'#d8deea'},switchKnobOn:{alignSelf:'flex-end',backgroundColor:'#fff'},
  audioModal:{flex:1,backgroundColor:'#080c12'},audioModalHead:{minHeight:74,borderBottomWidth:1,borderColor:'#242d38',paddingHorizontal:18,paddingTop:14,paddingBottom:12,flexDirection:'row',alignItems:'center',gap:12},audioModalKicker:{color:'#8f7bff',fontSize:8,fontWeight:'900',letterSpacing:1.5},audioModalTitle:{color:'#f4f7fb',fontSize:20,fontWeight:'800',marginTop:4},audioModalClose:{width:38,height:38,borderWidth:1,borderColor:'#303a48',borderRadius:10,backgroundColor:'#111821',alignItems:'center',justifyContent:'center'},audioModalCloseText:{color:'#d8deea',fontSize:24,lineHeight:24},audioModalBody:{padding:16,paddingBottom:120,gap:12},advancedGrid:{gap:7},audioModalFooter:{position:'absolute',left:0,right:0,bottom:0,minHeight:70,borderTopWidth:1,borderColor:'#242d38',backgroundColor:'#0a0f16',paddingHorizontal:16,paddingVertical:11,flexDirection:'row',gap:9},modalSecondary:{flex:1,minHeight:44,borderWidth:1,borderColor:'#303a48',borderRadius:10,backgroundColor:'#111821',alignItems:'center',justifyContent:'center'},modalSecondaryText:{color:'#aeb8c7',fontSize:10,fontWeight:'800'},modalPrimary:{flex:1,minHeight:44,borderRadius:10,backgroundColor:'#7658e9',alignItems:'center',justifyContent:'center'},modalPrimaryText:{color:'#fff',fontSize:10,fontWeight:'800'},
  eqCurve:{height:170,borderWidth:1,borderColor:'#29313d',borderRadius:12,backgroundColor:'#0c121b',position:'relative',overflow:'hidden'},eqZero:{position:'absolute',left:0,right:0,top:'50%',height:1,backgroundColor:'#313a47'},eqNode:{position:'absolute',width:24,height:24,borderRadius:12,marginLeft:-12,marginTop:-12,borderWidth:2,borderColor:'#a68cff',backgroundColor:'#6650cf',alignItems:'center',justifyContent:'center'},eqNodeOff:{opacity:.35},eqNodeText:{color:'#fff',fontSize:8,fontWeight:'900'},eqBands:{gap:9},eqBand:{borderWidth:1,borderColor:'#29313d',borderRadius:11,backgroundColor:'#0d141d',padding:10,gap:6},eqBandOff:{opacity:.55},eqBandHead:{flexDirection:'row',alignItems:'center',gap:8},eqBandToggle:{width:36,height:25,borderWidth:1,borderColor:'#3b4655',borderRadius:7,alignItems:'center',justifyContent:'center'},eqBandToggleOn:{borderColor:'#7059e4',backgroundColor:'#211c3b'},eqBandToggleText:{color:'#c6cfdb',fontSize:8,fontWeight:'900'},eqBandTitle:{flex:1,color:'#e5eaf1',fontSize:10,fontWeight:'800'},eqBandFreq:{color:'#8072cc',fontSize:9,fontWeight:'800'}

});
