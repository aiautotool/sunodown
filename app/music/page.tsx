import type { Metadata } from 'next';
import { MusicHub } from '@/components/music-hub';

const title = 'SunoDown Music - Nghe nhạc Suno, playlist & Top 20';
const description =
  'Nghe nhạc Suno online trên SunoDown Music. Shuffle thư viện, tạo playlist, lưu bài yêu thích, xem Top 20 và đồng bộ lịch sử nghe theo tài khoản.';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'SunoDown Music',
    'nghe nhạc Suno',
    'Suno music player',
    'Suno playlist',
    'Suno Top 20',
    'Suno songs',
    'Suno lyrics',
    'AI music player',
    'nghe nhạc AI',
    'music player online',
    'playlist nhạc Suno',
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
    '@type': 'WebApplication',
    name: 'SunoDown Music',
    url: 'https://picai.online/music',
    description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
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
          __html: JSON.stringify(structuredData).replace(/</g, '\u003c'),
        }}
      />
      <MusicHub />
    </main>
  );
}
