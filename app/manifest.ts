import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SunoDown',
    short_name: 'SunoDown',
    description:
      'Tải nhạc Suno, tạo lyric video, music visualizer và đồng bộ subtitle karaoke trên web.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#06070b',
    theme_color: '#7c5cff',
    icons: [
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
