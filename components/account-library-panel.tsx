'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Library,
  RefreshCw,
  Search,
  UserRound,
  X,
  Plus,
  LogIn,
} from 'lucide-react';

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

type AuthUser = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

const fmt = (seconds?: number | null) => {
  if (!seconds) return '';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

function normalizeHandle(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(
      raw.startsWith('http')
        ? raw
        : `https://suno.com/${raw.replace(/^@/, '')}`,
    );
    return decodeURIComponent(
      url.pathname.split('/').filter(Boolean)[0] || '',
    ).replace(/^@/, '');
  } catch {
    return raw.replace(/^@/, '');
  }
}

async function patchAccountMusicState(patch: Record<string, unknown>) {
  const response = await fetch('/api/music/state', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await response.json();
  if (response.status === 401) {
    throw new Error('Hãy đăng nhập SunoDown để lưu thư viện theo tài khoản.');
  }
  if (!response.ok) {
    throw new Error(data.error || 'Không thể lưu dữ liệu tài khoản.');
  }
  return data;
}

export function AccountLibraryPanel({
  onOpenSong,
}: {
  onOpenSong: (url: string) => void;
}) {
  const [input, setInput] = useState('');
  const [library, setLibrary] = useState<StoredLibrary | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/music/state', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;

        if (response.status === 401) {
          setUser(null);
          setLibrary(null);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || 'Không tải được thư viện tài khoản.');
        }

        setUser(data.user || null);
        const saved = (data.state?.library || null) as StoredLibrary | null;
        setLibrary(saved);
        if (saved?.handle) setInput(`@${saved.handle}`);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Không tải được thư viện tài khoản.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAccount(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!library?.songs) return [];
    if (!q) return library.songs;
    return library.songs.filter((song) =>
      `${song.title} ${song.creator || ''} ${song.tags || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [library, query]);

  async function sync() {
    if (!user) {
      setMessage('Hãy đăng nhập SunoDown trước khi quét thư viện.');
      return;
    }

    const handle = normalizeHandle(input);
    if (!handle) {
      setMessage('Nhập username hoặc URL profile Suno.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/suno/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle, maxPages: 30 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể đồng bộ profile.');
      }

      const previous = library?.handle === data.handle ? library.songs : [];
      const oldIds = new Set(previous.map((song) => song.id));
      const merged = new Map<string, LibrarySong>();

      for (const song of previous) merged.set(song.id, song);
      for (const song of data.songs as LibrarySong[]) {
        merged.set(song.id, {
          ...merged.get(song.id),
          ...song,
          discoveredAt:
            merged.get(song.id)?.discoveredAt || new Date().toISOString(),
        });
      }

      const songs = [...merged.values()].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      );

      const next: StoredLibrary = {
        handle: data.handle,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        syncedAt: data.syncedAt,
        songs,
      };

      await patchAccountMusicState({ library: next });

      setLibrary(next);
      setInput(`@${data.handle}`);
      const added = (data.songs as LibrarySong[]).filter(
        (song) => !oldIds.has(song.id),
      ).length;
      setMessage(
        `${added ? `+${added} bài mới · ` : ''}${songs.length} bài trong thư viện tài khoản${data.truncated ? ' · còn có thể Sync tiếp' : ''}.`,
      );
      setScanOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Không thể đồng bộ profile.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function clearLibrary() {
    if (!user) return;
    setBusy(true);
    try {
      await patchAccountMusicState({ library: null });
      setLibrary(null);
      setMessage('Đã xóa thư viện khỏi tài khoản.');
      setQuery('');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Không thể xóa thư viện.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loadingAccount) {
    return (
      <div style={{ padding: 26, opacity: 0.7 }}>
        Đang tải thư viện theo tài khoản…
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          border: '1px dashed rgba(148,163,184,.24)',
          borderRadius: 18,
          padding: 28,
          textAlign: 'center',
        }}
      >
        <LogIn size={30} style={{ margin: '0 auto 10px' }} />
        <b style={{ display: 'block', marginBottom: 6 }}>
          Đăng nhập để dùng thư viện Music
        </b>
        <small style={{ display: 'block', opacity: 0.64, marginBottom: 14 }}>
          Thư viện, playlist, lượt nghe và Top 20 được lưu theo tài khoản của bạn.
        </small>
        <a href="/api/auth/google">Đăng nhập với Google</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <b style={{ display: 'block', fontSize: 18 }}>Thư viện bài hát</b>
          <small style={{ opacity: 0.62 }}>
            {library
              ? `@${library.handle} · ${library.songs.length} bài · lưu theo ${user.email}`
              : `Chưa có thư viện · dữ liệu sẽ lưu theo ${user.email}`}
          </small>
        </div>
        <button
          onClick={() => setScanOpen(true)}
          style={{
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Plus size={16} /> Quét tài khoản Suno
        </button>
      </div>

      {message && (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.76 }}>{message}</p>
      )}

      {library ? (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: 1,
              }}
            >
              {library.avatarUrl ? (
                <img
                  src={library.avatarUrl}
                  alt=""
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <Library size={22} />
              )}
              <div>
                <b>{library.displayName || library.handle}</b>
                <small style={{ display: 'block', opacity: 0.6 }}>
                  @{library.handle} · {library.songs.length} bài
                  {library.syncedAt
                    ? ` · Sync ${new Date(library.syncedAt).toLocaleString()}`
                    : ''}
                </small>
              </div>
            </div>

            <a
              href={`/music/@${library.handle}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                textDecoration: 'none',
              }}
            >
              <Library size={15} />
              Trang Music public
            </a>
            <button
              onClick={() => void sync()}
              disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <RefreshCw size={15} />
              {busy ? 'Đang sync…' : 'Sync bài mới'}
            </button>
            <button
              onClick={() => void clearLibrary()}
              disabled={busy}
              style={{ opacity: 0.65 }}
            >
              Xóa thư viện
            </button>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(148,163,184,.16)',
              borderRadius: 12,
              padding: '10px 12px',
            }}
          >
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên bài, tác giả, style..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 0,
                color: 'inherit',
                outline: 'none',
              }}
            />
          </label>

          <div style={{ display: 'grid', gap: 6 }}>
            {visibleSongs.map((song) => (
              <button
                key={song.id}
                onClick={() => onOpenSong(song.sunoUrl)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,.10)',
                  background: 'rgba(15,23,42,.18)',
                  textAlign: 'left',
                }}
              >
                {song.picture ? (
                  <img
                    src={song.picture}
                    alt=""
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 8,
                      objectFit: 'cover',
                      flex: '0 0 auto',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(148,163,184,.10)',
                      flex: '0 0 auto',
                    }}
                  >
                    <Library size={17} />
                  </div>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {song.title}
                  </b>
                  <small style={{ opacity: 0.55 }}>
                    {song.creator || 'Suno'}
                    {song.duration ? ` · ${fmt(song.duration)}` : ''}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div
          style={{
            border: '1px dashed rgba(148,163,184,.24)',
            borderRadius: 18,
            padding: 28,
            textAlign: 'center',
            opacity: 0.82,
          }}
        >
          <Library size={30} style={{ margin: '0 auto 10px' }} />
          <b style={{ display: 'block', marginBottom: 6 }}>
            Chưa có bài hát trong thư viện
          </b>
          <small>Quét tài khoản Suno để đưa các bài public vào Music.</small>
        </div>
      )}

      {scanOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setScanOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(2,6,23,.72)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(560px,100%)',
              borderRadius: 22,
              border: '1px solid rgba(148,163,184,.18)',
              background: '#0f172a',
              padding: 20,
              boxShadow: '0 24px 70px rgba(0,0,0,.45)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(139,92,246,.18)',
                }}
              >
                <UserRound size={21} />
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ display: 'block', fontSize: 17 }}>
                  Quét tài khoản Suno
                </b>
                <small style={{ opacity: 0.64 }}>
                  Nhập @username hoặc URL profile. Chỉ quét bài public.
                </small>
              </div>
              <button
                onClick={() => !busy && setScanOpen(false)}
                aria-label="Đóng"
                style={{
                  width: 36,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void sync()}
              placeholder="@username hoặc https://suno.com/@username"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 12,
                padding: '12px 14px',
                border: '1px solid rgba(148,163,184,.24)',
                background: 'rgba(2,6,23,.55)',
                color: 'inherit',
                marginBottom: 12,
              }}
            />

            <button
              onClick={() => void sync()}
              disabled={busy}
              style={{
                width: '100%',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <RefreshCw size={16} />
              {busy
                ? 'Đang quét tài khoản…'
                : library
                  ? 'Quét và cập nhật thư viện'
                  : 'Quét bài hát'}
            </button>

            <p style={{ fontSize: 12, opacity: 0.58, margin: '12px 0 0' }}>
              Dữ liệu thư viện được lưu trong tài khoản SunoDown đang đăng nhập,
              không phụ thuộc thiết bị.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
