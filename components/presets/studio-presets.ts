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
import { normalizeEffectSettings, type EffectSettings, VIDEO_EFFECTS, type VideoEffect } from '@/components/v8/video-effects';
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
  effectSettings?:EffectSettings;
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
const text = (
  titleFont:string,
  creatorFont:string,
  titleColor='#ffffff',
  creatorColor='#d1d5db',
  effect?:OverlayTextStyles['title']['effect'],
):OverlayTextStyles => ({
  title:{font:titleFont,color:titleColor,...(effect?{effect}:{})},
  creator:{font:creatorFont,color:creatorColor},
});
const bg = (presetId:string,dim:number,overlayOpacity:number,blur=0):BackgroundConfig => ({
  mode:'preset',presetId,fit:'cover',blur,dim,overlayOpacity,loopVideo:true,
});
const waveLook = (
  color:string,
  color2:string,
  overrides:Partial<WaveAppearance>={},
):WaveAppearance => ({
  ...DEFAULT_WAVE_APPEARANCE,
  color,
  color2,
  ...overrides,
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

  {schemaVersion:3,id:'golden-floating-title',name:'Golden Floating Title',description:'Poster tình ca với title vàng ánh kim làm tâm điểm, trôi nổi và nghiêng nhẹ qua lại như một bìa nhạc sống.',category:'Cinematic',badge:'New · Title',accent:'#f3c768',secondary:'#8f5d20',thumbnail:'/preset-golden-floating-title.svg',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'cover-motion',wave:'thin-bars',motion:'low',aspect:'9:16',lyrics:'focus',effects:['bokeh','film','vignette'],layout:{wave:{x:50,y:88,scale:82},subtitle:{x:50,y:70,scale:106},title:{x:68,y:39,scale:148},creator:{x:68,y:49,scale:96}},textStyles:text('"Great Vibes", cursive','Georgia, serif','#f8d88b','#ead9b8',{kind:'gold-floating',floatPx:7,tiltDeg:1.45,duration:6.4,glow:.58}),subtitleStyle:{font:'serif',color:'#fff8e7',activeColor:'#f6c968'},background:{mode:'suno',fit:'cover',blur:0,dim:22,overlayOpacity:12,loopVideo:true}}},
  // Signature animated-title collection. Preview and export share the same renderer effects.
  {schemaVersion:3,id:'silver-moon-script',name:'Silver Moon Script',description:'Title bạc lạnh kiểu ánh trăng, shimmer mềm và trôi chậm cho ballad buồn, chill và late-night.',category:'Cinematic',badge:'New · Silver',accent:'#cbd5e1',secondary:'#64748b',thumbnail:'/preset-silver-moon-script.svg',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'cover-motion',wave:'line',motion:'low',aspect:'9:16',lyrics:'focus',effects:['stars','film','vignette'],layout:{wave:{x:50,y:88,scale:78},subtitle:{x:50,y:72,scale:104},title:{x:52,y:31,scale:142},creator:{x:52,y:41,scale:92}},textStyles:text('"Pinyon Script", cursive','Georgia, serif','#e7eef7','#b8c3d1',{kind:'silver-shimmer',floatPx:6,tiltDeg:.8,duration:8.2,glow:.5}),subtitleStyle:{font:'serif',color:'#eef4fb',activeColor:'#cbd5e1'},background:{mode:'suno',fit:'cover',blur:0,dim:32,overlayOpacity:18,loopVideo:true}}},
  {schemaVersion:3,id:'neon-heartbeat-title',name:'Neon Heartbeat Title',description:'Title neon hồng tím pulse nổi bật như biển hiệu đêm, dành cho synthpop, remix, city pop và EDM mềm.',category:'Visualizer',badge:'New · Neon',accent:'#f472d0',secondary:'#7c3aed',thumbnail:'/preset-neon-heartbeat-title.svg',builtin:true,mastering:{profile:'punchy',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'glass-card',wave:'neon-ring',motion:'medium',aspect:'9:16',lyrics:'off',effects:['sparkles','lightleak','vignette'],layout:{wave:{x:50,y:73,scale:118},subtitle:{x:50,y:83,scale:90},title:{x:50,y:20,scale:132},creator:{x:50,y:29,scale:94}},textStyles:text('"Alex Brush", cursive','system-ui, sans-serif','#fff1fb','#f0abfc',{kind:'neon-pulse',floatPx:0,tiltDeg:0,duration:2.9,glow:.76}),subtitleStyle:{font:'rounded',color:'#ffffff',activeColor:'#f472d0'},background:{mode:'suno',fit:'cover',blur:6,dim:38,overlayOpacity:26,loopVideo:true}}},
  {schemaVersion:3,id:'vintage-love-letter',name:'Vintage Love Letter',description:'Chữ ký màu kem pha đỏ rượu, đung đưa rất nhẹ như trang thư cũ; hợp tình ca, acoustic và bolero hiện đại.',category:'Cinematic',badge:'New · Letter',accent:'#d6b38b',secondary:'#7f1d1d',thumbnail:'/preset-vintage-love-letter.svg',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'4:5',quality:'high',durationMode:'full'},config:{template:'editorial',wave:'thin-bars',motion:'low',aspect:'4:5',lyrics:'scroll',effects:['dust','film','vignette'],layout:{wave:{x:50,y:90,scale:72},subtitle:{x:50,y:68,scale:98},title:{x:48,y:26,scale:138},creator:{x:48,y:36,scale:92}},textStyles:text('Allura, cursive','Georgia, serif','#f4dfc2','#ddc2aa',{kind:'vintage-sway',floatPx:5,tiltDeg:1.1,duration:9.4,glow:.32}),subtitleStyle:{font:'serif',color:'#f8ead7',activeColor:'#d6b38b'},background:{mode:'suno',fit:'cover',blur:0,dim:28,overlayOpacity:14,loopVideo:true}}},
  {schemaVersion:3,id:'midnight-blue-glow',name:'Midnight Blue Glow',description:'Title xanh đêm phát sáng, drift ngang chậm và sang; hợp nhạc cô đơn, city night, dream pop và cinematic.',category:'Cinematic',badge:'New · Night',accent:'#7dd3fc',secondary:'#4338ca',thumbnail:'/preset-midnight-blue-glow.svg',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'16:9',quality:'high',durationMode:'full'},config:{template:'cover-motion',wave:'mountain',motion:'low',aspect:'16:9',lyrics:'focus',effects:['stars','bokeh','vignette'],layout:{wave:{x:50,y:86,scale:90},subtitle:{x:50,y:69,scale:102},title:{x:67,y:25,scale:136},creator:{x:67,y:34,scale:92}},textStyles:text('Ephesis, cursive','Georgia, serif','#dff5ff','#a5c7f7',{kind:'midnight-drift',floatPx:7,tiltDeg:.65,duration:8.8,glow:.62}),subtitleStyle:{font:'serif',color:'#edf8ff',activeColor:'#7dd3fc'},background:{mode:'suno',fit:'cover',blur:4,dim:36,overlayOpacity:20,loopVideo:true}}},

  {schemaVersion:3,id:'podcast-wave',name:'Podcast Clean',description:'Bố cục sạch cho spoken-word, podcast và audio snippets; waveform dễ đọc, ít nhiễu.',category:'Social',badge:'Voice',accent:'#10b981',secondary:'#94a3b8',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'1:1',quality:'balanced',durationMode:'full'},config:{template:'glass-card',wave:'center-line',motion:'low',aspect:'1:1',lyrics:'scroll',effects:['vignette'],layout:layout(80,67,18,27,106,92,100),textStyles:text('system-ui, sans-serif','system-ui, sans-serif','#f8fafc','#cbd5e1'),subtitleStyle:{font:'system',color:'#ffffff',activeColor:'#34d399'},background:bg('dark-film',24,4)}},
  {schemaVersion:3,id:'retro-vinyl',name:'Warm Retro Vinyl',description:'Vinyl retro với film grain và tông ấm dành cho soul, jazz, oldies và acoustic cổ điển.',category:'Album',badge:'Retro',accent:'#fbbf24',secondary:'#a16207',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'1:1',quality:'balanced',durationMode:'full'},config:{template:'vinyl',wave:'orbit-dots',motion:'medium',aspect:'1:1',lyrics:'off',effects:['film','dust','vignette'],layout:layout(73,82,15,23,116,90,102),textStyles:text('Georgia, serif',"'Courier New', monospace",'#fef3c7','#fde68a'),subtitleStyle:{font:'serif',color:'#fff7ed',activeColor:'#fbbf24'},background:bg('bokeh-night',30,8)}},

  // V23 Signature Wave collection — inspired by premium music-cover visualizers.
  {schemaVersion:3,id:'signature-mirror-glow',name:'Mirror Glow',description:'Ballad/romantic dọc với waveform phản chiếu phát sáng, hạt sáng mềm và title script lớn như một music cover cao cấp.',category:'Visualizer',badge:'Signature · Ballad',accent:'#f24fda',secondary:'#6cbcff',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'cover-motion',wave:'mirror-glow',waveAppearance:waveLook('#ff4fd8','#62b7ff',{glow:96,opacity:98,density:78,smoothing:88,height:108,thickness:62,attack:38,release:22,colorMode:'gradient'}),motion:'low',aspect:'9:16',lyrics:'off',effects:['sparkles','bokeh','vignette'],layout:{wave:{x:50,y:70,scale:122},subtitle:{x:50,y:78,scale:92},title:{x:50,y:35,scale:154},creator:{x:50,y:46,scale:90}},textStyles:text('"Pinyon Script", cursive','system-ui, sans-serif','#ffd8f4','#e9d5ff',{kind:'neon-pulse',floatPx:3,tiltDeg:.4,duration:5.8,glow:.54}),subtitleStyle:{font:'serif',color:'#ffffff',activeColor:'#f0abfc'},background:{mode:'suno',fit:'cover',blur:0,dim:24,overlayOpacity:16,loopVideo:true}}},
  {schemaVersion:3,id:'signature-rounded-spectrum',name:'Rounded Spectrum',description:'EDM/pop dọc với các cột spectrum bo tròn cyan-magenta, reflection và glow kiểu cyberpunk.',category:'Visualizer',badge:'Signature · EDM',accent:'#45d8ff',secondary:'#ff4fd8',builtin:true,mastering:{profile:'punchy',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'glass-card',wave:'rounded-spectrum',waveAppearance:waveLook('#49cfff','#ff4fd8',{glow:92,opacity:100,density:64,smoothing:74,height:118,thickness:76,attack:78,release:32,colorMode:'audio-reactive'}),motion:'high',aspect:'9:16',lyrics:'off',effects:['sparkles','lightleak','vignette'],layout:{wave:{x:50,y:73,scale:118},subtitle:{x:50,y:83,scale:90},title:{x:50,y:37,scale:142},creator:{x:50,y:47,scale:88}},textStyles:text('Impact, "Arial Black", sans-serif','system-ui, sans-serif','#ffffff','#a5f3fc',{kind:'neon-pulse',floatPx:0,tiltDeg:-1.2,duration:2.8,glow:.8}),subtitleStyle:{font:'impact',color:'#ffffff',activeColor:'#f472d0'},background:{mode:'suno',fit:'cover',blur:1,dim:22,overlayOpacity:18,loopVideo:true}}},
  {schemaVersion:3,id:'signature-circular-pulse',name:'Circular Pulse',description:'Cinematic/travel với vòng phổ 360°, spike sáng theo beat, dotted ring và ánh vàng điện ảnh quanh chủ thể.',category:'Cinematic',badge:'Signature · Cinema',accent:'#ffd98a',secondary:'#ff9d55',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'spotlight',wave:'circular-pulse',waveAppearance:waveLook('#fff2c7','#ff9f55',{glow:82,opacity:100,density:82,smoothing:68,height:125,thickness:58,attack:72,release:28,colorMode:'dynamic'}),motion:'medium',aspect:'9:16',lyrics:'off',effects:['dust','lightleak','vignette'],layout:{wave:{x:50,y:67,scale:128},subtitle:{x:50,y:84,scale:88},title:{x:50,y:23,scale:138},creator:{x:50,y:34,scale:88}},textStyles:text('Georgia, serif','system-ui, sans-serif','#fff7e6','#fde7bd',{kind:'gold-floating',floatPx:4,tiltDeg:.35,duration:7.2,glow:.45}),subtitleStyle:{font:'serif',color:'#fffaf0',activeColor:'#fbbf24'},background:{mode:'suno',fit:'cover',blur:0,dim:18,overlayOpacity:10,loopVideo:true}}},
  {schemaVersion:3,id:'signature-ribbon-wave',name:'Ribbon Wave',description:'Acoustic/lofi/dream pop với ba dải lụa ánh sáng chuyển động mềm, glow tím-hồng-xanh và hạt sáng bay.',category:'Visualizer',badge:'Signature · Dream',accent:'#a985ff',secondary:'#ff75d8',builtin:true,mastering:{profile:'clean',spatial:{enabled:false,mode:'immersive',amount:65}},export:{aspect:'9:16',quality:'high',durationMode:'full'},config:{template:'cover-motion',wave:'ribbon-wave',waveAppearance:waveLook('#b586ff','#5fc4ff',{glow:100,opacity:96,density:84,smoothing:92,height:132,thickness:84,attack:34,release:18,colorMode:'gradient'}),motion:'low',aspect:'9:16',lyrics:'off',effects:['sparkles','stars','vignette'],layout:{wave:{x:50,y:72,scale:130},subtitle:{x:50,y:84,scale:90},title:{x:50,y:37,scale:150},creator:{x:50,y:48,scale:88}},textStyles:text('"Great Vibes", cursive','system-ui, sans-serif','#e7f5ff','#f0d5ff',{kind:'midnight-drift',floatPx:5,tiltDeg:.4,duration:7.8,glow:.64}),subtitleStyle:{font:'rounded',color:'#ffffff',activeColor:'#c4b5fd'},background:{mode:'suno',fit:'cover',blur:0,dim:24,overlayOpacity:14,loopVideo:true}}},
];

