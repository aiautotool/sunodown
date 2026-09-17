export type Song = { id:string|null; title:string; picture:string|null; audio:string; sourceAudio:string; video:string|null; description:string|null; lyrics:string|null; style:string|null; tags:string|null; duration:number|null; creator:string|null };
export type VideoAspect = '16:9'|'9:16'|'1:1'|'4:5'|'4:3';
export type WaveStyle = 'bars'|'mirror'|'line'|'dots'|'pulse';
export type VisualTemplate = 'cover-motion'|'vinyl'|'glass-card'|'lyrics-focus';
export type MotionIntensity = 'low'|'medium'|'high';
export type LyricsMode = 'off'|'scroll'|'focus';
export type PlatformPreset = 'custom'|'tiktok'|'reels'|'shorts'|'youtube'|'instagram-square'|'instagram-feed';
export type VideoPresetId = 'cinematic-cover'|'vinyl-night'|'glass-neon'|'lyrics-tiktok'|'minimal-album'|'spectrum-club'|'dreamy-reels'|'karaoke-focus'|'retro-record'|'social-pulse'|'chill-glass'|'youtube-music';

export const VIDEO_SIZES: Record<VideoAspect,{width:number;height:number}> = {
  '16:9':{width:1280,height:720}, '9:16':{width:720,height:1280}, '1:1':{width:1080,height:1080}, '4:5':{width:864,height:1080}, '4:3':{width:960,height:720}
};

export const PLATFORM_PRESETS:{id:PlatformPreset;label:string;aspect:VideoAspect;hint:string}[] = [
  {id:'custom',label:'Tùy chỉnh',aspect:'16:9',hint:'Tự chọn cấu hình'},
  {id:'tiktok',label:'TikTok',aspect:'9:16',hint:'720×1280'},
  {id:'reels',label:'Reels',aspect:'9:16',hint:'720×1280'},
  {id:'shorts',label:'YouTube Shorts',aspect:'9:16',hint:'720×1280'},
  {id:'youtube',label:'YouTube',aspect:'16:9',hint:'1280×720'},
  {id:'instagram-square',label:'Instagram vuông',aspect:'1:1',hint:'1080×1080'},
  {id:'instagram-feed',label:'Bảng tin Instagram',aspect:'4:5',hint:'864×1080'},
];

export const WAVE_STYLES:{id:WaveStyle;label:string}[] = [
  {id:'bars',label:'Cột sóng'},{id:'mirror',label:'Đối xứng'},{id:'line',label:'Đường sóng'},{id:'dots',label:'Chấm'},{id:'pulse',label:'Nhịp đập'}
];

export const VISUAL_TEMPLATES:{id:VisualTemplate;label:string;hint:string}[] = [
  {id:'cover-motion',label:'Ảnh bìa chuyển động',hint:'Phóng to và di chuyển theo nhịp'},
  {id:'vinyl',label:'Đĩa than',hint:'Đĩa xoay và ảnh bìa trung tâm'},
  {id:'glass-card',label:'Thẻ kính',hint:'Thẻ kính và ánh sáng chuyển động'},
  {id:'lyrics-focus',label:'Lời bài hát nổi bật',hint:'Lấy lời bài hát làm trung tâm'},
];

export const VIDEO_PRESETS:{id:VideoPresetId;label:string;hint:string;category:'Album'|'Social'|'Lyrics'|'Visualizer';template:VisualTemplate;wave:WaveStyle;motion:MotionIntensity;lyrics:LyricsMode;aspect:VideoAspect;badge?:string}[] = [
  {id:'cinematic-cover',label:'Ảnh bìa điện ảnh',hint:'Ảnh bìa chuyển động điện ảnh',category:'Album',template:'cover-motion',wave:'line',motion:'low',lyrics:'off',aspect:'16:9',badge:'Phổ biến'},
  {id:'vinyl-night',label:'Đĩa than đêm',hint:'Đĩa than xoay và cột sóng',category:'Album',template:'vinyl',wave:'bars',motion:'medium',lyrics:'off',aspect:'16:9'},
  {id:'glass-neon',label:'Kính neon',hint:'Thẻ kính và sóng đối xứng neon',category:'Visualizer',template:'glass-card',wave:'mirror',motion:'medium',lyrics:'off',aspect:'16:9',badge:'Mới'},
  {id:'lyrics-tiktok',label:'Lời nhạc TikTok',hint:'Lời bài hát nổi bật cho video dọc',category:'Lyrics',template:'lyrics-focus',wave:'pulse',motion:'medium',lyrics:'focus',aspect:'9:16',badge:'9:16'},
  {id:'minimal-album',label:'Ảnh bìa tối giản',hint:'Ảnh bìa gọn và đường sóng mảnh',category:'Album',template:'cover-motion',wave:'line',motion:'low',lyrics:'off',aspect:'1:1'},
  {id:'spectrum-club',label:'Phổ nhạc sôi động',hint:'Cột sóng mạnh cho nhạc điện tử',category:'Visualizer',template:'glass-card',wave:'bars',motion:'high',lyrics:'off',aspect:'16:9'},
  {id:'dreamy-reels',label:'Reels mộng mơ',hint:'Hiệu ứng kính mềm cho Reels',category:'Social',template:'glass-card',wave:'dots',motion:'low',lyrics:'off',aspect:'9:16',badge:'Reels'},
  {id:'karaoke-focus',label:'Karaoke nổi bật',hint:'Lời bài hát lớn và sóng âm gọn',category:'Lyrics',template:'lyrics-focus',wave:'line',motion:'low',lyrics:'focus',aspect:'16:9'},
  {id:'retro-record',label:'Đĩa than cổ điển',hint:'Đĩa than cổ điển và sóng đối xứng',category:'Album',template:'vinyl',wave:'mirror',motion:'low',lyrics:'off',aspect:'4:3'},
  {id:'social-pulse',label:'Nhịp mạng xã hội',hint:'Nhịp đập mạnh cho Shorts',category:'Social',template:'cover-motion',wave:'pulse',motion:'high',lyrics:'scroll',aspect:'9:16',badge:'Shorts'},
  {id:'chill-glass',label:'Kính dịu nhẹ',hint:'Chấm nhẹ và thẻ kính',category:'Visualizer',template:'glass-card',wave:'dots',motion:'low',lyrics:'off',aspect:'4:5'},
  {id:'youtube-music',label:'YouTube Music',hint:'Bố cục rộng, tiêu đề rõ',category:'Social',template:'vinyl',wave:'line',motion:'medium',lyrics:'off',aspect:'16:9',badge:'YouTube'},
];

export const MOTION_LEVELS:{id:MotionIntensity;label:string}[] = [
  {id:'low',label:'Nhẹ'},{id:'medium',label:'Vừa'},{id:'high',label:'Mạnh'}
];

export const LYRIC_MODES:{id:LyricsMode;label:string}[] = [
  {id:'off',label:'Tắt'},{id:'scroll',label:'Cuộn'},{id:'focus',label:'Nổi bật'}
];
