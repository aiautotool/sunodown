'use client';

import {
  ArrowRight,
  Flame,
  Headphones,
  Music2,
  Play,
  Search,
  Share2,
  Shuffle,
  Sparkles,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import type {
  DirectorySong,
  PublicMusicDirectorySnapshot,
} from '@/app/lib/music-directory';
import { useGlobalMusic, type GlobalMusicSong } from '@/components/music-global-player';

function normalize(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(
      raw.startsWith('http')
        ? raw
        : `https://suno.com/${raw.replace(/^@/, '')}`,
    );
    return decodeURIComponent(
      url.pathname.split('/').filter(Boolean)[0] || '',
    ).replace(/^@/, '');
  } catch {
    return raw.replace(/^@/, '');
  }
}

function fmt(seconds?: number | null) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

const toGlobal = (song: DirectorySong): GlobalMusicSong => ({
  id: song.id,
  title: song.title,
  creator: song.creator,
  handle: song.handle,
  picture: song.picture,
  duration: song.duration,
  tags: song.tags,
});

export function PublicMusicHome({
  directory,
}: {
  directory: PublicMusicDirectorySnapshot;
}) {
  const music = useGlobalMusic();
  const [query, setQuery] = useState('');
  const [handle, setHandle] = useState('');
  const [style, setStyle] = useState<string | null>(null);
  const [sharedSongId, setSharedSongId] = useState<string | null>(null);

  const allSongs = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...directory.trendingSongs,
      ...directory.latestSongs,
      ...directory.topSongs,
    ].filter((song) => {
      if (seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    });
  }, [directory.latestSongs, directory.topSongs, directory.trendingSongs]);

  const styles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const song of allSongs) {
      for (const raw of (song.tags || '').split(/[,;/|]+/)) {
        const tag = raw.trim();
        if (!tag || tag.length > 32) continue;
        const key = tag.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);
  }, [allSongs]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSongs.filter((song) => {
      const matchesQuery =
        !q ||
        `${song.title} ${song.creator || ''} ${song.handle} ${song.tags || ''}`
          .toLowerCase()
          .includes(q);
      const matchesStyle =
        !style || (song.tags || '').toLowerCase().includes(style);
      return matchesQuery && matchesStyle;
    });
  }, [allSongs, query, style]);

  const filteredCreators = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory.creators;
    return directory.creators.filter((creator) =>
      `${creator.displayName} ${creator.handle}`
        .toLowerCase()
        .includes(q),
    );
  }, [directory.creators, query]);

  const openProfile = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalize(handle);
    if (!normalized) return;
    window.location.href = `/music/@${encodeURIComponent(normalized)}`;
  };

  const featured =
    (style || query ? filteredSongs[0] : directory.featuredSong) ||
    directory.latestSongs[0] ||
    null;

  const play = (song: DirectorySong, source: DirectorySong[]) =>
    music.playSong(
      toGlobal(song),
      source.map(toGlobal),
    );

  const shareSong = async (song: DirectorySong) => {
    const path = `/music/@${encodeURIComponent(song.handle)}/${song.id}`;
    const shareUrl =
      typeof window !== 'undefined'
        ? new URL(path, window.location.origin).toString()
        : `https://picai.online${path}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: song.title,
          text: `${song.title} · ${song.creator || '@' + song.handle}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setSharedSongId(song.id);
        window.setTimeout(() => setSharedSongId(null), 1600);
      }
    } catch {}
  };

  const SongCard = ({ song, source }: { song: DirectorySong; source: DirectorySong[] }) => (
    <article className="sd-discover-card">
      <button className="art" onClick={() => play(song, source)} aria-label={`Phát ${song.title}`}>
        {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
        <span><Play /></span>
      </button>
      <Link href={`/music/@${encodeURIComponent(song.handle)}/${song.id}`}>
        <b>{song.title}</b>
      </Link>
      <div className="sd-discover-card-meta">
        <Link className="creator" href={`/music/@${encodeURIComponent(song.handle)}`}>
          @{song.handle}
        </Link>
        <button
          type="button"
          className="share"
          onClick={() => void shareSong(song)}
          aria-label={`Chia sẻ ${song.title}`}
        >
          <Share2 />
          <span>{sharedSongId === song.id ? 'Đã copy' : 'Share'}</span>
        </button>
      </div>
    </article>
  );

  return (
    <div className="sd-discover">
      <header className="sd-discover-topbar">
        <Link className="brand" href="/">
          <span><Music2 /></span>
          <b>SunoDown</b>
          <em>Music</em>
        </Link>

        <label className="search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm bài hát, creator, style..."
          />
        </label>

        <nav>
          <Link href="/music" className="active">Khám phá</Link>
          <Link href="/music/me">Music của tôi</Link>
        </nav>
      </header>

      <main className="sd-discover-body">
        {featured ? (
          <section className="sd-discover-hero">
            <div className="hero-copy">
              <span><Sparkles /> FEATURED</span>
              <h1>{featured.title}</h1>
              <Link href={`/music/@${encodeURIComponent(featured.handle)}`}>
                @{featured.handle}
              </Link>
              <p>{featured.tags || 'Khám phá một bài hát mới từ cộng đồng SunoDown.'}</p>
              <div>
                <button
                  className="primary"
                  onClick={() =>
                    play(
                      featured,
                      directory.trendingSongs.length
                        ? directory.trendingSongs
                        : directory.latestSongs,
                    )
                  }
                >
                  <Play /> Nghe ngay
                </button>
                <button
                  onClick={() =>
                    music.shuffleQueue(directory.latestSongs.map(toGlobal))
                  }
                >
                  <Shuffle /> Random
                </button>
                <Link href={`/music/@${encodeURIComponent(featured.handle)}/${featured.id}`}>
                  Chi tiết <ArrowRight />
                </Link>
                <button onClick={() => void shareSong(featured)}>
                  <Share2 /> {sharedSongId === featured.id ? 'Đã copy' : 'Share'}
                </button>
              </div>
            </div>

            <button
              className="hero-art"
              onClick={() =>
                play(
                  featured,
                  directory.trendingSongs.length
                    ? directory.trendingSongs
                    : directory.latestSongs,
                )
              }
              aria-label={`Phát ${featured.title}`}
            >
              {featured.picture ? <img src={featured.picture} alt="" /> : <Music2 />}
              <i><Play /></i>
            </button>
          </section>
        ) : (
          <section className="sd-discover-empty">
            <Music2 />
            <h1>Music đang chờ bài hát đầu tiên.</h1>
            <p>Khi một creator được sync vào SunoDown, nhạc public sẽ xuất hiện ở đây.</p>
            <Link href="/library">Sync thư viện</Link>
          </section>
        )}

        <section className="sd-discover-summary">
          <span><b>{directory.creatorCount}</b> creator</span>
          <span><b>{directory.songCount}</b> bài public</span>
          <form onSubmit={openProfile}>
            <input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="Mở @username"
            />
            <button type="submit"><ArrowRight /></button>
          </form>
        </section>

        {styles.length > 0 && (
          <section className="sd-discover-styles">
            <button className={!style ? 'active' : ''} onClick={() => setStyle(null)}>
              Tất cả
            </button>
            {styles.map((item) => (
              <button
                key={item}
                className={style === item ? 'active' : ''}
                onClick={() => setStyle(style === item ? null : item)}
              >
                {item}
              </button>
            ))}
          </section>
        )}

        {(query || style) && (
          <section className="sd-discover-section">
            <header>
              <div>
                <small>SEARCH & FILTER</small>
                <h2>{filteredSongs.length} bài phù hợp</h2>
              </div>
            </header>
            <div className="sd-discover-card-row">
              {filteredSongs.slice(0, 20).map((song) => (
                <SongCard key={song.id} song={song} source={filteredSongs} />
              ))}
            </div>
          </section>
        )}

        {!query && !style && directory.trendingSongs.length > 0 && (
          <section className="sd-discover-section">
            <header>
              <div>
                <small><Flame /> TRENDING</small>
                <h2>Đang được nghe nhiều</h2>
              </div>
              <span>7 ngày gần đây</span>
            </header>
            <div className="sd-discover-card-row">
              {directory.trendingSongs.slice(0, 10).map((song) => (
                <SongCard key={song.id} song={song} source={directory.trendingSongs} />
              ))}
            </div>
          </section>
        )}

        {!query && !style && directory.topSongs.length > 0 && (
          <section className="sd-discover-section sd-chart-section">
            <header>
              <div>
                <small><TrendingUp /> CHART</small>
                <h2>Top 20 cộng đồng</h2>
              </div>
              <span>Xếp theo lượt nghe hợp lệ</span>
            </header>
            <div className="sd-chart">
              {directory.topSongs.slice(0, 20).map((song, index) => (
                <article key={song.id}>
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  <button className="art" onClick={() => play(song, directory.topSongs)}>
                    {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
                    <i><Play /></i>
                  </button>
                  <div>
                    <Link href={`/music/@${encodeURIComponent(song.handle)}/${song.id}`}>
                      {song.title}
                    </Link>
                    <Link href={`/music/@${encodeURIComponent(song.handle)}`}>
                      @{song.handle}
                    </Link>
                  </div>
                  <span>{song.playCount || 0} lượt nghe</span>
                  <div className="sd-chart-actions">
                    <button
                      className="share"
                      onClick={() => void shareSong(song)}
                      aria-label={`Chia sẻ ${song.title}`}
                    >
                      <Share2 />
                    </button>
                    <button className="play" onClick={() => play(song, directory.topSongs)}>
                      <Play />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!query && !style && directory.latestSongs.length > 0 && (
          <section className="sd-discover-section">
            <header>
              <div>
                <small>NEW RELEASES</small>
                <h2>Bài mới</h2>
              </div>
            </header>
            <div className="sd-discover-card-row">
              {directory.latestSongs.slice(0, 12).map((song) => (
                <SongCard key={song.id} song={song} source={directory.latestSongs} />
              ))}
            </div>
          </section>
        )}

        <section className="sd-discover-section">
          <header>
            <div>
              <small>CREATORS</small>
              <h2>Creator mới cập nhật</h2>
            </div>
          </header>
          {filteredCreators.length ? (
            <div className="sd-creator-strip">
              {filteredCreators.slice(0, 16).map((creator) => (
                <Link
                  key={creator.handle}
                  href={`/music/@${encodeURIComponent(creator.handle)}`}
                >
                  <span>
                    {creator.avatarUrl ? (
                      <img src={creator.avatarUrl} alt="" />
                    ) : (
                      <UserRound />
                    )}
                  </span>
                  <b>{creator.displayName}</b>
                  <small>@{creator.handle}</small>
                  <em>{creator.songCount} bài</em>
                </Link>
              ))}
            </div>
          ) : (
            <p className="sd-discover-muted">Chưa có creator phù hợp.</p>
          )}
        </section>

        <footer className="sd-discover-footer">
          <Headphones />
          <span>
            SunoDown Music · dữ liệu hiển thị từ creator và bài hát public thật.
          </span>
        </footer>
      </main>
    </div>
  );
}
