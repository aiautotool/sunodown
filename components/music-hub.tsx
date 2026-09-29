'use client';

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Heart,
  ListMusic,
  LogIn,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MobileAppNav } from '@/components/mobile-app-nav';

type LibrarySong = {
  id: string;
  title: string;
  creator?: string | null;
  handle?: string | null;
  picture?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  duration?: number | null;
  tags?: string | null;
  createdAt?: string | null;
  isPublic?: boolean;
  sunoUrl: string;
  discoveredAt?: string;
};

type StoredLibrary = {
  handle: string;
  displayName?: string;
  avatarUrl?: string | null;
  syncedAt?: string;
  songs: LibrarySong[];
};

type SongStats = {
  playCount: number;
  completedCount: number;
  overHalfCount: number;
  totalListeningSeconds: number;
  lastPlayedAt?: number;
  lastPosition?: number;
};

type Playlist = {
  id: string;
  name: string;
  description?: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
};

type PlayerState = {
  queueIds: string[];
  queueIndex: number;
  repeatMode: 'off' | 'all' | 'one';
  shuffleOn: boolean;
  currentTime: number;
  currentSongId: string | null;
};

type AccountState = {
  version: 1;
  library: StoredLibrary | null;
  playlists: Playlist[];
  liked: string[];
  stats: Record<string, SongStats>;
  player: PlayerState;
  updatedAt: number;
};

type AuthUser = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

type MusicTab = 'listen' | 'new' | 'top' | 'playlists';

const fmt = (seconds = 0) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};

const dateLabel = (value?: string | null) => {
  if (!value) return 'Gần đây';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Gần đây';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const scoreStats = (stats?: SongStats) => {
  if (!stats) return 0;
  return (
    stats.completedCount * 5 +
    stats.overHalfCount * 3 +
    stats.playCount +
    Math.min(20, Math.floor(stats.totalListeningSeconds / 180))
  );
};

const shuffled = (ids: string[]) => {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index--) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
};

const audioProxy = (song?: LibrarySong | null) =>
  song?.id ? `/api/music/audio?id=${encodeURIComponent(song.id)}` : '';

const defaultStats = (): SongStats => ({
  playCount: 0,
  completedCount: 0,
  overHalfCount: 0,
  totalListeningSeconds: 0,
  lastPlayedAt: 0,
  lastPosition: 0,
});

