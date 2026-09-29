'use client';

import {
  ChevronDown,
  ListMusic,
  Maximize2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  buildEstimatedKaraokeTimeline,
} from '@/app/lib/karaoke';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  lyrics?: string | null;
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
  const metadataFetchedRef = useRef(new Set<string>());
  const nowLyricsRef = useRef<HTMLDivElement | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);

  const [queue, setQueue] = useState<GlobalMusicSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queueOpen, setQueueOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const current = queueIndex >= 0 ? queue[queueIndex] || null : null;

  const ensureAudioAnalyser = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || typeof window === 'undefined') return null;

    try {
      let context = audioContextRef.current;
      let analyser = analyserRef.current;

      if (!context || !analyser) {
        const AudioContextCtor =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;

        if (!AudioContextCtor) return null;

        context = new AudioContextCtor();
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.84;
        analyser.minDecibels = -92;
        analyser.maxDecibels = -16;

        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        audioSourceRef.current = source;
      }

      if (context.state === 'suspended') {
        await context.resume();
      }

      return analyser;
    } catch {
      return analyserRef.current;
    }
  }, []);

  const loadAt = useCallback(
    (list: GlobalMusicSong[], index: number, autoplay = true) => {
      const song = list[index];
      if (!song) return;

      setQueue(list);
      setQueueIndex(index);
      setTime(0);
      setDuration(song.duration || 0);
      milestonesRef.current = new Set();

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
      Math.min(
        Number.isFinite(audio.duration) ? audio.duration : seconds,
        seconds,
      ),
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

  const shareCurrent = useCallback(async () => {
    if (!current) return;
    const path = canonicalSongUrl(current);
    const shareUrl = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: current.title,
          text: `${current.title} · ${current.creator || current.handle || 'Suno'}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1600);
      }
    } catch {}
  }, [current]);

  useEffect(() => {
    if (!nowPlayingOpen || !current) return;

    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let frequencyData: Uint8Array<ArrayBuffer> | null = null;

    const drawFrame = (analyser: AnalyserNode | null) => {
      if (cancelled) return;

      const context2d = canvas.getContext('2d');
      if (!context2d) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context2d.clearRect(0, 0, width, height);

      const barCount = width < 720 ? 30 : 42;
      const gap = Math.max(2, Math.round(2.2 * dpr));
      const barWidth = Math.max(
        2,
        (width - gap * (barCount - 1)) / barCount,
      );
      const audio = audioRef.current;
      const isPlaying = Boolean(audio && !audio.paused && !audio.ended);

      if (analyser) {
        if (
          !frequencyData ||
          frequencyData.length !== analyser.frequencyBinCount
        ) {
          frequencyData = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(frequencyData);
      }

      const gradient = context2d.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(255,255,255,.98)');
      gradient.addColorStop(.42, 'rgba(213,199,255,.94)');
      gradient.addColorStop(1, 'rgba(157,126,244,.30)');
      context2d.fillStyle = gradient;

      for (let index = 0; index < barCount; index += 1) {
        const normalized = index / Math.max(1, barCount - 1);
        const shaped = Math.pow(normalized, 1.7);
        const binIndex = frequencyData
          ? Math.min(
              frequencyData.length - 1,
              Math.floor(shaped * frequencyData.length * 0.72),
            )
          : 0;
        const raw = frequencyData ? frequencyData[binIndex] / 255 : 0;
        const neighboring = frequencyData
          ? frequencyData[
              Math.min(frequencyData.length - 1, binIndex + 2)
            ] / 255
          : 0;
        const energy = Math.max(raw, neighboring * .82);
        const idle = .055 + ((index * 17) % 8) / 400;
        const strength = isPlaying
          ? Math.max(idle, Math.pow(energy, .82))
          : idle;
        const barHeight = Math.max(
          3 * dpr,
          Math.min(height * .96, height * strength),
        );
        const x = index * (barWidth + gap);
        const y = height - barHeight;

        context2d.globalAlpha = isPlaying
          ? .52 + Math.min(.45, strength * .5)
          : .26;
        context2d.fillRect(x, y, barWidth, barHeight);
      }

      context2d.globalAlpha = 1;
      visualizerFrameRef.current = window.requestAnimationFrame(() =>
        drawFrame(analyser),
      );
    };

    void ensureAudioAnalyser().then((analyser) => {
      if (!cancelled) drawFrame(analyser);
    });

    return () => {
      cancelled = true;
      if (visualizerFrameRef.current != null) {
        window.cancelAnimationFrame(visualizerFrameRef.current);
        visualizerFrameRef.current = null;
      }
    };
  }, [current?.id, ensureAudioAnalyser, nowPlayingOpen]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    if (!current || metadataFetchedRef.current.has(current.id)) return;
    metadataFetchedRef.current.add(current.id);
    const controller = new AbortController();

    void fetch(`/api/music/song?id=${encodeURIComponent(current.id)}`, {
      signal: controller.signal,
      cache: 'force-cache',
    })
      .then((response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ song?: GlobalMusicSong }>;
      })
      .then((payload) => {
        const enriched = payload?.song;
        if (!enriched) return;
        setQueue((items) =>
          items.map((item) =>
            item.id === current.id
              ? {
                  ...item,
                  ...enriched,
                  id: item.id,
                  title: enriched.title || item.title,
                }
              : item,
          ),
        );
      })
      .catch(() => {});

    return () => controller.abort();
  }, [current?.id]);

  useEffect(() => {
    setQueueOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!nowPlayingOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [nowPlayingOpen]);

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
  const maxDuration = Math.max(1, duration || current?.duration || 1);
  const progress = Math.max(0, Math.min(100, (time / maxDuration) * 100));
  const karaokeTimeline = useMemo(
    () =>
      current?.lyrics
        ? buildEstimatedKaraokeTimeline(current.lyrics, maxDuration)
        : [],
    [current?.lyrics, maxDuration],
  );
  const activeLyricIndex = useMemo(() => {
    let active = -1;
    for (let index = 0; index < karaokeTimeline.length; index += 1) {
      if (time >= karaokeTimeline[index].start) active = index;
      else break;
    }
    return active;
  }, [karaokeTimeline, time]);

  useEffect(() => {
    if (!nowPlayingOpen || activeLyricIndex < 0) return;
    const target = nowLyricsRef.current?.querySelector<HTMLElement>(
      `[data-lyric-index="${activeLyricIndex}"]`,
    );
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLyricIndex, nowPlayingOpen]);

  return (
    <MusicContext.Provider value={contextValue}>
      {children}

      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          void ensureAudioAnalyser();
        }}
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
        <div className="sd-premium-player">
          <input
            className="sd-premium-player-progress"
            aria-label="Tiến trình bài hát"
            type="range"
            min="0"
            max={maxDuration}
            step=".1"
            value={Math.min(time, maxDuration)}
            style={{ '--sd-player-progress': `${progress}%` } as CSSProperties}
            onChange={(event) => seek(Number(event.target.value))}
          />

          <button
            type="button"
            className="track-summary"
            onClick={() => setNowPlayingOpen(true)}
            aria-label="Mở Now Playing"
          >
            {current.picture ? (
              <img src={current.picture} alt="" />
            ) : (
              <span><Music2 /></span>
            )}
            <div>
              <b>{current.title}</b>
              <small>
                {current.creator ||
                  (current.handle ? `@${current.handle}` : 'Suno')}
              </small>
            </div>
          </button>

          <div className="transport">
            <button
              className={shuffleOn ? 'active secondary' : 'secondary'}
              onClick={toggleShuffle}
              aria-label="Trộn bài"
            >
              <Shuffle />
            </button>
            <button onClick={previous} aria-label="Bài trước">
              <SkipBack />
            </button>
            <button
              className="primary"
              onClick={toggle}
              aria-label={playing ? 'Tạm dừng' : 'Phát'}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <button onClick={next} aria-label="Bài tiếp">
              <SkipForward />
            </button>
            <button
              className={
                repeatMode !== 'off' ? 'active secondary' : 'secondary'
              }
              onClick={cycleRepeat}
              aria-label="Lặp"
            >
              {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
            </button>
          </div>

          <div className="player-tools">
            <div className="volume">
              <button
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
              </button>
              <input
                aria-label="Âm lượng"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={muted ? 0 : volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  setVolume(nextVolume);
                  if (nextVolume > 0) setMuted(false);
                }}
              />
            </div>
            <button
              onClick={() => void shareCurrent()}
              aria-label="Chia sẻ bài hát"
              title={shareCopied ? 'Đã copy link' : 'Chia sẻ'}
            >
              <Share2 />
            </button>
            <button
              className={queueOpen ? 'active' : ''}
              onClick={() => setQueueOpen(!queueOpen)}
              aria-label="Hàng đợi"
            >
              <ListMusic />
            </button>
            <button
              onClick={() => setNowPlayingOpen(true)}
              aria-label="Mở Now Playing"
            >
              <Maximize2 />
            </button>
          </div>
        </div>
      )}

      {!hidePlayer && nowPlayingOpen && current && (
        <section
          className="sd-premium-now-playing"
          role="dialog"
          aria-modal="true"
          aria-label="Now Playing"
        >
          <div className="visual-bg" aria-hidden="true">
            {current.picture && <img src={current.picture} alt="" />}
          </div>

          <header>
            <button
              className="collapse"
              onClick={() => setNowPlayingOpen(false)}
              aria-label="Thu nhỏ player"
            >
              <ChevronDown />
            </button>
            <div>
              <small>NOW PLAYING</small>
              <b>SunoDown Music</b>
            </div>
            <button
              className={queueOpen ? 'active' : ''}
              onClick={() => setQueueOpen(!queueOpen)}
              aria-label="Hàng đợi"
            >
              <ListMusic />
            </button>
          </header>

          <div className="now-playing-body">
            <div className="now-art">
              {current.picture ? (
                <img src={current.picture} alt="" />
              ) : (
                <Music2 />
              )}
              <canvas
                ref={visualizerCanvasRef}
                className="now-visualizer-canvas"
                aria-hidden="true"
              />
            </div>

            <div className="now-info">
              <div className="now-title">
                <span>PLAYING FROM SUNODOWN MUSIC</span>
                <h1>{current.title}</h1>
                {current.handle ? (
                  <Link
                    href={`/music/@${encodeURIComponent(current.handle)}`}
                    onClick={() => setNowPlayingOpen(false)}
                  >
                    {current.creator || `@${current.handle}`}
                  </Link>
                ) : (
                  <p>{current.creator || 'Suno'}</p>
                )}
                {current.tags && <em>{current.tags}</em>}
              </div>

              {karaokeTimeline.length > 0 && (
                <div className="now-lyrics-panel">
                  <div className="now-lyrics-head">
                    <span>SYNCED LYRICS</span>
                    <small>
                      {activeLyricIndex >= 0
                        ? `${activeLyricIndex + 1}/${karaokeTimeline.length}`
                        : `${karaokeTimeline.length} câu`}
                    </small>
                  </div>
                  <div className="now-lyrics-scroll" ref={nowLyricsRef}>
                    {karaokeTimeline.map((line, index) => (
                      <button
                        key={`${index}-${line.text}`}
                        type="button"
                        data-lyric-index={index}
                        className={
                          index === activeLyricIndex
                            ? 'active'
                            : index < activeLyricIndex
                              ? 'past'
                              : ''
                        }
                        onClick={() => seek(line.start)}
                      >
                        {line.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="now-progress">
                <input
                  aria-label="Tiến trình bài hát"
                  type="range"
                  min="0"
                  max={maxDuration}
                  step=".1"
                  value={Math.min(time, maxDuration)}
                  style={{ '--sd-player-progress': `${progress}%` } as CSSProperties}
                  onChange={(event) => seek(Number(event.target.value))}
                />
                <div>
                  <span>{fmt(time)}</span>
                  <span>{fmt(maxDuration)}</span>
                </div>
              </div>

              <div className="now-controls">
                <button
                  className={shuffleOn ? 'active secondary' : 'secondary'}
                  onClick={toggleShuffle}
                  aria-label="Trộn bài"
                >
                  <Shuffle />
                </button>
                <button onClick={previous} aria-label="Bài trước">
                  <SkipBack />
                </button>
                <button
                  className="primary"
                  onClick={toggle}
                  aria-label={playing ? 'Tạm dừng' : 'Phát'}
                >
                  {playing ? <Pause /> : <Play />}
                </button>
                <button onClick={next} aria-label="Bài tiếp">
                  <SkipForward />
                </button>
                <button
                  className={
                    repeatMode !== 'off' ? 'active secondary' : 'secondary'
                  }
                  onClick={cycleRepeat}
                  aria-label="Lặp"
                >
                  {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
                </button>
              </div>

              <div className="now-footer">
                <div className="volume">
                  <button
                    onClick={() => setMuted((value) => !value)}
                    aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                  >
                    {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
                  </button>
                  <input
                    aria-label="Âm lượng"
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={muted ? 0 : volume}
                    onChange={(event) => {
                      const nextVolume = Number(event.target.value);
                      setVolume(nextVolume);
                      if (nextVolume > 0) setMuted(false);
                    }}
                  />
                </div>
                <div className="now-share-actions">
                  <button onClick={() => void shareCurrent()}>
                    <Share2 />
                    {shareCopied ? 'Đã copy link' : 'Chia sẻ'}
                  </button>
                  <Link
                    href={canonicalSongUrl(current)}
                    onClick={() => setNowPlayingOpen(false)}
                  >
                    Trang bài hát
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {!hidePlayer && queueOpen && current && (
        <>
          <button
            className="sd-player-sheet-backdrop"
            aria-label="Đóng hàng đợi"
            onClick={() => setQueueOpen(false)}
          />
          <aside className="sd-premium-queue" aria-label="Hàng đợi phát nhạc">
            <header>
              <div>
                <small>UP NEXT</small>
                <b>Hàng đợi</b>
                <span>{queue.length} bài</span>
              </div>
              <button onClick={() => setQueueOpen(false)} aria-label="Đóng">
                <X />
              </button>
            </header>

            <div className="queue-current">
              <span>Đang phát</span>
              <button onClick={() => setNowPlayingOpen(true)}>
                {current.picture ? (
                  <img src={current.picture} alt="" />
                ) : (
                  <Music2 />
                )}
                <div>
                  <b>{current.title}</b>
                  <small>{current.creator || current.handle || 'Suno'}</small>
                </div>
              </button>
            </div>

            <div className="queue-list">
              <span>Tiếp theo</span>
              {queue.map((song, index) => {
                if (index === queueIndex) return null;
                return (
                  <button
                    key={`${song.id}-${index}`}
                    onClick={() => loadAt(queue, index)}
                  >
                    {song.picture ? (
                      <img src={song.picture} alt="" />
                    ) : (
                      <Music2 />
                    )}
                    <div>
                      <b>{song.title}</b>
                      <small>{song.creator || song.handle || 'Suno'}</small>
                    </div>
                    <em>{index + 1}</em>
                  </button>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </MusicContext.Provider>
  );
}
