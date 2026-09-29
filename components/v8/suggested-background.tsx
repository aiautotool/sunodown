'use client';
/* oxlint-disable next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import type { AddPexelsToTimeline } from './pexels-library';
import type { BackgroundConfig } from './background';
import {
  backgroundSearchQuery,
  rankBackgroundPhotos,
} from './pexels-suggestions';

type Props = {
  onAddToTimeline: AddPexelsToTimeline;
  songKey: string;
  text: string;
  aspect: string;
  background: BackgroundConfig;
  disabled: boolean;
  onChange: (value: BackgroundConfig) => void;
  onBrowse: () => void;
};

type Photo = {
  id: number;
  width: number;
  height: number;
  alt?: string;
  url: string;
  photographer?: { name: string };
  src?: {
    medium?: string;
    large?: string;
    large2x?: string;
    portrait?: string;
  };
  download: string;
};

export function SuggestedBackground(props: Props) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [credit, setCredit] = useState<{
    name: string;
    url: string;
    fingerprint: string;
  } | null>(null);

  const current = useRef(props);
  useEffect(() => {
    current.current = props;
  });

  async function addSelected() {
    const url = props.background.imageUrl;
    if (!url) return;
    setBusy(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Không đọc được ảnh đang chọn.');
      const blob = await response.blob();
      await props.onAddToTimeline(
        new File(
          [blob],
          `${props.background.imageFingerprint || 'Pexels'}.jpg`,
          { type: blob.type },
        ),
        'photo',
      );
      setStatus('');
    } catch {
      setStatus('Chưa thêm được ảnh vào timeline. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function applyPhoto(photo: Photo) {
    if (props.disabled || applyingId !== null) return;
    setApplyingId(photo.id);
    setStatus('');

    try {
      const source =
        photo.src?.large2x ||
        photo.src?.large ||
        photo.src?.portrait ||
        photo.download;
      const media = await fetch(source, { cache: 'no-store' });
      if (!media.ok) throw new Error('Chưa tải được ảnh nền.');
      const blob = await media.blob();
      if (!blob.size || !blob.type.startsWith('image/')) {
        throw new Error('Ảnh nền không hợp lệ.');
      }

      const url = URL.createObjectURL(blob);
      const fingerprint = `pexels-photo-${photo.id}`;

      // IMPORTANT: background only changes after an explicit user click.
      // Discovery itself never touches preview state.
      props.onChange({
        ...props.background,
        mode: 'image',
        imageUrl: url,
        imageFingerprint: fingerprint,
        videoUrl: undefined,
        videoFingerprint: undefined,
        dim: 20,
        positionX: 50,
        positionY: 50,
        zoom: 100,
      });

      setCredit({
        name: photo.photographer?.name || 'Pexels',
        url: photo.url,
        fingerprint,
      });
      setStatus('');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Chưa áp dụng được ảnh. Vui lòng thử lại.',
      );
    } finally {
      setApplyingId(null);
    }
  }

  useEffect(() => {
    const start = current.current;
    if (start.disabled) return;

    const controller = new AbortController();
    let disposed = false;

    const timer = window.setTimeout(async () => {
      setBusy(true);
      setStatus('');
      const timeout = window.setTimeout(() => controller.abort(), 30000);

      try {
        const query = backgroundSearchQuery(start.text);
        const params = new URLSearchParams({
          q: query,
          orientation: 'portrait',
          per_page: '18',
        });
        const response = await fetch(
          `https://pexels.aiautotool.com/v1/photos?${params}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(
            'Chưa tìm được ảnh gợi ý. Bạn có thể thử lại hoặc mở kho ảnh.',
          );
        }

        const data = await response.json();
        const ranked = rankBackgroundPhotos<Photo>(
          (data.results || []).filter(
            (photo: Photo) =>
              photo.width > 0 && photo.height > 0 && photo.download,
          ),
          start.aspect,
        ).slice(0, 8);

        if (!ranked.length) {
          throw new Error(
            'Chưa có ảnh phù hợp. Hãy mở kho ảnh để chọn theo ý bạn.',
          );
        }

        if (disposed || controller.signal.aborted) return;

        setPhotos(ranked);
        setStatus('');
      } catch (error) {
        if (!disposed) {
          setStatus(
            controller.signal.aborted
              ? 'Tìm ảnh gợi ý quá lâu. Hãy thử lại.'
              : error instanceof Error
                ? error.message
                : 'Không kết nối được Pexels.',
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) setBusy(false);
      }
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [props.songKey, props.aspect, attempt, props.disabled]);

  return (
    <section
      className="my-3 rounded-xl border border-sky-300/20 bg-sky-300/5 p-3"
      aria-label="Nền gợi ý Pexels"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <b className="text-sm">Ảnh nền gợi ý · Pexels</b>
          {status && (
            <p
              className="mt-1 text-xs text-rose-200/90"
              aria-live="polite"
            >
              {status}
            </p>
          )}
          {credit &&
            props.background.imageFingerprint === credit.fingerprint && (
              <a
                href={credit.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[10px] text-sky-200/75 underline"
              >
                {credit.name} · Pexels ↗
              </a>
            )}
        </div>

        <button
          type="button"
          disabled={props.disabled || busy}
          onClick={() => setAttempt((value) => value + 1)}
          className="shrink-0 rounded-lg bg-sky-300/15 px-3 py-2 text-xs disabled:opacity-50"
        >
          {busy ? 'Đang tìm…' : 'Gợi ý khác'}
        </button>
      </div>

      {photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-2">
          {photos.map((photo) => {
            const preview =
              photo.src?.medium ||
              photo.src?.portrait ||
              photo.src?.large ||
              photo.src?.large2x ||
              photo.download;
            const selected =
              props.background.imageFingerprint ===
              `pexels-photo-${photo.id}`;

            return (
              <article
                key={photo.id}
                className={`w-32 shrink-0 overflow-hidden rounded-xl border bg-black/25 ${
                  selected
                    ? 'border-sky-300/60'
                    : 'border-white/10'
                }`}
              >
                <button
                  type="button"
                  disabled={props.disabled || applyingId !== null}
                  onClick={() => void applyPhoto(photo)}
                  className="block w-full text-left disabled:opacity-60"
                  aria-label={`Dùng ảnh gợi ý ${photo.alt || photo.id}`}
                >
                  <img
                    src={preview}
                    alt={photo.alt || 'Ảnh nền gợi ý'}
                    loading="lazy"
                    className="h-36 w-full object-cover"
                  />
                  <span className="block px-2 py-2">
                    <b className="block text-[10px] text-white/90">
                      {selected
                        ? 'Đang dùng'
                        : applyingId === photo.id
                          ? 'Đang áp dụng…'
                          : 'Dùng ảnh này'}
                    </b>
                    <small className="mt-0.5 block truncate text-[9px] text-white/40">
                      {photo.photographer?.name || 'Pexels'}
                    </small>
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {props.background.mode === 'image' &&
          props.background.imageUrl && (
            <button
              type="button"
              disabled={props.disabled || busy}
              onClick={() => void addSelected()}
              className="rounded-lg bg-sky-300/15 px-3 py-2 text-xs disabled:opacity-50"
            >
              ＋ Thêm ảnh đang dùng vào timeline
            </button>
          )}
        <button
          type="button"
          disabled={props.disabled}
          onClick={props.onBrowse}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs"
        >
          Mở kho ảnh/video
        </button>
      </div>
    </section>
  );
}
