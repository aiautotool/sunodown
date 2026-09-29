'use client';

import {
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type GlobalMusicSong = {
  id: string;
  title: string;
  creator?: string | null;
  handle?: string | null;
  picture?: string | null;
  duration?: number | null;
  tags?: string | null;
};

type RepeatMode = 'off' | 'all' | 'one';

type MusicContextValue = {
  current: GlobalMusicSong | null;
  queue: GlobalMusicSong[];
  queueIndex: number;
  playing: boolean;
  time: number;
  duration: number;
  shuffleOn: boolean;
  repeatMode: RepeatMode;
  queueOpen: boolean;
  playSong: (song: GlobalMusicSong, source?: GlobalMusicSong[]) => void;
  playQueue: (source: GlobalMusicSong[], startIndex?: number) => void;
  shuffleQueue: (source: GlobalMusicSong[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setQueueOpen: (open: boolean) => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

const fmt = (seconds = 0) => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

const mediaUrl = (song: GlobalMusicSong) =>
  `/api/music/audio?id=${encodeURIComponent(song.id)}`;

const canonicalSongUrl = (song: GlobalMusicSong) =>
  song.handle
    ? `/music/@${encodeURIComponent(song.handle)}/${song.id}`
    : `/music/${song.id}`;

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

async function trackEvent(songId: string, event: string) {
  try {
    await fetch('/api/music/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ songId, event }),
    });
  } catch {}
}

export function useGlobalMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useGlobalMusic must be used inside MusicGlobalProvider');
  }
  return context;
}

export function MusicGlobalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const milestonesRef = useRef(new Set<string>());
  const lastSongRef = useRef<string | null>(null);

  const [queue, setQueue] = useState<GlobalMusicSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queueOpen, setQueueOpen] = useState(false);

  const current = queueIndex >= 0 ? queue[queueIndex] || null : null;

  const loadAt = useCallback(
    (list: GlobalMusicSong[], index: number, autoplay = true) => {
      const song = list[index];
      if (!song) return;

      setQueue(list);
      setQueueIndex(index);
      setTime(0);
      setDuration(song.duration || 0);
      milestonesRef.current = new Set();
      lastSongRef.current = song.id;

      window.setTimeout(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.src = mediaUrl(song);
        audio.load();
        if (autoplay) void audio.play().catch(() => {});
      }, 0);

      void trackEvent(song.id, 'start');
    },
    [],
  );

  const playSong = useCallback(
    (song: GlobalMusicSong, source?: GlobalMusicSong[]) => {
      const list =
        source && source.length
          ? source
          : queue.length
            ? queue
            : [song];
      const found = list.findIndex((item) => item.id === song.id);
      loadAt(found >= 0 ? list : [song, ...list], found >= 0 ? found : 0);
    },
    [loadAt, queue],
  );

  const playQueue = useCallback(
    (source: GlobalMusicSong[], startIndex = 0) => {
      if (!source.length) return;
      loadAt(source, Math.max(0, Math.min(source.length - 1, startIndex)));
    },
    [loadAt],
  );

  const shuffleQueue = useCallback(
    (source: GlobalMusicSong[]) => {
      if (!source.length) return;
      const list = shuffled(source);
      setShuffleOn(true);
      loadAt(list, 0);
    },
    [loadAt],
  );

  const next = useCallback(() => {
    if (!queue.length) return;
    if (repeatMode === 'one') {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
      return;
    }

    let index = queueIndex + 1;
    if (index >= queue.length) {
      if (repeatMode !== 'all') {
        setPlaying(false);
        return;
      }
      index = 0;
    }
    loadAt(queue, index);
  }, [loadAt, queue, queueIndex, repeatMode]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    if (!queue.length) return;
    const index = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
    loadAt(queue, index);
  }, [loadAt, queue, queueIndex]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, [current]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(Number.isFinite(audio.duration) ? audio.duration : seconds, seconds),
    );
    setTime(audio.currentTime);
  }, []);

  const toggleShuffle = useCallback(() => {
    if (!queue.length) {
      setShuffleOn((value) => !value);
      return;
    }
    setShuffleOn((value) => {
      const nextValue = !value;
      if (nextValue && current) {
        const rest = queue.filter((song) => song.id !== current.id);
        setQueue([current, ...shuffled(rest)]);
        setQueueIndex(0);
      }
      return nextValue;
    });
  }, [current, queue]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((mode) =>
      mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off',
    );
  }, []);

  useEffect(() => {
    if (!current || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.creator || current.handle || 'Suno',
      album: 'SunoDown Music',
      artwork: current.picture
        ? [{ src: current.picture, sizes: '512x512' }]
        : undefined,
    });
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        void audioRef.current?.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', previous);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) seek(details.seekTime);
      });
    } catch {}
  }, [current, next, previous, seek]);

  const contextValue = useMemo<MusicContextValue>(
    () => ({
      current,
      queue,
      queueIndex,
      playing,
      time,
      duration,
      shuffleOn,
      repeatMode,
      queueOpen,
      playSong,
      playQueue,
      shuffleQueue,
      toggle,
      next,
      previous,
      seek,
      toggleShuffle,
      cycleRepeat,
      setQueueOpen,
    }),
    [
      current,
      queue,
      queueIndex,
      playing,
      time,
      duration,
      shuffleOn,
      repeatMode,
      queueOpen,
      playSong,
      playQueue,
      shuffleQueue,
      toggle,
      next,
      previous,
      seek,
      toggleShuffle,
      cycleRepeat,
    ],
  );

  const hidePlayer = pathname === '/music/me';

  return (
    <MusicContext.Provider value={contextValue}>
      {children}

      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration)) setDuration(audio.duration);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          const nextTime = audio.currentTime || 0;
          setTime(nextTime);

          if (!current || !audio.duration) return;
          const key30 = `${current.id}:30s`;
          const keyHalf = `${current.id}:half`;

          if (nextTime >= 30 && !milestonesRef.current.has(key30)) {
            milestonesRef.current.add(key30);
            void trackEvent(current.id, '30s');
          }
          if (
            nextTime / audio.duration >= 0.5 &&
            !milestonesRef.current.has(keyHalf)
          ) {
            milestonesRef.current.add(keyHalf);
            void trackEvent(current.id, 'half');
          }

          if ('mediaSession' in navigator) {
            try {
              navigator.mediaSession.setPositionState({
                duration: audio.duration,
                playbackRate: audio.playbackRate,
                position: Math.min(nextTime, audio.duration),
              });
            } catch {}
          }
        }}
        onEnded={() => {
          if (current) void trackEvent(current.id, 'complete');
          next();
        }}
      />

      {!hidePlayer && current && (
        <div className="sd-global-music-player">
          <Link className="track" href={canonicalSongUrl(current)}>
            {current.picture ? (
              <img src={current.picture} alt="" />
            ) : (
              <span><Music2 /></span>
            )}
            <div>
              <b>{current.title}</b>
              <small>{current.creator || (current.handle ? `@${current.handle}` : 'Suno')}</small>
            </div>
          </Link>

          <div className="transport">
            <div>
              <button
                className={shuffleOn ? 'active' : ''}
                onClick={toggleShuffle}
                aria-label="Trộn bài"
              >
                <Shuffle />
              </button>
              <button onClick={previous} aria-label="Bài trước"><SkipBack /></button>
              <button className="primary" onClick={toggle} aria-label={playing ? 'Tạm dừng' : 'Phát'}>
                {playing ? <Pause /> : <Play />}
              </button>
              <button onClick={next} aria-label="Bài tiếp"><SkipForward /></button>
              <button
                className={repeatMode !== 'off' ? 'active' : ''}
                onClick={cycleRepeat}
                aria-label="Lặp"
              >
                {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
              </button>
            </div>
            <label>
              <span>{fmt(time)}</span>
              <input
                type="range"
                min="0"
                max={Math.max(1, duration || current.duration || 1)}
                step=".1"
                value={Math.min(time, Math.max(1, duration || current.duration || 1))}
                onChange={(event) => seek(Number(event.target.value))}
              />
              <span>{fmt(duration || current.duration || 0)}</span>
            </label>
          </div>

          <button className="queue-toggle" onClick={() => setQueueOpen(!queueOpen)} aria-label="Hàng đợi">
            <ListMusic />
          </button>
        </div>
      )}

      {!hidePlayer && queueOpen && current && (
        <aside className="sd-global-queue">
          <header>
            <div>
              <small>UP NEXT</small>
              <b>Queue · {queue.length} bài</b>
            </div>
            <button onClick={() => setQueueOpen(false)} aria-label="Đóng"><X /></button>
          </header>
          <div>
            {queue.map((song, index) => (
              <button
                key={`${song.id}-${index}`}
                className={index === queueIndex ? 'active' : ''}
                onClick={() => loadAt(queue, index)}
              >
                {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
                <span>
                  <b>{song.title}</b>
                  <small>{song.creator || song.handle || 'Suno'}</small>
                </span>
                <em>{index + 1}</em>
              </button>
            ))}
          </div>
        </aside>
      )}
    </MusicContext.Provider>
  );
}
