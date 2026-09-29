'use client';

import {
  ChevronDown,
  ListMusic,
  Headphones,
  Maximize2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SlidersHorizontal,
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
  type PointerEvent as ReactPointerEvent,
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
type SoundPreset =
  | 'original'
  | 'clean'
  | 'vocal'
  | 'punchy'
  | 'bass'
  | 'wide'
  | 'immersive';

type SoundPresetConfig = {
  id: SoundPreset;
  label: string;
  description: string;
  low: number;
  mid: number;
  high: number;
  threshold: number;
  ratio: number;
  makeupDb: number;
  spatial: 0 | 0.45 | 0.72;
};

const SOUND_PRESETS: SoundPresetConfig[] = [
  {
    id: 'original',
    label: 'Original',
    description: 'Âm thanh gốc, không tăng màu.',
    low: 0,
    mid: 0,
    high: 0,
    threshold: 0,
    ratio: 1,
    makeupDb: 0,
    spatial: 0,
  },
  {
    id: 'clean',
    label: 'Clean',
    description: 'Rõ hơn, thoáng hơn và vẫn giữ độ tự nhiên.',
    low: 0.4,
    mid: 0.8,
    high: 1.2,
    threshold: -17,
    ratio: 1.45,
    makeupDb: 0.4,
    spatial: 0,
  },
  {
    id: 'vocal',
    label: 'Vocal',
    description: 'Đưa giọng hát ra trước, giảm cảm giác đục.',
    low: -0.8,
    mid: 2.6,
    high: 1.1,
    threshold: -18,
    ratio: 1.7,
    makeupDb: 0.5,
    spatial: 0,
  },
  {
    id: 'punchy',
    label: 'Punchy',
    description: 'Kick/snare chắc hơn, nghe có lực hơn.',
    low: 1.6,
    mid: 0.6,
    high: 1,
    threshold: -19,
    ratio: 2.15,
    makeupDb: 0.9,
    spatial: 0,
  },
  {
    id: 'bass',
    label: 'Bass+',
    description: 'Tăng low-end nhưng vẫn giữ vocal rõ.',
    low: 4,
    mid: -0.5,
    high: 0.5,
    threshold: -18,
    ratio: 1.65,
    makeupDb: 0.3,
    spatial: 0,
  },
  {
    id: 'wide',
    label: 'Wide',
    description: 'Mở rộng stereo nhẹ, hợp tai nghe.',
    low: 0.3,
    mid: 0.5,
    high: 1,
    threshold: -17,
    ratio: 1.4,
    makeupDb: 0.3,
    spatial: 0.45,
  },
  {
    id: 'immersive',
    label: 'Immersive',
    description: 'Không gian rộng và sâu hơn, nên dùng tai nghe.',
    low: 0.5,
    mid: 0.6,
    high: 1.2,
    threshold: -18,
    ratio: 1.55,
    makeupDb: 0.45,
    spatial: 0.72,
  },
];

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
  const nowPlayingDragRef = useRef<{
    pointerId: number;
    startY: number;
    startAt: number;
  } | null>(null);
  const nowPlayingCollapseTimerRef = useRef<number | null>(null);
  const lowEqRef = useRef<BiquadFilterNode | null>(null);
  const midEqRef = useRef<BiquadFilterNode | null>(null);
  const highEqRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const makeupGainRef = useRef<GainNode | null>(null);
  const directGainRef = useRef<GainNode | null>(null);
  const spatialGainRef = useRef<GainNode | null>(null);
  const spatialCrossLRef = useRef<GainNode | null>(null);
  const spatialCrossRRef = useRef<GainNode | null>(null);
  const spatialDelayLRef = useRef<DelayNode | null>(null);
  const spatialDelayRRef = useRef<DelayNode | null>(null);

  const [queue, setQueue] = useState<GlobalMusicSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queueOpen, setQueueOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [nowPlayingDragY, setNowPlayingDragY] = useState(0);
  const [nowPlayingDragging, setNowPlayingDragging] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [soundPreset, setSoundPreset] = useState<SoundPreset>('original');
  const [quickEq, setQuickEq] = useState({ low: 0, mid: 0, high: 0 });
  const [soundGraphReady, setSoundGraphReady] = useState(false);
  const [liveAudioFxAvailable, setLiveAudioFxAvailable] = useState(false);

  const current = queueIndex >= 0 ? queue[queueIndex] || null : null;

  const ensureAudioAnalyser = useCallback(async () => {
    const audio = audioRef.current;
    if (
      !audio ||
      typeof window === 'undefined' ||
      !liveAudioFxAvailable
    ) return null;

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

        const lowEq = context.createBiquadFilter();
        lowEq.type = 'lowshelf';
        lowEq.frequency.value = 120;

        const midEq = context.createBiquadFilter();
        midEq.type = 'peaking';
        midEq.frequency.value = 2600;
        midEq.Q.value = 0.75;

        const highEq = context.createBiquadFilter();
        highEq.type = 'highshelf';
        highEq.frequency.value = 7600;

        const compressor = context.createDynamicsCompressor();
        compressor.knee.value = 10;
        compressor.attack.value = 0.012;
        compressor.release.value = 0.16;

        const makeup = context.createGain();
        const directGain = context.createGain();
        const spatialGain = context.createGain();

        source
          .connect(lowEq)
          .connect(midEq)
          .connect(highEq)
          .connect(compressor)
          .connect(makeup);

        // Direct branch.
        makeup.connect(directGain).connect(analyser);

        // Live stereo-width branch. The original left/right stay intact while
        // a tiny delayed, inverted cross-channel signal creates width without
        // changing playback position or rendering a new file.
        const splitter = context.createChannelSplitter(2);
        const merger = context.createChannelMerger(2);
        const dryL = context.createGain();
        const dryR = context.createGain();
        const crossL = context.createGain();
        const crossR = context.createGain();
        const delayL = context.createDelay(0.05);
        const delayR = context.createDelay(0.05);

        makeup.connect(splitter);
        splitter.connect(dryL, 0);
        splitter.connect(dryR, 1);
        dryL.connect(merger, 0, 0);
        dryR.connect(merger, 0, 1);

        splitter.connect(crossL, 1);
        splitter.connect(crossR, 0);
        crossL.connect(delayL).connect(merger, 0, 0);
        crossR.connect(delayR).connect(merger, 0, 1);
        merger.connect(spatialGain).connect(analyser);

        analyser.connect(context.destination);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        audioSourceRef.current = source;
        lowEqRef.current = lowEq;
        midEqRef.current = midEq;
        highEqRef.current = highEq;
        compressorRef.current = compressor;
        makeupGainRef.current = makeup;
        directGainRef.current = directGain;
        spatialGainRef.current = spatialGain;
        spatialCrossLRef.current = crossL;
        spatialCrossRRef.current = crossR;
        spatialDelayLRef.current = delayL;
        spatialDelayRRef.current = delayR;

        directGain.gain.value = 1;
        spatialGain.gain.value = 0;
        crossL.gain.value = 0;
        crossR.gain.value = 0;
        delayL.delayTime.value = 0.007;
        delayR.delayTime.value = 0.011;

        setSoundGraphReady(true);
      }

      if (context.state === 'suspended') {
        await context.resume();
      }

      return analyser;
    } catch {
      return analyserRef.current;
    }
  }, [liveAudioFxAvailable]);

  const loadAt = useCallback(
    (list: GlobalMusicSong[], index: number, autoplay = true) => {
      const song = list[index];
      if (!song) return;

      setQueue(list);
      setQueueIndex(index);
      setTime(0);
      setDuration(song.duration || 0);
      milestonesRef.current = new Set();

      // Match the Creator v22 playback model: keep a real HTMLAudioElement
      // as the primary transport and start it inside the original interaction.
      // Moving play() into a timer breaks the user-activation chain on iOS and
      // makes background/lock-screen playback less reliable.
      const audio = audioRef.current;
      if (audio) {
        const nextSource = mediaUrl(song);
        if (audio.getAttribute('src') !== nextSource) {
          audio.src = nextSource;
          audio.load();
        }
        if (autoplay) void audio.play().catch(() => {});
      }

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

  const openNowPlaying = useCallback(() => {
    if (nowPlayingCollapseTimerRef.current != null) {
      window.clearTimeout(nowPlayingCollapseTimerRef.current);
      nowPlayingCollapseTimerRef.current = null;
    }
    setNowPlayingDragY(0);
    setNowPlayingDragging(false);
    setNowPlayingOpen(true);
  }, []);

  const collapseNowPlaying = useCallback((animated = true) => {
    nowPlayingDragRef.current = null;
    setNowPlayingDragging(false);

    if (!animated || typeof window === 'undefined') {
      setNowPlayingOpen(false);
      setNowPlayingDragY(0);
      return;
    }

    setNowPlayingDragY(Math.max(window.innerHeight, 720));
    if (nowPlayingCollapseTimerRef.current != null) {
      window.clearTimeout(nowPlayingCollapseTimerRef.current);
    }
    nowPlayingCollapseTimerRef.current = window.setTimeout(() => {
      setNowPlayingOpen(false);
      setNowPlayingDragY(0);
      nowPlayingCollapseTimerRef.current = null;
    }, 240);
  }, []);

  const beginNowPlayingDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!nowPlayingOpen || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'button, a, input, .now-lyrics-scroll, .now-controls, .now-footer',
        )
      ) {
        return;
      }

      nowPlayingDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startAt: performance.now(),
      };
      setNowPlayingDragging(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
    },
    [nowPlayingOpen],
  );

  const moveNowPlayingDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = nowPlayingDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const rawDistance = Math.max(0, event.clientY - drag.startY);
      const distance =
        rawDistance <= 260 ? rawDistance : 260 + (rawDistance - 260) * 0.58;
      setNowPlayingDragY(distance);

      if (rawDistance > 6) event.preventDefault();
    },
    [],
  );

  const endNowPlayingDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = nowPlayingDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const distance = Math.max(0, event.clientY - drag.startY);
      const elapsed = Math.max(16, performance.now() - drag.startAt);
      const velocity = distance / elapsed;
      nowPlayingDragRef.current = null;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}

      if (distance >= 110 || (distance >= 42 && velocity >= 0.48)) {
        collapseNowPlaying(true);
        return;
      }

      setNowPlayingDragging(false);
      setNowPlayingDragY(0);
    },
    [collapseNowPlaying],
  );

  const cancelNowPlayingDrag = useCallback(() => {
    nowPlayingDragRef.current = null;
    setNowPlayingDragging(false);
    setNowPlayingDragY(0);
  }, []);

  useEffect(() => {
    return () => {
      if (nowPlayingCollapseTimerRef.current != null) {
        window.clearTimeout(nowPlayingCollapseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!nowPlayingOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapseNowPlaying(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [collapseNowPlaying, nowPlayingOpen]);

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
    const ua = navigator.userAgent || '';
    const isiOS =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isiOS || isAndroid || /Mobile/i.test(ua);

    // Mobile must stay on the browser's native media pipeline so iOS/Android
    // can continue playback after screen lock. createMediaElementSource()
    // permanently reroutes this element through AudioContext, which mobile OSes
    // may suspend in the background.
    setLiveAudioFxAvailable(!isMobile);
  }, []);

  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem('sunodown-music-sound-preset');
      const savedEq = localStorage.getItem('sunodown-music-quick-eq');
      if (savedPreset && SOUND_PRESETS.some((item) => item.id === savedPreset)) {
        setSoundPreset(savedPreset as SoundPreset);
      }
      if (savedEq) {
        const parsed = JSON.parse(savedEq) as Partial<typeof quickEq>;
        setQuickEq({
          low: Math.max(-6, Math.min(6, Number(parsed.low) || 0)),
          mid: Math.max(-6, Math.min(6, Number(parsed.mid) || 0)),
          high: Math.max(-6, Math.min(6, Number(parsed.high) || 0)),
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!soundGraphReady) return;
    const preset =
      SOUND_PRESETS.find((item) => item.id === soundPreset) || SOUND_PRESETS[0];
    const now = audioContextRef.current?.currentTime || 0;
    const ramp = 0.06;

    const setAudioParam = (param: AudioParam | undefined, value: number) => {
      if (!param) return;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + ramp);
    };

    setAudioParam(lowEqRef.current?.gain, preset.low + quickEq.low);
    setAudioParam(midEqRef.current?.gain, preset.mid + quickEq.mid);
    setAudioParam(highEqRef.current?.gain, preset.high + quickEq.high);

    if (compressorRef.current) {
      compressorRef.current.threshold.value = preset.threshold;
      compressorRef.current.ratio.value = preset.ratio;
    }

    setAudioParam(
      makeupGainRef.current?.gain,
      Math.pow(10, preset.makeupDb / 20),
    );

    const spatialAmount = preset.spatial;
    setAudioParam(directGainRef.current?.gain, spatialAmount ? 0 : 1);
    setAudioParam(spatialGainRef.current?.gain, spatialAmount ? 1 : 0);
    setAudioParam(spatialCrossLRef.current?.gain, -0.11 * spatialAmount);
    setAudioParam(spatialCrossRRef.current?.gain, -0.11 * spatialAmount);

    if (spatialDelayLRef.current) {
      spatialDelayLRef.current.delayTime.value =
        soundPreset === 'immersive' ? 0.011 : 0.006;
    }
    if (spatialDelayRRef.current) {
      spatialDelayRRef.current.delayTime.value =
        soundPreset === 'immersive' ? 0.016 : 0.009;
    }

    try {
      localStorage.setItem('sunodown-music-sound-preset', soundPreset);
      localStorage.setItem('sunodown-music-quick-eq', JSON.stringify(quickEq));
    } catch {}
  }, [quickEq.high, quickEq.low, quickEq.mid, soundGraphReady, soundPreset]);

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

    if (liveAudioFxAvailable) {
      void ensureAudioAnalyser().then((analyser) => {
        if (!cancelled) drawFrame(analyser);
      });
    } else {
      drawFrame(null);
    }

    return () => {
      cancelled = true;
      if (visualizerFrameRef.current != null) {
        window.cancelAnimationFrame(visualizerFrameRef.current);
        visualizerFrameRef.current = null;
      }
    };
  }, [current?.id, ensureAudioAnalyser, liveAudioFxAvailable, nowPlayingOpen]);

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
      navigator.mediaSession.playbackState =
        audioRef.current && !audioRef.current.paused ? 'playing' : 'paused';
      navigator.mediaSession.setActionHandler('play', () => {
        void audioRef.current?.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', previous);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const audio = audioRef.current;
        if (!audio) return;
        seek(audio.currentTime - (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const audio = audioRef.current;
        if (!audio) return;
        seek(audio.currentTime + (details.seekOffset || 10));
      });
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
          if ('mediaSession' in navigator) {
            try {
              navigator.mediaSession.playbackState = 'playing';
            } catch {}
          }
          if (liveAudioFxAvailable) void ensureAudioAnalyser();
        }}
        onPause={() => {
          setPlaying(false);
          if ('mediaSession' in navigator) {
            try {
              navigator.mediaSession.playbackState = 'paused';
            } catch {}
          }
        }}
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
          if ('mediaSession' in navigator) {
            try {
              navigator.mediaSession.playbackState = 'none';
            } catch {}
          }
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
            onClick={openNowPlaying}
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
            {liveAudioFxAvailable && (
              <button
                className={soundPreset !== 'original' ? 'active' : ''}
                onClick={() => { setQueueOpen(false); setSoundOpen(true); }}
                aria-label="Chỉnh âm thanh"
                title="Sound"
              >
                <SlidersHorizontal />
              </button>
            )}
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
              onClick={openNowPlaying}
              aria-label="Mở Now Playing"
            >
              <Maximize2 />
            </button>
          </div>
        </div>
      )}

      {!hidePlayer && nowPlayingOpen && current && (
        <section
          className={`sd-premium-now-playing${nowPlayingDragging ? ' is-dragging' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Now Playing"
          style={
            {
              '--sd-now-playing-drag': `${nowPlayingDragY}px`,
            } as CSSProperties
          }
          onPointerDown={beginNowPlayingDrag}
          onPointerMove={moveNowPlayingDrag}
          onPointerUp={endNowPlayingDrag}
          onPointerCancel={cancelNowPlayingDrag}
        >
          <div className="visual-bg" aria-hidden="true">
            {current.picture && <img src={current.picture} alt="" />}
          </div>

          <header>
            <button
              className="collapse"
              onClick={() => collapseNowPlaying(true)}
              aria-label="Thu nhỏ Now Playing"
              title="Thu nhỏ"
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
                {liveAudioFxAvailable && (
                  <button
                    className={`now-sound-button ${soundPreset !== 'original' ? 'active' : ''}`}
                    onClick={() => { setQueueOpen(false); setSoundOpen(true); }}
                  >
                    <Headphones />
                    {SOUND_PRESETS.find((item) => item.id === soundPreset)?.label ||
                      'Sound'}
                  </button>
                )}
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

      {!hidePlayer && liveAudioFxAvailable && soundOpen && current && (
        <>
          <button
            className="sd-player-sheet-backdrop"
            aria-label="Đóng Sound"
            onClick={() => setSoundOpen(false)}
          />
          <aside className="sd-music-sound-sheet" aria-label="Chỉnh âm thanh">
            <header>
              <div>
                <small>SOUND</small>
                <b>Nghe theo cách bạn thích</b>
                <span>Áp dụng trực tiếp · không render lại</span>
              </div>
              <button onClick={() => setSoundOpen(false)} aria-label="Đóng">
                <X />
              </button>
            </header>

            <div className="sd-music-sound-body">
              <section>
                <div className="sd-music-sound-section-title">
                  <span>Chất âm</span>
                  <small>
                    {SOUND_PRESETS.find((item) => item.id === soundPreset)
                      ?.description}
                  </small>
                </div>
                <div className="sd-music-sound-presets">
                  {SOUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={soundPreset === preset.id ? 'active' : ''}
                      onClick={() => {
                        setSoundPreset(preset.id);
                        void ensureAudioAnalyser();
                      }}
                    >
                      <b>{preset.label}</b>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="sd-music-sound-section-title">
                  <span>Quick EQ</span>
                  <button
                    onClick={() => setQuickEq({ low: 0, mid: 0, high: 0 })}
                  >
                    Reset
                  </button>
                </div>
                {(
                  [
                    ['low', 'Bass', 'Âm trầm'],
                    ['mid', 'Vocal', 'Giọng hát'],
                    ['high', 'Treble', 'Độ sáng'],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label className="sd-music-eq-row" key={key}>
                    <span>
                      <b>{label}</b>
                      <small>{hint}</small>
                    </span>
                    <input
                      type="range"
                      min="-6"
                      max="6"
                      step=".5"
                      value={quickEq[key]}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setQuickEq((currentEq) => ({
                          ...currentEq,
                          [key]: value,
                        }));
                        void ensureAudioAnalyser();
                      }}
                    />
                    <em>
                      {quickEq[key] > 0 ? '+' : ''}
                      {quickEq[key].toFixed(1)} dB
                    </em>
                  </label>
                ))}
              </section>

              {(soundPreset === 'wide' || soundPreset === 'immersive') && (
                <div className="sd-music-headphone-note">
                  <Headphones />
                  <span>
                    Spatial sẽ rõ nhất khi dùng tai nghe. Stereo được mở rộng
                    bằng cross-channel delay rất nhẹ để vẫn giữ cảm giác tự nhiên.
                  </span>
                </div>
              )}

              <button
                className="sd-music-sound-original"
                onClick={() => {
                  setSoundPreset('original');
                  setQuickEq({ low: 0, mid: 0, high: 0 });
                }}
              >
                Về âm thanh gốc
              </button>
            </div>
          </aside>
        </>
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
              <button onClick={openNowPlaying}>
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
