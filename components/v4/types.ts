export type Song = { id:string|null; title:string; picture:string|null; audio:string; sourceAudio:string; video:string|null; description:string|null; lyrics:string|null; style:string|null; tags:string|null; duration:number|null; creator:string|null };
export type VideoAspect = '16:9'|'9:16'|'1:1'|'4:5'|'4:3';
export type WaveStyle = 'bars'|'mirror'|'line'|'dots'|'pulse'|'thin-bars'|'blocks'|'needles'|'mountain'|'ribbon'|'spark'|'center-line'|'equalizer'|'circle'|'circle-bars'|'orbit-dots'|'radial-spectrum'|'neon-ring'|'arc-burst'|'spiral'|'radial-wave'|'pinwheel'|'mandala'|'spectrum-rings'|'wave-bars'|'stacked-spectrum';
export type VisualTemplate = 'cover-motion'|'vinyl'|'glass-card'|'lyrics-focus'|'editorial'|'spotlight'|'gold-record';
export type MotionIntensity = 'low'|'medium'|'high';
export type LyricsMode = 'off'|'scroll'|'focus';
export type PlatformPreset = 'custom'|'tiktok'|'reels'|'shorts'|'youtube'|'instagram-square'|'instagram-feed';
export type VideoPresetId = 'cinematic-cover'|'vinyl-night'|'glass-neon'|'lyrics-tiktok'|'minimal-album'|'spectrum-club'|'dreamy-reels'|'karaoke-focus'|'retro-record'|'social-pulse'|'chill-glass'|'youtube-music'|'portrait-record'|'square-record'|'cover-feed'|'gentle-story'|'glass-square'|'shorts-energy'|'lyrics-scroll'|'lyrics-square'|'lyrics-feed'|'wide-pulse'|'mirror-square'|'retro-spectrum'|'editorial-portrait'|'editorial-wide'|'spotlight-portrait'|'spotlight-square'|'gold-portrait'|'gold-wide';

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
  {id:'bars',label:'Cột sóng'},{id:'mirror',label:'Đối xứng'},{id:'line',label:'Đường sóng'},{id:'dots',label:'Chấm'},{id:'pulse',label:'Nhịp đập'},
  {id:'thin-bars',label:'Cột mảnh'},{id:'blocks',label:'Khối LED'},{id:'needles',label:'Kim phổ'},{id:'mountain',label:'Dãy núi'},{id:'ribbon',label:'Dải lụa'},{id:'spark',label:'Tia sáng'},{id:'center-line',label:'Đường tâm'},{id:'equalizer',label:'Equalizer'},{id:'circle',label:'Vòng tròn'},{id:'circle-bars',label:'Cột vòng tròn'},{id:'orbit-dots',label:'Chấm quỹ đạo'},{id:'radial-spectrum',label:'Phổ xuyên tâm'},{id:'neon-ring',label:'Vòng neon đổi màu'},{id:'arc-burst',label:'Arc Burst 360°'},{id:'spiral',label:'Spiral Spectrum'},{id:'radial-wave',label:'Radial Wave'},{id:'pinwheel',label:'Pinwheel'},{id:'mandala',label:'Mandala'},{id:'spectrum-rings',label:'Spectrum Rings'},{id:'wave-bars',label:'Wave Bars'},{id:'stacked-spectrum',label:'Stacked Spectrum'}
];

