'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Library, RefreshCw, Search, UserRound } from 'lucide-react';

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

const STORAGE_KEY = 'sunodown-v18-account-library';

const fmt = (seconds?: number | null) => {
  if (!seconds) return '';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

function normalizeHandle(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://suno.com/${raw.replace(/^@/, '')}`);
    return decodeURIComponent(url.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
  } catch {
    return raw.replace(/^@/, '');
  }
}

export function AccountLibraryPanel({ onOpenSong }: { onOpenSong: (url: string) => void }) {
  const [input, setInput] = useState('');
  const [library, setLibrary] = useState<StoredLibrary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as StoredLibrary | null;
      if (saved?.songs) {
        setLibrary(saved);
        setInput(saved.handle ? `@${saved.handle}` : '');
      }
    } catch {}
  }, []);

  const visibleSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!library?.songs) return [];
    if (!q) return library.songs;
    return library.songs.filter(song =>
      `${song.title} ${song.creator || ''} ${song.tags || ''}`.toLowerCase().includes(q),
    );
  }, [library, query]);

  async function sync() {
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
      if (!response.ok) throw new Error(data.error || 'Không thể đồng bộ profile.');

      const previous = library?.handle === data.handle ? library.songs : [];
      const oldIds = new Set(previous.map(song => song.id));
      const merged = new Map<string, LibrarySong>();
      for (const song of previous) merged.set(song.id, song);
      for (const song of data.songs as LibrarySong[]) {
        merged.set(song.id, {
          ...merged.get(song.id),
          ...song,
          discoveredAt: merged.get(song.id)?.discoveredAt || new Date().toISOString(),
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setLibrary(next);
      setInput(`@${data.handle}`);
      const added = (data.songs as LibrarySong[]).filter(song => !oldIds.has(song.id)).length;
      setMessage(`${added ? `+${added} bài mới · ` : ''}${songs.length} bài trong thư viện${data.truncated ? ' · còn có thể Sync tiếp' : ''}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đồng bộ profile.');
    } finally {
      setBusy(false);
    }
  }

  function clearLibrary() {
    localStorage.removeItem(STORAGE_KEY);
    setLibrary(null);
    setMessage('');
    setQuery('');
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ border: '1px solid rgba(148,163,184,.18)', borderRadius: 20, padding: 18, background: 'rgba(15,23,42,.38)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(139,92,246,.18)' }}><UserRound size={20}/></div>
          <div style={{ flex: 1 }}>
            <b style={{ display: 'block' }}>Kết nối thư viện Suno</b>
            <small style={{ opacity: .66 }}>Chỉ quét bài public. Không cần đăng nhập SunoDown hay lưu MP3/video.</small>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && void sync()}
            placeholder="@username hoặc https://suno.com/@username"
            style={{ flex: '1 1 300px', minWidth: 0, borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(148,163,184,.24)', background: 'rgba(2,6,23,.45)', color: 'inherit' }}
          />
          <button onClick={() => void sync()} disabled={busy} style={{ borderRadius: 12, padding: '11px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <RefreshCw size={16} className={busy ? 'spin' : ''}/>{busy ? 'Đang quét…' : library ? 'Sync bài mới' : 'Import'}
          </button>
        </div>
        {message && <p style={{ margin: '10px 0 0', fontSize: 13, opacity: .78 }}>{message}</p>}
      </div>

      {library && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              {library.avatarUrl ? <img src={library.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}/> : <Library size={22}/>}
              <div><b>{library.displayName || library.handle}</b><small style={{ display: 'block', opacity: .6 }}>@{library.handle} · {library.songs.length} bài public</small></div>
            </div>
            <button onClick={clearLibrary} style={{ opacity: .7 }}>Xóa thư viện local</button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(148,163,184,.16)', borderRadius: 12, padding: '10px 12px' }}>
            <Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm bài hát…" style={{ flex: 1, background: 'transparent', border: 0, color: 'inherit', outline: 'none' }}/>
          </label>

          <div className="sd-section-grid">
            {visibleSongs.map(song => (
              <div key={song.id} style={{ border: '1px solid rgba(148,163,184,.14)', borderRadius: 16, overflow: 'hidden', background: 'rgba(15,23,42,.24)' }}>
                {song.picture && <img src={song.picture} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }}/>}
                <div style={{ padding: 12, display: 'grid', gap: 7 }}>
                  <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</b>
                  <small style={{ opacity: .62 }}>{fmt(song.duration)}{song.tags ? ` · ${song.tags}` : ''}</small>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onOpenSong(song.sunoUrl)} style={{ flex: 1 }}>Mở Studio</button>
                    {song.audioUrl && <a href={song.audioUrl} download title="Tải audio" style={{ display: 'grid', placeItems: 'center', width: 38 }}><Download size={16}/></a>}
                    <a href={song.sunoUrl} target="_blank" rel="noreferrer" title="Mở Suno" style={{ display: 'grid', placeItems: 'center', width: 38 }}><ExternalLink size={16}/></a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