const COOLTEXT_TITLE_FONTS: Record<string, string> = {
  'social-hook': "'Bebas Neue', Impact, sans-serif",
  'sad-lyrics': "'Dancing Script', cursive",
  'cinematic-story': "'Tangerine', Georgia, serif",
  'album-motion': "'Special Elite', Georgia, serif",
  'neon-pulse': "'Orbitron', 'Trebuchet MS', sans-serif",
  'karaoke-pop': "'Bebas Neue', Impact, sans-serif",
  'gold-premiere': "'Tangerine', Georgia, serif",
  'reels-velocity': "'Bebas Neue', Impact, sans-serif",
  'story-confession': "'Special Elite', 'Courier New', monospace",
  'midnight-drive': "'Orbitron', 'Trebuchet MS', sans-serif",
  'acoustic-room': "'Special Elite', Georgia, serif",
  'festival-energy': "'Orbitron', Impact, sans-serif",
  'romantic-letter': "'Dancing Script', cursive",
  'golden-floating-title': "'Tangerine', Georgia, serif",
  'silver-moon-script': "'Dancing Script', cursive",
  'neon-heartbeat-title': "'Orbitron', 'Trebuchet MS', sans-serif",
  'vintage-love-letter': "'Dancing Script', cursive",
  'midnight-blue-glow': "'Tangerine', Georgia, serif",
  'retro-vinyl': "'Special Elite', Georgia, serif",
  'signature-mirror-glow': "'Dancing Script', cursive",
  'signature-rounded-spectrum': "'Bebas Neue', Impact, sans-serif",
  'signature-circular-pulse': "'Tangerine', Georgia, serif",
  'signature-ribbon-wave': "'Dancing Script', cursive",
};