export const VISUAL_TEMPLATES:{id:VisualTemplate;label:string;hint:string}[] = [
  {id:'cover-motion',label:'Ảnh bìa chuyển động',hint:'Phóng to và di chuyển theo nhịp'},
  {id:'vinyl',label:'Đĩa than',hint:'Đĩa xoay và ảnh bìa trung tâm'},
  {id:'glass-card',label:'Thẻ kính',hint:'Thẻ kính và ánh sáng chuyển động'},
  {id:'lyrics-focus',label:'Lời bài hát nổi bật',hint:'Lấy lời bài hát làm trung tâm'},
  {id:'editorial',label:'Tạp chí âm nhạc',hint:'Chữ lớn, nền xanh trầm và viền kem'},
  {id:'spotlight',label:'Sân khấu ánh sáng',hint:'Bìa nổi trên nền tối và hào quang'},
  {id:'gold-record',label:'Đĩa vàng',hint:'Đĩa kim loại xoay và chữ thanh lịch'},
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
  {"id": "portrait-record", "label": "Đĩa than dọc", "hint": "Đĩa xoay dọc với đường sóng nhẹ", "category": "Album", "template": "vinyl", "wave": "line", "motion": "low", "lyrics": "off", "aspect": "9:16", "badge": "Mới"},
  {"id": "square-record", "label": "Đĩa than vuông", "hint": "Ảnh bìa vuông với chấm nhạc", "category": "Album", "template": "vinyl", "wave": "dots", "motion": "low", "lyrics": "off", "aspect": "1:1", "badge": "Mới"},
  {"id": "cover-feed", "label": "Ảnh bìa nổi bật", "hint": "Bố cục bảng tin và sóng đối xứng", "category": "Album", "template": "cover-motion", "wave": "mirror", "motion": "medium", "lyrics": "off", "aspect": "4:5", "badge": "Mới"},
  {"id": "gentle-story", "label": "Câu chuyện dịu dàng", "hint": "Ảnh bìa dọc, chuyển động chậm", "category": "Social", "template": "cover-motion", "wave": "dots", "motion": "low", "lyrics": "off", "aspect": "9:16", "badge": "Mới"},
  {"id": "glass-square", "label": "Ô kính vuông", "hint": "Thẻ kính vuông với đường sóng", "category": "Social", "template": "glass-card", "wave": "line", "motion": "low", "lyrics": "off", "aspect": "1:1", "badge": "Mới"},
  {"id": "shorts-energy", "label": "Video ngắn sôi động", "hint": "Thẻ kính dọc và cột sóng mạnh", "category": "Social", "template": "glass-card", "wave": "bars", "motion": "high", "lyrics": "off", "aspect": "9:16", "badge": "Mới"},
  {"id": "lyrics-scroll", "label": "Lời nhạc cuộn", "hint": "Lời nhạc cuộn trên nền dọc", "category": "Lyrics", "template": "lyrics-focus", "wave": "line", "motion": "low", "lyrics": "scroll", "aspect": "9:16", "badge": "Mới"},
  {"id": "lyrics-square", "label": "Lời nhạc vuông", "hint": "Lời nổi bật với chấm nhạc nhẹ", "category": "Lyrics", "template": "lyrics-focus", "wave": "dots", "motion": "low", "lyrics": "focus", "aspect": "1:1", "badge": "Mới"},
  {"id": "lyrics-feed", "label": "Lời nhạc bảng tin", "hint": "Lời cuộn và sóng đối xứng", "category": "Lyrics", "template": "lyrics-focus", "wave": "mirror", "motion": "medium", "lyrics": "scroll", "aspect": "4:5", "badge": "Mới"},
  {"id": "wide-pulse", "label": "Nhịp đập toàn cảnh", "hint": "Ảnh bìa ngang với nhịp đập mạnh", "category": "Visualizer", "template": "cover-motion", "wave": "pulse", "motion": "high", "lyrics": "off", "aspect": "16:9", "badge": "Mới"},
  {"id": "mirror-square", "label": "Sóng gương vuông", "hint": "Thẻ kính và sóng đối xứng mạnh", "category": "Visualizer", "template": "glass-card", "wave": "mirror", "motion": "high", "lyrics": "off", "aspect": "1:1", "badge": "Mới"},
  {"id": "retro-spectrum", "label": "Phổ nhạc cổ điển", "hint": "Đĩa than với cột sóng khung 4:3", "category": "Visualizer", "template": "vinyl", "wave": "bars", "motion": "high", "lyrics": "off", "aspect": "4:3", "badge": "Mới"},
  {"id": "editorial-portrait", "label": "Tạp chí dọc", "hint": "Bố cục tạp chí, chữ lớn và ảnh bìa", "category": "Album", "template": "editorial", "wave": "line", "motion": "low", "lyrics": "off", "aspect": "9:16", "badge": "Cao cấp"},
  {"id": "editorial-wide", "label": "Tạp chí toàn cảnh", "hint": "Bố cục tạp chí, chữ lớn và ảnh bìa", "category": "Album", "template": "editorial", "wave": "dots", "motion": "low", "lyrics": "off", "aspect": "16:9", "badge": "Cao cấp"},
  {"id": "spotlight-portrait", "label": "Sân khấu dọc", "hint": "Bìa nổi, khung nghiêng và hào quang", "category": "Album", "template": "spotlight", "wave": "mirror", "motion": "medium", "lyrics": "off", "aspect": "9:16", "badge": "Cao cấp"},
  {"id": "spotlight-square", "label": "Sân khấu vuông", "hint": "Bìa nổi, khung nghiêng và hào quang", "category": "Album", "template": "spotlight", "wave": "pulse", "motion": "high", "lyrics": "off", "aspect": "1:1", "badge": "Cao cấp"},
  {"id": "gold-portrait", "label": "Đĩa vàng dọc", "hint": "Đĩa vàng xoay trên nền than trầm", "category": "Album", "template": "gold-record", "wave": "line", "motion": "low", "lyrics": "off", "aspect": "9:16", "badge": "Cao cấp"},
  {"id": "gold-wide", "label": "Đĩa vàng toàn cảnh", "hint": "Đĩa vàng xoay trên nền than trầm", "category": "Album", "template": "gold-record", "wave": "dots", "motion": "low", "lyrics": "off", "aspect": "16:9", "badge": "Cao cấp"},
];

export const MOTION_LEVELS:{id:MotionIntensity;label:string}[] = [
  {id:'low',label:'Nhẹ'},{id:'medium',label:'Vừa'},{id:'high',label:'Mạnh'}
];

export const LYRIC_MODES:{id:LyricsMode;label:string}[] = [
  {id:'off',label:'Tắt'},{id:'scroll',label:'Cuộn'},{id:'focus',label:'Nổi bật'}
];
