import type { Metadata } from 'next';
import { PublicMusicHome } from '@/components/public-music-home';
import { MobileAppNav } from '@/components/mobile-app-nav';
import { getPublicMusicDirectory } from '@/app/lib/music-directory';

export const dynamic = 'force-dynamic';

const title = 'SunoDown Music - Nghe nhạc Suno từ creator thật';
const description =
  'Khám phá creator và bài hát Suno public đang được publish trên SunoDown Music. Mỗi creator có trang @username và mỗi bài hát có URL riêng để nghe, chia sẻ và tìm kiếm.';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'SunoDown Music',
    'nghe nhạc Suno',
    'Suno creator',
    'Suno music player',
    'Suno songs',
    'Suno lyrics',
    'nhạc AI',
    'AI music',
    'music player online',
    'Suno community',
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

export default async function MusicPage() {
  const directory = await getPublicMusicDirectory();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'SunoDown Music',
    url: 'https://picai.online/music',
    description,
    numberOfItems: directory.songCount,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: directory.latestSongs.length,
      itemListElement: directory.latestSongs.slice(0, 50).map((song, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://picai.online/music/@${song.handle}/${song.id}`,
        name: song.title,
      })),
    },
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
      <PublicMusicHome directory={directory} />
      <MobileAppNav />
    </main>
  );
}
