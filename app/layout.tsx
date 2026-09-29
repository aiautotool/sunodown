import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { PasteLinkEnhancer } from '@/components/paste-link-enhancer';
import { PwaInstaller } from '@/components/pwa-installer';
import './globals.css';

const font = Be_Vietnam_Pro({
  variable: '--font-app',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
});

const siteUrl = 'https://picai.online';
const title = 'SunoDown - Tải nhạc Suno, tạo lyric video & music visualizer';
const description =
  'SunoDown giúp tải nhạc Suno MP3, WAV, M4A, tạo lyric video, waveform visualizer, đồng bộ subtitle karaoke và quản lý nội dung âm nhạc ngay trên web.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'SunoDown',
  title,
  description,
  keywords: [
    'SunoDown',
    'tải nhạc Suno',
    'tải Suno MP3',
    'tải Suno WAV',
    'Suno downloader',
    'lyric video maker',
    'music visualizer',
    'karaoke subtitle',
    'waveform video',
  ],
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'SunoDown',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title,
    description,
    url: '/',
    siteName: 'SunoDown',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'SunoDown - Suno music creator studio',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og.png'],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: 'SunoDown',
      description,
      inLanguage: 'vi-VN',
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#webapp`,
      name: 'SunoDown',
      url: `${siteUrl}/`,
      description,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      inLanguage: 'vi-VN',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'VND',
      },
      featureList: [
        'Download Suno audio',
        'Create lyric videos',
        'Create music visualizers',
        'Synchronize karaoke subtitles',
        'Audio mastering and export',
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Birthstone&family=Ephesis&family=Great+Vibes&family=Italianno&family=Lavishly+Yours&family=Mea+Culpa&family=Pinyon+Script&display=swap"
        />
      </head>
      <body className={`${font.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
        <PasteLinkEnhancer />
        <PwaInstaller />
        {children}
      </body>
    </html>
  );
}
