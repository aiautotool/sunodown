'use client';

import { ArrowRight, Headphones, Search, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';

function normalize(value: string) {
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

export function PublicMusicHome() {
  const [handle, setHandle] = useState('');

  const openProfile = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalize(handle);
    if (!normalized) return;
    window.location.href = `/music/@${encodeURIComponent(normalized)}`;
  };

  return (
    <div className="sd-public-music-home">
      <section className="hero">
        <span><Headphones /> SUNODOWN MUSIC</span>
        <h1>Nghe kho nhạc public theo từng creator Suno.</h1>
        <p>
          Mỗi creator có URL <b>/music/@username</b> riêng và mỗi bài hát có
          một trang SEO riêng để nghe, chia sẻ và tìm kiếm trên Google.
        </p>

        <form onSubmit={openProfile}>
          <Search />
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="@username hoặc URL profile Suno"
            aria-label="Username Suno"
          />
          <button type="submit">
            Mở kho nhạc <ArrowRight />
          </button>
        </form>

        <div className="actions">
          <a href="/music/me"><UserRound /> Music của tôi</a>
          <a href="/library">Quản lý thư viện</a>
        </div>
      </section>

      <section className="explain">
        <article>
          <b>/music/@username</b>
          <p>Kho nhạc public của creator, index được và chia sẻ trực tiếp.</p>
        </article>
        <article>
          <b>/music/@username/UUID</b>
          <p>Mỗi bài một URL, title/description/cover/structured data riêng.</p>
        </article>
        <article>
          <b>/music/me</b>
          <p>Playlist, Like, Top 20 và lịch sử nghe riêng theo tài khoản đăng nhập.</p>
        </article>
      </section>
    </div>
  );
}
