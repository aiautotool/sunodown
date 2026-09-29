import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Music2 } from 'lucide-react';
import { PublicMusicPlayer } from '@/components/public-music-player';
import {
  getPublicSong,
  songDescription,
  songSeoKeywords,
} from '@/app/lib/public-song';

export const revalidate = 900;

type PageProps = {
  params: Promise<{ id: string }>;
};

function isoDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return `PT${Math.round(seconds)}S`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const song = await getPublicSong(id);

  if (!song || !song.isPublic) {
    return {
      title: 'Bài hát không khả dụng | SunoDown Music',
      robots: {
        index: false,
        follow: false,
        nocache: true,
      },
    };
  }

  const description = songDescription(song);
  const title = `${song.title} - ${song.creator} | SunoDown Music`;
  const canonical = `/music/${song.id}`;

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
      type: 'music.song',
      locale: 'vi_VN',
      images: song.picture
        ? [
            {
              url: song.picture,
              alt: `Ảnh bìa ${song.title} - ${song.creator}`,
            },
          ]
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

export default async function MusicSongPage({ params }: PageProps) {
  const { id } = await params;
  const song = await getPublicSong(id);
  if (!song || !song.isPublic) notFound();

  const description = songDescription(song);
  const audioProxy = song.audioUrl
    ? `/api/audio?source=${encodeURIComponent(song.audioUrl)}`
    : null;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': `https://picai.online/music/${song.id}#recording`,
    name: song.title,
    url: `https://picai.online/music/${song.id}`,
    description,
    image: song.picture || undefined,
    duration: isoDuration(song.duration),
    datePublished: song.createdAt || undefined,
    byArtist: {
      '@type': 'Person',
      name: song.creator,
    },
    genre: song.tags || song.style || undefined,
    audio: song.audioUrl
      ? {
          '@type': 'AudioObject',
          contentUrl: song.audioUrl,
          encodingFormat: 'audio/mpeg',
          duration: isoDuration(song.duration),
        }
      : undefined,
    isPartOf: {
      '@type': 'WebSite',
      name: 'SunoDown',
      url: 'https://picai.online/',
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
          <a href="/tai-suno-mp3">Tải MP3</a>
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
        <h2>Nghe {song.title} trên SunoDown Music</h2>
        <p>{description}</p>
        {song.tags && (
          <div className="sd-public-tags" aria-label="Phong cách bài hát">
            {song.tags
              .split(/[,;/|]+/)
              .map((tag) => tag.trim())
              .filter(Boolean)
              .slice(0, 12)
              .map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
        <div className="sd-public-related">
          <a href="/tai-suno-mp3">Tải nhạc Suno MP3</a>
          <a href="/tai-suno-wav">Tải Suno WAV</a>
          <a href="/tai-video-suno">Tạo lyric video & music visualizer</a>
        </div>
      </section>
    </main>
  );
}