for (const preset of BUILTIN_STUDIO_PRESETS) {
  const titleFont = COOLTEXT_TITLE_FONTS[preset.id];
  if (titleFont) preset.config.textStyles.title.font = titleFont;
}

const VALID_TEMPLATES = new Set<VisualTemplate>(['cover-motion','vinyl','glass-card','lyrics-focus','editorial','spotlight','gold-record']);
const VALID_ASPECTS = new Set<VideoAspect>(['16:9','9:16','1:1','4:5','4:3']);
const VALID_LYRICS = new Set<LyricsMode>(['off','scroll','focus']);
const VALID_MOTION = new Set<MotionIntensity>(['low','medium','high']);
const VALID_WAVES = new Set<WaveStyle>(WAVE_STYLES.map(item=>item.id));
const VALID_EFFECTS = new Set<VideoEffect>(VIDEO_EFFECTS.map(item=>item.id));
const clamp=(value:unknown,min:number,max:number,fallback:number)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
const WAVE_COLOR_MODES = new Set(['solid','gradient','dynamic','audio-reactive']);
const normalizeWaveAppearance=(value:Partial<WaveAppearance>|undefined):WaveAppearance=>{
  const source={...DEFAULT_WAVE_APPEARANCE,...(value||{})};
  return {
    color:typeof source.color==='string'&&/^#[0-9a-f]{6}$/i.test(source.color)?source.color:DEFAULT_WAVE_APPEARANCE.color,
    color2:typeof source.color2==='string'&&/^#[0-9a-f]{6}$/i.test(source.color2)?source.color2:DEFAULT_WAVE_APPEARANCE.color2,
    glow:clamp(source.glow,0,100,DEFAULT_WAVE_APPEARANCE.glow),
    opacity:clamp(source.opacity,10,100,DEFAULT_WAVE_APPEARANCE.opacity),
    density:clamp(source.density,20,100,DEFAULT_WAVE_APPEARANCE.density),
    smoothing:clamp(source.smoothing,0,100,DEFAULT_WAVE_APPEARANCE.smoothing),
    height:clamp(source.height,20,160,DEFAULT_WAVE_APPEARANCE.height),
    thickness:clamp(source.thickness,10,100,DEFAULT_WAVE_APPEARANCE.thickness),
    attack:clamp(source.attack,0,100,DEFAULT_WAVE_APPEARANCE.attack),
    release:clamp(source.release,0,100,DEFAULT_WAVE_APPEARANCE.release),
    rotation:clamp(source.rotation,-180,180,DEFAULT_WAVE_APPEARANCE.rotation),
    colorMode:WAVE_COLOR_MODES.has(source.colorMode)?source.colorMode:DEFAULT_WAVE_APPEARANCE.colorMode,
  };
};
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
    waveAppearance:normalizeWaveAppearance(value.waveAppearance||fallback.waveAppearance),
    motion:VALID_MOTION.has(value.motion as MotionIntensity)?value.motion as MotionIntensity:fallback.motion,
    aspect:VALID_ASPECTS.has(value.aspect as VideoAspect)?value.aspect as VideoAspect:fallback.aspect,
    lyrics:VALID_LYRICS.has(value.lyrics as LyricsMode)?value.lyrics as LyricsMode:fallback.lyrics,
    effects:Array.isArray(value.effects)?value.effects.filter((effect):effect is VideoEffect=>VALID_EFFECTS.has(effect as VideoEffect)):[...fallback.effects],
    effectSettings:normalizeEffectSettings(value.effectSettings),
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
