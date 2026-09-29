import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Music2 } from 'lucide-react';
import { PublicArtistMusic } from '@/components/public-artist-music';
import { PublicMusicPlayer } from '@/components/public-music-player';
import { MobileAppNav } from '@/components/mobile-app-nav';
import {
  getPublicSong,
  PUBLIC_SONG_UUID_RE,
  songDescription,
  songSeoKeywords,
} from '@/app/lib/public-song';
import {
  getPublicMusicProfile,
  profileSeoKeywords,
} from '@/app/lib/public-music-profile';

export const revalidate = 900;

type PageProps = {
  params: Promise<{ id: string }>;
};

function isoDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return `PT${Math.round(seconds)}S`;
}

function normalizeSegment(value: string) {
  return decodeURIComponent(value || '');
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id: raw } = await params;
  const segment = normalizeSegment(raw);

  if (segment.startsWith('@')) {
    const profile = await getPublicMusicProfile(segment);
    if (!profile) {
      return {
        title: 'Creator không tồn tại | SunoDown Music',
        robots: { index: false, follow: false },
      };
    }

    const canonical = `/music/@${profile.handle}`;
    const title = `${profile.displayName} (@${profile.handle}) - Nhạc Suno | SunoDown Music`;
    const description = `Nghe ${profile.total} bài nhạc public của ${profile.displayName} (@${profile.handle}) trên SunoDown Music. Mỗi bài có player, cover và URL riêng để chia sẻ.`;

    return {
      title,
      description,
      keywords: profileSeoKeywords(profile),
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
        type: 'profile',
        images: profile.avatarUrl
          ? [{ url: profile.avatarUrl, alt: profile.displayName }]
          : ['/og.png'],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: profile.avatarUrl ? [profile.avatarUrl] : ['/og.png'],
      },
    };
  }

  if (!PUBLIC_SONG_UUID_RE.test(segment)) {
    return {
      title: 'Music | SunoDown',
      robots: { index: false, follow: false },
    };
  }

  const song = await getPublicSong(segment);
  if (!song || !song.isPublic) {
    return {
      title: 'Bài hát không khả dụng | SunoDown Music',
      robots: { index: false, follow: false, nocache: true },
    };
  }

  const description = songDescription(song);
  const title = `${song.title} - ${song.creator} | SunoDown Music`;
  const canonical = song.handle
    ? `/music/@${song.handle}/${song.id}`
    : `/music/${song.id}`;

  return {
    title,
    description,
    keywords: songSeoKeywords(song),
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'SunoDown',
      type: 'music.song',
      locale: 'vi_VN',
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

export default async function PublicMusicRoute({ params }: PageProps) {
  const { id: raw } = await params;
  const segment = normalizeSegment(raw);

  if (segment.startsWith('@')) {
    const profile = await getPublicMusicProfile(segment);
    if (!profile) notFound();

    const canonical = `https://picai.online/music/@${profile.handle}`;
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: `${profile.displayName} (@${profile.handle})`,
      url: canonical,
      mainEntity: {
        '@type': 'Person',
        name: profile.displayName,
        identifier: `@${profile.handle}`,
        image: profile.avatarUrl || undefined,
        description: profile.bio || undefined,
        url: canonical,
      },
      hasPart: profile.songs.slice(0, 50).map((song) => ({
        '@type': 'MusicRecording',
        name: song.title,
        url: `https://picai.online/music/@${profile.handle}/${song.id}`,
        image: song.picture || undefined,
        duration: isoDuration(song.duration),
        datePublished: song.createdAt || undefined,
        genre: song.tags || undefined,
      })),
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
          <Link href="/" className="sd-public-brand" aria-label="SunoDown">
            <span><Music2 /></span>
            <b>SunoDown</b>
          </a>
          <nav aria-label="Điều hướng">
            <Link href="/">Trang chủ</Link>
            <Link href="/music">Music</Link>
            <Link href="/music/me">Music của tôi</Link>
            <Link href="/tai-video-suno">Tạo video</Link>
          </nav>
        </header>

        <PublicArtistMusic profile={profile} />
        <MobileAppNav />
      </main>
    );
  }

  if (!PUBLIC_SONG_UUID_RE.test(segment)) notFound();

  const song = await getPublicSong(segment);
  if (!song || !song.isPublic) notFound();

  if (song.handle) {
    permanentRedirect(`/music/@${song.handle}/${song.id}`);
  }

  const description = songDescription(song);
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
    byArtist: { '@type': 'Person', name: song.creator },
    genre: song.tags || song.style || undefined,
  };

  return (
    <main className="sd-public-music-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <PublicMusicPlayer
        id={song.id}
        title={song.title}
        creator={song.creator}
        handle={song.handle || canonicalHandle}
        picture={song.picture}
        duration={song.duration}
        lyrics={song.lyrics}
        style={song.style || song.tags}
      />
      <MobileAppNav />
    </main>
  );
}
