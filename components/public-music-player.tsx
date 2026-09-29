'use client';

import {
  Pause,
  Play,
  RotateCcw,
  Share2,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  useGlobalMusic,
  type GlobalMusicSong,
} from '@/components/music-global-player';
import { buildEstimatedKaraokeTimeline } from '@/app/lib/karaoke';

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
  const lyricsRef = useRef<HTMLDivElement | null>(null);
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
      lyrics,
    }),
    [creator, duration, handle, id, lyrics, picture, style, title],
  );

  const resolvedLyrics = active ? music.current?.lyrics || lyrics : lyrics;
  const cleanLyrics = useMemo(
    () =>
      (resolvedLyrics || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 160),
    [resolvedLyrics],
  );
  const karaokeTimeline = useMemo(
    () =>
      active && music.current?.karaokeTimeline?.length
        ? music.current.karaokeTimeline
        : resolvedLyrics && resolvedDuration > 0
          ? buildEstimatedKaraokeTimeline(resolvedLyrics, resolvedDuration)
          : [],
    [
      active,
      music.current?.karaokeTimeline,
      resolvedDuration,
      resolvedLyrics,
    ],
  );
  const activeLyricIndex = useMemo(() => {
    if (!active) return -1;
    for (let index = 0; index < karaokeTimeline.length; index += 1) {
      const line = karaokeTimeline[index];
      if (time >= line.start && time <= line.end + 0.35) return index;
      if (line.start > time) break;
    }
    return -1;
  }, [active, karaokeTimeline, time]);

  useEffect(() => {
    if (activeLyricIndex < 0) return;
    lyricsRef.current
      ?.querySelector<HTMLElement>(
        `[data-track-lyric-index="${activeLyricIndex}"]`,
      )
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLyricIndex]);

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
            <a href={`/music/@${encodeURIComponent(handle)}`}>
              {creator} · @{handle}
            </a>
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
        <section className="sd-track-lyrics sd-track-lyrics-live">
          <header>
            <span>SYNCED LYRICS</span>
            <h2>Lời bài hát</h2>
            <small>Chạm vào câu để tua tới đoạn đó</small>
          </header>
          <div ref={lyricsRef}>
            {(karaokeTimeline.length
              ? karaokeTimeline
              : cleanLyrics.map((text) => ({
                  text,
                  start: 0,
                  end: 0,
                  words: [],
                }))
            ).map((line, index) => (
              <button
                key={`${index}-${line.text}`}
                type="button"
                data-track-lyric-index={index}
                className={
                  index === activeLyricIndex
                    ? 'active'
                    : time > line.end
                      ? 'past'
                      : ''
                }
                onClick={() => {
                  if (!active) {
                    music.playSong(song, [song]);
                    return;
                  }
                  if (karaokeTimeline.length) music.seek(line.start);
                }}
              >
                {line.text}
              </button>
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
