'use client';

import {
  ExternalLink,
  Heart,
  ListMusic,
  Music2,
  Pause,
  Play,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type {
  PublicMusicProfile,
  PublicProfileSong,
} from '@/app/lib/public-music-profile';

const fmt = (seconds?: number | null) => {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

const mediaUrl = (song: PublicProfileSong) =>
  `/api/music/audio?id=${encodeURIComponent(song.id)}`;

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

export function PublicArtistMusic({
  profile,
}: {
  profile: PublicMusicProfile;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<PublicProfileSong[]>(profile.songs);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const current = queueIndex >= 0 ? queue[queueIndex] || null : null;

  const visibleSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profile.songs;
    return profile.songs.filter((song) =>
      `${song.title} ${song.creator} ${song.tags || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [profile.songs, query]);

  const playSong = (
    song: PublicProfileSong,
    source: PublicProfileSong[] = visibleSongs,
  ) => {
    const list = source.length ? source : profile.songs;
    const index = Math.max(0, list.findIndex((item) => item.id === song.id));
    setQueue(list);
    setQueueIndex(index);
    setTime(0);

    window.setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = mediaUrl(song);
      audio.load();
      void audio.play().catch(() => {});
    }, 0);
  };

  const next = () => {
    if (!queue.length) return;
    const nextIndex = queueIndex + 1 >= queue.length ? 0 : queueIndex + 1;
    const song = queue[nextIndex];
    if (!song) return;
    setQueueIndex(nextIndex);
    setTime(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = mediaUrl(song);
    audio.load();
    void audio.play().catch(() => {});
  };

  const previous = () => {
    if (!queue.length) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    const nextIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
    const song = queue[nextIndex];
    if (!song) return;
    setQueueIndex(nextIndex);
    setTime(0);
    if (!audio) return;
    audio.src = mediaUrl(song);
    audio.load();
    void audio.play().catch(() => {});
  };

  const shuffleAll = () => {
    if (!profile.songs.length) return;
    const list = shuffled(profile.songs);
    setQueue(list);
    setQueueIndex(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = mediaUrl(list[0]);
    audio.load();
    void audio.play().catch(() => {});
  };

  return (
    <div className={`sd-public-artist-app ${current ? 'has-player' : ''}`}>
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime || 0)}
        onEnded={next}
      />

      <section className="sd-public-artist-hero">
        <div className="artist-avatar">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} />
          ) : (
            <Music2 />
          )}
        </div>
        <div>
          <small>PUBLIC MUSIC PROFILE</small>
          <h1>{profile.displayName}</h1>
          <p>@{profile.handle}</p>
          {profile.bio && <em>{profile.bio}</em>}
          <div className="artist-actions">
            <button onClick={shuffleAll} disabled={!profile.songs.length}>
              <Shuffle /> Shuffle
            </button>
            <a
              href={`https://suno.com/@${encodeURIComponent(profile.handle)}`}
              target="_blank"
              rel="noopener"
            >
              Suno profile <ExternalLink />
            </a>
          </div>
        </div>
      </section>

      <section className="sd-public-artist-content">
        <header>
          <div>
            <small>MUSIC</small>
            <h2>{profile.total} bài public</h2>
          </div>
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm bài hát..."
            />
          </label>
        </header>

        <div className="sd-public-artist-list">
          {visibleSongs.map((song, index) => (
            <article key={song.id}>
              <button className="song-cover" onClick={() => playSong(song)}>
                {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
                <i><Play /></i>
              </button>
              <button className="song-title" onClick={() => playSong(song)}>
                <b>{song.title}</b>
                <small>
                  {song.tags || song.creator}
                  {song.duration ? ` · ${fmt(song.duration)}` : ''}
                </small>
              </button>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <a
                className="song-page"
                href={`/music/@${encodeURIComponent(profile.handle)}/${song.id}`}
              >
                Mở bài
              </a>
            </article>
          ))}
        </div>
      </section>

      {current && (
        <div className="sd-public-artist-player">
          <button className="track" onClick={() => playSong(current, queue)}>
            {current.picture ? <img src={current.picture} alt="" /> : <Music2 />}
            <span>
              <b>{current.title}</b>
              <small>{current.creator}</small>
            </span>
          </button>

          <div className="controls">
            <button onClick={previous} aria-label="Bài trước"><SkipBack /></button>
            <button
              className="primary"
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
            <button onClick={next} aria-label="Bài tiếp"><SkipForward /></button>
          </div>

          <label>
            <span>{fmt(time)}</span>
            <input
              type="range"
              min="0"
              max={Math.max(1, duration || current.duration || 1)}
              step=".1"
              value={Math.min(time, Math.max(1, duration || current.duration || 1))}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (audioRef.current) audioRef.current.currentTime = value;
                setTime(value);
              }}
            />
            <span>{fmt(duration || current.duration)}</span>
          </label>

          <a
            className="detail"
            href={`/music/@${encodeURIComponent(profile.handle)}/${current.id}`}
            aria-label="Trang bài hát"
          >
            <ListMusic />
          </a>
        </div>
      )}
    </div>
  );
}
