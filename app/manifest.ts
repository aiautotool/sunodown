import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SunoDown',
    short_name: 'SunoDown',
    description:
      'Nghe nhạc Suno, chỉnh Sound, tạo lyric video, music visualizer và đồng bộ subtitle karaoke.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#06070b',
    theme_color: '#06070b',
    orientation: 'any',
    categories: ['music', 'multimedia', 'entertainment'],
    icons: [
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Music',
        short_name: 'Music',
        description: 'Mở SunoDown Music',
        url: '/music?source=pwa-shortcut',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Tạo video',
        short_name: 'Create',
        description: 'Mở Creator Studio',
        url: '/create?source=pwa-shortcut',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Thư viện',
        short_name: 'Library',
        description: 'Mở thư viện SunoDown',
        url: '/library?source=pwa-shortcut',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    ],
  };
}
