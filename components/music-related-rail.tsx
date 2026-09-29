'use client';

import { Music2, Play } from 'lucide-react';
import Link from 'next/link';
import { useGlobalMusic, type GlobalMusicSong } from '@/components/music-global-player';

export type RelatedMusicSong = {
  id: string;
  title: string;
  creator: string;
  handle: string;
  picture?: string | null;
  duration?: number | null;
  tags?: string | null;
};

const toGlobal = (song: RelatedMusicSong): GlobalMusicSong => ({
  id: song.id,
  title: song.title,
  creator: song.creator,
  handle: song.handle,
  picture: song.picture,
  duration: song.duration,
  tags: song.tags,
});

export function MusicRelatedRail({
  title,
  eyebrow,
  songs,
}: {
  title: string;
  eyebrow: string;
  songs: RelatedMusicSong[];
}) {
  const music = useGlobalMusic();
  if (!songs.length) return null;

  return (
    <section className="sd-track-related">
      <header>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </header>
      <div>
        {songs.map((song) => (
          <article key={song.id}>
            <button
              onClick={() =>
                music.playSong(toGlobal(song), songs.map(toGlobal))
              }
            >
              {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
              <i><Play /></i>
            </button>
            <Link href={`/music/@${encodeURIComponent(song.handle)}/${song.id}`}>
              {song.title}
            </Link>
            <Link className="creator" href={`/music/@${encodeURIComponent(song.handle)}`}>
              @{song.handle}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
