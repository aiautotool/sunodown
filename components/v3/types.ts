export type Song = { id:string|null; title:string; picture:string|null; audio:string; sourceAudio:string; video:string|null; description:string|null; lyrics:string|null; style:string|null; tags:string|null; duration:number|null; creator:string|null };
export type VideoAspect = '16:9'|'9:16'|'1:1'|'4:5'|'4:3';
export type WaveStyle = 'bars'|'mirror'|'line'|'dots'|'pulse';
export type VisualTemplate = 'cover-motion'|'vinyl'|'glass-card';

export const VIDEO_SIZES: Record<VideoAspect,{width:number;height:number}> = {
  '16:9':{width:1280,height:720},
  '9:16':{width:720,height:1280},
  '1:1':{width:1080,height:1080},
  '4:5':{width:864,height:1080},
  '4:3':{width:960,height:720},
};

export const WAVE_STYLES:{id:WaveStyle;label:string}[] = [
  {id:'bars',label:'Bars'},
  {id:'mirror',label:'Mirror'},
  {id:'line',label:'Line'},
  {id:'dots',label:'Dots'},
  {id:'pulse',label:'Pulse'},
];

export const VISUAL_TEMPLATES:{id:VisualTemplate;label:string;hint:string}[] = [
  {id:'cover-motion',label:'Cover Motion',hint:'Zoom + pan nhẹ theo nhạc'},
  {id:'vinyl',label:'Vinyl',hint:'Đĩa xoay + cover trung tâm'},
  {id:'glass-card',label:'Glass Card',hint:'Card kính + nền chuyển động'},
];
