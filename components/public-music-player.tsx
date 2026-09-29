'use client';

import { Pause, Play, RotateCcw, Share2, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  id: string;
  title: string;
  creator: string;
  picture?: string | null;
  audioUrl?: string | null;
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
  picture,
  audioUrl,
  duration,
  lyrics,
  style,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(duration || 0);
  const progress = resolvedDuration > 0 ? (time / resolvedDuration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const sync = () => {
      setTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration)) setResolvedDuration(audio.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onPause);

    return () => {
      audio.removeEventListener('timeupdate', sync);
      audio.removeEventListener('loadedmetadata', sync);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onPause);
    };
  }, []);

  const cleanLyrics = useMemo(
    () =>
      (lyrics || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 120),
    [lyrics],
  );

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !resolvedDuration) return;
    audio.currentTime = Math.max(
      0,
      Math.min(resolvedDuration, (value / 100) * resolvedDuration),
    );
    setTime(audio.currentTime);
  };

  const replay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setTime(0);
    void audio.play().catch(() => {});
  };

  const share = async () => {
    const url = `${window.location.origin}/music/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} · ${creator}`, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  };

  return (
    <div className="sd-public-player">
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        preload="metadata"
        playsInline
      />

      <section className="sd-public-now">
        <div className="sd-public-cover">
          {picture ? <img src={picture} alt={`Ảnh bìa ${title}`} /> : <span>♫</span>}
          <button
            type="button"
            className={playing ? 'is-playing' : ''}
            onClick={() => void toggle()}
            disabled={!audioUrl}
            aria-label={playing ? 'Tạm dừng' : 'Phát nhạc'}
          >
            {playing ? <Pause /> : <Play />}
          </button>
        </div>

        <div className="sd-public-track">
          <span className="sd-public-kicker">SUNODOWN MUSIC</span>
          <h1>{title}</h1>
          <p className="sd-public-creator">{creator}</p>
          {style && <p className="sd-public-style">{style}</p>}

          <div className="sd-public-seek">
            <span>{fmt(time)}</span>
            <input
              aria-label="Vị trí phát nhạc"
              type="range"
              min="0"
              max="100"
              step=".1"
              value={Math.max(0, Math.min(100, progress))}
              onChange={(event) => seek(Number(event.target.value))}
              disabled={!audioUrl}
            />
            <span>{fmt(resolvedDuration)}</span>
          </div>

          <div className="sd-public-player-actions">
            <button type="button" onClick={replay} disabled={!audioUrl}>
              <RotateCcw /> Phát lại
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void toggle()}
              disabled={!audioUrl}
            >
              {playing ? <Pause /> : <Play />}
              {playing ? 'Tạm dừng' : 'Phát bài hát'}
            </button>
            <button type="button" onClick={() => void share()}>
              <Share2 /> Chia sẻ
            </button>
          </div>

          <a
            className="sd-public-edit"
            href={`/editor?source=${encodeURIComponent(
              `https://suno.com/song/${id}`,
            )}`}
          >
            <SlidersHorizontal />
            Mở bài hát trong Creator Studio
          </a>
        </div>
      </section>

      {cleanLyrics.length > 0 && (
        <section className="sd-public-lyrics">
          <header>
            <span>Lời bài hát</span>
            <b>{title}</b>
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
