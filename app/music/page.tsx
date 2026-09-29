import type { Metadata } from 'next';
import { PublicMusicHome } from '@/components/public-music-home';
import { MobileAppNav } from '@/components/mobile-app-nav';

const title = 'SunoDown Music - Nghe nhạc Suno theo @username';
const description =
  'Mở kho nhạc public của creator Suno theo @username, nghe từng bài với URL riêng, lyrics, cover và trang tối ưu SEO trên SunoDown Music.';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'SunoDown Music',
    'nghe nhạc Suno',
    'Suno username',
    'Suno creator music',
    'Suno music player',
    'Suno songs',
    'Suno lyrics',
    'nhạc AI',
    'AI music',
    'music player online',
  ],
  alternates: { canonical: '/music' },
  openGraph: {
    title,
    description,
    url: '/music',
    siteName: 'SunoDown',
    images: ['/og.png'],
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

export default function MusicPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'SunoDown Music',
    url: 'https://picai.online/music',
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: 'SunoDown',
      url: 'https://picai.online/',
    },
  };

  return (
    <main className="sd-music-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <PublicMusicHome />
      <MobileAppNav />
    </main>
  );
}
