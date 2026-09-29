'use client';

import {
  Pause,
  Play,
  RotateCcw,
  Share2,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import {
  useGlobalMusic,
  type GlobalMusicSong,
} from '@/components/music-global-player';

type Props = {
  id: string;
  title: string;
  creator: string;
  handle?: string | null;
  picture?: string | null;
  duration?: number | null;
  lyrics?: string | null;
  style?: string | null;
};

const fmt = (value = 0) => {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};

export function PublicMusicPlayer({
  id,
  title,
  creator,
  handle,
  picture,
  duration,
  lyrics,
  style,
}: Props) {
  const music = useGlobalMusic();
  const active = music.current?.id === id;
  const time = active ? music.time : 0;
  const resolvedDuration = active
    ? music.duration || duration || 0
    : duration || 0;
  const progress =
    resolvedDuration > 0 ? (time / resolvedDuration) * 100 : 0;

  const song = useMemo<GlobalMusicSong>(
    () => ({
      id,
      title,
      creator,
      handle,
      picture,
      duration,
      tags: style,
    }),
    [creator, duration, handle, id, picture, style, title],
  );

  const cleanLyrics = useMemo(
    () =>
      (lyrics || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 160),
    [lyrics],
  );

  const toggle = () => {
    if (!active) {
      music.playSong(song, [song]);
      return;
    }
    music.toggle();
  };

  const replay = () => {
    if (!active) {
      music.playSong(song, [song]);
      return;
    }
    music.seek(0);
    if (!music.playing) music.toggle();
  };

  const share = async () => {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `${title} · ${creator}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  };

  return (
    <div className="sd-track-page">
      <section className="sd-track-hero">
        <button className="track-art" onClick={toggle} aria-label={music.playing && active ? 'Tạm dừng' : 'Phát'}>
          {picture ? <img src={picture} alt={`Ảnh bìa ${title}`} /> : <Music2Fallback />}
          <i>{music.playing && active ? <Pause /> : <Play />}</i>
        </button>

        <div className="track-copy">
          <span>TRACK</span>
          <h1>{title}</h1>
          {handle ? (
            <Link href={`/music/@${encodeURIComponent(handle)}`}>
              {creator} · @{handle}
            </Link>
          ) : (
            <p>{creator}</p>
          )}
          {style && <em>{style}</em>}

          <div className="track-actions">
            <button className="primary" onClick={toggle}>
              {music.playing && active ? <Pause /> : <Play />}
              {music.playing && active ? 'Tạm dừng' : 'Nghe bài hát'}
            </button>
            <button onClick={replay}><RotateCcw /> Phát lại</button>
            <button onClick={() => void share()}><Share2 /> Chia sẻ</button>
            <a
              href={`/editor?source=${encodeURIComponent(
                `https://suno.com/song/${id}`,
              )}`}
            >
              <SlidersHorizontal /> Create Video
            </a>
          </div>

          <div className="track-progress">
            <span>{fmt(time)}</span>
            <input
              type="range"
              min="0"
              max="100"
              step=".1"
              value={Math.max(0, Math.min(100, progress))}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!active) {
                  music.playSong(song, [song]);
                  return;
                }
                music.seek((value / 100) * resolvedDuration);
              }}
            />
            <span>{fmt(resolvedDuration)}</span>
          </div>
        </div>
      </section>

      {cleanLyrics.length > 0 && (
        <section className="sd-track-lyrics">
          <header>
            <span>LYRICS</span>
            <h2>Lời bài hát</h2>
          </header>
          <div>
            {cleanLyrics.map((line, index) => (
              <p key={`${index}-${line}`}>{line}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Music2Fallback() {
  return <span className="track-art-fallback">♫</span>;
}
