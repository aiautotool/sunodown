'use client';

import {
  ArrowRight,
  Headphones,
  Music2,
  Pause,
  Play,
  Search,
  Shuffle,
  SkipForward,
  UserRound,
} from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import type {
  DirectorySong,
  PublicMusicDirectorySnapshot,
} from '@/app/lib/music-directory';

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

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

export function PublicMusicHome({
  directory,
}: {
  directory: PublicMusicDirectorySnapshot;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [handle, setHandle] = useState('');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<DirectorySong | null>(null);
  const [queue, setQueue] = useState<DirectorySong[]>(directory.latestSongs);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const filteredCreators = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory.creators;
    return directory.creators.filter((creator) =>
      `${creator.displayName} ${creator.handle}`.toLowerCase().includes(q),
    );
  }, [directory.creators, query]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory.latestSongs;
    return directory.latestSongs.filter((song) =>
      `${song.title} ${song.creator || ''} ${song.handle} ${song.tags || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [directory.latestSongs, query]);

  const openProfile = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalize(handle);
    if (!normalized) return;
    window.location.href = `/music/@${encodeURIComponent(normalized)}`;
  };

  const playSong = (song: DirectorySong, source = filteredSongs) => {
    const list = source.length ? source : directory.latestSongs;
    const index = Math.max(0, list.findIndex((item) => item.id === song.id));
    setQueue(list);
    setQueueIndex(index);
    setCurrent(song);

    window.setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = `/api/music/audio?id=${encodeURIComponent(song.id)}`;
      audio.load();
      void audio.play().catch(() => {});
    }, 0);
  };

  const playNext = () => {
    if (!queue.length) return;
    const nextIndex = queueIndex + 1 >= queue.length ? 0 : queueIndex + 1;
    const song = queue[nextIndex];
    if (!song) return;
    setQueueIndex(nextIndex);
    setCurrent(song);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = `/api/music/audio?id=${encodeURIComponent(song.id)}`;
    audio.load();
    void audio.play().catch(() => {});
  };

  const shuffleAll = () => {
    if (!directory.latestSongs.length) return;
    const list = shuffle(directory.latestSongs);
    setQueue(list);
    setQueueIndex(0);
    setCurrent(list[0]);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = `/api/music/audio?id=${encodeURIComponent(list[0].id)}`;
    audio.load();
    void audio.play().catch(() => {});
  };

  return (
    <div className={`sd-public-music-home ${current ? 'has-player' : ''}`}>
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={playNext}
      />

      <section className="hero">
        <span><Headphones /> SUNODOWN MUSIC</span>
        <h1>Nhạc public từ cộng đồng SunoDown.</h1>
        <p>
          Hiện có <b>{directory.creatorCount} creator</b> và{' '}
          <b>{directory.songCount} bài public</b> đã được publish từ các tài
          khoản đang sử dụng SunoDown.
        </p>

        <div className="directory-actions">
          <button onClick={shuffleAll} disabled={!directory.latestSongs.length}>
            <Shuffle /> Random play
          </button>
          <a href="/music/me"><UserRound /> Music của tôi</a>
        </div>

        <label className="directory-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm creator, tên bài hoặc style..."
          />
        </label>

        <form onSubmit={openProfile} className="profile-jump">
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="Mở nhanh @username Suno"
            aria-label="Username Suno"
          />
          <button type="submit">
            Mở <ArrowRight />
          </button>
        </form>
      </section>

      {directory.creatorCount === 0 ? (
        <section className="directory-empty">
          <Music2 />
          <h2>Chưa có creator nào được publish</h2>
          <p>
            Khi user đăng nhập và sync một profile Suno public, creator và các
            bài public sẽ tự xuất hiện tại đây.
          </p>
          <a href="/library">Sync thư viện đầu tiên</a>
        </section>
      ) : (
        <>
          <section className="directory-section">
            <header>
              <div>
                <small>CREATORS</small>
                <h2>{filteredCreators.length} creator</h2>
              </div>
            </header>
            <div className="creator-grid">
              {filteredCreators.map((creator) => (
                <a
                  key={creator.handle}
                  href={`/music/@${encodeURIComponent(creator.handle)}`}
                  className="creator-card"
                >
                  <span>
                    {creator.avatarUrl ? (
                      <img src={creator.avatarUrl} alt="" />
                    ) : (
                      <UserRound />
                    )}
                  </span>
                  <div>
                    <b>{creator.displayName}</b>
                    <small>@{creator.handle}</small>
                    <em>{creator.songCount} bài public</em>
                  </div>
                  <ArrowRight />
                </a>
              ))}
            </div>
          </section>

          <section className="directory-section">
            <header>
              <div>
                <small>LATEST MUSIC</small>
                <h2>{filteredSongs.length} bài mới</h2>
              </div>
            </header>

            <div className="directory-song-grid">
              {filteredSongs.map((song) => (
                <article key={`${song.handle}-${song.id}`}>
                  <button
                    className="art"
                    onClick={() => playSong(song)}
                    aria-label={`Phát ${song.title}`}
                  >
                    {song.picture ? (
                      <img src={song.picture} alt="" />
                    ) : (
                      <Music2 />
                    )}
                    <i><Play /></i>
                  </button>
                  <div>
                    <a
                      href={`/music/@${encodeURIComponent(song.handle)}/${song.id}`}
                    >
                      {song.title}
                    </a>
                    <a
                      className="creator"
                      href={`/music/@${encodeURIComponent(song.handle)}`}
                    >
                      @{song.handle}
                    </a>
                    <small>
                      {song.tags || song.creator || 'Suno'}
                      {song.duration ? ` · ${fmt(song.duration)}` : ''}
                    </small>
                  </div>
                  <button
                    className="row-play"
                    onClick={() => playSong(song)}
                    aria-label={`Phát ${song.title}`}
                  >
                    <Play />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {current && (
        <div className="sd-directory-player">
          <button
            className="track"
            onClick={() =>
              (window.location.href = `/music/@${encodeURIComponent(
                current.handle,
              )}/${current.id}`)
            }
          >
            {current.picture ? <img src={current.picture} alt="" /> : <Music2 />}
            <span>
              <b>{current.title}</b>
              <small>@{current.handle}</small>
            </span>
          </button>

          <button
            className="play"
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              if (audio.paused) void audio.play().catch(() => {});
              else audio.pause();
            }}
            aria-label={playing ? 'Tạm dừng' : 'Phát'}
          >
            {playing ? <Pause /> : <Play />}
          </button>

          <button onClick={playNext} aria-label="Bài tiếp">
            <SkipForward />
          </button>
        </div>
      )}
    </div>
  );
}