export function MusicHub() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const halfCountedRef = useRef(false);
  const lastAccountSyncRef = useRef(0);
  const previousTimeRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<AccountState | null>(null);
  const [tab, setTab] = useState<MusicTab>('listen');
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistPickerSongId, setPlaylistPickerSongId] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const library = state?.library || null;
  const songs = library?.songs || [];
  const songMap = useMemo(
    () => new Map(songs.map((song) => [song.id, song])),
    [songs],
  );
  const player = state?.player;
  const currentSong =
    player?.currentSongId && songMap.has(player.currentSongId)
      ? songMap.get(player.currentSongId) || null
      : player && player.queueIndex >= 0
        ? songMap.get(player.queueIds[player.queueIndex]) || null
        : null;

  const newSongs = useMemo(
    () =>
      [...songs].sort((a, b) =>
        String(b.createdAt || b.discoveredAt || '').localeCompare(
          String(a.createdAt || a.discoveredAt || ''),
        ),
      ),
    [songs],
  );

  const topSongs = useMemo(
    () =>
      [...songs]
        .sort(
          (a, b) =>
            scoreStats(state?.stats[b.id]) - scoreStats(state?.stats[a.id]),
        )
        .slice(0, 20),
    [songs, state?.stats],
  );

  const recentSongs = useMemo(
    () =>
      [...songs]
        .filter((song) => state?.stats[song.id]?.lastPlayedAt)
        .sort(
          (a, b) =>
            (state?.stats[b.id]?.lastPlayedAt || 0) -
            (state?.stats[a.id]?.lastPlayedAt || 0),
        )
        .slice(0, 10),
    [songs, state?.stats],
  );

  const continueSong = useMemo(
    () =>
      [...songs]
        .filter((song) => (state?.stats[song.id]?.lastPosition || 0) > 8)
        .sort(
          (a, b) =>
            (state?.stats[b.id]?.lastPlayedAt || 0) -
            (state?.stats[a.id]?.lastPlayedAt || 0),
        )[0] || null,
    [songs, state?.stats],
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return songs.filter((song) =>
      `${song.title} ${song.creator || ''} ${song.tags || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [songs, query]);

  const activePlaylist = useMemo(
    () => state?.playlists.find((playlist) => playlist.id === activePlaylistId) || null,
    [state?.playlists, activePlaylistId],
  );

  const activePlaylistSongs = useMemo(
    () =>
      activePlaylist
        ? activePlaylist.songIds
            .map((id) => songMap.get(id))
            .filter((song): song is LibrarySong => Boolean(song))
        : [],
    [activePlaylist, songMap],
  );

  const patchAccount = async (patch: Record<string, unknown>) => {
    const response = await fetch('/api/music/state', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Không lưu được Music vào tài khoản.');
    }
    if (data.state) setState(data.state as AccountState);
    return data.state as AccountState;
  };

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/music/state', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;
        if (response.status === 401) {
          setUser(null);
          setState(null);
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || 'Không tải được SunoDown Music.');
        }
        setUser(data.user || null);
        setState(data.state || null);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Không tải được SunoDown Music.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateLocalPlayer = (change: Partial<PlayerState>) => {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        player: { ...current.player, ...change },
      };
    });
  };

  const persistPlayer = (change: Partial<PlayerState>) => {
    const current = state?.player;
    if (!current) return;
    const next = { ...current, ...change };
    updateLocalPlayer(change);
    void patchAccount({ player: next }).catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Không lưu được queue.'),
    );
  };

  const persistStats = (
    songId: string,
    update: (previous: SongStats) => SongStats,
  ) => {
    setState((current) => {
      if (!current) return current;
      const nextStats = {
        ...current.stats,
        [songId]: update(current.stats[songId] || defaultStats()),
      };
      void patchAccount({ stats: nextStats }).catch((error) =>
        setMessage(
          error instanceof Error
            ? error.message
            : 'Không lưu được lịch sử nghe.',
        ),
      );
      return { ...current, stats: nextStats };
    });
  };

  const setQueueAndPlay = (
    songId: string,
    sourceSongs: LibrarySong[] = songs,
    shouldShuffle = false,
  ) => {
    if (!state) return;
    const sourceIds = sourceSongs
      .filter((song) => song.isPublic !== false)
      .map((song) => song.id);
    if (!sourceIds.includes(songId)) sourceIds.unshift(songId);

    const queueIds = shouldShuffle
      ? [songId, ...shuffled(sourceIds.filter((id) => id !== songId))]
      : sourceIds;
    const queueIndex = Math.max(0, queueIds.indexOf(songId));
    const nextPlayer: PlayerState = {
      ...state.player,
      queueIds,
      queueIndex,
      currentSongId: songId,
      currentTime: state.stats[songId]?.lastPosition || 0,
      shuffleOn: shouldShuffle,
    };

    currentSongIdRef.current = songId;
    halfCountedRef.current = false;
    previousTimeRef.current = nextPlayer.currentTime;
    setState({ ...state, player: nextPlayer });
    void patchAccount({ player: nextPlayer });

    window.setTimeout(() => {
      const audio = audioRef.current;
      const song = songMap.get(songId);
      if (!audio || !song) return;
      audio.src = audioProxy(song);
      audio.load();
      const resume = state.stats[songId]?.lastPosition || 0;
      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (resume > 2 && resume < audio.duration - 5) {
            audio.currentTime = resume;
          }
          void audio.play().catch(() => {});
        },
        { once: true },
      );
    }, 0);

    persistStats(songId, (previous) => ({
      ...previous,
      playCount: previous.playCount + 1,
      lastPlayedAt: Date.now(),
    }));
  };

  const shuffleLibrary = () => {
    const playable = songs.filter((song) => song.isPublic !== false);
    if (!playable.length) {
      setMessage('Thư viện chưa có bài public để phát.');
      return;
    }
    const ids = shuffled(playable.map((song) => song.id));
    const first = ids[0];
    if (!first || !state) return;
    const nextPlayer: PlayerState = {
      ...state.player,
      queueIds: ids,
      queueIndex: 0,
      currentSongId: first,
      currentTime: 0,
      shuffleOn: true,
    };
    setState({ ...state, player: nextPlayer });
    void patchAccount({ player: nextPlayer });
    currentSongIdRef.current = first;
    halfCountedRef.current = false;
    previousTimeRef.current = 0;
    persistStats(first, (previous) => ({
      ...previous,
      playCount: previous.playCount + 1,
      lastPlayedAt: Date.now(),
    }));

    window.setTimeout(() => {
      const audio = audioRef.current;
      const song = songMap.get(first);
      if (!audio || !song) return;
      audio.src = audioProxy(song);
      audio.load();
      void audio.play().catch(() => {});
    }, 0);
  };

  const toggleLike = (songId: string) => {
    if (!state) return;
    const exists = state.liked.includes(songId);
    const liked = exists
      ? state.liked.filter((id) => id !== songId)
      : [songId, ...state.liked];
    setState({ ...state, liked });
    void patchAccount({ liked });
  };

  const createPlaylist = () => {
    if (!state) return;
    const name = newPlaylistName.trim();
    if (!name) return;
    const now = Date.now();
    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name: name.slice(0, 120),
      description: '',
      songIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const playlists = [playlist, ...state.playlists];
    setState({ ...state, playlists });
    setNewPlaylistName('');
    setNewPlaylistOpen(false);
    setActivePlaylistId(playlist.id);
    void patchAccount({ playlists });
  };

  const deletePlaylist = (playlistId: string) => {
    if (!state) return;
    const playlists = state.playlists.filter(
      (playlist) => playlist.id !== playlistId,
    );
    setState({ ...state, playlists });
    if (activePlaylistId === playlistId) setActivePlaylistId(null);
    void patchAccount({ playlists });
  };

  const addToPlaylist = (playlistId: string, songId: string) => {
    if (!state) return;
    const playlists = state.playlists.map((playlist) =>
      playlist.id === playlistId
        ? {
            ...playlist,
            songIds: playlist.songIds.includes(songId)
              ? playlist.songIds
              : [...playlist.songIds, songId],
            updatedAt: Date.now(),
          }
        : playlist,
    );
    setState({ ...state, playlists });
    setPlaylistPickerSongId(null);
    void patchAccount({ playlists });
  };

  const removeFromPlaylist = (playlistId: string, songId: string) => {
    if (!state) return;
    const playlists = state.playlists.map((playlist) =>
      playlist.id === playlistId
        ? {
            ...playlist,
            songIds: playlist.songIds.filter((id) => id !== songId),
            updatedAt: Date.now(),
          }
        : playlist,
    );
    setState({ ...state, playlists });
    void patchAccount({ playlists });
  };

  const playNext = (songId: string) => {
    if (!state) return;
    const queueIds = [...state.player.queueIds];
    const currentIndex = Math.max(-1, state.player.queueIndex);
    const without = queueIds.filter((id) => id !== songId);
    without.splice(currentIndex + 1, 0, songId);
    const player = { ...state.player, queueIds: without };
    setState({ ...state, player });
    void patchAccount({ player });
    setRowMenuId(null);
  };

  const nextTrack = () => {
    if (!state?.player.queueIds.length) return;
    const { queueIds, queueIndex, repeatMode } = state.player;
    if (repeatMode === 'one' && currentSong) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      }
      return;
    }
    let nextIndex = queueIndex + 1;
    if (nextIndex >= queueIds.length) {
      if (repeatMode !== 'all') {
        setPlaying(false);
        return;
      }
      nextIndex = 0;
    }
    const nextId = queueIds[nextIndex];
    const song = songMap.get(nextId);
    if (!song) return;
    const player = {
      ...state.player,
      queueIndex: nextIndex,
      currentSongId: nextId,
      currentTime: 0,
    };
    setState({ ...state, player });
    void patchAccount({ player });
    currentSongIdRef.current = nextId;
    halfCountedRef.current = false;
    previousTimeRef.current = 0;
    persistStats(nextId, (previous) => ({
      ...previous,
      playCount: previous.playCount + 1,
      lastPlayedAt: Date.now(),
      lastPosition: 0,
    }));
    const audio = audioRef.current;
    if (audio) {
      audio.src = audioProxy(song);
      audio.load();
      void audio.play().catch(() => {});
    }
  };

  const previousTrack = () => {
    if (!state?.player.queueIds.length) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    const index =
      state.player.queueIndex > 0
        ? state.player.queueIndex - 1
        : state.player.repeatMode === 'all'
          ? state.player.queueIds.length - 1
          : 0;
    const id = state.player.queueIds[index];
    const song = songMap.get(id);
    if (!song) return;
    const player = {
      ...state.player,
      queueIndex: index,
      currentSongId: id,
      currentTime: 0,
    };
    setState({ ...state, player });
    void patchAccount({ player });
    currentSongIdRef.current = id;
    halfCountedRef.current = false;
    previousTimeRef.current = 0;
    persistStats(id, (previous) => ({
      ...previous,
      playCount: previous.playCount + 1,
      lastPlayedAt: Date.now(),
      lastPosition: 0,
    }));
    if (audio) {
      audio.src = audioProxy(song);
      audio.load();
      void audio.play().catch(() => {});
    }
  };

  const cycleRepeat = () => {
    if (!state) return;
    const repeatMode =
      state.player.repeatMode === 'off'
        ? 'all'
        : state.player.repeatMode === 'all'
          ? 'one'
          : 'off';
    const player = { ...state.player, repeatMode };
    setState({ ...state, player });
    void patchAccount({ player });
  };

  useEffect(() => {
    if (!state || !currentSong) return;
    currentSongIdRef.current = currentSong.id;
    const audio = audioRef.current;
    if (!audio || audio.src) return;

    audio.src = audioProxy(currentSong);
    audio.load();
    const resume = state.player.currentTime || state.stats[currentSong.id]?.lastPosition || 0;
    audio.addEventListener(
      'loadedmetadata',
      () => {
        if (resume > 2 && resume < audio.duration - 5) {
          audio.currentTime = resume;
          setTime(resume);
        }
      },
      { once: true },
    );
  }, [state, currentSong]);

  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.creator || 'Suno',
      album: 'SunoDown Music',
      artwork: currentSong.picture
        ? [{ src: currentSong.picture, sizes: '512x512' }]
        : undefined,
    });

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        void audioRef.current?.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        const audio = audioRef.current;
        if (!audio || details.seekTime == null) return;
        audio.currentTime = details.seekTime;
      });
    } catch {}
  }, [currentSong, state?.player.queueIndex, state?.player.repeatMode]);

  const SongRow = ({
    song,
    index,
    sourceSongs,
    showRank = false,
    playlistId,
  }: {
    song: LibrarySong;
    index?: number;
    sourceSongs?: LibrarySong[];
    showRank?: boolean;
    playlistId?: string;
  }) => {
    const liked = state?.liked.includes(song.id) || false;
    const stat = state?.stats[song.id];
    const active = currentSong?.id === song.id;

    return (
      <div className={`sd-music-song-row ${active ? 'active' : ''}`}>
        {showRank ? (
          <span className="rank">{String((index || 0) + 1).padStart(2, '0')}</span>
        ) : null}
        <button
          className="cover"
          onClick={() => setQueueAndPlay(song.id, sourceSongs || songs)}
          aria-label={`Phát ${song.title}`}
        >
          {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
          <i><Play /></i>
        </button>
        <button
          className="song-copy"
          onClick={() => setQueueAndPlay(song.id, sourceSongs || songs)}
        >
          <b>{song.title}</b>
          <small>
            {song.creator || 'Suno'}
            {song.duration ? ` · ${fmt(song.duration)}` : ''}
          </small>
        </button>
        {showRank && (
          <span className="plays">
            {stat?.playCount || 0} lượt
          </span>
        )}
        <button
          className={`like ${liked ? 'active' : ''}`}
          onClick={() => toggleLike(song.id)}
          aria-label={liked ? 'Bỏ thích' : 'Yêu thích'}
        >
          <Heart />
        </button>
        <div className="row-menu">
          <button
            className="more"
            onClick={() => setRowMenuId(rowMenuId === song.id ? null : song.id)}
            aria-label="Thêm tùy chọn"
          >
            <MoreHorizontal />
          </button>
          {rowMenuId === song.id && (
            <div className="menu-pop">
              <button onClick={() => playNext(song.id)}>Phát tiếp theo</button>
              <button onClick={() => setPlaylistPickerSongId(song.id)}>
                Thêm vào playlist
              </button>
              <a href={song.handle ? `/music/@${song.handle}/${song.id}` : `/music/${song.id}`}>Trang bài hát</a>
              <a
                href={`/editor?source=${encodeURIComponent(
                  `https://suno.com/song/${song.id}`,
                )}`}
              >
                Tạo video
              </a>
              {playlistId && (
                <button onClick={() => removeFromPlaylist(playlistId, song.id)}>
                  Xóa khỏi playlist
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="sd-music-state">
        <Music2 />
        <b>Đang tải Music của tài khoản…</b>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="sd-music-state">
        <LogIn />
        <h1>SunoDown Music</h1>
        <p>
          Đăng nhập để playlist, Top 20, lịch sử nghe và vị trí phát được đồng bộ
          theo tài khoản trên mọi thiết bị.
        </p>
        <a href="/api/auth/google">Đăng nhập với Google</a>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="sd-music-state">
        <Music2 />
        <b>Music storage chưa sẵn sàng.</b>
        {message && <p>{message}</p>}
      </div>
    );
  }

  return (
    <div className={`sd-music-app ${currentSong ? 'has-player' : ''}`}>
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          setMessage('');
        }}
        onError={(event) => {
          setPlaying(false);
          const mediaError = event.currentTarget.error;
          const code = mediaError?.code || 0;
          setMessage(
            code
              ? `Không phát được audio của bài này (media error ${code}). Hãy thử lại hoặc Sync bài mới.`
              : 'Không phát được audio của bài này. Hãy thử lại.',
          );
        }}
        onPause={() => {
          setPlaying(false);
          if (!currentSong) return;
          const audio = audioRef.current;
          if (!audio) return;
          const finalTime = audio.currentTime || 0;
          persistStats(currentSong.id, (previous) => ({
            ...previous,
            lastPosition: finalTime,
          }));
          persistPlayer({
            currentTime: finalTime,
            currentSongId: currentSong.id,
          });
        }}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setDuration(
            Number.isFinite(audio.duration)
              ? audio.duration
              : currentSong?.duration || 0,
          );
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          const nextTime = audio.currentTime || 0;
          const delta = Math.max(
            0,
            Math.min(2, nextTime - previousTimeRef.current),
          );
          previousTimeRef.current = nextTime;
          setTime(nextTime);

          if (
            currentSong &&
            audio.duration > 0 &&
            !halfCountedRef.current &&
            nextTime / audio.duration >= 0.5
          ) {
            halfCountedRef.current = true;
            persistStats(currentSong.id, (previous) => ({
              ...previous,
              overHalfCount: previous.overHalfCount + 1,
            }));
          }

          const now = Date.now();
          if (currentSong && now - lastAccountSyncRef.current > 15_000) {
            lastAccountSyncRef.current = now;
            setState((current) => {
              if (!current) return current;
              const previous = current.stats[currentSong.id] || defaultStats();
              const stats = {
                ...current.stats,
                [currentSong.id]: {
                  ...previous,
                  totalListeningSeconds:
                    previous.totalListeningSeconds + delta,
                  lastPosition: nextTime,
                  lastPlayedAt: Date.now(),
                },
              };
              const player = {
                ...current.player,
                currentSongId: currentSong.id,
                currentTime: nextTime,
              };
              void patchAccount({ stats, player });
              return { ...current, stats, player };
            });
          }

          if ('mediaSession' in navigator && Number.isFinite(audio.duration)) {
            try {
              navigator.mediaSession.setPositionState({
                duration: audio.duration,
                playbackRate: audio.playbackRate,
                position: Math.min(audio.duration, nextTime),
              });
            } catch {}
          }
        }}
        onEnded={() => {
          if (currentSong) {
            persistStats(currentSong.id, (previous) => ({
              ...previous,
              completedCount: previous.completedCount + 1,
              lastPosition: 0,
            }));
          }
          nextTrack();
        }}
      />

      <aside className="sd-music-sidebar">
        <a className="brand" href="/">
          <span><Music2 /></span>
          <b>SunoDown</b>
        </a>
        <small>MUSIC</small>
        <button
          className={tab === 'listen' ? 'active' : ''}
          onClick={() => {
            setTab('listen');
            setActivePlaylistId(null);
          }}
        >
          <Sparkles /> Listen Now
        </button>
        <button
          className={tab === 'new' ? 'active' : ''}
          onClick={() => {
            setTab('new');
            setActivePlaylistId(null);
          }}
        >
          <Clock3 /> New Songs
        </button>
        <button
          className={tab === 'top' ? 'active' : ''}
          onClick={() => {
            setTab('top');
            setActivePlaylistId(null);
          }}
        >
          <ListMusic /> Top 20
        </button>
        <button
          className={tab === 'playlists' ? 'active' : ''}
          onClick={() => setTab('playlists')}
        >
          <Music2 /> Playlists
        </button>

        <div className="side-playlists">
          <button
            onClick={() => {
              setTab('playlists');
              setActivePlaylistId('__liked');
            }}
          >
            <Heart /> Liked Songs
          </button>
          {state.playlists.slice(0, 8).map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => {
                setTab('playlists');
                setActivePlaylistId(playlist.id);
              }}
            >
              <ListMusic /> {playlist.name}
            </button>
          ))}
        </div>

        <button
          className="new-playlist"
          onClick={() => setNewPlaylistOpen(true)}
        >
          <Plus /> New Playlist
        </button>
      </aside>

      <main className="sd-music-main">
        <header className="sd-music-topbar">
          <div className="search">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên bài, tác giả, style..."
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Xóa tìm kiếm">
                <X />
              </button>
            )}
          </div>
          <a className="profile" href="/">
            {user.picture ? <img src={user.picture} alt="" /> : <span>{user.name[0]}</span>}
            <b>{user.name}</b>
          </a>
        </header>

        {message && (
          <div className="sd-music-message">
            <span>{message}</span>
            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}

        {query ? (
          <section className="sd-music-section">
            <div className="section-head">
              <div>
                <small>SEARCH</small>
                <h1>Kết quả cho “{query}”</h1>
              </div>
              <span>{searchResults.length} bài</span>
            </div>
            <div className="song-list">
              {searchResults.length ? (
                searchResults.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    sourceSongs={searchResults}
                  />
                ))
              ) : (
                <p className="empty-copy">Không tìm thấy bài phù hợp.</p>
              )}
            </div>
          </section>
        ) : tab === 'listen' ? (
          <>
            <section className="sd-music-hero">
              <div>
                <small>LISTEN NOW</small>
                <h1>Nhạc của bạn,<br />sẵn sàng để nghe.</h1>
                <p>
                  {library
                    ? `@${library.handle} · ${songs.length} bài trong tài khoản`
                    : 'Quét tài khoản Suno để đưa nhạc vào đây.'}
                </p>
                <div className="hero-actions">
                  <button
                    className="primary"
                    onClick={shuffleLibrary}
                    disabled={!songs.length}
                  >
                    <Shuffle /> Shuffle My Library
                  </button>
                  <a href="/#library">
                    <Plus /> Thêm nhạc
                  </a>
                </div>
              </div>

              {continueSong ? (
                <button
                  className="continue-card"
                  onClick={() => setQueueAndPlay(continueSong.id)}
                >
                  {continueSong.picture ? (
                    <img src={continueSong.picture} alt="" />
                  ) : (
                    <span><Music2 /></span>
                  )}
                  <div>
                    <small>CONTINUE LISTENING</small>
                    <b>{continueSong.title}</b>
                    <p>{continueSong.creator || 'Suno'}</p>
                    <i>
                      <u
                        style={{
                          width: `${Math.min(
                            100,
                            ((state.stats[continueSong.id]?.lastPosition || 0) /
                              Math.max(1, continueSong.duration || 1)) *
                              100,
                          )}%`,
                        }}
                      />
                    </i>
                    <em>
                      {fmt(state.stats[continueSong.id]?.lastPosition || 0)}
                      {' / '}
                      {fmt(continueSong.duration || 0)}
                    </em>
                  </div>
                  <strong><Play /></strong>
                </button>
              ) : (
                <div className="continue-card empty">
                  <span><Music2 /></span>
                  <div>
                    <small>START LISTENING</small>
                    <b>Chưa có lịch sử nghe</b>
                    <p>Phát một bài để bắt đầu xây Music của bạn.</p>
                  </div>
                </div>
              )}
            </section>

            {!library && (
              <section className="sd-music-empty-library">
                <Music2 />
                <div>
                  <b>Chưa có thư viện nhạc trong tài khoản</b>
                  <p>
                    Vào Library, quét profile Suno một lần. Sau đó Music,
                    playlist và Top 20 sẽ dùng chung trên mọi thiết bị.
                  </p>
                </div>
                <a href="/">Mở Library</a>
              </section>
            )}

            {recentSongs.length > 0 && (
              <section className="sd-music-section">
                <div className="section-head">
                  <div>
                    <small>YOUR HISTORY</small>
                    <h2>Recently Played</h2>
                  </div>
                </div>
                <div className="music-card-row">
                  {recentSongs.map((song) => (
                    <button
                      key={song.id}
                      className="music-card"
                      onClick={() => setQueueAndPlay(song.id, recentSongs)}
                    >
                      <span>
                        {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
                        <i><Play /></i>
                      </span>
                      <b>{song.title}</b>
                      <small>{song.creator || 'Suno'}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {newSongs.length > 0 && (
              <section className="sd-music-section">
                <div className="section-head">
                  <div>
                    <small>JUST ADDED</small>
                    <h2>New Songs</h2>
                  </div>
                  <button onClick={() => setTab('new')}>Xem tất cả</button>
                </div>
                <div className="song-list">
                  {newSongs.slice(0, 6).map((song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      sourceSongs={newSongs}
                    />
                  ))}
                </div>
              </section>
            )}

            {topSongs.length > 0 && (
              <section className="sd-music-section">
                <div className="section-head">
                  <div>
                    <small>MOST PLAYED</small>
                    <h2>Your Top 20</h2>
                  </div>
                  <button onClick={() => setTab('top')}>Xem Top 20</button>
                </div>
                <div className="song-list">
                  {topSongs.slice(0, 5).map((song, index) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      index={index}
                      showRank
                      sourceSongs={topSongs}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : tab === 'new' ? (
          <section className="sd-music-section page-section">
            <div className="section-head">
              <div>
                <small>NEW MUSIC</small>
                <h1>Bài mới</h1>
                <p>Những bài mới nhất được đồng bộ vào tài khoản.</p>
              </div>
              <button
                className="shuffle-small"
                onClick={() =>
                  newSongs[0] &&
                  setQueueAndPlay(newSongs[0].id, newSongs, true)
                }
              >
                <Shuffle /> Shuffle
              </button>
            </div>
            <div className="song-list">
              {newSongs.map((song) => (
                <div key={song.id} className="dated-song">
                  <SongRow song={song} sourceSongs={newSongs} />
                  <time>{dateLabel(song.createdAt || song.discoveredAt)}</time>
                </div>
              ))}
            </div>
          </section>
        ) : tab === 'top' ? (
          <section className="sd-music-section page-section">
            <div className="section-head">
              <div>
                <small>YOUR LISTENING</small>
                <h1>Top 20</h1>
                <p>
                  Xếp theo lượt nghe hợp lệ, mức hoàn thành và tổng thời gian nghe.
                </p>
              </div>
            </div>
            <div className="song-list">
              {topSongs.map((song, index) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={index}
                  showRank
                  sourceSongs={topSongs}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="sd-music-section page-section">
            {activePlaylistId ? (
              <>
                <button
                  className="playlist-back"
                  onClick={() => setActivePlaylistId(null)}
                >
                  ‹ Playlists
                </button>
                {activePlaylistId === '__liked' ? (
                  <>
                    <div className="playlist-hero">
                      <div className="playlist-cover liked"><Heart /></div>
                      <div>
                        <small>PLAYLIST HỆ THỐNG</small>
                        <h1>Liked Songs</h1>
                        <p>{state.liked.length} bài yêu thích</p>
                        <button
                          onClick={() => {
                            const list = state.liked
                              .map((id) => songMap.get(id))
                              .filter((song): song is LibrarySong => Boolean(song));
                            if (list[0]) {
                              setQueueAndPlay(list[0].id, list, true);
                            }
                          }}
                        >
                          <Shuffle /> Shuffle
                        </button>
                      </div>
                    </div>
                    <div className="song-list">
                      {state.liked
                        .map((id) => songMap.get(id))
                        .filter((song): song is LibrarySong => Boolean(song))
                        .map((song) => (
                          <SongRow
                            key={song.id}
                            song={song}
                            sourceSongs={state.liked
                              .map((id) => songMap.get(id))
                              .filter((x): x is LibrarySong => Boolean(x))}
                          />
                        ))}
                    </div>
                  </>
                ) : activePlaylist ? (
                  <>
                    <div className="playlist-hero">
                      <div className="playlist-cover">
                        {activePlaylistSongs.slice(0, 4).map((song) =>
                          song.picture ? <img key={song.id} src={song.picture} alt="" /> : null,
                        )}
                        {!activePlaylistSongs.length && <ListMusic />}
                      </div>
                      <div>
                        <small>PLAYLIST</small>
                        <h1>{activePlaylist.name}</h1>
                        <p>{activePlaylistSongs.length} bài</p>
                        <div>
                          <button
                            onClick={() =>
                              activePlaylistSongs[0] &&
                              setQueueAndPlay(
                                activePlaylistSongs[0].id,
                                activePlaylistSongs,
                              )
                            }
                          >
                            <Play /> Play
                          </button>
                          <button
                            onClick={() =>
                              activePlaylistSongs[0] &&
                              setQueueAndPlay(
                                activePlaylistSongs[0].id,
                                activePlaylistSongs,
                                true,
                              )
                            }
                          >
                            <Shuffle /> Shuffle
                          </button>
                          <button
                            className="danger"
                            onClick={() => deletePlaylist(activePlaylist.id)}
                          >
                            <Trash2 /> Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="song-list">
                      {activePlaylistSongs.map((song) => (
                        <SongRow
                          key={song.id}
                          song={song}
                          sourceSongs={activePlaylistSongs}
                          playlistId={activePlaylist.id}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <div className="section-head">
                  <div>
                    <small>YOUR COLLECTIONS</small>
                    <h1>Playlists</h1>
                    <p>Tất cả playlist được đồng bộ theo tài khoản.</p>
                  </div>
                  <button
                    className="shuffle-small"
                    onClick={() => setNewPlaylistOpen(true)}
                  >
                    <Plus /> New Playlist
                  </button>
                </div>
                <div className="playlist-grid">
                  <button
                    className="playlist-card"
                    onClick={() => setActivePlaylistId('__liked')}
                  >
                    <span className="playlist-card-cover liked"><Heart /></span>
                    <b>Liked Songs</b>
                    <small>{state.liked.length} bài</small>
                  </button>
                  {state.playlists.map((playlist) => {
                    const preview = playlist.songIds
                      .map((id) => songMap.get(id))
                      .filter((song): song is LibrarySong => Boolean(song))
                      .slice(0, 4);
                    return (
                      <button
                        key={playlist.id}
                        className="playlist-card"
                        onClick={() => setActivePlaylistId(playlist.id)}
                      >
                        <span className="playlist-card-cover">
                          {preview.map((song) =>
                            song.picture ? (
                              <img key={song.id} src={song.picture} alt="" />
                            ) : null,
                          )}
                          {!preview.length && <ListMusic />}
                        </span>
                        <b>{playlist.name}</b>
                        <small>{playlist.songIds.length} bài</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {currentSong && (
        <div className="sd-music-player">
          <button
            className="track"
            onClick={() => setNowPlayingOpen(true)}
          >
            {currentSong.picture ? (
              <img src={currentSong.picture} alt="" />
            ) : (
              <span><Music2 /></span>
            )}
            <div>
              <b>{currentSong.title}</b>
              <small>{currentSong.creator || 'Suno'}</small>
            </div>
          </button>

          <div className="transport">
            <div>
              <button
                className={state.player.shuffleOn ? 'active' : ''}
                onClick={() =>
                  persistPlayer({ shuffleOn: !state.player.shuffleOn })
                }
                aria-label="Shuffle"
              >
                <Shuffle />
              </button>
              <button onClick={previousTrack} aria-label="Bài trước">
                <SkipBack />
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
              <button onClick={nextTrack} aria-label="Bài tiếp">
                <SkipForward />
              </button>
              <button
                className={state.player.repeatMode !== 'off' ? 'active' : ''}
                onClick={cycleRepeat}
                aria-label="Lặp"
              >
                {state.player.repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
              </button>
            </div>
            <label>
              <span>{fmt(time)}</span>
              <input
                type="range"
                min="0"
                max={Math.max(1, duration || currentSong.duration || 1)}
                step=".1"
                value={Math.min(
                  time,
                  Math.max(1, duration || currentSong.duration || 1),
                )}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (audioRef.current) audioRef.current.currentTime = next;
                  setTime(next);
                }}
              />
              <span>{fmt(duration || currentSong.duration || 0)}</span>
            </label>
          </div>

          <div className="player-tools">
            <button
              className={state.liked.includes(currentSong.id) ? 'active' : ''}
              onClick={() => toggleLike(currentSong.id)}
              aria-label="Yêu thích"
            >
              <Heart />
            </button>
            <button
              onClick={() => setQueueOpen(!queueOpen)}
              aria-label="Queue"
            >
              <ListMusic />
            </button>
            <button
              className="expand-player"
              onClick={() => setNowPlayingOpen(!nowPlayingOpen)}
              aria-label="Mở Now Playing"
            >
              {nowPlayingOpen ? <ChevronDown /> : <ChevronUp />}
            </button>
          </div>
        </div>
      )}

      {queueOpen && (
        <aside className="sd-music-queue">
          <header>
            <div>
              <small>NOW PLAYING</small>
              <b>Queue</b>
            </div>
            <button onClick={() => setQueueOpen(false)}><X /></button>
          </header>
          <div>
            {state.player.queueIds.map((id, index) => {
              const song = songMap.get(id);
              if (!song) return null;
              return (
                <button
                  key={`${id}-${index}`}
                  className={index === state.player.queueIndex ? 'active' : ''}
                  onClick={() => {
                    const player = {
                      ...state.player,
                      queueIndex: index,
                      currentSongId: id,
                      currentTime: 0,
                    };
                    setState({ ...state, player });
                    void patchAccount({ player });
                    if (audioRef.current) {
                      audioRef.current.src = audioProxy(song);
                      audioRef.current.load();
                      void audioRef.current.play().catch(() => {});
                    }
                  }}
                >
                  {song.picture ? <img src={song.picture} alt="" /> : <Music2 />}
                  <span>
                    <b>{song.title}</b>
                    <small>{song.creator || 'Suno'}</small>
                  </span>
                  <em>{index + 1}</em>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {nowPlayingOpen && currentSong && (
        <section className="sd-now-playing">
          <button className="close" onClick={() => setNowPlayingOpen(false)}>
            <ChevronDown />
          </button>
          <div className="now-art">
            {currentSong.picture ? (
              <img src={currentSong.picture} alt="" />
            ) : (
              <Music2 />
            )}
          </div>
          <div className="now-copy">
            <small>NOW PLAYING</small>
            <h1>{currentSong.title}</h1>
            <p>{currentSong.creator || 'Suno'}</p>
            {currentSong.tags && <em>{currentSong.tags}</em>}
            <div className="now-actions">
              <a href={currentSong.handle ? `/music/@${currentSong.handle}/${currentSong.id}` : `/music/${currentSong.id}`}>Trang bài hát</a>
              <a
                href={`/editor?source=${encodeURIComponent(
                  `https://suno.com/song/${currentSong.id}`,
                )}`}
              >
                Create Video
              </a>
            </div>
          </div>
        </section>
      )}

      {newPlaylistOpen && (
        <div className="sd-music-modal" onClick={() => setNewPlaylistOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <header>
              <b>Tạo playlist</b>
              <button onClick={() => setNewPlaylistOpen(false)}><X /></button>
            </header>
            <input
              autoFocus
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && createPlaylist()}
              placeholder="Tên playlist..."
            />
            <button className="primary" onClick={createPlaylist}>
              <Plus /> Tạo playlist
            </button>
          </div>
        </div>
      )}

      {playlistPickerSongId && (
        <div
          className="sd-music-modal"
          onClick={() => setPlaylistPickerSongId(null)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <header>
              <b>Thêm vào playlist</b>
              <button onClick={() => setPlaylistPickerSongId(null)}><X /></button>
            </header>
            <div className="playlist-picker">
              {state.playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() =>
                    addToPlaylist(playlist.id, playlistPickerSongId)
                  }
                >
                  <ListMusic />
                  <span>
                    <b>{playlist.name}</b>
                    <small>{playlist.songIds.length} bài</small>
                  </span>
                </button>
              ))}
              {!state.playlists.length && (
                <p>Chưa có playlist. Tạo playlist mới trước.</p>
              )}
            </div>
            <button
              onClick={() => {
                setPlaylistPickerSongId(null);
                setNewPlaylistOpen(true);
              }}
            >
              <Plus /> Tạo playlist mới
            </button>
          </div>
        </div>
      )}
      <MobileAppNav />
    </div>
  );
}
