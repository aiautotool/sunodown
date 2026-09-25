import { normalizeProductionPreset, type ProductionExportConfig, type ProductionMasteringConfig } from './production-preset';
import type { KaraokeDrawStyle } from '@/app/lib/karaoke';
import type { OverlayTextStyles } from '@/components/v4/renderer-safe';
import type { OverlayLayout } from '@/components/v9/overlay-layout-panel';
import {
  WAVE_STYLES,
  type LyricsMode,
  type MotionIntensity,
  type VideoAspect,
  type VisualTemplate,
  type WaveStyle,
  type WaveAppearance,
  DEFAULT_WAVE_APPEARANCE,
} from '@/components/v4/types';
import { VIDEO_EFFECTS, type VideoEffect } from '@/components/v8/video-effects';
import {
  DEFAULT_BACKGROUND_CONFIG,
  sanitizeStoredBackground,
  type BackgroundConfig,
} from '@/components/v8/background';

export type StudioPresetCategory = 'Social' | 'Lyrics' | 'Cinematic' | 'Album' | 'Visualizer';
export type StudioPresetConfig = {
  template: VisualTemplate;
  wave: WaveStyle;
  waveAppearance?: WaveAppearance;
  motion: MotionIntensity;
  aspect: VideoAspect;
  lyrics: LyricsMode;
  effects: VideoEffect[];
  layout: OverlayLayout;
  textStyles: OverlayTextStyles;
  subtitleStyle: KaraokeDrawStyle;
  background: BackgroundConfig;
};
export const PRESET_SCHEMA_VERSION = 3;
export type StudioPreset = {
  schemaVersion?: number;
  id: string;
  name: string;
  description: string;
  category: StudioPresetCategory;
  badge?: string;
  accent: string;
  secondary: string;
  thumbnail?: string;
  builtin?: boolean;
  config: StudioPresetConfig;
  mastering?: ProductionMasteringConfig;
  export?: ProductionExportConfig;
};

const layout = (waveY:number,subtitleY:number,titleY:number,creatorY:number,waveScale=100,subtitleScale=100,titleScale=100):OverlayLayout => ({
  wave:{x:50,y:waveY,scale:waveScale}, subtitle:{x:50,y:subtitleY,scale:subtitleScale},
  title:{x:50,y:titleY,scale:titleScale}, creator:{x:50,y:creatorY,scale:100},
});
const text = (titleFont:string,creatorFont:string,titleColor='#ffffff',creatorColor='#d1d5db'):OverlayTextStyles => ({
  title:{font:titleFont,color:titleColor}, creator:{font:creatorFont,color:creatorColor},
});
const bg = (presetId:string,dim:number,overlayOpacity:number,blur=0):BackgroundConfig => ({
  mode:'preset',presetId,fit:'cover',blur,dim,overlayOpacity,loopVideo:true,
});

