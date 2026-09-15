export type Song = { id:string|null; title:string; picture:string|null; audio:string; sourceAudio:string; video:string|null; description:string|null; lyrics:string|null; style:string|null; tags:string|null; duration:number|null; creator:string|null };
export type VideoAspect = '16:9'|'9:16'|'1:1'|'4:5'|'4:3';
export type WaveStyle = 'bars'|'mirror'|'line'|'dots'|'pulse';
export type VisualTemplate = 'cover-motion'|'vinyl'|'glass-card'|'lyrics-focus';
export type MotionIntensity = 'low'|'medium'|'high';
export type LyricsMode = 'off'|'scroll'|'focus';
export type PlatformPreset = 'custom'|'tiktok'|'reels'|'shorts'|'youtube'|'instagram-square'|'instagram-feed';

export const VIDEO_SIZES: Record<VideoAspect,{width:number;height:number}> = {
  '16:9':{width:1280,height:720}, '9:16':{width:720,height:1280}, '1:1':{width:1080,height:1080}, '4:5':{width:864,height:1080}, '4:3':{width:960,height:720}
};

export const PLATFORM_PRESETS:{id:PlatformPreset;label:string;aspect:VideoAspect;hint:string}[] = [
  {id:'custom',label:'Tùy chỉnh',aspect:'16:9',hint:'Tự chọn cấu hình'},
  {id:'tiktok',label:'TikTok',aspect:'9:16',hint:'720×1280'},
  {id:'reels',label:'Reels',aspect:'9:16',hint:'720×1280'},
  {id:'shorts',label:'YouTube Shorts',aspect:'9:16',hint:'720×1280'},
  {id:'youtube',label:'YouTube',aspect:'16:9',hint:'1280×720'},
  {id:'instagram-square',label:'Instagram Square',aspect:'1:1',hint:'1080×1080'},
  {id:'instagram-feed',label:'Instagram Feed',aspect:'4:5',hint:'864×1080'},
];

export const WAVE_STYLES:{id:WaveStyle;label:string}[] = [
  {id:'bars',label:'Bars'},{id:'mirror',label:'Mirror'},{id:'line',label:'Line'},{id:'dots',label:'Dots'},{id:'pulse',label:'Pulse'}
];

export const VISUAL_TEMPLATES:{id:VisualTemplate;label:string;hint:string}[] = [
  {id:'cover-motion',label:'Cover Motion',hint:'Zoom + pan theo nhịp'},
  {id:'vinyl',label:'Vinyl',hint:'Đĩa xoay + cover trung tâm'},
  {id:'glass-card',label:'Glass Card',hint:'Card kính + glow động'},
  {id:'lyrics-focus',label:'Lyrics Focus',hint:'Lyrics là trung tâm video'},
];

export const MOTION_LEVELS:{id:MotionIntensity;label:string}[] = [
  {id:'low',label:'Nhẹ'},{id:'medium',label:'Vừa'},{id:'high',label:'Mạnh'}
];

export const LYRIC_MODES:{id:LyricsMode;label:string}[] = [
  {id:'off',label:'Tắt'},{id:'scroll',label:'Scroll'},{id:'focus',label:'Focus'}
];
