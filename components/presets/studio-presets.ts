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
  motion: MotionIntensity;
  aspect: VideoAspect;
  lyrics: LyricsMode;
  effects: VideoEffect[];
  layout: OverlayLayout;
  textStyles: OverlayTextStyles;
  subtitleStyle: KaraokeDrawStyle;
  background: BackgroundConfig;
};
export const PRESET_SCHEMA_VERSION = 2;
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
  {schemaVersion:2,id:'social-hook',name:'Social Hook',description:'Hook mạnh cho TikTok, Reels và Shorts. Chữ lớn, pulse rõ, bắt mắt ngay 3 giây đầu.',category:'Social',badge:'Popular',accent:'#8b5cf6',secondary:'#ec4899',builtin:true,config:{template:'glass-card',wave:'pulse',motion:'high',aspect:'9:16',lyrics:'focus',effects:['sparkles','vignette'],layout:layout(83,61,18,26,118,125,116),textStyles:text('Impact, sans-serif','system-ui, sans-serif'),subtitleStyle:{font:'rounded',color:'#ffffff',activeColor:'#c4b5fd'},background:bg('neon-blur',12,18)}},
  {schemaVersion:2,id:'sad-lyrics',name:'Sad Lyrics',description:'Ballad và ca khúc cảm xúc. Bố cục tối, lyric tập trung, chuyển động chậm và hạt phim nhẹ.',category:'Lyrics',badge:'Ballad',accent:'#6366f1',secondary:'#94a3b8',builtin:true,config:{template:'lyrics-focus',wave:'line',motion:'low',aspect:'9:16',lyrics:'focus',effects:['film','vignette'],layout:layout(86,58,22,30,92,112,96),textStyles:text('Georgia, serif','system-ui, sans-serif','#f8fafc','#cbd5e1'),subtitleStyle:{font:'serif',color:'#f8fafc',activeColor:'#a5b4fc'},background:bg('dark-film',30,8)}},
  {schemaVersion:2,id:'cinematic-story',name:'Cinema Story',description:'Video kể chuyện điện ảnh, title thanh lịch, ánh sáng dịu và bố cục rộng.',category:'Cinematic',badge:'Premium',accent:'#f59e0b',secondary:'#7c2d12',builtin:true,config:{template:'editorial',wave:'thin-bars',motion:'low',aspect:'16:9',lyrics:'scroll',effects:['lightleak','film','vignette'],layout:layout(88,72,20,29,86,90,110),textStyles:text('Georgia, serif',"'Trebuchet MS', sans-serif",'#fff7ed','#fed7aa'),subtitleStyle:{font:'serif',color:'#fff7ed',activeColor:'#fbbf24'},background:bg('concert-light',20,10)}},
  {schemaVersion:2,id:'album-motion',name:'Album Motion',description:'Cover art là trung tâm, waveform vòng tròn và chuyển động vừa đủ cho music visualizer.',category:'Album',badge:'Album',accent:'#22c55e',secondary:'#06b6d4',builtin:true,config:{template:'vinyl',wave:'circle-bars',motion:'medium',aspect:'1:1',lyrics:'off',effects:['bokeh','vignette'],layout:layout(72,81,14,22,112,90,104),textStyles:text("'Trebuchet MS', sans-serif",'system-ui, sans-serif'),subtitleStyle:{font:'system',color:'#ffffff',activeColor:'#86efac'},background:{mode:'suno',fit:'cover',blur:8,dim:18,overlayOpacity:8,loopVideo:true}}},
  {schemaVersion:2,id:'neon-pulse',name:'Neon Pulse',description:'EDM, synthwave và electronic. Neon ring, glow, chuyển động mạnh và màu tương phản cao.',category:'Visualizer',badge:'EDM',accent:'#06b6d4',secondary:'#d946ef',builtin:true,config:{template:'glass-card',wave:'neon-ring',motion:'high',aspect:'9:16',lyrics:'off',effects:['sparkles','stars','lightleak'],layout:layout(67,80,15,23,132,90,110),textStyles:text('Impact, sans-serif',"'Courier New', monospace",'#ecfeff','#67e8f9'),subtitleStyle:{font:'impact',color:'#ecfeff',activeColor:'#e879f9'},background:bg('neon-blur',8,28)}},
  {schemaVersion:2,id:'minimal-clean',name:'Minimal Clean',description:'Tối giản, sạch, ít hiệu ứng. Phù hợp acoustic, chill, podcast music và portfolio.',category:'Album',badge:'Clean',accent:'#64748b',secondary:'#e2e8f0',builtin:true,config:{template:'cover-motion',wave:'center-line',motion:'low',aspect:'4:5',lyrics:'off',effects:['vignette'],layout:layout(88,76,68,76,82,90,92),textStyles:text('system-ui, sans-serif','system-ui, sans-serif','#ffffff','#cbd5e1'),subtitleStyle:{font:'system',color:'#ffffff',activeColor:'#cbd5e1'},background:bg('soft-light',10,3)}},
  {schemaVersion:2,id:'karaoke-pop',name:'Karaoke Pop',description:'Lyric rõ, highlight từng câu, bố cục cân bằng cho video hát theo và social clips.',category:'Lyrics',badge:'Karaoke',accent:'#f43f5e',secondary:'#fb7185',builtin:true,config:{template:'lyrics-focus',wave:'mirror',motion:'medium',aspect:'16:9',lyrics:'focus',effects:['bokeh'],layout:layout(84,56,17,25,100,132,104),textStyles:text("'Trebuchet MS', sans-serif",'system-ui, sans-serif'),subtitleStyle:{font:'rounded',color:'#ffffff',activeColor:'#fb7185'},background:bg('romantic-glow',18,18)}},
  {schemaVersion:2,id:'gold-premiere',name:'Gold Premiere',description:'Luxury music launch: gold record, chữ serif, glow nhẹ và hạt phim cao cấp.',category:'Cinematic',badge:'Launch',accent:'#fbbf24',secondary:'#92400e',builtin:true,config:{template:'gold-record',wave:'dots',motion:'low',aspect:'16:9',lyrics:'off',effects:['dust','film','vignette'],layout:layout(87,73,20,29,86,90,106),textStyles:text('Georgia, serif','Georgia, serif','#fef3c7','#fde68a'),subtitleStyle:{font:'serif',color:'#fff7ed',activeColor:'#fbbf24'},background:bg('bokeh-night',26,10)}},
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
  const cloned=structuredClone(config) as StudioPresetConfig;
  cloned.background=structuredClone(config.background||DEFAULT_BACKGROUND_CONFIG);
  return cloned;
}
const fallbackConfig=():StudioPresetConfig=>clonePresetConfig(BUILTIN_STUDIO_PRESETS[0].config);
export function normalizePresetConfig(value:Partial<StudioPresetConfig>|null|undefined):StudioPresetConfig{
  if(!value)return fallbackConfig();
  const fallback=BUILTIN_STUDIO_PRESETS[0].config;
  return {
    template:VALID_TEMPLATES.has(value.template as VisualTemplate)?value.template as VisualTemplate:fallback.template,
    wave:VALID_WAVES.has(value.wave as WaveStyle)?value.wave as WaveStyle:fallback.wave,
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
  };
}
export function normalizeStoredPresets(input:unknown):StudioPreset[]{
  if(!Array.isArray(input))return [];
  const seen=new Set<string>(),result:StudioPreset[]=[];
  for(const item of input){const preset=normalizeStudioPreset(item as Partial<StudioPreset>);if(!preset||preset.builtin||seen.has(preset.id))continue;seen.add(preset.id);result.push(preset)}
  return result;
}
