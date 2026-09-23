'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Minus, Plus, Video } from 'lucide-react';
import type { KaraokeLine } from '@/app/lib/karaoke';

export type MediaClip = {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  start: number;
  end: number;
};

type Props = {
  duration: number;
  picture?: string;
  playhead: number;
  onSeek: (time: number) => void;
  subtitles: KaraokeLine[];
  onSubtitlesChange: (lines: KaraokeLine[]) => void;
  clips: MediaClip[];
  onClipsChange: (clips: MediaClip[]) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const stamp = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export function EditorTimeline(props: Props) {
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const width = Math.max(900, props.duration * 18 * zoom);
  const px = width / Math.max(1, props.duration);

  const timeAt = (clientX: number) => {
    const box = scroller.current!.getBoundingClientRect();
    return clamp(
      (clientX - box.left + scroller.current!.scrollLeft) / px,
      0,
      props.duration,
    );
  };
  const drag = (
    event: React.PointerEvent,
    kind: 'subtitle' | 'clip',
    index: number,
    edge: 'move' | 'start' | 'end',
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const originX = event.clientX;
    const source =
      kind === 'subtitle' ? props.subtitles[index] : props.clips[index];
    const originStart = source.start,
      originEnd = source.end;
    const move = (e: PointerEvent) => {
      const delta = (e.clientX - originX) / px;
      let start = originStart,
        end = originEnd;
      if (edge === 'move') {
        const length = originEnd - originStart;
        start = clamp(originStart + delta, 0, props.duration - length);
        end = start + length;
      } else if (edge === 'start')
        start = clamp(originStart + delta, 0, end - 0.08);
      else end = clamp(originEnd + delta, start + 0.08, props.duration);
      if (kind === 'subtitle') {
        const next = props.subtitles.map((line, i) =>
          i === index
            ? {
                ...line,
                start,
                end,
                words: line.words.map((word) => {
                  const ratio =
                    (word.start - originStart) /
                    Math.max(0.01, originEnd - originStart);
                  const endRatio =
                    (word.end - originStart) /
                    Math.max(0.01, originEnd - originStart);
                  return {
                    ...word,
                    start: start + ratio * (end - start),
                    end: start + endRatio * (end - start),
                  };
                }),
              }
            : line,
        );
        props.onSubtitlesChange(next);
      } else
        props.onClipsChange(
          props.clips.map((clip, i) =>
            i === index ? { ...clip, start, end } : clip,
          ),
        );
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };
  const addMedia = (files: FileList | null, replaceId?: string) => {
    if (!files?.length) return;
    const added = Array.from(files).map((file, index) => {
      const existing = replaceId
        ? props.clips.find((clip) => clip.id === replaceId)
        : null;
      const start =
        existing?.start ??
        Math.min(props.duration - 0.1, props.playhead + index * 5);
      return {
        id: existing?.id || crypto.randomUUID(),
        type: file.type.startsWith('video/')
          ? ('video' as const)
          : ('image' as const),
        url: URL.createObjectURL(file),
        name: file.name,
        start,
        end: existing?.end ?? Math.min(props.duration, start + 5),
      };
    });
    props.onClipsChange(
      replaceId
        ? props.clips.map((clip) => (clip.id === replaceId ? added[0] : clip))
        : [...props.clips, ...added],
    );
    setSelected(added[0].id);
  };
  const ticks = Array.from(
    { length: Math.ceil(props.duration / Math.max(1, 10 / zoom)) + 1 },
    (_, i) => i * Math.max(1, 10 / zoom),
  );
  return (
    <section className="sd-edit-timeline">
      <header>
        <b>Timeline</b>
        <span>
          Kéo clip/subtitle để đổi thời điểm · kéo hai cạnh để co giãn
        </span>
        <label className="sd-add-media">
          <ImagePlus /> Thêm ảnh/video
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => addMedia(e.target.files)}
          />
        </label>
        <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          <Minus />
        </button>
        <small>{Math.round(zoom * 100)}%</small>
        <button onClick={() => setZoom((z) => Math.min(5, z + 0.25))}>
          <Plus />
        </button>
      </header>
      <div
        className="sd-timeline-scroll"
        ref={scroller}
        onPointerDown={(e) => props.onSeek(timeAt(e.clientX))}
      >
        <div className="sd-timeline-canvas" style={{ width }}>
          <div className="sd-time-ruler">
            {ticks.map((t) => (
              <i key={t} style={{ left: t * px }}>
                <span>{stamp(t)}</span>
              </i>
            ))}
          </div>
          <div className="sd-track sd-video-track">
            <em>
              <Video /> Video
            </em>
            {!props.clips.length && (
              <div className="sd-base-clip" style={{ left: 0, width }}>
                <span style={{ backgroundImage: `url(${props.picture})` }} />
                Ảnh bìa
              </div>
            )}
            {props.clips.map((clip, index) => (
              <div
                key={clip.id}
                className={`sd-timeline-clip ${selected === clip.id ? 'selected' : ''}`}
                style={{
                  left: clip.start * px,
                  width: Math.max(24, (clip.end - clip.start) * px),
                }}
                onPointerDown={(e) => {
                  setSelected(clip.id);
                  drag(e, 'clip', index, 'move');
                }}
              >
                <button
                  className="sd-edge left"
                  onPointerDown={(e) => drag(e, 'clip', index, 'start')}
                />
                <span
                  style={
                    clip.type === 'image'
                      ? { backgroundImage: `url(${clip.url})` }
                      : undefined
                  }
                >
                  {clip.type === 'video' && <Video />}
                </span>
                <b>{clip.name}</b>
                <button
                  className="sd-edge right"
                  onPointerDown={(e) => drag(e, 'clip', index, 'end')}
                />
                {selected === clip.id && (
                  <label className="sd-replace">
                    Thay thế
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => addMedia(e.target.files, clip.id)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
          <div className="sd-track sd-subtitle-track">
            <em>CC Subtitle</em>
            {props.subtitles.map((line, index) => (
              <div
                key={`${index}-${line.text}`}
                className={`sd-sub-clip ${selected === `sub-${index}` ? 'selected' : ''}`}
                style={{
                  left: line.start * px,
                  width: Math.max(20, (line.end - line.start) * px),
                }}
                title={`${stamp(line.start)} → ${stamp(line.end)}\n${line.text}`}
                onPointerDown={(e) => {
                  setSelected(`sub-${index}`);
                  drag(e, 'subtitle', index, 'move');
                }}
              >
                <button
                  className="sd-edge left"
                  onPointerDown={(e) => drag(e, 'subtitle', index, 'start')}
                />
                <span>{line.text}</span>
                <button
                  className="sd-edge right"
                  onPointerDown={(e) => drag(e, 'subtitle', index, 'end')}
                />
              </div>
            ))}
          </div>
          <div className="sd-playhead" style={{ left: props.playhead * px }}>
            <i />
          </div>
        </div>
      </div>
    </section>
  );
}