export const BUILTIN_STUDIO_PRESETS:StudioPreset[] = [
  {schemaVersion:3,id:'social-hook',name:'Viral Hook',description:'Video dọc bắt mắt ngay 3 giây đầu: chữ lớn, pulse mạnh và nhịp hình rõ cho TikTok/Reels.',category:'Social',badge:'Popular',accent:'#8b5cf6',secondary:'#ec4899',builtin:true,mastering:{profile:'tiktok-loud',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'glass-card',wave:'pulse',motion:'high',aspect:'9:16',lyrics:'focus',effects:['sparkles','vignette'],layout:layout(83,61,18,26,118,125,116),textStyles:text('Impact, sans-serif','system-ui, sans-serif'),subtitleStyle:{font:'rounded',color:'#ffffff',activeColor:'#c4b5fd'},background:bg('neon-blur',12,18)}},
  {schemaVersion:3,id:'sad-lyrics',name:'Sad Lyrics Cinema',description:'Ballad cảm xúc với lyric làm trung tâm, nền tối điện ảnh và chuyển động chậm, sâu.',category:'Lyrics',badge:'Ballad',accent:'#6366f1',secondary:'#94a3b8',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'lyrics-focus',wave:'line',motion:'low',aspect:'9:16',lyrics:'focus',effects:['film','vignette'],layout:layout(86,58,22,30,92,112,96),textStyles:text('Georgia, serif','system-ui, sans-serif','#f8fafc','#cbd5e1'),subtitleStyle:{font:'serif',color:'#f8fafc',activeColor:'#a5b4fc'},background:bg('dark-film',30,8)}},
  {schemaVersion:3,id:'cinematic-story',name:'Cinema Story',description:'Kể chuyện bằng khung hình điện ảnh, title thanh lịch, ánh sáng dịu và bố cục rộng.',category:'Cinematic',badge:'Premium',accent:'#f59e0b',secondary:'#7c2d12',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'16:9',quality:'high',durationMode:'full'},config:{template:'editorial',wave:'thin-bars',motion:'low',aspect:'16:9',lyrics:'scroll',effects:['lightleak','film','vignette'],layout:layout(88,72,20,29,86,90,110),textStyles:text('Georgia, serif',"'Trebuchet MS', sans-serif",'#fff7ed','#fed7aa'),subtitleStyle:{font:'serif',color:'#fff7ed',activeColor:'#fbbf24'},background:bg('concert-light',20,10)}},
  {schemaVersion:3,id:'album-motion',name:'Midnight Vinyl',description:'Đĩa than quay với cover ở tâm, waveform vòng tròn và chuyển động vừa đủ cho music visualizer.',category:'Album',badge:'Album',accent:'#22c55e',secondary:'#06b6d4',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'1:1',quality:'balanced',durationMode:'full'},config:{template:'vinyl',wave:'circle-bars',motion:'medium',aspect:'1:1',lyrics:'off',effects:['bokeh','vignette'],layout:layout(72,81,14,22,112,90,104),textStyles:text("'Trebuchet MS', sans-serif",'system-ui, sans-serif'),subtitleStyle:{font:'system',color:'#ffffff',activeColor:'#86efac'},background:{mode:'suno',fit:'cover',blur:8,dim:18,overlayOpacity:8,loopVideo:true}}},
  {schemaVersion:3,id:'neon-pulse',name:'Neon Pulse',description:'EDM/synthwave với neon ring, glow mạnh và phản ứng năng lượng rõ theo nhạc.',category:'Visualizer',badge:'EDM',accent:'#06b6d4',secondary:'#d946ef',builtin:true,mastering:{profile:'punchy',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'glass-card',wave:'neon-ring',motion:'high',aspect:'9:16',lyrics:'off',effects:['sparkles','stars','lightleak'],layout:layout(67,80,15,23,132,90,110),textStyles:text('Impact, sans-serif',"'Courier New', monospace",'#ecfeff','#67e8f9'),subtitleStyle:{font:'impact',color:'#ecfeff',activeColor:'#e879f9'},background:bg('neon-blur',8,28)}},
  {schemaVersion:3,id:'minimal-clean',name:'Minimal Clean',description:'Tối giản, sạch và ít hiệu ứng cho acoustic, chill, podcast music hoặc portfolio.',category:'Album',badge:'Clean',accent:'#64748b',secondary:'#e2e8f0',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'4:5',quality:'balanced',durationMode:'full'},config:{template:'cover-motion',wave:'center-line',motion:'low',aspect:'4:5',lyrics:'off',effects:['vignette'],layout:layout(88,76,68,76,82,90,92),textStyles:text('system-ui, sans-serif','system-ui, sans-serif','#ffffff','#cbd5e1'),subtitleStyle:{font:'system',color:'#ffffff',activeColor:'#cbd5e1'},background:bg('soft-light',10,3)}},
  {schemaVersion:3,id:'karaoke-pop',name:'Karaoke Pop',description:'Lyric rõ, highlight từng câu và bố cục cân bằng để hát theo hoặc cắt social clip.',category:'Lyrics',badge:'Karaoke',accent:'#f43f5e',secondary:'#fb7185',builtin:true,mastering:{profile:'tiktok-loud',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'16:9',quality:'high',durationMode:'full'},config:{template:'lyrics-focus',wave:'mirror',motion:'medium',aspect:'16:9',lyrics:'focus',effects:['bokeh'],layout:layout(84,56,17,25,100,132,104),textStyles:text("'Trebuchet MS', sans-serif",'system-ui, sans-serif'),subtitleStyle:{font:'rounded',color:'#ffffff',activeColor:'#fb7185'},background:bg('romantic-glow',18,18)}},
  {schemaVersion:3,id:'gold-premiere',name:'Golden Premiere',description:'Ra mắt ca khúc theo phong cách luxury: đĩa vàng, serif, glow nhẹ và film grain cao cấp.',category:'Cinematic',badge:'Launch',accent:'#fbbf24',secondary:'#92400e',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'16:9',quality:'high',durationMode:'full'},config:{template:'gold-record',wave:'dots',motion:'low',aspect:'16:9',lyrics:'off',effects:['dust','film','vignette'],layout:layout(87,73,20,29,86,90,106),textStyles:text('Georgia, serif','Georgia, serif','#fef3c7','#fde68a'),subtitleStyle:{font:'serif',color:'#fff7ed',activeColor:'#fbbf24'},background:bg('bokeh-night',26,10)}},

  {schemaVersion:3,id:'reels-velocity',name:'Reels Velocity',description:'Nhịp nhanh cho Reels/Shorts: waveform lớn, title gọn và ánh sáng neon chuyển động mạnh.',category:'Social',badge:'New',accent:'#22d3ee',secondary:'#a855f7',builtin:true,mastering:{profile:'tiktok-loud',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'30s'},config:{template:'spotlight',wave:'wave-bars',motion:'high',aspect:'9:16',lyrics:'focus',effects:['sparkles','lightleak','vignette'],layout:layout(79,59,16,24,124,118,108),textStyles:text('Impact, sans-serif',"'Trebuchet MS', sans-serif",'#ecfeff','#a5f3fc'),subtitleStyle:{font:'rounded',color:'#ffffff',activeColor:'#22d3ee'},background:bg('dreamy-blue',14,20)}},
  {schemaVersion:3,id:'story-confession',name:'Confession Story',description:'Tập trung lời kể và lyric, nhịp chậm, nền tối mềm cho video tâm sự và storytelling.',category:'Lyrics',badge:'Story',accent:'#c084fc',secondary:'#64748b',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'lyrics-focus',wave:'ribbon',motion:'low',aspect:'9:16',lyrics:'scroll',effects:['film','dust','vignette'],layout:layout(89,55,19,27,84,108,94),textStyles:text('Georgia, serif','system-ui, sans-serif','#faf5ff','#cbd5e1'),subtitleStyle:{font:'serif',color:'#f8fafc',activeColor:'#d8b4fe'},background:bg('dark-film',34,12)}},
  {schemaVersion:3,id:'midnight-drive',name:'Midnight Drive',description:'Không khí thành phố về đêm cho synthpop, chillwave và late-night tracks.',category:'Visualizer',badge:'Night',accent:'#38bdf8',secondary:'#818cf8',builtin:true,mastering:{profile:'punchy',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'16:9',quality:'high',durationMode:'full'},config:{template:'glass-card',wave:'mountain',motion:'medium',aspect:'16:9',lyrics:'off',effects:['stars','bokeh','vignette'],layout:layout(82,74,18,27,108,90,102),textStyles:text("'Trebuchet MS', sans-serif",'system-ui, sans-serif','#e0f2fe','#bae6fd'),subtitleStyle:{font:'system',color:'#ffffff',activeColor:'#38bdf8'},background:bg('dreamy-blue',22,20)}},
  {schemaVersion:3,id:'acoustic-room',name:'Acoustic Journal',description:'Ấm, tối giản và gần gũi cho acoustic/live session với typography mềm và hiệu ứng tiết chế.',category:'Album',badge:'Acoustic',accent:'#f59e0b',secondary:'#d6d3d1',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'4:5',quality:'high',durationMode:'full'},config:{template:'cover-motion',wave:'line',motion:'low',aspect:'4:5',lyrics:'scroll',effects:['dust','vignette'],layout:layout(87,70,17,25,88,94,98),textStyles:text('Georgia, serif','system-ui, sans-serif','#fff7ed','#e7e5e4'),subtitleStyle:{font:'serif',color:'#fff7ed',activeColor:'#fbbf24'},background:bg('soft-light',18,5)}},
  {schemaVersion:3,id:'festival-energy',name:'Festival Pulse',description:'Visualizer năng lượng cao cho EDM/live set với vòng sóng lớn, sparkle và concert lighting.',category:'Visualizer',badge:'Live',accent:'#f472b6',secondary:'#22d3ee',builtin:true,mastering:{profile:'max-loud',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'16:9',quality:'high',durationMode:'full'},config:{template:'spotlight',wave:'spectrum-rings',motion:'high',aspect:'16:9',lyrics:'off',effects:['sparkles','stars','lightleak'],layout:layout(66,78,15,23,138,90,112),textStyles:text('Impact, sans-serif',"'Courier New', monospace",'#fdf4ff','#a5f3fc'),subtitleStyle:{font:'impact',color:'#ffffff',activeColor:'#f472b6'},background:bg('concert-light',10,24)}},
  {schemaVersion:3,id:'romantic-letter',name:'Romantic Letter',description:'Thư tình điện ảnh với serif thanh lịch, lyric rõ và glow hồng dịu cho love songs.',category:'Cinematic',badge:'Love',accent:'#fb7185',secondary:'#fda4af',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'16:9',quality:'high',durationMode:'full'},config:{template:'editorial',wave:'thin-bars',motion:'low',aspect:'16:9',lyrics:'focus',effects:['bokeh','film','vignette'],layout:layout(89,63,18,27,82,110,106),textStyles:text('Georgia, serif','Georgia, serif','#fff1f2','#fecdd3'),subtitleStyle:{font:'serif',color:'#fff1f2',activeColor:'#fb7185'},background:bg('romantic-glow',24,14)}},
  {schemaVersion:3,id:'podcast-wave',name:'Podcast Clean',description:'Bố cục sạch cho spoken-word, podcast và audio snippets; waveform dễ đọc, ít nhiễu.',category:'Social',badge:'Voice',accent:'#10b981',secondary:'#94a3b8',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'1:1',quality:'balanced',durationMode:'full'},config:{template:'glass-card',wave:'center-line',motion:'low',aspect:'1:1',lyrics:'scroll',effects:['vignette'],layout:layout(80,67,18,27,106,92,100),textStyles:text('system-ui, sans-serif','system-ui, sans-serif','#f8fafc','#cbd5e1'),subtitleStyle:{font:'system',color:'#ffffff',activeColor:'#34d399'},background:bg('dark-film',24,4)}},
  {schemaVersion:3,id:'retro-vinyl',name:'Warm Retro Vinyl',description:'Vinyl retro với film grain và tông ấm dành cho soul, jazz, oldies và acoustic cổ điển.',category:'Album',badge:'Retro',accent:'#fbbf24',secondary:'#a16207',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'1:1',quality:'balanced',durationMode:'full'},config:{template:'vinyl',wave:'orbit-dots',motion:'medium',aspect:'1:1',lyrics:'off',effects:['film','dust','vignette'],layout:layout(73,82,15,23,116,90,102),textStyles:text('Georgia, serif',"'Courier New', monospace",'#fef3c7','#fde68a'),subtitleStyle:{font:'serif',color:'#fff7ed',activeColor:'#fbbf24'},background:bg('bokeh-night',30,8)}},
];

