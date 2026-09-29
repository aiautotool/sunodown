import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Music2 } from 'lucide-react';
import { PublicMusicPlayer } from '@/components/public-music-player';
import { MobileAppNav } from '@/components/mobile-app-nav';
import {
  getPublicSong,
  PUBLIC_SONG_UUID_RE,
  songDescription,
  songSeoKeywords,
} from '@/app/lib/public-song';

export const revalidate = 900;

type PageProps = {
  params: Promise<{ id: string; songId: string }>;
};

function isoDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return `PT${Math.round(seconds)}S`;
}

function normalizeHandle(value: string) {
  return decodeURIComponent(value || '').replace(/^@/, '');
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, songId } = await params;
  const handle = normalizeHandle(id);
  if (!PUBLIC_SONG_UUID_RE.test(songId)) {
    return {
      title: 'Bài hát không tồn tại | SunoDown Music',
      robots: { index: false, follow: false },
    };
  }

  const song = await getPublicSong(songId);
  if (!song || !song.isPublic) {
    return {
      title: 'Bài hát không khả dụng | SunoDown Music',
      robots: { index: false, follow: false, nocache: true },
    };
  }

  const canonicalHandle = song.handle || handle;
  const canonical = `/music/@${canonicalHandle}/${song.id}`;
  const title = `${song.title} - ${song.creator} | SunoDown Music`;
  const description = songDescription(song);

  return {
    title,
    description,
    keywords: songSeoKeywords(song),
    alternates: { canonical },
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
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'SunoDown',
      locale: 'vi_VN',
      type: 'music.song',
      images: song.picture
        ? [{ url: song.picture, alt: `Ảnh bìa ${song.title} - ${song.creator}` }]
        : ['/og.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: song.picture ? [song.picture] : ['/og.png'],
    },
  };
}

export default async function PublicSongByCreatorPage({ params }: PageProps) {
  const { id, songId } = await params;
  const requestedHandle = normalizeHandle(id);

  if (!PUBLIC_SONG_UUID_RE.test(songId)) notFound();

  const song = await getPublicSong(songId);
  if (!song || !song.isPublic) notFound();

  const canonicalHandle = song.handle || requestedHandle;
  if (song.handle && requestedHandle.toLowerCase() !== song.handle.toLowerCase()) {
    permanentRedirect(`/music/@${song.handle}/${song.id}`);
  }

  const canonicalUrl = `https://picai.online/music/@${canonicalHandle}/${song.id}`;
  const profileUrl = `/music/@${canonicalHandle}`;
  const description = songDescription(song);
  const audioProxy = `/api/music/audio?id=${encodeURIComponent(song.id)}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': `${canonicalUrl}#recording`,
    name: song.title,
    url: canonicalUrl,
    description,
    image: song.picture || undefined,
    duration: isoDuration(song.duration),
    datePublished: song.createdAt || undefined,
    byArtist: {
      '@type': 'Person',
      name: song.creator,
      identifier: canonicalHandle ? `@${canonicalHandle}` : undefined,
      url: canonicalHandle
        ? `https://picai.online/music/@${canonicalHandle}`
        : undefined,
    },
    genre: song.tags || song.style || undefined,
    audio: {
      '@type': 'AudioObject',
      contentUrl: `https://picai.online/api/music/audio?id=${encodeURIComponent(song.id)}`,
      duration: isoDuration(song.duration),
    },
    isPartOf: {
      '@type': 'CollectionPage',
      name: `${song.creator} - SunoDown Music`,
      url: `https://picai.online${profileUrl}`,
    },
  };

  return (
    <main className="sd-public-music-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />

      <header className="sd-public-music-head">
        <a href="/" className="sd-public-brand" aria-label="SunoDown">
          <span><Music2 /></span>
          <b>SunoDown</b>
        </a>
        <nav aria-label="Điều hướng">
          <a href="/">Trang chủ</a>
          <a href="/music">Music</a>
          <a href={profileUrl}>@{canonicalHandle}</a>
          <a href="/tai-video-suno">Tạo video</a>
        </nav>
      </header>

      <PublicMusicPlayer
        id={song.id}
        title={song.title}
        creator={song.creator}
        picture={song.picture}
        audioUrl={audioProxy}
        duration={song.duration}
        lyrics={song.lyrics}
        style={song.style || song.tags}
      />

      <section className="sd-public-song-seo">
        <h2>{song.title} · @{canonicalHandle}</h2>
        <p>{description}</p>
        <div className="sd-public-related">
          <a href={profileUrl}>Xem tất cả bài của @{canonicalHandle}</a>
          <a href="/tai-suno-mp3">Tải nhạc Suno MP3</a>
          <a href="/tai-video-suno">Tạo lyric video & music visualizer</a>
        </div>
      </section>

      <MobileAppNav />
    </main>
  );
}
