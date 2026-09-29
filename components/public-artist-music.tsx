'use client';

import {
  ExternalLink,
  Music2,
  Play,
  Search,
  Shuffle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  PublicMusicProfile,
  PublicProfileSong,
} from '@/app/lib/public-music-profile';
import { useGlobalMusic, type GlobalMusicSong } from '@/components/music-global-player';

const fmt = (seconds?: number | null) => {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

const toGlobal = (song: PublicProfileSong): GlobalMusicSong => ({
  id: song.id,
  title: song.title,
  creator: song.creator,
  handle: song.handle,
  picture: song.picture,
  duration: song.duration,
  tags: song.tags,
});

export function PublicArtistMusic({
  profile,
}: {
  profile: PublicMusicProfile;
}) {
  const music = useGlobalMusic();
  const [query, setQuery] = useState('');

  const visibleSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profile.songs;
    return profile.songs.filter((song) =>
      `${song.title} ${song.creator} ${song.tags || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [profile.songs, query]);

  const popular = useMemo(
    () =>
      [...profile.songs]
        .sort((a, b) => Number(b.playCount || 0) - Number(a.playCount || 0))
        .slice(0, 5),
    [profile.songs],
  );

  const latest = useMemo(
    () =>
      [...profile.songs]
        .sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
        )
        .slice(0, 10),
    [profile.songs],
  );

  const playSong = (
    song: PublicProfileSong,
    source: PublicProfileSong[] = visibleSongs,
  ) => {
    music.playSong(toGlobal(song), source.map(toGlobal));
  };

  const SongRow = ({
    song,
    source,
    rank,
  }: {
    song: PublicProfileSong;
    source: PublicProfileSong[];
    rank?: number;
  }) => (
    <article className={music.current?.id === song.id ? 'active' : ''}>
      {rank ? <strong>{String(rank).padStart(2, '0')}</strong> : null}
      <button className="song-cover" onClick={() => playSong(song, source)}>
        {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
        <i><Play /></i>
      </button>
      <div className="song-copy">
        <Link
          href={`/music/@${encodeURIComponent(profile.handle)}/${song.id}`}
        >
          {song.title}
        </Link>
        <small>
          {song.tags || song.creator}
          {song.duration ? ` · ${fmt(song.duration)}` : ''}
        </small>
      </div>
      <span>{song.playCount ? `${song.playCount} plays` : ''}</span>
      <button className="row-play" onClick={() => playSong(song, source)}>
        <Play />
      </button>
    </article>
  );

  return (
    <div className="sd-artist-page">
      <section className="sd-artist-hero">
        <div className="artist-avatar">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} />
          ) : (
            <Music2 />
          )}
        </div>

        <div className="artist-copy">
          <small>ARTIST PROFILE</small>
          <h1>{profile.displayName}</h1>
          <p>@{profile.handle}</p>
          {profile.bio && <em>{profile.bio}</em>}
          <div className="artist-stats">
            <span><b>{profile.total}</b> bài public</span>
          </div>
          <div className="artist-actions">
            <button
              className="primary"
              onClick={() =>
                profile.songs[0] &&
                music.playQueue(profile.songs.map(toGlobal), 0)
              }
              disabled={!profile.songs.length}
            >
              <Play /> Play
            </button>
            <button
              onClick={() => music.shuffleQueue(profile.songs.map(toGlobal))}
              disabled={!profile.songs.length}
            >
              <Shuffle /> Shuffle
            </button>
            <a
              href={`https://suno.com/@${encodeURIComponent(profile.handle)}`}
              target="_blank"
              rel="noopener"
            >
              Suno <ExternalLink />
            </a>
          </div>
        </div>
      </section>

      {popular.length > 0 && (
        <section className="sd-artist-section">
          <header>
            <div>
              <small>POPULAR</small>
              <h2>Nghe nhiều</h2>
            </div>
          </header>
          <div className="sd-artist-song-list popular">
            {popular.map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                source={popular}
                rank={index + 1}
              />
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section className="sd-artist-section">
          <header>
            <div>
              <small>LATEST RELEASES</small>
              <h2>Bài mới</h2>
            </div>
          </header>
          <div className="sd-artist-release-row">
            {latest.map((song) => (
              <article key={song.id}>
                <button onClick={() => playSong(song, latest)}>
                  {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
                  <i><Play /></i>
                </button>
                <Link
                  href={`/music/@${encodeURIComponent(profile.handle)}/${song.id}`}
                >
                  {song.title}
                </Link>
                <small>{song.tags || profile.displayName}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="sd-artist-section all-songs">
        <header>
          <div>
            <small>DISCOGRAPHY</small>
            <h2>Tất cả bài hát</h2>
          </div>
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm trong kho nhạc..."
            />
          </label>
        </header>

        <div className="sd-artist-song-list">
          {visibleSongs.map((song) => (
            <SongRow key={song.id} song={song} source={visibleSongs} />
          ))}
        </div>
      </section>
    </div>
  );
}
