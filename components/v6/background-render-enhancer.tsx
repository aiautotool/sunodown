'use client';
import { useEffect, useState } from 'react';
type ResolvedSong = {
  id?: string;
  title?: string;
  creator?: string;
  audio?: string;
  picture?: string;
  lyrics?: string;
  style?: string;
  tags?: string;
  duration?: number;
  url?: string;
};
const INSTALLATION_KEY = 'suno-installation-id';
function installationId() {
  let id = localStorage.getItem(INSTALLATION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(INSTALLATION_KEY, id);
  }
  return id;
}
function b64(s: string) {
  const p = '='.repeat((4 - (s.length % 4)) % 4),
    raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );
}
function displayJobError(value: unknown) {
  const message = String(value || 'Render thất bại.');
  if (message.includes('RATE_LIMITED') || message.includes('Too many requests'))
    return 'Vibes đang giới hạn lượt tạo video (429). Vui lòng thử lại sau vài phút.';
  if (message.includes('401 Client Error'))
    return 'Liên kết audio đã hết hạn. Vui lòng dán lại liên kết Suno và tạo job mới.';
  return escapeHtml(message.slice(0, 240));
}
export function V6BackgroundRenderEnhancer() {
  const [permission, setPermission] = useState<
      NotificationPermission | 'unsupported'
    >(() =>
      typeof Notification === 'undefined'
        ? 'unsupported'
        : Notification.permission,
    ),
    [job, setJob] = useState<any>(null),
    [song, setSong] = useState<ResolvedSong | null>(null),
    [aiAvailable, setAiAvailable] = useState(false),
    [visualizerAvailable, setVisualizerAvailable] = useState(false),
    [activityTick, setActivityTick] = useState(0);
  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js').catch(() => {});
    fetch('/api/render/capabilities', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: {
          aiMusicVideo?: boolean;
          backgroundVisualizer?: boolean;
        } | null) => {
          setAiAvailable(Boolean(d?.aiMusicVideo));
          setVisualizerAvailable(Boolean(d?.backgroundVisualizer));
        },
      )
      .catch(() => {});
    const onSong = (event: Event) =>
      setSong((event as CustomEvent<ResolvedSong>).detail);
    window.addEventListener('suno-song-resolved', onSong);
    const q = new URLSearchParams(location.search).get('renderJob');
    if (q)
      fetch(`/api/render/jobs/${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setJob(d))
        .catch(() => {});
    return () => window.removeEventListener('suno-song-resolved', onSong);
  }, []);
  useEffect(() => {
    if (!job || ['completed', 'failed'].includes(job.status)) return;
    const activity = setInterval(() => setActivityTick((tick) => tick + 1), 900);
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/render/jobs/${job.id}`, {
          cache: 'no-store',
        });
        if (r.ok) setJob(await r.json());
      } catch {}
    }, 3000);
    return () => {
      clearInterval(t);
      clearInterval(activity);
    };
  }, [job?.id, job?.status]);
  async function enableNotify() {
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setPermission('unsupported');
      return;
    }
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p !== 'granted') return;
    const keyRes = await fetch('/api/push/key'),
      { publicKey } = await keyRes.json();
    if (!keyRes.ok || !publicKey) {
      setPermission('unsupported');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64(publicKey),
      });
    const r = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: installationId(),
        subscription: sub.toJSON(),
      }),
    });
    if (!r.ok) throw new Error('Không lưu được đăng ký thông báo.');
  }
  async function startBackground(mode: 'visualizer' | 'ai_music_video') {
    const root = document.querySelector('article');
    if (!root) return;
    if (mode === 'ai_music_video' && (!song?.audio || !song?.lyrics))
      throw new Error('Bài hát cần có audio và lời để tạo AI Music Video.');
    const title =
      song?.title ||
      root.querySelector('h2')?.textContent?.trim() ||
      'Suno video';
    const selected = (needle: string) =>
      Array.from(root.querySelectorAll('button'))
        .find((b) => b.className.includes(needle))
        ?.textContent?.trim();
    const absolute = (value?: string) =>
      value ? new URL(value, location.origin).toString() : undefined;
    const payload = {
      installationId: installationId(),
      mode,
      title,
      preset: selected('border-emerald-300/50') || 'custom',
      template: selected('border-fuchsia-300/50') || 'Ảnh bìa chuyển động',
      aspect: selected('border-violet-300/50') || '9:16',
      wave: selected('border-cyan-300/50') || 'Bars',
      motion: selected('border-amber-300/50') || 'Vừa',
      lyricsMode: selected('border-pink-300/50') || 'Tắt',
      backgroundKey: document.documentElement.dataset.sunoBackground || 'suno',
      backgroundMode:
        document.documentElement.dataset.sunoBackgroundMode || 'suno',
      song: song
        ? {
            ...song,
            audio: absolute(song.audio),
            picture: absolute(song.picture),
          }
        : undefined,
      lyrics: song?.lyrics || '',
      style: song?.style || song?.tags || '',
      duration: Number(song?.duration) || 0,
      sceneSeconds: 5,
      maxUniqueScenes: 12,
      resolution: '720p',
    };
    const r = await fetch('/api/render/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      d = await r.json();
    if (!r.ok)
      throw new Error(d.error || 'Không tạo được tác vụ xuất video nền');
    setJob(d);
  }
  useEffect(() => {
    const button =
      document.querySelector<HTMLButtonElement>('[data-full-render-anchor]') ||
      (Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Xuất toàn bộ'),
      ) as HTMLButtonElement | undefined);
    if (!button) return;
    let box = document.getElementById('v6-background-render');
    if (!box) {
      box = document.createElement('div');
      box.id = 'v6-background-render';
      box.className =
        'mt-3 rounded-2xl border border-violet-300/20 bg-violet-300/[.06] p-4';
      button.closest('.grid')?.parentElement?.appendChild(box);
    }
    const mount = () => {
      const disabled = !song?.lyrics || !aiAvailable;
      box!.innerHTML = `<div><p class="text-sm font-bold text-violet-100">Xuất video trên server <span class="ml-1 rounded-md bg-fuchsia-300/10 px-1.5 py-0.5 text-[9px]">AI MV</span></p><p class="mt-1 text-xs leading-5 text-white/45">AI Music Video đọc lời bài hát, tạo từng cảnh rồi ghép với audio gốc. Đóng web vẫn tiếp tục.</p></div><div class="mt-3 grid gap-2 sm:grid-cols-2"><button data-ai-render ${disabled ? 'disabled' : ''} class="h-11 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">✨ Tạo AI Music Video</button><button data-bg-render ${visualizerAvailable ? '' : 'disabled'} class="h-11 rounded-xl border border-violet-300/20 bg-violet-500/15 font-bold text-violet-100 disabled:cursor-not-allowed disabled:opacity-40">☁️ ${visualizerAvailable ? 'Visualizer nền' : 'Visualizer chưa khả dụng'}</button><button data-notify class="h-10 rounded-xl border border-white/10 bg-white/[.05] text-xs font-bold sm:col-span-2">${permission === 'granted' ? '🔔 Đã cho phép thông báo' : '🔔 Bật thông báo khi xong'}</button></div>${!aiAvailable ? '<p class="mt-2 text-[10px] text-amber-200/70">AI renderer đang chờ cấu hình Vibes.</p>' : !song?.lyrics ? '<p class="mt-2 text-[10px] text-amber-200/70">Dán bài Suno có lyrics để bật AI Music Video.</p>' : ''}${job ? `<div class="mt-3 rounded-xl bg-black/20 p-3"><div class="flex items-center justify-between gap-3 text-xs"><span class="flex items-center gap-2"><i class="${['completed','failed'].includes(job.status) ? '' : 'animate-spin'} inline-block size-3 rounded-full border-2 border-violet-300/30 border-t-violet-300"></i><span>${job.status}</span><span class="text-white/35">${['completed','failed'].includes(job.status) ? '' : '· server đang xử lý'}</span></span><b>${job.progress || 0}%</b></div><div class="relative mt-2 h-2 overflow-hidden rounded-full bg-white/10"><i class="block h-full rounded-full bg-violet-400 transition-[width] duration-500" style="width:${job.progress || 0}%"></i>${['completed','failed'].includes(job.status) ? '' : `<i class="absolute inset-y-0 w-1/3 animate-pulse rounded-full bg-white/20" style="left:${(activityTick * 11) % 100 - 30}%"></i>`}</div>${!['completed','failed'].includes(job.status) ? `<div class="mt-2 flex items-center gap-1.5 text-[10px] text-violet-200/70"><span class="inline-flex gap-0.5"><i class="size-1 animate-bounce rounded-full bg-violet-300"></i><i class="size-1 animate-bounce rounded-full bg-violet-300 [animation-delay:120ms]"></i><i class="size-1 animate-bounce rounded-full bg-violet-300 [animation-delay:240ms]"></i></span><span>Vẫn đang chạy · cập nhật trạng thái mỗi 3 giây</span></div>` : ''}${job.resultUrl ? `<a class="mt-3 block text-xs font-bold text-cyan-300" href="${job.resultUrl}">▶ Xem video đã xuất</a>` : ''}${job.error ? `<p class="mt-2 break-words text-xs leading-5 text-red-300">${displayJobError(job.error)}</p>` : ''}<p class="mt-2 break-all text-[10px] text-white/35">Tác vụ: ${job.id}</p></div>` : ''}`;
      box!
        .querySelector('[data-ai-render]')
        ?.addEventListener('click', () =>
          startBackground('ai_music_video').catch((e) => alert(e.message)),
        );
      box!
        .querySelector('[data-bg-render]')
        ?.addEventListener('click', () =>
          startBackground('visualizer').catch((e) => alert(e.message)),
        );
      box!
        .querySelector('[data-notify]')
        ?.addEventListener('click', () =>
          enableNotify().catch((e) => alert(e.message)),
        );
    };
    mount();
  }, [permission, job, song, aiAvailable, visualizerAvailable, activityTick]);
  return null;
}
