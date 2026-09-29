import type { Metadata } from 'next';
import { Music2, Play, Search, Sparkles } from 'lucide-react';

const title = 'SunoDown Music - Nghe nhạc Suno, lyrics & music player';
const description =
  'Nghe nhạc Suno online trên SunoDown Music, mở player theo từng bài, xem lyrics, chia sẻ bài hát và chuyển thẳng sang Creator Studio để tạo lyric video.';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'SunoDown Music',
    'nghe nhạc Suno',
    'Suno music player',
    'Suno player',
    'Suno lyrics',
    'nghe nhạc AI',
    'AI music player',
    'Suno playlist',
    'Suno songs',
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
    <main className="sd-music-landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />

      <header className="sd-public-music-head">
        <a href="/" className="sd-public-brand">
          <span><Music2 /></span>
          <b>SunoDown</b>
        </a>
        <nav>
          <a href="/">Trang chủ</a>
          <a href="/music" aria-current="page">Music</a>
          <a href="/tai-suno-mp3">Tải MP3</a>
          <a href="/tai-video-suno">Tạo video</a>
        </nav>
      </header>

      <section className="sd-music-landing-hero">
        <span><Sparkles /> SUNODOWN MUSIC</span>
        <h1>Nghe nhạc Suno theo từng bài với một URL riêng.</h1>
        <p>
          Mỗi bài public có trang <b>/music/UUID</b> riêng để phát nhạc,
          xem lời, chia sẻ và mở lại trong Creator Studio.
        </p>
        <div>
          <a className="primary" href="/"><Search /> Mở bài từ link Suno</a>
          <a href="/tai-video-suno"><Play /> Tạo lyric video</a>
        </div>
      </section>
    </main>
  );
}
