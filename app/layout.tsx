import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { PasteLinkEnhancer } from '@/components/paste-link-enhancer';
import './globals.css';

const font = Be_Vietnam_Pro({ variable: '--font-app', subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'] });

const title = 'Tải nhạc Suno miễn phí - MP3, WAV, M4A, Video | Suno Grab';
const description = 'Tải nhạc Suno miễn phí từ liên kết Suno. Hỗ trợ tải MP3, WAV, M4A, video gốc và tạo video sóng nhạc ngay trên trình duyệt, không cần cài ứng dụng.';

export const metadata: Metadata = {
  metadataBase: new URL('https://suno.aiautotool.com'),
  title,
  description,
  keywords: ['tải nhạc Suno', 'tải Suno MP3', 'download Suno', 'Suno downloader', 'tải video Suno', 'tải WAV Suno', 'Suno AI download'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: { title, description, url: '/', siteName: 'Suno Grab', images: ['/og.png'], locale: 'vi_VN', type: 'website' },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={`${font.variable} antialiased`}><PasteLinkEnhancer />{children}</body></html>;
}
