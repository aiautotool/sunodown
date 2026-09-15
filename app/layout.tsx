import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { PasteLinkEnhancer } from '@/components/paste-link-enhancer';
import './globals.css';

const font = Be_Vietnam_Pro({ variable: '--font-app', subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://suno.aiautotool.com'),
  title: 'Suno Grab — Tải nhạc Suno',
  description: 'Dán liên kết Suno và tải file âm thanh về thiết bị nhanh chóng.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: { title: 'Suno Grab — Tải nhạc Suno', description: 'Dán liên kết Suno và tải file âm thanh về thiết bị nhanh chóng.', images: ['/og.png'], locale: 'vi_VN', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Suno Grab — Tải nhạc Suno', description: 'Dán liên kết Suno và tải file âm thanh về thiết bị nhanh chóng.', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={`${font.variable} antialiased`}><PasteLinkEnhancer />{children}</body></html>;
}