const VALID_TEMPLATES = new Set<VisualTemplate>(['cover-motion','vinyl','glass-card','lyrics-focus','editorial','spotlight','gold-record']);
const VALID_ASPECTS = new Set<VideoAspect>(['16:9','9:16','1:1','4:5','4:3']);
const VALID_LYRICS = new Set<LyricsMode>(['off','scroll','focus']);
const VALID_MOTION = new Set<MotionIntensity>(['low','medium','high']);
const VALID_WAVES = new Set<WaveStyle>(WAVE_STYLES.map(item=>item.id));
const VALID_EFFECTS = new Set<VideoEffect>(VIDEO_EFFECTS.map(item=>item.id));
const clamp=(value:unknown,min:number,max:number,fallback:number)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
const normalizeLayout=(value:Partial<OverlayLayout>|undefined,fallback:OverlayLayout):OverlayLayout=>{
  const source=value||{};
  const item=(key:keyof OverlayLayout)=>({x:clamp(source[key]?.x,0,100,fallback[key].x),y:clamp(source[key]?.y,0,100,fallback[key].y),scale:clamp(source[key]?.scale,40,180,fallback[key].scale)});
  return {wave:item('wave'),subtitle:item('subtitle'),title:item('title'),creator:item('creator')};
};

export function clonePresetConfig(config:StudioPresetConfig):StudioPresetConfig{
  return normalizePresetConfig(config);
}
const fallbackConfig=():StudioPresetConfig=>clonePresetConfig(BUILTIN_STUDIO_PRESETS[0].config);
export function normalizePresetConfig(value:Partial<StudioPresetConfig>|null|undefined):StudioPresetConfig{
  if(!value)return fallbackConfig();
  const fallback=BUILTIN_STUDIO_PRESETS[0].config;
  return {
    template:VALID_TEMPLATES.has(value.template as VisualTemplate)?value.template as VisualTemplate:fallback.template,
    wave:VALID_WAVES.has(value.wave as WaveStyle)?value.wave as WaveStyle:fallback.wave,
    waveAppearance:{...DEFAULT_WAVE_APPEARANCE,...(value.waveAppearance||fallback.waveAppearance||{})},
    motion:VALID_MOTION.has(value.motion as MotionIntensity)?value.motion as MotionIntensity:fallback.motion,
    aspect:VALID_ASPECTS.has(value.aspect as VideoAspect)?value.aspect as VideoAspect:fallback.aspect,
    lyrics:VALID_LYRICS.has(value.lyrics as LyricsMode)?value.lyrics as LyricsMode:fallback.lyrics,
    effects:Array.isArray(value.effects)?value.effects.filter((effect):effect is VideoEffect=>VALID_EFFECTS.has(effect as VideoEffect)):[...fallback.effects],
    layout:normalizeLayout(value.layout,fallback.layout),
    textStyles:structuredClone(value.textStyles||fallback.textStyles),
    subtitleStyle:structuredClone(value.subtitleStyle||fallback.subtitleStyle),
    background:sanitizeStoredBackground(value.background||DEFAULT_BACKGROUND_CONFIG),
  };
}
export function normalizeStudioPreset(value:Partial<StudioPreset>|null|undefined):StudioPreset|null{
  if(!value||typeof value.id!=='string'||typeof value.name!=='string')return null;
  const categories:StudioPresetCategory[]=['Social','Lyrics','Cinematic','Album','Visualizer'];
  const category=categories.includes(value.category as StudioPresetCategory)?value.category as StudioPresetCategory:'Social';
  return {
    schemaVersion:PRESET_SCHEMA_VERSION,id:value.id,name:value.name.trim()||'Untitled preset',
    description:typeof value.description==='string'&&value.description.trim()?value.description:'Custom Creator Studio preset.',
    category,badge:typeof value.badge==='string'?value.badge:'My preset',
    accent:typeof value.accent==='string'&&/^#[0-9a-f]{6}$/i.test(value.accent)?value.accent:'#8b5cf6',
    secondary:typeof value.secondary==='string'&&/^#[0-9a-f]{6}$/i.test(value.secondary)?value.secondary:'#ffffff',
    thumbnail:typeof value.thumbnail==='string'&&(value.thumbnail.startsWith('data:image/')||value.thumbnail.startsWith('https://'))?value.thumbnail:undefined,
    builtin:value.builtin===true,config:normalizePresetConfig(value.config),
    ...normalizeProductionPreset({ mastering:value.mastering, export:value.export }, normalizePresetConfig(value.config).aspect),
  };
}
export function normalizeStoredPresets(input:unknown):StudioPreset[]{
  if(!Array.isArray(input))return [];
  const seen=new Set<string>(),result:StudioPreset[]=[];
  for(const item of input){const preset=normalizeStudioPreset(item as Partial<StudioPreset>);if(!preset||preset.builtin||seen.has(preset.id))continue;seen.add(preset.id);result.push(preset)}
  return result;
}
