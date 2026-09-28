export type MobilePreset = {
  id: string;
  name: string;
  description: string;
  aspect: '9:16' | '16:9' | '1:1';
  styleHint: string;
  accent: string;
};

export const MOBILE_PRESETS: MobilePreset[] = [
  {
    id: 'social-hook',
    name: 'Viral Hook',
    description: 'Dọc, nhịp mạnh, tối ưu social.',
    aspect: '9:16',
    styleHint: 'high-energy cinematic social music video, punchy pacing, vivid neon accents',
    accent: '#8b5cf6',
  },
  {
    id: 'sad-lyrics',
    name: 'Sad Lyrics Cinema',
    description: 'Ballad cảm xúc, tối và điện ảnh.',
    aspect: '9:16',
    styleHint: 'melancholic cinematic live-action realism, rain reflections, intimate closeups',
    accent: '#6366f1',
  },
  {
    id: 'cinematic-story',
    name: 'Cinema Story',
    description: 'Kể chuyện widescreen, chuyển động nhẹ.',
    aspect: '16:9',
    styleHint: 'cinematic narrative, natural lighting, coherent characters, restrained camera movement',
    accent: '#f59e0b',
  },
];
